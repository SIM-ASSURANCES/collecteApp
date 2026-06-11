import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../storage/secure_storage.dart';

const _baseUrl = 'https://collecte.mysimassurances.com/api';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
    headers: {'Content-Type': 'application/json'},
  ));

  // Intercepteur JWT
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await ref.read(secureStorageProvider).getToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (err, handler) async {
      if (err.response?.statusCode == 401) {
        // Token expiré → déconnexion
        await ref.read(secureStorageProvider).deleteToken();
      }
      handler.next(err);
    },
  ));

  dio.interceptors.add(PrettyDioLogger(
    requestHeader: false,
    requestBody: true,
    responseBody: true,
    error: true,
    compact: true,
  ));

  return dio;
});

// Helpers pour changer l'URL de base (prod vs dev)
extension DioBaseUrl on Dio {
  void setBaseUrl(String url) => options.baseUrl = url;
}
