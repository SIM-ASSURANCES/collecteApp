import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import 'auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey        = GlobalKey<FormState>();
  final _identCtrl      = TextEditingController();
  final _mdpCtrl        = TextEditingController();
  bool _obscure         = true;

  @override
  void dispose() {
    _identCtrl.dispose();
    _mdpCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authProvider.notifier).login(_identCtrl.text.trim(), _mdpCtrl.text);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: SimColors.blue,
      body: SafeArea(
        child: Column(
          children: [
            // ── En-tête bleu avec logo ──
            Expanded(
              flex: 2,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [SimColors.blue, SimColors.blueMid, SimColors.blueLight],
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Image.asset('assets/images/logo_sim.webp', height: 40),
                    const SizedBox(height: 16),
                    const Text(
                      'Collecte terrain',
                      style: TextStyle(color: Colors.white70, fontSize: 13, letterSpacing: 2),
                    ),
                  ],
                ),
              ),
            ),

            // ── Formulaire blanc ──
            Expanded(
              flex: 3,
              child: Container(
                decoration: const BoxDecoration(
                  color: SimColors.background,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Connexion',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                color: SimColors.blue, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('Accès réservé aux commerciaux terrain',
                          style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 28),

                      // Identifiant
                      TextFormField(
                        controller: _identCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Identifiant',
                          prefixIcon: Icon(Icons.person_outline, color: SimColors.textSecondary),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: (v) => (v == null || v.isEmpty) ? 'Identifiant requis' : null,
                      ),
                      const SizedBox(height: 16),

                      // Mot de passe
                      TextFormField(
                        controller: _mdpCtrl,
                        obscureText: _obscure,
                        decoration: InputDecoration(
                          labelText: 'Mot de passe',
                          prefixIcon: const Icon(Icons.lock_outline, color: SimColors.textSecondary),
                          suffixIcon: IconButton(
                            icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility,
                                color: SimColors.textSecondary),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        validator: (v) => (v == null || v.isEmpty) ? 'Mot de passe requis' : null,
                      ),
                      const SizedBox(height: 8),

                      // Erreur
                      if (auth.error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline, color: SimColors.error, size: 16),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(auth.error!,
                                      style: const TextStyle(color: SimColors.error, fontSize: 12)),
                                ),
                              ],
                            ),
                          ),
                        ),

                      const Spacer(),

                      // Bouton connexion
                      ElevatedButton(
                        onPressed: auth.isLoading ? null : _submit,
                        child: auth.isLoading
                            ? const SizedBox(
                                height: 20, width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Se connecter'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
