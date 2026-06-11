import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/ma_liste/ma_liste_screen.dart';
import '../../features/paiement/paiement_choix_screen.dart';
import '../../features/paiement/paiement_wave_screen.dart';
import '../../features/paiement/paiement_manuel_screen.dart';
import '../../features/reversement/reversement_screen.dart';
import '../../shared/widgets/main_scaffold.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isLoggedIn = authState.user != null;
      final isLoginPage = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoginPage) return '/login';
      if (isLoggedIn && isLoginPage) return '/liste';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (ctx, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (ctx, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: '/liste',
            pageBuilder: (ctx, state) => _fade(const MaListeScreen()),
          ),
          GoRoute(
            path: '/wave',
            pageBuilder: (ctx, state) {
              final cotisant = state.extra as Map<String, dynamic>?;
              return _fade(PaiementWaveScreen(cotisant: cotisant));
            },
          ),
          GoRoute(
            path: '/manuel',
            pageBuilder: (ctx, state) {
              final cotisant = state.extra as Map<String, dynamic>?;
              return _fade(PaiementManuelScreen(cotisant: cotisant));
            },
          ),
          GoRoute(
            path: '/reversement',
            pageBuilder: (ctx, state) => _fade(const ReversementScreen()),
          ),
        ],
      ),
      GoRoute(
        path: '/paiement',
        builder: (ctx, state) {
          final cotisant = state.extra as Map<String, dynamic>;
          return PaiementChoixScreen(cotisant: cotisant);
        },
      ),
    ],
  );
});

CustomTransitionPage<void> _fade(Widget child) => CustomTransitionPage(
      child: child,
      transitionsBuilder: (ctx, animation, _, c) =>
          FadeTransition(opacity: animation, child: c),
    );
