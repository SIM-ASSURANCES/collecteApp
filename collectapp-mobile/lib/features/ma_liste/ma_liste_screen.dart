import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

final maListeProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final dio = ref.read(dioProvider);
  final [listResp, paiementsResp] = await Future.wait([
    dio.get('/souscripteurs'),
    dio.get('/paiements/today'),
  ]);

  final paiements = (paiementsResp.data as List)
      .map((p) => p as Map<String, dynamic>)
      .toList();

  return (listResp.data as List).map((c) {
    final cotisant = Map<String, dynamic>.from(c as Map);
    final paiement = paiements.firstWhere(
      (p) => p['cotisant_id'] == cotisant['id'],
      orElse: () => {},
    );
    cotisant['paye_aujourd_hui'] = paiement.isNotEmpty;
    if (paiement.isNotEmpty) {
      cotisant['heure_paiement'] = paiement['horodatage'];
      cotisant['mode_paiement']  = paiement['mode'];
    }
    return cotisant;
  }).toList();
});

class MaListeScreen extends ConsumerStatefulWidget {
  const MaListeScreen({super.key});

  @override
  ConsumerState<MaListeScreen> createState() => _MaListeScreenState();
}

class _MaListeScreenState extends ConsumerState<MaListeScreen> {
  String _search = '';
  String _filtre = 'tous'; // tous | payes | impayes
  Timer? _autoRefresh;

  @override
  void initState() {
    super.initState();
    // Auto-refresh toutes les 10 secondes
    _autoRefresh = Timer.periodic(const Duration(seconds: 10), (_) {
      ref.invalidate(maListeProvider);
    });
  }

  @override
  void dispose() {
    _autoRefresh?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(maListeProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator(color: SimColors.blue)),
      error: (e, _) => Center(child: Text('Erreur : $e')),
      data: (cotisants) {
        final actifs   = cotisants.where((c) => c['actif'] == true).toList();
        final total    = actifs.length;
        final payes    = actifs.where((c) => c['paye_aujourd_hui'] == true).toList().length;
        final impayes  = total - payes;
        final pct      = total > 0 ? payes / total : 0.0;

        final filtered = actifs.where((c) {
          final nom = (c['nom'] as String).toLowerCase();
          final tel = c['telephone'] as String;
          final matchSearch = _search.isEmpty || nom.contains(_search.toLowerCase()) || tel.contains(_search);
          final matchFiltre = _filtre == 'tous'
              ? true
              : _filtre == 'payes'
                  ? c['paye_aujourd_hui'] == true
                  : c['paye_aujourd_hui'] != true;
          return matchSearch && matchFiltre;
        }).toList();

        return RefreshIndicator(
          color: SimColors.blue,
          onRefresh: () => ref.refresh(maListeProvider.future),
          child: CustomScrollView(
            slivers: [
              // Stats + barre de progression
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    _StatsRow(total: total, payes: payes, impayes: impayes),
                    const SizedBox(height: 12),
                    _ProgressBar(pct: pct, payes: payes, total: total),
                    const SizedBox(height: 12),
                    _SearchBar(onChanged: (v) => setState(() => _search = v)),
                    const SizedBox(height: 10),
                    _FiltreRow(filtre: _filtre, onChanged: (f) => setState(() => _filtre = f)),
                  ]),
                ),
              ),
              // Liste
              filtered.isEmpty
                  ? const SliverFillRemaining(
                      child: Center(child: Text('Aucun cotisant trouvé', style: TextStyle(color: SimColors.textSecondary))))
                  : SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) => _CotisantTile(
                            cotisant: filtered[i],
                            onTap: () => context.go('/paiement', extra: filtered[i]),
                          ),
                          childCount: filtered.length,
                        ),
                      ),
                    ),
              const SliverToBoxAdapter(child: SizedBox(height: 20)),
            ],
          ),
        );
      },
    );
  }
}

// ── Sous-widgets ─────────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  final int total, payes, impayes;
  const _StatsRow({required this.total, required this.payes, required this.impayes});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      _StatChip(label: 'Total',   val: total,   color: SimColors.blue,    bg: SimColors.blueTint),
      const SizedBox(width: 8),
      _StatChip(label: 'Payés',   val: payes,   color: SimColors.success, bg: const Color(0xFFD1FAE5)),
      const SizedBox(width: 8),
      _StatChip(label: 'Impayés', val: impayes, color: SimColors.error,   bg: const Color(0xFFFEE2E2)),
    ]);
  }
}

class _StatChip extends StatelessWidget {
  final String label; final int val; final Color color, bg;
  const _StatChip({required this.label, required this.val, required this.color, required this.bg});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Text('$val', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: color)),
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: color)),
      ]),
    ),
  );
}

class _ProgressBar extends StatelessWidget {
  final double pct; final int payes, total;
  const _ProgressBar({required this.pct, required this.payes, required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Progression du jour', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: SimColors.blue)),
          Text('${(pct * 100).round()}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: SimColors.blue)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 10,
            backgroundColor: const Color(0xFFEEF1F7),
            valueColor: const AlwaysStoppedAnimation<Color>(SimColors.blue),
          ),
        ),
      ]),
    );
  }
}

class _SearchBar extends StatelessWidget {
  final ValueChanged<String> onChanged;
  const _SearchBar({required this.onChanged});

  @override
  Widget build(BuildContext context) => TextField(
    onChanged: onChanged,
    decoration: const InputDecoration(
      hintText: 'Rechercher par nom ou téléphone…',
      prefixIcon: Icon(Icons.search, color: SimColors.textSecondary, size: 20),
      contentPadding: EdgeInsets.symmetric(vertical: 12),
    ),
  );
}

class _FiltreRow extends StatelessWidget {
  final String filtre; final ValueChanged<String> onChanged;
  const _FiltreRow({required this.filtre, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      for (final f in ['tous', 'impayes', 'payes'])
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: GestureDetector(
              onTap: () => onChanged(f),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: filtre == f ? SimColors.blue : Colors.white,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Text(
                  f == 'tous' ? 'Tous' : f == 'impayes' ? '⚠ Impayés' : '✓ Payés',
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: filtre == f ? Colors.white : SimColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        ),
    ]);
  }
}

class _CotisantTile extends StatelessWidget {
  final Map<String, dynamic> cotisant;
  final VoidCallback onTap;
  const _CotisantTile({required this.cotisant, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final paye    = cotisant['paye_aujourd_hui'] == true;
    final initiale = (cotisant['nom'] as String).substring(0, 1).toUpperCase();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Row(children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: paye ? SimColors.success : SimColors.error,
            child: Text(initiale, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(cotisant['nom'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              Text(cotisant['telephone'] as String, style: const TextStyle(color: SimColors.textSecondary, fontSize: 12, fontFamily: 'monospace')),
              if (paye && cotisant['heure_paiement'] != null)
                Text('✓ Payé · ${cotisant['mode_paiement']} · ${_dateHeure(cotisant['heure_paiement'])}',
                    style: const TextStyle(color: SimColors.success, fontSize: 11, fontWeight: FontWeight.w500)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(
              '${_fmt(cotisant['montant_journalier'])} F',
              style: const TextStyle(fontWeight: FontWeight.w700, color: SimColors.blue, fontSize: 13),
            ),
            const SizedBox(height: 4),
            Icon(paye ? Icons.check_circle : Icons.cancel,
                color: paye ? SimColors.success : SimColors.error, size: 20),
          ]),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, color: Color(0xFFD1D9E6), size: 18),
        ]),
      ),
    );
  }

  String _fmt(dynamic v) {
    final n = double.tryParse(v.toString()) ?? 0;
    return n.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]} ');
  }

  String _dateHeure(dynamic iso) {
    final dt = DateTime.tryParse(iso.toString())?.toLocal();
    if (dt == null) return '';
    final d = dt.day.toString().padLeft(2, '0');
    final mo = dt.month.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    return '$d/$mo à ${h}h$mi';
  }
}
