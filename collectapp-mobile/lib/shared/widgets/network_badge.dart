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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isOnline
            ? Colors.green.withValues(alpha: 0.2)
            : Colors.red.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(isOnline ? Icons.wifi : Icons.wifi_off,
            size: 12,
            color: isOnline ? const Color(0xFF6EE7B7) : const Color(0xFFFCA5A5)),
        const SizedBox(width: 4),
        Text(
          isOnline ? 'En ligne' : 'Hors ligne',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: isOnline ? const Color(0xFF6EE7B7) : const Color(0xFFFCA5A5),
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: Colors.amber, borderRadius: BorderRadius.circular(10)),
            child: Text('$count',
                style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF78350F))),
          ),
        ],
      ]),
    );
  }
}
