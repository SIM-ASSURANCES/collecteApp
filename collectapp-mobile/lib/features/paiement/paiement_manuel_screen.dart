import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/storage/offline_queue.dart';
import '../../core/theme/app_theme.dart';
import '../ma_liste/ma_liste_screen.dart';
import 'widgets/cotisant_selector.dart';
import 'widgets/succes_widget.dart';
import 'widgets/doublon_widget.dart';

class PaiementManuelScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? cotisant;
  const PaiementManuelScreen({super.key, this.cotisant});

  @override
  ConsumerState<PaiementManuelScreen> createState() => _PaiementManuelScreenState();
}

class _PaiementManuelScreenState extends ConsumerState<PaiementManuelScreen> {
  Map<String, dynamic>? _cotisant;
  final _montantCtrl = TextEditingController();
  bool _loading  = false;
  bool _succes   = false;
  bool _doublon  = false;
  bool _offline  = false;
  bool _confirme = false; // étape 2

  @override
  void initState() {
    super.initState();
    if (widget.cotisant != null) {
      _cotisant = widget.cotisant;
      _montantCtrl.text = widget.cotisant!['montant_journalier'].toString();
    }
  }

  @override
  void dispose() {
    _montantCtrl.dispose();
    super.dispose();
  }

  Future<void> _valider() async {
    final montantNum = double.tryParse(_montantCtrl.text) ?? 0;
    if (montantNum <= 0 || _cotisant == null) return;

    setState(() => _loading = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/paiements', data: {
        'cotisant_id': _cotisant!['id'],
        'montant':     montantNum,
        'mode':        'especes',
        'statut':      'paye',
      });
      ref.invalidate(maListeProvider);
      setState(() { _succes = true; _loading = false; });
    } catch (e) {
      if (e.toString().contains('409')) {
        setState(() { _doublon = true; _loading = false; });
      } else {
        offlineQueue.add({
          'type':         'paiement_especes',
          'cotisant_id':  _cotisant!['id'],
          'cotisant_nom': _cotisant!['nom'],
          'montant':      montantNum,
          'mode':         'especes',
        });
        setState(() { _succes = true; _offline = true; _loading = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_succes) return SuccesWidget(
      cotisant: _cotisant!, mode: 'especes', offline: _offline,
      montant: double.tryParse(_montantCtrl.text),
      onNouveau: () => setState(() { _succes = false; _cotisant = null; _confirme = false; _offline = false; _montantCtrl.clear(); }),
      onRetour: () => context.go('/liste'),
    );

    if (_doublon) return DoublonWidget(
      cotisant: _cotisant!,
      onAutre:  () => setState(() { _doublon = false; _cotisant = null; _confirme = false; }),
      onRetour: () => context.go('/liste'),
    );

    if (_cotisant == null) {
      return CotisantSelector(onSelected: (c) {
        setState(() {
          _cotisant = c;
          _montantCtrl.text = c['montant_journalier'].toString();
        });
      });
    }

    final montantNum  = double.tryParse(_montantCtrl.text) ?? 0;
    final montantDef  = double.tryParse(_cotisant!['montant_journalier'].toString()) ?? 0;
    final estModifie  = montantNum != montantDef;

    // Étape confirmation
    if (_confirme) {
      return Scaffold(
        backgroundColor: SimColors.background,
        appBar: AppBar(
          title: const Text('Confirmer'),
          leading: BackButton(onPressed: () => setState(() => _confirme = false)),
          flexibleSpace: Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]))),
        ),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 8)]),
              child: Column(children: [
                _Row('Mode', 'Espèces', icon: Icons.payments, iconColor: SimColors.success),
                const Divider(height: 20),
                _Row('Cotisant', _cotisant!['nom'] as String),
                const SizedBox(height: 8),
                _Row('Téléphone', _cotisant!['telephone'] as String),
                const SizedBox(height: 8),
                _Row('Montant', '${montantNum.toStringAsFixed(0)} FCFA'),
                if (estModifie)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                      child: Row(children: [
                        const Icon(Icons.warning_amber, color: SimColors.warning, size: 14),
                        const SizedBox(width: 6),
                        Text('Défaut : ${montantDef.toStringAsFixed(0)} F',
                            style: const TextStyle(fontSize: 11, color: SimColors.warning)),
                      ]),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [SimColors.blue, SimColors.blueMid]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(children: [
                const Text('Total à encaisser', style: TextStyle(color: Colors.white70, fontSize: 12)),
                const SizedBox(height: 4),
                Text('${montantNum.toStringAsFixed(0)} FCFA',
                    style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700)),
              ]),
            ),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: _loading ? null : _valider,
              icon: _loading
                  ? const SizedBox(height: 18, width: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.check_circle_outline),
              label: Text(_loading ? 'Enregistrement…' : 'Valider l\'encaissement'),
            ),
          ]),
        ),
      );
    }

    // Étape saisie
    return Scaffold(
      backgroundColor: SimColors.background,
      appBar: AppBar(
        title: const Text('Paiement Espèces'),
        leading: BackButton(onPressed: () => setState(() => _cotisant = null)),
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]))),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Cotisant
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14),
                boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 6)]),
            child: Row(children: [
              CircleAvatar(backgroundColor: SimColors.success, radius: 22,
                  child: Text((_cotisant!['nom'] as String).substring(0, 1).toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_cotisant!['nom'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text(_cotisant!['telephone'] as String, style: const TextStyle(color: SimColors.textSecondary, fontSize: 12)),
              ])),
              Text('${montantDef.toStringAsFixed(0)} F',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: SimColors.blue, fontSize: 15)),
            ]),
          ),
          const SizedBox(height: 20),

          // Montant
          const Text('Montant à encaisser (FCFA)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: SimColors.textPrimary)),
          const SizedBox(height: 8),
          TextField(
            controller: _montantCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: SimColors.blue),
            decoration: const InputDecoration(suffixText: 'FCFA'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => setState(() => _montantCtrl.text = montantDef.toStringAsFixed(0)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: SimColors.blueTint, borderRadius: BorderRadius.circular(8)),
              child: Text('Utiliser le montant défaut : ${montantDef.toStringAsFixed(0)} F',
                  style: const TextStyle(fontSize: 12, color: SimColors.blue, fontWeight: FontWeight.w500)),
            ),
          ),
          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: montantNum > 0 ? () => setState(() => _confirme = true) : null,
            child: const Text('Continuer vers la confirmation'),
          ),
        ]),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label, value; final IconData? icon; final Color? iconColor;
  const _Row(this.label, this.value, {this.icon, this.iconColor});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(label, style: const TextStyle(color: SimColors.textSecondary, fontSize: 13)),
      Row(children: [
        if (icon != null) ...[Icon(icon, color: iconColor, size: 14), const SizedBox(width: 4)],
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      ]),
    ],
  );
}
