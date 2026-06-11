import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

class OfflineQueueService {
  static const _boxName = 'offline_queue';
  static final _uuid = Uuid();

  Box get _box => Hive.box(_boxName);

  void add(Map<String, dynamic> operation) {
    final entry = {
      ...operation,
      'id_local': _uuid.v4(),
      'horodatage_local': DateTime.now().toIso8601String(),
    };
    _box.add(jsonEncode(entry));
  }

  List<Map<String, dynamic>> getAll() {
    return _box.values
        .map((v) => jsonDecode(v as String) as Map<String, dynamic>)
        .toList();
  }

  void clear() => _box.clear();

  int get count => _box.length;

  bool get isEmpty => _box.isEmpty;
}

final offlineQueue = OfflineQueueService();
