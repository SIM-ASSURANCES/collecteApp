import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/storage/offline_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/anticipation.dart';
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
  bool _confirme = false;
  bool _isOnline = true;
  int  _nbperiodes = 1;

  double get _montantBase => double.tryParse(_cotisant?['montant_journalier']?.toString() ?? '0') ?? 0;

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

  void _handleAnticipation(int nb) {
    final newNb = _nbperiodes == nb ? 1 : nb;
    setState(() {
      _nbperiodes = newNb;
      _montantCtrl.text = (_montantBase * newNb).round().toString();
    });
  }

  Future<void> _valider() async {
    final montantNum = double.tryParse(_montantCtrl.text) ?? 0;
    if (montantNum <= 0 || _cotisant == null) return;

    // Mode hors ligne
    if (!_isOnline) {
      if (_nbperiodes > 1) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('La collecte anticipée nécessite une connexion internet.'),
          backgroundColor: SimColors.error,
        ));
        return;
      }
      offlineQueue.add({
        'type':         'paiement_especes',
        'cotisant_id':  _cotisant!['id'],
        'cotisant_nom': _cotisant!['nom'],
        'montant':      montantNum,
        'mode':         'especes',
      });
      setState(() { _succes = true; _offline = true; });
      return;
    }

    setState(() => _loading = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/paiements', data: {
        'cotisant_id': _cotisant!['id'],
        'montant':     montantNum,
        'mode':        'especes',
        'statut':      'paye',
        'nbjours':     _nbperiodes,
      });
      ref.invalidate(maListeProvider);
      setState(() { _succes = true; _loading = false; });
    } catch (e) {
      if (e.toString().contains('409')) {
        setState(() { _doublon = true; _loading = false; });
      } else {
        // Hors ligne détecté à la volée
        if (_nbperiodes > 1) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('Connexion perdue. La collecte anticipée ne peut pas être mise en file.'),
              backgroundColor: SimColors.error,
            ));
          }
          setState(() => _loading = false);
          return;
        }
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
    final frequence    = _cotisant?['frequence_collecte'] as String? ?? 'journalier';
    final options      = getAnticipationOptions(frequence);
    final periodeLabel = getPeriodeLabel(frequence);
    final montantNum   = double.tryParse(_montantCtrl.text) ?? 0;
    final montantAuto  = (_montantBase * _nbperiodes).roundToDouble();
    final estModifie   = montantNum != montantAuto && _cotisant != null;

    if (_succes) return SuccesWidget(
      cotisant: _cotisant!, mode: 'especes', offline: _offline,
      montant: montantNum,
      nbperiodes: _nbperiodes,
      periodeLabel: periodeLabel,
      onNouveau: () => setState(() {
        _succes = false; _cotisant = null; _confirme = false;
        _offline = false; _nbperiodes = 1; _montantCtrl.clear();
      }),
      onRetour: () => context.go('/liste'),
    );

    if (_doublon) return DoublonWidget(
      cotisant: _cotisant!,
      onAutre:  () => setState(() { _doublon = false; _cotisant = null; _confirme = false; _nbperiodes = 1; }),
      onRetour: () => context.go('/liste'),
    );

    if (_cotisant == null) {
      return CotisantSelector(onSelected: (c) {
        setState(() {
          _cotisant = c;
          _nbperiodes = 1;
          _montantCtrl.text = c['montant_journalier'].toString();
        });
      });
    }

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
                if (_nbperiodes > 1) ...[
                  const SizedBox(height: 4),
                  _Row('Périodes', '$_nbperiodes $periodeLabel${_nbperiodes > 1 ? "s" : ""}'),
                ],
                if (estModifie)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                      child: Row(children: [
                        const Icon(Icons.warning_amber, color: SimColors.warning, size: 14),
                        const SizedBox(width: 6),
                        Text('Attendu : ${montantAuto.toStringAsFixed(0)} F',
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
                if (_nbperiodes > 1)
                  Text('$_nbperiodes $periodeLabel${_nbperiodes > 1 ? "s" : ""}',
                      style: const TextStyle(color: Colors.white60, fontSize: 12)),
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
        leading: BackButton(onPressed: () => setState(() { _cotisant = null; _nbperiodes = 1; })),
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
              Text('${_montantBase.toStringAsFixed(0)} F',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: SimColors.blue, fontSize: 15)),
            ]),
          ),
          const SizedBox(height: 16),

          // Sélecteur d'anticipation
          if (options.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 6)]),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.calendar_today, color: SimColors.success, size: 14),
                  const SizedBox(width: 6),
                  const Text('Paiement anticipé', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: SimColors.success)),
                  if (_nbperiodes > 1) ...[
                    const Spacer(),
                    GestureDetector(
                      onTap: () => setState(() {
                        _nbperiodes = 1;
                        _montantCtrl.text = _montantBase.round().toString();
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(20)),
                        child: const Text('Annuler', style: TextStyle(fontSize: 10, color: SimColors.error, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ]),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: options.map((opt) {
                      final selected = _nbperiodes == opt.nbperiodes;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: GestureDetector(
                          onTap: () => _handleAnticipation(opt.nbperiodes),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: selected ? SimColors.success : const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(opt.label, style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600,
                              color: selected ? Colors.white : SimColors.success,
                            )),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                if (_nbperiodes > 1) ...[
                  const SizedBox(height: 8),
                  Text(
                    '${_montantBase.toStringAsFixed(0)} × $_nbperiodes $periodeLabel${_nbperiodes > 1 ? "s" : ""} = ${montantAuto.toStringAsFixed(0)} FCFA',
                    style: const TextStyle(fontSize: 11, color: SimColors.textSecondary),
                  ),
                ],
              ]),
            ),
            const SizedBox(height: 16),
          ],

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
            onTap: () => setState(() {
              _montantCtrl.text = montantAuto.toStringAsFixed(0);
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: SimColors.blueTint, borderRadius: BorderRadius.circular(8)),
              child: Text('Défaut : ${montantAuto.toStringAsFixed(0)} F',
                  style: const TextStyle(fontSize: 12, color: SimColors.blue, fontWeight: FontWeight.w500)),
            ),
          ),
          if (estModifie) ...[
            const SizedBox(height: 4),
            Text('⚠ Montant modifié (attendu : ${montantAuto.toStringAsFixed(0)} F)',
                style: const TextStyle(fontSize: 11, color: SimColors.warning)),
          ],
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
