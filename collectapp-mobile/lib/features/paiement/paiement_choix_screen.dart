import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

class PaiementChoixScreen extends StatelessWidget {
  final Map<String, dynamic> cotisant;
  const PaiementChoixScreen({super.key, required this.cotisant});

  @override
  Widget build(BuildContext context) {
    final paye     = cotisant['paye_aujourd_hui'] == true;
    final montant  = double.tryParse(cotisant['montant_journalier'].toString()) ?? 0;
    final initiale = (cotisant['nom'] as String).substring(0, 1).toUpperCase();

    return Scaffold(
      backgroundColor: SimColors.background,
      appBar: AppBar(
        title: const Text('Paiement'),
        leading: BackButton(onPressed: () => context.go('/liste')),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
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
                backgroundImage: null,
                backgroundColor: SimColors.blue,
                child: Text(initiale, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 12),
              Text(cotisant['nom'] as String,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              Text(cotisant['telephone'] as String,
                  style: const TextStyle(color: SimColors.textSecondary, fontSize: 13)),
              const SizedBox(height: 12),
              Text(
                '${montant.toStringAsFixed(0)} FCFA',
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: SimColors.blue),
              ),
              const Text('Cotisation journalière', style: TextStyle(color: SimColors.textSecondary, fontSize: 12)),
            ]),
          ),

          const SizedBox(height: 24),

          if (paye) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFD1FAE5),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Row(children: [
                Icon(Icons.check_circle, color: SimColors.success),
                SizedBox(width: 10),
                Text('Déjà payé aujourd\'hui', style: TextStyle(color: SimColors.success, fontWeight: FontWeight.w600)),
              ]),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => context.go('/liste'),
              child: const Text('Retour à la liste'),
            ),
          ] else ...[
            const Text('Choisir le mode de paiement',
                style: TextStyle(fontWeight: FontWeight.w600, color: SimColors.textSecondary)),
            const SizedBox(height: 16),

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
        ]),
      ),
    );
  }
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
