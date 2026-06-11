import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/storage/secure_storage.dart';

class AuthUser {
  final int id;
  final String nom;
  final String role;
  final String token;

  const AuthUser({required this.id, required this.nom, required this.role, required this.token});

  factory AuthUser.fromJson(Map<String, dynamic> json, String token) => AuthUser(
        id:    json['id'] as int,
        nom:   json['nom'] as String,
        role:  json['role'] as String,
        token: token,
      );
}

class AuthState {
  final AuthUser? user;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});

  AuthState copyWith({AuthUser? user, bool? isLoading, String? error}) =>
      AuthState(user: user ?? this.user, isLoading: isLoading ?? this.isLoading, error: error);
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._ref) : super(const AuthState()) {
    _init();
  }

  final Ref _ref;

  Future<void> _init() async {
    final storage = _ref.read(secureStorageProvider);
    final token   = await storage.getToken();
    final user    = await storage.getUser();
    if (token != null && user != null) {
      state = AuthState(user: AuthUser.fromJson(user, token));
    }
  }

  Future<void> login(String identifiant, String motDePasse) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final dio  = _ref.read(dioProvider);
      final resp = await dio.post('/auth/login', data: {
        'identifiant': identifiant,
        'mot_de_passe': motDePasse,
      });
      final token = resp.data['token'] as String;
      final user  = AuthUser.fromJson(resp.data['user'] as Map<String, dynamic>, token);
      final storage = _ref.read(secureStorageProvider);
      await storage.saveToken(token);
      await storage.saveUser({'id': user.id, 'nom': user.nom, 'role': user.role});
      state = AuthState(user: user);
    } catch (e) {
      final msg = _parseError(e);
      state = state.copyWith(isLoading: false, error: msg);
    }
  }

  Future<void> logout() async {
    try {
      final dio = _ref.read(dioProvider);
      await dio.post('/auth/logout');
    } catch (_) {}
    await _ref.read(secureStorageProvider).clear();
    state = const AuthState();
  }

  String _parseError(Object e) {
    if (e is Exception) {
      final msg = e.toString();
      if (msg.contains('400') || msg.contains('401')) return 'Identifiant ou mot de passe incorrect.';
      if (msg.contains('423')) return 'Compte bloqué. Réessayez dans 15 minutes.';
      if (msg.contains('SocketException') || msg.contains('Connection')) return 'Impossible de joindre le serveur.';
    }
    return 'Erreur de connexion. Vérifiez votre réseau.';
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref);
});
