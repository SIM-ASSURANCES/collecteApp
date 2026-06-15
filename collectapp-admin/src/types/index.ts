export type Role = 'ADMIN' | 'SUPERVISEUR' | 'COMMERCIAL';

export interface User {
  id: number;
  nom: string;
  role: Role;
  permissions: string[];
}

export interface UtilisateurAdmin {
  id: number;
  nom: string;
  identifiant: string;
  role: Role;
  permissions: string[];
  actif: boolean;
  derniere_connexion: string | null;
  created_at: string;
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
  numero_wave?: string | null;
  wave_session_id?: string | null;
  wave_payment_status?: 'non_paye' | 'processing' | 'succeeded' | 'failed';
}

export interface DashboardData {
  date: string;
  total_cotisants: number;
  payes: number;
  non_payes: number;
  montants_par_mode: { mode: string; total: string }[];
  ca_collecte_jour: number;
  ca_non_collecte_jour: number;
  ca_total: number;
  periode: { debut: string; fin: string } | null;
  ca_periode: number | null;
  nombre_paiements_periode: number | null;
}
