import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ── Charte graphique SIM Assurances CI ──
class SimColors {
  static const blue       = Color(0xFF004B9C);
  static const blueDark   = Color(0xFF003A7A);
  static const blueLight  = Color(0xFF51AEE2);
  static const blueMid    = Color(0xFF1565C0);
  static const background = Color(0xFFF4F6FA);
  static const surface    = Colors.white;
  static const success    = Color(0xFF059669);
  static const error      = Color(0xFFDC2626);
  static const warning    = Color(0xFFD97706);
  static const textPrimary   = Color(0xFF1F2937);
  static const textSecondary = Color(0xFF6B7280);
  static const border     = Color(0xFFD1D9E6);
  static const blueTint   = Color(0xFFEBF3FC);
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: SimColors.blue,
      primary: SimColors.blue,
      secondary: SimColors.blueLight,
      surface: SimColors.surface,
      error: SimColors.error,
    ),
    scaffoldBackgroundColor: SimColors.background,
    textTheme: GoogleFonts.montserratTextTheme().copyWith(
      displayLarge:  GoogleFonts.montserrat(fontWeight: FontWeight.w700, color: SimColors.textPrimary),
      titleLarge:    GoogleFonts.montserrat(fontWeight: FontWeight.w700, color: SimColors.textPrimary, fontSize: 18),
      titleMedium:   GoogleFonts.montserrat(fontWeight: FontWeight.w600, color: SimColors.textPrimary, fontSize: 16),
      bodyLarge:     GoogleFonts.montserrat(fontWeight: FontWeight.w400, color: SimColors.textPrimary, fontSize: 14),
      bodyMedium:    GoogleFonts.montserrat(fontWeight: FontWeight.w400, color: SimColors.textSecondary, fontSize: 13),
      labelSmall:    GoogleFonts.montserrat(fontWeight: FontWeight.w500, color: SimColors.textSecondary, fontSize: 11),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: SimColors.blue,
      foregroundColor: Colors.white,
      elevation: 0,
      titleTextStyle: GoogleFonts.montserrat(
        fontWeight: FontWeight.w700, fontSize: 16, color: Colors.white,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: SimColors.blue,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.montserrat(fontWeight: FontWeight.w600, fontSize: 15),
        elevation: 0,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: SimColors.border, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: SimColors.border, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: SimColors.blue, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: SimColors.error, width: 1.5),
      ),
      labelStyle: GoogleFonts.montserrat(color: SimColors.textSecondary, fontSize: 13),
      hintStyle: GoogleFonts.montserrat(color: SimColors.textSecondary, fontSize: 13),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: EdgeInsets.zero,
    ),
    dividerTheme: const DividerThemeData(color: Color(0xFFEEF1F7), thickness: 1),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: SimColors.blue,
      unselectedItemColor: SimColors.textSecondary,
      selectedLabelStyle: GoogleFonts.montserrat(fontSize: 10, fontWeight: FontWeight.w600),
      unselectedLabelStyle: GoogleFonts.montserrat(fontSize: 10, fontWeight: FontWeight.w400),
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
  );
}
