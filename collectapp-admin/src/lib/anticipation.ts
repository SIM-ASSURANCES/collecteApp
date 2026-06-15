import type { FrequenceCollecte } from '../types';

export interface AnticipationOption {
  nbperiodes: number;
  label: string;
}

export const ANTICIPATION_PAR_FREQUENCE: Record<FrequenceCollecte, AnticipationOption[]> = {
  journalier: [
    { nbperiodes: 2,   label: '2 j' },
    { nbperiodes: 3,   label: '3 j' },
    { nbperiodes: 4,   label: '4 j' },
    { nbperiodes: 5,   label: '5 j' },
    { nbperiodes: 6,   label: '6 j' },
    { nbperiodes: 7,   label: '7 j' },
    { nbperiodes: 30,  label: '1 mois' },
    { nbperiodes: 60,  label: '2 mois' },
    { nbperiodes: 90,  label: '1 trim.' },
    { nbperiodes: 180, label: '2 trim.' },
  ],
  hebdomadaire: [
    { nbperiodes: 2,  label: '2 sem.' },
    { nbperiodes: 3,  label: '3 sem.' },
    { nbperiodes: 4,  label: '4 sem.' },
    { nbperiodes: 8,  label: '2 mois' },
    { nbperiodes: 13, label: '3 mois' },
    { nbperiodes: 26, label: '6 mois' },
  ],
  mensuel: [
    { nbperiodes: 2,  label: '2 mois' },
    { nbperiodes: 3,  label: '3 mois' },
    { nbperiodes: 6,  label: '6 mois' },
    { nbperiodes: 12, label: '1 an' },
    { nbperiodes: 24, label: '2 ans' },
  ],
  trimestriel: [
    { nbperiodes: 2, label: '2 trim.' },
    { nbperiodes: 3, label: '3 trim.' },
    { nbperiodes: 4, label: '1 an' },
    { nbperiodes: 8, label: '2 ans' },
  ],
  semestriel: [
    { nbperiodes: 2, label: '1 an' },
    { nbperiodes: 3, label: '18 mois' },
    { nbperiodes: 4, label: '2 ans' },
  ],
  annuel: [
    { nbperiodes: 2, label: '2 ans' },
    { nbperiodes: 3, label: '3 ans' },
    { nbperiodes: 5, label: '5 ans' },
  ],
};

export const FREQ_PERIODE_LABEL: Record<FrequenceCollecte, string> = {
  journalier:   'jour',
  hebdomadaire: 'semaine',
  mensuel:      'mois',
  trimestriel:  'trimestre',
  semestriel:   'semestre',
  annuel:       'an',
};
