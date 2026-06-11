export interface User {
  id: number;
  nom: string;
  role: 'ADMIN' | 'COMMERCIAL';
}

export interface Cotisant {
  id: number;
  nom: string;
  telephone: string;
  montant_journalier: number;
  date_inscription: string;
  commercial_id: number;
  actif: boolean;
}

export interface Commercial {
  id: number;
  nom: string;
  identifiant: string;
  actif: boolean;
  cotisants?: Cotisant[];
}

export interface Paiement {
  id: number;
  cotisant_id: number;
  cotisant_nom?: string;
  telephone?: string;
  commercial_id: number | null;
  date: string;
  montant: number;
  mode: 'wave' | 'especes' | 'cheque' | 'autre';
  statut: 'paye' | 'en_attente' | 'annule';
  horodatage: string;
}

export interface Reversement {
  id: number;
  commercial_id: number;
  commercial_nom?: string;
  date: string;
  montant_declare: number;
  montant_attendu: number;
  ecart: number;
  statut: 'en_attente' | 'valide' | 'rejete';
  motif_rejet?: string;
}

export interface DashboardData {
  date: string;
  total_cotisants: number;
  payes: number;
  non_payes: number;
  montants_par_mode: { mode: string; total: string }[];
}
