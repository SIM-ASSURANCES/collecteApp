import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

final sommairePaiementsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final dio  = ref.read(dioProvider);
  final resp = await dio.get('/paiements/today/sommaire');
  return Map<String, dynamic>.from(resp.data as Map);
});

final reversementTodayProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  try {
    final dio  = ref.read(dioProvider);
    final resp = await dio.get('/reversements/today');
    return Map<String, dynamic>.from(resp.data as Map);
  } catch (_) { return null; }
});

class ReversementScreen extends ConsumerStatefulWidget {
  const ReversementScreen({super.key});

  @override
  ConsumerState<ReversementScreen> createState() => _ReversementScreenState();
}

class _ReversementScreenState extends ConsumerState<ReversementScreen> {
  final _ctrl     = TextEditingController();
  bool _confirme  = false;
  bool _soumis    = false;
  bool _loading   = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  Future<void> _soumettre(double montantAttendu) async {
    final declare = double.tryParse(_ctrl.text) ?? 0;
    if (declare <= 0) return;
    setState(() => _loading = true);
    try {
      final dio  = ref.read(dioProvider);
      final resp = await dio.post('/reversements', data: {
        'montant_declare': declare,
        'montant_attendu': montantAttendu,
      });
      setState(() { _result = Map<String, dynamic>.from(resp.data as Map); _soumis = true; _loading = false; });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erreur lors de la soumission')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final revToday = ref.watch(reversementTodayProvider);
    final sommaire = ref.watch(sommairePaiementsProvider);

    return Scaffold(
      backgroundColor: SimColors.background,
      appBar: AppBar(
        title: const Text('Reversement'),
        automaticallyImplyLeading: false,
        flexibleSpace: Container(decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]))),
      ),
      body: revToday.when(
        loading: () => const Center(child: CircularProgressIndicator(color: SimColors.blue)),
        error: (_, __) => const Center(child: Text('Erreur')),
        data: (existant) {
          if (existant != null) return _DejaSubmis(reversement: existant);
          if (_soumis && _result != null) return _SuccesReversement(result: _result!);

          return sommaire.when(
            loading: () => const Center(child: CircularProgressIndicator(color: SimColors.blue)),
            error: (_, __) => const Center(child: Text('Erreur chargement sommaire')),
            data: (s) {
              final attendu = (s['total_encaisse'] as num).toDouble();
              final declare = double.tryParse(_ctrl.text) ?? 0;
              final ecart   = declare - attendu;

              if (_confirme) return _EtapeConfirmation(
                attendu: attendu, declare: declare, ecart: ecart, loading: _loading,
                onModifier: () => setState(() => _confirme = false),
                onSoumettre: () => _soumettre(attendu),
              );

              return SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  // Sommaire journalier
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [SimColors.blue, SimColors.blueMid]),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(children: [
                      const Text('Paiements collectés aujourd\'hui',
                          style: TextStyle(color: Colors.white70, fontSize: 13)),
                      const SizedBox(height: 6),
                      Text('${attendu.toStringAsFixed(0)} FCFA',
                          style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700)),
                      Text('${s['nombre_paiements']} paiement(s)',
                          style: const TextStyle(color: Colors.white60, fontSize: 12)),
                    ]),
                  ),
                  const SizedBox(height: 20),

                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
                        boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 8)]),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Container(width: 38, height: 38,
                            decoration: BoxDecoration(color: SimColors.blueTint, borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.account_balance_wallet, color: SimColors.blue, size: 20)),
                        const SizedBox(width: 12),
                        const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Déclarer votre reversement', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          Text('Montant physique en votre possession', style: TextStyle(color: SimColors.textSecondary, fontSize: 11)),
                        ]),
                      ]),
                      const SizedBox(height: 20),

                      const Text('Montant à reverser (FCFA)',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _ctrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: SimColors.blue),
                        decoration: const InputDecoration(suffixText: 'FCFA'),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 10),
                      GestureDetector(
                        onTap: () => setState(() => _ctrl.text = attendu.toStringAsFixed(0)),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: SimColors.blueTint, borderRadius: BorderRadius.circular(8)),
                          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            const Icon(Icons.auto_fix_high, color: SimColors.blue, size: 14),
                            const SizedBox(width: 6),
                            Text('Utiliser montant attendu : ${attendu.toStringAsFixed(0)} F',
                                style: const TextStyle(fontSize: 12, color: SimColors.blue, fontWeight: FontWeight.w500)),
                          ]),
                        ),
                      ),
                      if (declare > 0 && attendu > 0) ...[
                        const SizedBox(height: 12),
                        _EcartBadge(ecart: ecart),
                      ],
                    ]),
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: declare > 0 ? () => setState(() => _confirme = true) : null,
                    child: const Text('Continuer vers la confirmation'),
                  ),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}

class _EtapeConfirmation extends StatelessWidget {
  final double attendu, declare, ecart;
  final bool loading;
  final VoidCallback onModifier, onSoumettre;
  const _EtapeConfirmation({required this.attendu, required this.declare, required this.ecart,
      required this.loading, required this.onModifier, required this.onSoumettre});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(20),
    child: Column(children: [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 8)]),
        child: Column(children: [
          Row(children: [
            Expanded(child: _AmountCard('Attendu', attendu, SimColors.blue, SimColors.blueTint)),
            const SizedBox(width: 10),
            Expanded(child: _AmountCard('Déclaré', declare, SimColors.success, const Color(0xFFF0FDF4))),
          ]),
          const SizedBox(height: 12),
          _EcartBadge(ecart: ecart),
        ]),
      ),
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [SimColors.blue, SimColors.blueMid]),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(children: [
          const Text('Montant à reverser', style: TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 4),
          Text('${declare.toStringAsFixed(0)} FCFA',
              style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700)),
        ]),
      ),
      const Spacer(),
      Row(children: [
        Expanded(child: OutlinedButton(
          onPressed: onModifier,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 52),
            side: const BorderSide(color: SimColors.blue),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Modifier'),
        )),
        const SizedBox(width: 12),
        Expanded(child: ElevatedButton(
          onPressed: loading ? null : onSoumettre,
          child: loading
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Text('Soumettre'),
        )),
      ]),
    ]),
  );
}

class _SuccesReversement extends StatelessWidget {
  final Map<String, dynamic> result;
  const _SuccesReversement({required this.result});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(width: 90, height: 90,
          decoration: const BoxDecoration(color: Color(0xFFD1FAE5), shape: BoxShape.circle),
          child: const Icon(Icons.check_circle, color: SimColors.success, size: 50)),
      const SizedBox(height: 20),
      const Text('Reversement soumis !', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      const Text('En attente de validation admin', style: TextStyle(color: SimColors.textSecondary)),
      const SizedBox(height: 24),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14),
            boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 8)]),
        child: Column(children: [
          Row(children: [
            Expanded(child: _AmountCard('Attendu', (result['montant_attendu'] as num).toDouble(), SimColors.blue, SimColors.blueTint)),
            const SizedBox(width: 10),
            Expanded(child: _AmountCard('Déclaré', (result['montant_declare'] as num).toDouble(), SimColors.success, const Color(0xFFF0FDF4))),
          ]),
          const SizedBox(height: 12),
          _EcartBadge(ecart: (result['ecart'] as num).toDouble()),
        ]),
      ),
    ]),
  );
}

class _DejaSubmis extends StatelessWidget {
  final Map<String, dynamic> reversement;
  const _DejaSubmis({required this.reversement});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(20),
    child: Column(children: [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 8)]),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Reversement du jour', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            _StatutBadge(statut: reversement['statut'] as String),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _AmountCard('Attendu', (reversement['montant_attendu'] as num).toDouble(), SimColors.blue, SimColors.blueTint)),
            const SizedBox(width: 10),
            Expanded(child: _AmountCard('Déclaré', (reversement['montant_declare'] as num).toDouble(), SimColors.success, const Color(0xFFF0FDF4))),
          ]),
          const SizedBox(height: 12),
          _EcartBadge(ecart: (reversement['ecart'] as num).toDouble()),
        ]),
      ),
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: SimColors.blueTint, borderRadius: BorderRadius.circular(12)),
        child: const Row(children: [
          Icon(Icons.access_time, color: SimColors.blue, size: 16),
          SizedBox(width: 8),
          Text('En attente de validation par l\'administrateur',
              style: TextStyle(color: SimColors.blue, fontSize: 13)),
        ]),
      ),
    ]),
  );
}

class _AmountCard extends StatelessWidget {
  final String label; final double val; final Color color, bg;
  const _AmountCard(this.label, this.val, this.color, this.bg);

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
    child: Column(children: [
      Text(label, style: TextStyle(fontSize: 11, color: color)),
      const SizedBox(height: 4),
      Text('${val.toStringAsFixed(0)} F', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
    ]),
  );
}

class _EcartBadge extends StatelessWidget {
  final double ecart;
  const _EcartBadge({required this.ecart});

  @override
  Widget build(BuildContext context) {
    final exact = ecart == 0;
    final excedent = ecart > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: exact ? const Color(0xFFF0FDF4) : excedent ? const Color(0xFFEFF6FF) : const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Row(children: [
          Icon(exact ? Icons.check_circle : excedent ? Icons.trending_up : Icons.trending_down,
              size: 16,
              color: exact ? SimColors.success : excedent ? Colors.blue : SimColors.error),
          const SizedBox(width: 6),
          Text(exact ? 'Montant exact' : excedent ? 'Excédent' : 'Déficit',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                  color: exact ? SimColors.success : excedent ? Colors.blue : SimColors.error)),
        ]),
        Text(exact ? '—' : '${ecart > 0 ? '+' : ''}${ecart.toStringAsFixed(0)} F',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12,
                color: exact ? SimColors.success : excedent ? Colors.blue : SimColors.error)),
      ]),
    );
  }
}

class _StatutBadge extends StatelessWidget {
  final String statut;
  const _StatutBadge({required this.statut});

  @override
  Widget build(BuildContext context) {
    final cfg = {
      'en_attente': ('En attente', const Color(0xFFFEF3C7), const Color(0xFF92400E)),
      'valide':     ('Validé ✓',   const Color(0xFFD1FAE5), const Color(0xFF065F46)),
      'rejete':     ('Rejeté',     const Color(0xFFFEE2E2), const Color(0xFF991B1B)),
    }[statut] ?? ('En attente', const Color(0xFFFEF3C7), const Color(0xFF92400E));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: cfg.$2, borderRadius: BorderRadius.circular(20)),
      child: Text(cfg.$1, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: cfg.$3)),
    );
  }
}
