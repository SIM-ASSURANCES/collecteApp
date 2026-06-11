import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../features/auth/auth_provider.dart';
import '../widgets/network_badge.dart';

class MainScaffold extends ConsumerWidget {
  final Widget child;
  const MainScaffold({super.key, required this.child});

  int _locationToIndex(String location) {
    if (location.startsWith('/liste'))       return 0;
    if (location.startsWith('/wave'))        return 1;
    if (location.startsWith('/manuel'))      return 2;
    if (location.startsWith('/reversement')) return 3;
    return 0;
  }

  void _onTap(BuildContext context, int index) {
    const routes = ['/liste', '/wave', '/manuel', '/reversement'];
    context.go(routes[index]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user     = ref.watch(authProvider).user;
    final location = GoRouterState.of(context).matchedLocation;
    final idx      = _locationToIndex(location);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [SimColors.blue, SimColors.blueMid],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
          ),
        ),
        title: Row(
          children: [
            Image.asset('assets/images/logo_sim.webp', height: 28),
            const SizedBox(width: 10),
            const Text('Collecte terrain',
                style: TextStyle(color: SimColors.blueLight, fontSize: 12, letterSpacing: 0.5)),
          ],
        ),
        actions: [
          const NetworkBadge(),
          const SizedBox(width: 8),
          // Avatar
          GestureDetector(
            onTap: () => _showLogoutDialog(context, ref),
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              width: 32, height: 32,
              decoration: const BoxDecoration(
                color: SimColors.blueLight, shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                user?.nom.substring(0, 1).toUpperCase() ?? '?',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36),
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Commercial', style: TextStyle(color: SimColors.textSecondary, fontSize: 10)),
                  Text(user?.nom ?? '', style: const TextStyle(color: SimColors.blue, fontWeight: FontWeight.w600, fontSize: 13)),
                ]),
                Text(
                  _dateAujourdhui(),
                  style: const TextStyle(color: SimColors.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: idx,
        onTap: (i) => _onTap(context, i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.list_alt_outlined),     activeIcon: Icon(Icons.list_alt),     label: 'Ma liste'),
          BottomNavigationBarItem(icon: Icon(Icons.smartphone_outlined),   activeIcon: Icon(Icons.smartphone),   label: 'Wave'),
          BottomNavigationBarItem(icon: Icon(Icons.payments_outlined),     activeIcon: Icon(Icons.payments),     label: 'Manuel'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined), activeIcon: Icon(Icons.account_balance_wallet), label: 'Reversement'),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Voulez-vous vous déconnecter ?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await ref.read(authProvider.notifier).logout();
            },
            style: ElevatedButton.styleFrom(backgroundColor: SimColors.error),
            child: const Text('Déconnecter'),
          ),
        ],
      ),
    );
  }

  String _dateAujourdhui() {
    const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const mois  = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
    final now   = DateTime.now();
    return '${jours[now.weekday - 1]} ${now.day} ${mois[now.month - 1]} ${now.year}';
  }
}
