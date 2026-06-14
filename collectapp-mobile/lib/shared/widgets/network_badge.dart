import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/offline_queue.dart';

final connectivityProvider = StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

class NetworkBadge extends ConsumerWidget {
  const NetworkBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conn  = ref.watch(connectivityProvider);
    final count = offlineQueue.count;

    final isOnline = conn.when(
      data: (results) => results.any((r) => r != ConnectivityResult.none),
      loading: () => true,
      error: (_, __) => false,
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isOnline ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(isOnline ? Icons.wifi : Icons.wifi_off, size: 14, color: Colors.white),
        const SizedBox(width: 6),
        Text(
          isOnline ? 'En ligne' : 'Hors ligne',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(10)),
            child: Text('$count',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF15803D))),
          ),
        ],
      ]),
    );
  }
}
