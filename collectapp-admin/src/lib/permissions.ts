import type { User } from '../types';

/** Pages de l'espace admin pouvant être attribuées individuellement */
export const PERMISSIONS = [
  { key: 'dashboard',    label: 'Tableau de bord', path: '/' },
  { key: 'cotisants',    label: 'Cotisants',       path: '/cotisants' },
  { key: 'commerciaux',  label: 'Commerciaux',     path: '/commerciaux' },
  { key: 'reversements', label: 'Reversements',    path: '/reversements' },
  { key: 'statistiques', label: 'Statistiques',    path: '/statistiques' },
  { key: 'relances',     label: 'Relances',        path: '/relances' },
  { key: 'utilisateurs', label: 'Utilisateurs',    path: '/utilisateurs' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

/** L'utilisateur a-t-il accès à cette page ? (ADMIN : accès total) */
export function hasPermission(user: User | null, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'SUPERVISEUR') return false;
  // La gestion des utilisateurs reste réservée aux ADMIN
  if (key === 'utilisateurs') return false;
  return (user.permissions ?? []).includes(key);
}

/** Première page autorisée — cible de redirection après connexion ou accès refusé */
export function firstAllowedPath(user: User | null): string {
  for (const p of PERMISSIONS) {
    if (hasPermission(user, p.key)) return p.path;
  }
  return '/login';
}
