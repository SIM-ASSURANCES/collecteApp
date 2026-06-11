import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class DoublonWidget extends StatelessWidget {
  final Map<String, dynamic> cotisant;
  final VoidCallback onAutre, onRetour;
  const DoublonWidget({super.key, required this.cotisant, required this.onAutre, required this.onRetour});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: SimColors.background,
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 90, height: 90,
            decoration: const BoxDecoration(color: Color(0xFFFEF3C7), shape: BoxShape.circle),
            child: const Icon(Icons.warning_amber_rounded, color: SimColors.warning, size: 50),
          ),
          const SizedBox(height: 20),
          const Text('Paiement déjà enregistré',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Text('${cotisant['nom']} a déjà une cotisation enregistrée pour aujourd\'hui.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: SimColors.textSecondary, fontSize: 14)),
          const SizedBox(height: 40),
          ElevatedButton(onPressed: onAutre, child: const Text('Choisir un autre cotisant')),
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
