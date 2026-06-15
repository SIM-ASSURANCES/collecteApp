import type { User } from '../types';

export const PERMISSIONS = [
  { key: 'dashboard',      label: 'Tableau de bord', path: '/' },
  { key: 'souscripteurs',  label: 'Souscripteurs',   path: '/souscripteurs' },
  { key: 'collecteurs',    label: 'Collecteurs',      path: '/collecteurs' },
  { key: 'reversements',   label: 'Reversements',     path: '/reversements' },
  { key: 'statistiques',   label: 'Statistiques',     path: '/statistiques' },
  { key: 'relances',       label: 'Relances',         path: '/relances' },
  { key: 'journal',        label: 'Journal',          path: '/journal' },
  { key: 'utilisateurs',   label: 'Utilisateurs',     path: '/utilisateurs' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

/** L'utilisateur a-t-il accès à cette page ? (ADMIN : accès total) */
export function hasPermission(user: User | null, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'SUPERVISEUR') return false;
  if (key === 'utilisateurs' || key === 'journal') return false;
  const perms = user.permissions ?? [];
  return perms.some(p => p === key || p === `${key}:read` || p === `${key}:write`);
}

/** L'utilisateur peut-il effectuer des actions d'écriture ? */
export function canWrite(user: User | null, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'SUPERVISEUR') return false;
  const perms = user.permissions ?? [];
  return perms.some(p => p === key || p === `${key}:write`);
}

/** Première page autorisée — cible de redirection après connexion */
export function firstAllowedPath(user: User | null): string {
  for (const p of PERMISSIONS) {
    if (hasPermission(user, p.key)) return p.path;
  }
  return '/login';
}
