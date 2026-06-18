import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/storage/offline_queue.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/anticipation.dart';
import '../ma_liste/ma_liste_screen.dart';
import 'widgets/cotisant_selector.dart';
import 'widgets/succes_widget.dart';
import 'widgets/doublon_widget.dart';

class PaiementWaveScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? cotisant;
  const PaiementWaveScreen({super.key, this.cotisant});

  @override
  ConsumerState<PaiementWaveScreen> createState() => _PaiementWaveScreenState();
}

class _PaiementWaveScreenState extends ConsumerState<PaiementWaveScreen> {
  Map<String, dynamic>? _cotisant;
  bool _loading = false;
  bool _succes  = false;
  bool _doublon = false;
  bool _offline = false;
  int  _nbperiodes = 1;

  // Session Wave Checkout (QR réel)
  Map<String, dynamic>? _session;
  bool _sessionLoading = false;
  String? _sessionError;

  @override
  void initState() {
    super.initState();
    _cotisant = widget.cotisant;
    if (_cotisant != null) _creerSession();
  }

  Future<void> _creerSession() async {
    if (_cotisant == null) return;
    setState(() { _sessionLoading = true; _session = null; _sessionError = null; });
    try {
      final dio  = ref.read(dioProvider);
      final resp = await dio.post('/paiements/wave/session',
          data: {'cotisant_id': _cotisant!['id'], 'nbjours': _nbperiodes});
      if (!mounted) return;
      setState(() {
        _session = Map<String, dynamic>.from(resp.data as Map);
        _sessionLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sessionError = 'QR Wave indisponible — encaissez via le numéro';
        _sessionLoading = false;
      });
    }
  }

  Future<void> _confirmer() async {
    if (_cotisant == null) return;
    setState(() => _loading = true);
    final dio = ref.read(dioProvider);

    // Vérifier le statut Wave — bloquer si non confirmé
    if (_session != null) {
      try {
        final st = await dio.get('/paiements/wave/session/${_session!['id']}');
        if (st.data['payment_status'] != 'succeeded') {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('Wave n\'a pas encore confirmé ce paiement. Attendez que le client finalise.'),
              backgroundColor: SimColors.error,
            ));
          }
          setState(() => _loading = false);
          return;
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Wave injoignable. Vérifiez la connexion et réessayez.'),
            backgroundColor: SimColors.error,
          ));
        }
        setState(() => _loading = false);
        return;
      }
    }

    // Si pas de session et mode hors ligne, bloquer pour anticipation > 1
    if (_session == null && _nbperiodes > 1) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('La collecte anticipée nécessite une connexion internet.'),
          backgroundColor: SimColors.error,
        ));
      }
      setState(() => _loading = false);
      return;
    }

    try {
      await dio.post('/paiements', data: {
        'cotisant_id': _cotisant!['id'],
        'montant':     (double.tryParse(_cotisant!['montant_journalier'].toString()) ?? 0) * _nbperiodes,
        'mode':        'wave',
        'statut':      'paye',
        'nbjours':     _nbperiodes,
        if (_session != null) 'reference_wave': _session!['id'],
      });
      ref.invalidate(maListeProvider);
      setState(() { _succes = true; _loading = false; });
    } catch (e) {
      if (e.toString().contains('409')) {
        setState(() { _doublon = true; _loading = false; });
      } else {
        offlineQueue.add({
          'type':          'paiement_wave',
          'cotisant_id':   _cotisant!['id'],
          'cotisant_nom':  _cotisant!['nom'],
          'montant':       _cotisant!['montant_journalier'],
          'mode':          'wave',
        });
        setState(() { _succes = true; _offline = true; _loading = false; });
      }
    }
  }

  void _setNbperiodes(int nb) {
    setState(() {
      _nbperiodes = nb;
      _session = null;
      _sessionError = null;
    });
    _creerSession();
  }

  @override
  Widget build(BuildContext context) {
    final frequence = _cotisant?['frequence_collecte'] as String? ?? 'journalier';
    final options   = getAnticipationOptions(frequence);
    final periodeLabel = getPeriodeLabel(frequence);
    final montantBase  = double.tryParse(_cotisant?['montant_journalier']?.toString() ?? '0') ?? 0;
    final montantTotal = montantBase * _nbperiodes;

    if (_succes) return SuccesWidget(
      cotisant: _cotisant!, mode: 'wave', offline: _offline,
      montant: montantTotal,
      nbperiodes: _nbperiodes,
      periodeLabel: periodeLabel,
      onNouveau: () => setState(() { _succes = false; _cotisant = null; _offline = false; _nbperiodes = 1; }),
      onRetour:  () => context.go('/liste'),
    );
    if (_doublon) return DoublonWidget(
      cotisant: _cotisant!,
      onAutre:  () => setState(() { _doublon = false; _cotisant = null; _nbperiodes = 1; }),
      onRetour: () => context.go('/liste'),
    );

    // Sélection si pas de cotisant pré-sélectionné
    if (_cotisant == null) {
      return CotisantSelector(onSelected: (c) {
        setState(() { _cotisant = c; _nbperiodes = 1; });
        _creerSession();
      });
    }

    return Scaffold(
      backgroundColor: SimColors.background,
      appBar: AppBar(
        title: const Text('Paiement Wave'),
        leading: BackButton(onPressed: () => setState(() { _cotisant = null; _nbperiodes = 1; })),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [SimColors.blue, SimColors.blueMid]),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          // Infos cotisant
          _CotisantBand(cotisant: _cotisant!, montantTotal: montantTotal, nbperiodes: _nbperiodes),
          const SizedBox(height: 16),

          // Sélecteur d'anticipation
          if (options.isNotEmpty)
            _AnticipationCard(
              options: options,
              nbperiodes: _nbperiodes,
              montantBase: montantBase,
              periodeLabel: periodeLabel,
              onSelect: _setNbperiodes,
            ),
          const SizedBox(height: 16),

          // Zone QR
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.08), blurRadius: 12)],
            ),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.smartphone, color: SimColors.blue, size: 20),
                const SizedBox(width: 8),
                const Text('Paiement Wave', style: TextStyle(fontWeight: FontWeight.w700, color: SimColors.blue)),
              ]),
              const SizedBox(height: 20),
              if (_sessionLoading)
                const SizedBox(
                  width: 180, height: 180,
                  child: Center(child: CircularProgressIndicator(color: SimColors.blue)),
                )
              else if (_session != null)
                Container(
                  width: 196, height: 196,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    border: Border.all(color: SimColors.blue, width: 4),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: QrImageView(
                    data: _session!['wave_launch_url'] as String,
                    version: QrVersions.auto,
                    backgroundColor: Colors.white,
                  ),
                )
              else ...[
                Container(
                  width: 180, height: 180,
                  decoration: BoxDecoration(
                    border: Border.all(color: SimColors.blue, width: 4),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: CustomPaint(painter: _QrPainter()),
                ),
                if (_sessionError != null) ...[
                  const SizedBox(height: 8),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.info_outline, color: SimColors.warning, size: 14),
                    const SizedBox(width: 4),
                    Flexible(child: Text(_sessionError!,
                        style: const TextStyle(color: SimColors.warning, fontSize: 11))),
                  ]),
                  TextButton.icon(
                    onPressed: _creerSession,
                    icon: const Icon(Icons.refresh, size: 14),
                    label: const Text('Réessayer', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ],
              const SizedBox(height: 16),
              const Text('Numéro Wave du client',
                  style: TextStyle(color: SimColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 4),
              Text(
                _cotisant!['telephone'] as String,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700,
                    color: SimColors.blue, letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              Text('Montant : ${montantTotal.toStringAsFixed(0)} FCFA',
                  style: const TextStyle(color: SimColors.textSecondary, fontSize: 13)),
            ]),
          ),

          const SizedBox(height: 20),

          ElevatedButton.icon(
            onPressed: _loading ? null : _confirmer,
            icon: _loading
                ? const SizedBox(height: 18, width: 18,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.check_circle_outline),
            label: Text(_loading ? 'Enregistrement…' : 'Confirmer le paiement Wave'),
          ),
          const SizedBox(height: 10),
          const Text(
            'Appuyez après que le client a effectué le paiement',
            style: TextStyle(color: SimColors.textSecondary, fontSize: 11),
            textAlign: TextAlign.center,
          ),
        ]),
      ),
    );
  }
}

// ── Widgets ──────────────────────────────────────────────────────────────────

class _CotisantBand extends StatelessWidget {
  final Map<String, dynamic> cotisant;
  final double montantTotal;
  final int nbperiodes;
  const _CotisantBand({required this.cotisant, required this.montantTotal, required this.nbperiodes});

  @override
  Widget build(BuildContext context) {
    final initiale = (cotisant['nom'] as String).substring(0, 1).toUpperCase();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 6)],
      ),
      child: Row(children: [
        CircleAvatar(backgroundColor: SimColors.blue, radius: 22,
            child: Text(initiale, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(cotisant['nom'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          Text(cotisant['telephone'] as String,
              style: const TextStyle(color: SimColors.textSecondary, fontSize: 12, fontFamily: 'monospace')),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${montantTotal.toStringAsFixed(0)} F',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: SimColors.blue)),
          if (nbperiodes > 1)
            Text('× $nbperiodes pér.',
                style: const TextStyle(fontSize: 10, color: SimColors.textSecondary)),
        ]),
      ]),
    );
  }
}

class _AnticipationCard extends StatelessWidget {
  final List<AnticipationOption> options;
  final int nbperiodes;
  final double montantBase;
  final String periodeLabel;
  final ValueChanged<int> onSelect;
  const _AnticipationCard({
    required this.options, required this.nbperiodes,
    required this.montantBase, required this.periodeLabel, required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: SimColors.blue.withValues(alpha: 0.06), blurRadius: 6)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.calendar_today, color: SimColors.blue, size: 14),
          const SizedBox(width: 6),
          const Text('Paiement anticipé', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: SimColors.blue)),
          if (nbperiodes > 1) ...[
            const Spacer(),
            GestureDetector(
              onTap: () => onSelect(1),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(20)),
                child: const Text('Annuler', style: TextStyle(fontSize: 10, color: SimColors.error, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ]),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: options.map((opt) {
              final selected = nbperiodes == opt.nbperiodes;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GestureDetector(
                  onTap: () => onSelect(selected ? 1 : opt.nbperiodes),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: selected ? SimColors.blue : SimColors.blueTint,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(opt.label, style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600,
                      color: selected ? Colors.white : SimColors.blue,
                    )),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        if (nbperiodes > 1) ...[
          const SizedBox(height: 8),
          Text(
            '${montantBase.toStringAsFixed(0)} × $nbperiodes ${periodeLabel}s = ${(montantBase * nbperiodes).toStringAsFixed(0)} FCFA',
            style: const TextStyle(fontSize: 11, color: SimColors.textSecondary),
          ),
        ],
      ]),
    );
  }
}

// QR Code symbolique dessiné à la main
class _QrPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = SimColors.blue;
    final s = size.width;
    for (final (dx, dy) in [(0.0, 0.0), (s * 0.6, 0.0), (0.0, s * 0.6)]) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(dx + s * 0.06, dy + s * 0.06, s * 0.32, s * 0.32), const Radius.circular(4)), paint..color = Colors.transparent..style = PaintingStyle.stroke..strokeWidth = 3..color = SimColors.blue);
      canvas.drawRect(Rect.fromLTWH(dx + s * 0.12, dy + s * 0.12, s * 0.20, s * 0.20), paint..color = SimColors.blue..style = PaintingStyle.fill);
    }
    final positions = [0.45, 0.52, 0.59, 0.66, 0.73];
    for (final x in positions) {
      for (final y in positions) {
        if ((x + y) % 0.14 < 0.08) {
          canvas.drawRect(Rect.fromLTWH(s * x, s * y, s * 0.05, s * 0.05), paint..color = SimColors.blue.withValues(alpha: 0.7));
        }
      }
    }
    final tp = TextPainter(
      text: const TextSpan(text: 'W', style: TextStyle(color: SimColors.blue, fontSize: 18, fontWeight: FontWeight.bold)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(s * 0.42, s * 0.42));
  }

  @override
  bool shouldRepaint(_) => false;
}
