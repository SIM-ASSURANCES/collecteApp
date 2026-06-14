import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

// PostgreSQL renvoie les decimals comme chaînes ("500.00") → parsing sûr
double _money(dynamic v) => double.tryParse(v?.toString() ?? '') ?? 0;

// Historique d'un cotisant (paiements + jours manqués)
final historiqueCotisantProvider =
    FutureProvider.family<Map<String, dynamic>, int>((ref, id) async {
  final dio  = ref.read(dioProvider);
  final resp = await dio.get('/cotisants/$id/historique');
  return Map<String, dynamic>.from(resp.data as Map);
});

class PaiementChoixScreen extends ConsumerWidget {
  final Map<String, dynamic> cotisant;
  const PaiementChoixScreen({super.key, required this.cotisant});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paye     = cotisant['paye_aujourd_hui'] == true;
    final montant  = double.tryParse(cotisant['montant_journalier'].toString()) ?? 0;
    final initiale = (cotisant['nom'] as String).substring(0, 1).toUpperCase();
    final id       = cotisant['id'] as int;
    final histo    = ref.watch(historiqueCotisantProvider(id));

    return Scaffold(
      backgroundColor: SimColors.background,
      appBar: AppBar(
        title: const Text('Détail cotisant'),
        leading: BackButton(onPressed: () => context.go('/liste')),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: SimColors.blue,
        onRefresh: () => ref.refresh(historiqueCotisantProvider(id).future),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Carte cotisant
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.08), blurRadius: 12)],
              ),
              child: Column(children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: paye ? SimColors.success : SimColors.blue,
                  child: Text(initiale, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 12),
                Text(cotisant['nom'] as String,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                Text(cotisant['telephone'] as String,
                    style: const TextStyle(color: SimColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 12),
                Text('${montant.toStringAsFixed(0)} FCFA',
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: SimColors.blue)),
                const Text('Cotisation journalière', style: TextStyle(color: SimColors.textSecondary, fontSize: 12)),
              ]),
            ),
            const SizedBox(height: 16),

            // Statistiques + historique (chargés depuis l'API)
            histo.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator(color: SimColors.blue)),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (h) => _HistoriqueSection(h: h),
            ),

            const SizedBox(height: 20),

            // Action de paiement
            if (paye) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(14)),
                child: const Row(children: [
                  Icon(Icons.check_circle, color: SimColors.success),
                  SizedBox(width: 10),
                  Text('Déjà payé aujourd\'hui', style: TextStyle(color: SimColors.success, fontWeight: FontWeight.w600)),
                ]),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/liste'),
                child: const Text('Retour à la liste'),
              ),
            ] else ...[
              const Text('Choisir le mode de paiement',
                  style: TextStyle(fontWeight: FontWeight.w600, color: SimColors.textSecondary)),
              const SizedBox(height: 12),
              _ModeCard(
                icon: Icons.smartphone,
                title: 'Paiement Wave',
                subtitle: 'Mobile Money · QR Code',
                badge: 'Recommandé',
                bg: SimColors.blueTint,
                iconColor: SimColors.blue,
                onTap: () => context.go('/wave', extra: cotisant),
              ),
              const SizedBox(height: 12),
              _ModeCard(
                icon: Icons.payments,
                title: 'Espèces',
                subtitle: 'Paiement manuel en cash',
                bg: const Color(0xFFF0FDF4),
                iconColor: SimColors.success,
                onTap: () => context.go('/manuel', extra: cotisant),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HistoriqueSection extends StatelessWidget {
  final Map<String, dynamic> h;
  const _HistoriqueSection({required this.h});

  @override
  Widget build(BuildContext context) {
    final paiements = (h['paiements'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final jours     = (h['jours_manques'] as List).map((e) => e.toString()).toList();
    final nbManques = h['nombre_jours_manques'] as int? ?? jours.length;
    final totalPaye = _money(h['total_paye']);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Bandeau stats
      Row(children: [
        Expanded(child: _StatBox(
          label: 'Paiements', valeur: '${paiements.length}',
          color: SimColors.success, bg: const Color(0xFFD1FAE5))),
        const SizedBox(width: 8),
        Expanded(child: _StatBox(
          label: 'Jours impayés', valeur: '$nbManques',
          color: SimColors.error, bg: const Color(0xFFFEE2E2))),
        const SizedBox(width: 8),
        Expanded(child: _StatBox(
          label: 'Total payé', valeur: '${totalPaye.toStringAsFixed(0)} F',
          color: SimColors.blue, bg: SimColors.blueTint)),
      ]),
      const SizedBox(height: 16),

      // Historique des paiements
      const Text('Historique des paiements',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      const SizedBox(height: 8),
      if (paiements.isEmpty)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child: const Text('Aucun paiement enregistré',
              style: TextStyle(color: SimColors.textSecondary, fontSize: 13)),
        )
      else
        ...paiements.take(15).map((p) => Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.05), blurRadius: 5)]),
          child: Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: p['mode'] == 'wave' ? SimColors.blueTint : const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(10)),
              child: Icon(p['mode'] == 'wave' ? Icons.smartphone : Icons.payments,
                  size: 18, color: p['mode'] == 'wave' ? SimColors.blue : SimColors.success),
            ),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_dateHeure(p['horodatage'] ?? p['date']),
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              Text('${p['mode']}'.toUpperCase(),
                  style: const TextStyle(color: SimColors.textSecondary, fontSize: 10)),
            ])),
            Text('${_money(p['montant']).toStringAsFixed(0)} F',
                style: const TextStyle(fontWeight: FontWeight.w700, color: SimColors.success, fontSize: 14)),
          ]),
        )),

      // Jours manqués
      if (jours.isNotEmpty) ...[
        const SizedBox(height: 16),
        Row(children: [
          const Icon(Icons.event_busy, color: SimColors.error, size: 16),
          const SizedBox(width: 6),
          Text('Jours impayés ($nbManques)',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: SimColors.error)),
        ]),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12)),
          child: Wrap(spacing: 6, runSpacing: 6, children: [
            for (final d in jours.take(60))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFCA5A5))),
                child: Text(_dateCourte(d),
                    style: const TextStyle(fontSize: 11, color: SimColors.error, fontWeight: FontWeight.w500)),
              ),
            if (jours.length > 60)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text('+${jours.length - 60} autres',
                    style: const TextStyle(fontSize: 11, color: SimColors.textSecondary)),
              ),
          ]),
        ),
      ],
    ]);
  }

  String _dateHeure(dynamic iso) {
    final dt = DateTime.tryParse(iso.toString())?.toLocal();
    if (dt == null) return iso.toString();
    final d = dt.day.toString().padLeft(2, '0');
    final mo = dt.month.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    return '$d/$mo/${dt.year} à ${h}h$mi';
  }

  String _dateCourte(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}';
  }
}

class _StatBox extends StatelessWidget {
  final String label, valeur;
  final Color color, bg;
  const _StatBox({required this.label, required this.valeur, required this.color, required this.bg});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
    child: Column(children: [
      Text(valeur, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
      const SizedBox(height: 2),
      Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w500),
          textAlign: TextAlign.center),
    ]),
  );
}

class _ModeCard extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final String? badge;
  final Color bg, iconColor;
  final VoidCallback onTap;
  const _ModeCard({required this.icon, required this.title, required this.subtitle,
      this.badge, required this.bg, required this.iconColor, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: bg, width: 2),
        boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 8)],
      ),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: iconColor, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          Text(subtitle, style: const TextStyle(color: SimColors.textSecondary, fontSize: 12)),
        ])),
        if (badge != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: SimColors.blueTint, borderRadius: BorderRadius.circular(8)),
            child: Text(badge!, style: const TextStyle(fontSize: 10, color: SimColors.blue, fontWeight: FontWeight.w600)),
          ),
        const SizedBox(width: 8),
        const Icon(Icons.chevron_right, color: Color(0xFFD1D9E6)),
      ]),
    ),
  );
}
