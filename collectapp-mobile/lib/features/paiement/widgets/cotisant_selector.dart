import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';

final _cotisantsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final dio  = ref.read(dioProvider);
  final resp = await dio.get('/souscripteurs');
  return (resp.data as List).map((c) => Map<String, dynamic>.from(c as Map)).toList();
});

class CotisantSelector extends ConsumerStatefulWidget {
  final ValueChanged<Map<String, dynamic>> onSelected;
  const CotisantSelector({super.key, required this.onSelected});

  @override
  ConsumerState<CotisantSelector> createState() => _CotisantSelectorState();
}

class _CotisantSelectorState extends ConsumerState<CotisantSelector> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_cotisantsProvider);

    return Scaffold(
      backgroundColor: SimColors.background,
      appBar: AppBar(
        title: const Text('Sélectionner un cotisant'),
        flexibleSpace: Container(decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]))),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            autofocus: true,
            onChanged: (v) => setState(() => _search = v),
            decoration: const InputDecoration(
              hintText: 'Nom ou téléphone…',
              prefixIcon: Icon(Icons.search, color: SimColors.textSecondary, size: 20),
            ),
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator(color: SimColors.blue)),
            error: (e, _) => Center(child: Text('Erreur : $e')),
            data: (cotisants) {
              final filtered = cotisants.where((c) {
                if (c['actif'] != true) return false;
                final nom = (c['nom'] as String).toLowerCase();
                final tel = c['telephone'] as String;
                return _search.isEmpty || nom.contains(_search.toLowerCase()) || tel.contains(_search);
              }).toList();

              if (filtered.isEmpty) {
                return const Center(child: Text('Aucun cotisant trouvé',
                    style: TextStyle(color: SimColors.textSecondary)));
              }

              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) {
                  final c       = filtered[i];
                  final init    = (c['nom'] as String).substring(0, 1).toUpperCase();
                  final montant = double.tryParse(c['montant_journalier'].toString()) ?? 0;
                  return GestureDetector(
                    onTap: () => widget.onSelected(c),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white, borderRadius: BorderRadius.circular(12),
                        boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.05), blurRadius: 5)],
                      ),
                      child: Row(children: [
                        CircleAvatar(
                            backgroundColor: SimColors.blue, radius: 20,
                            child: Text(init, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13))),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(c['nom'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          Text(c['telephone'] as String,
                              style: const TextStyle(color: SimColors.textSecondary, fontSize: 12, fontFamily: 'monospace')),
                        ])),
                        Text('${montant.toStringAsFixed(0)} F',
                            style: const TextStyle(fontWeight: FontWeight.w700, color: SimColors.blue, fontSize: 13)),
                        const SizedBox(width: 6),
                        const Icon(Icons.chevron_right, color: Color(0xFFD1D9E6), size: 18),
                      ]),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}
