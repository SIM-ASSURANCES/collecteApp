import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class SuccesWidget extends StatelessWidget {
  final Map<String, dynamic> cotisant;
  final String mode;
  final bool offline;
  final double? montant;
  final VoidCallback onNouveau, onRetour;

  const SuccesWidget({
    super.key,
    required this.cotisant,
    required this.mode,
    required this.offline,
    required this.onNouveau,
    required this.onRetour,
    this.montant,
  });

  @override
  Widget build(BuildContext context) {
    final m = montant ?? double.tryParse(cotisant['montant_journalier'].toString()) ?? 0;
    return Scaffold(
      backgroundColor: SimColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              width: 90, height: 90,
              decoration: const BoxDecoration(color: Color(0xFFD1FAE5), shape: BoxShape.circle),
              child: const Icon(Icons.check_circle, color: SimColors.success, size: 50),
            ),
            const SizedBox(height: 20),
            const Text('Paiement enregistré !',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            if (offline) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(20)),
                child: const Text('Hors ligne — sera synchronisé à la reconnexion',
                    style: TextStyle(color: Color(0xFF92400E), fontSize: 11, fontWeight: FontWeight.w500)),
              ),
            ],
            const SizedBox(height: 12),
            Text(cotisant['nom'] as String,
                style: const TextStyle(color: SimColors.textSecondary, fontSize: 14)),
            const SizedBox(height: 6),
            Text('${m.toStringAsFixed(0)} FCFA',
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: SimColors.blue)),
            Text(mode == 'wave' ? 'Wave' : 'Espèces',
                style: const TextStyle(color: SimColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 40),
            ElevatedButton(onPressed: onNouveau, child: const Text('Nouveau paiement')),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetour,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                side: const BorderSide(color: SimColors.blue),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Retour à la liste'),
            ),
          ]),
        ),
      ),
    );
  }
}
