class AnticipationOption {
  final int nbperiodes;
  final String label;
  const AnticipationOption(this.nbperiodes, this.label);
}

const Map<String, List<AnticipationOption>> anticipationParFrequence = {
  'journalier': [
    AnticipationOption(2,   '2 j'),
    AnticipationOption(3,   '3 j'),
    AnticipationOption(4,   '4 j'),
    AnticipationOption(5,   '5 j'),
    AnticipationOption(6,   '6 j'),
    AnticipationOption(7,   '1 sem.'),
    AnticipationOption(14,  '2 sem.'),
    AnticipationOption(30,  '1 mois'),
    AnticipationOption(60,  '2 mois'),
    AnticipationOption(90,  '1 trim.'),
    AnticipationOption(180, '2 trim.'),
  ],
  'hebdomadaire': [
    AnticipationOption(2,  '2 sem.'),
    AnticipationOption(3,  '3 sem.'),
    AnticipationOption(4,  '1 mois'),
    AnticipationOption(8,  '2 mois'),
    AnticipationOption(13, '1 trim.'),
    AnticipationOption(26, '6 mois'),
  ],
  'mensuel': [
    AnticipationOption(2,  '2 mois'),
    AnticipationOption(3,  '1 trim.'),
    AnticipationOption(6,  '1 sem.'),
    AnticipationOption(12, '1 an'),
    AnticipationOption(18, '18 mois'),
    AnticipationOption(24, '2 ans'),
  ],
  'trimestriel': [
    AnticipationOption(2, '2 trim.'),
    AnticipationOption(3, '3 trim.'),
    AnticipationOption(4, '1 an'),
    AnticipationOption(6, '18 mois'),
    AnticipationOption(8, '2 ans'),
  ],
  'semestriel': [
    AnticipationOption(2, '1 an'),
    AnticipationOption(3, '18 mois'),
    AnticipationOption(4, '2 ans'),
  ],
  'annuel': [
    AnticipationOption(2, '2 ans'),
    AnticipationOption(3, '3 ans'),
    AnticipationOption(4, '4 ans'),
    AnticipationOption(5, '5 ans'),
  ],
};

const Map<String, String> freqPeriodeLabel = {
  'journalier':   'jour',
  'hebdomadaire': 'semaine',
  'mensuel':      'mois',
  'trimestriel':  'trimestre',
  'semestriel':   'semestre',
  'annuel':       'an',
};

List<AnticipationOption> getAnticipationOptions(String? frequence) =>
    anticipationParFrequence[frequence ?? 'journalier'] ??
    anticipationParFrequence['journalier']!;

String getPeriodeLabel(String? frequence) =>
    freqPeriodeLabel[frequence ?? 'journalier'] ?? 'période';
