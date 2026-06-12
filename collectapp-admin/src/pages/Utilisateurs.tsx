/**
 * Gestion des utilisateurs — réservée aux administrateurs.
 * Création / modification d'utilisateurs avec rôle et permissions par page.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Plus, Pencil, UserCheck, UserX, KeyRound, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import { PERMISSIONS } from '../lib/permissions';
import type { Role, UtilisateurAdmin } from '../types';

interface FormState {
  nom: string;
  identifiant: string;
  mot_de_passe: string;
  role: Role;
  permissions: string[];
}

const formVide: FormState = {
  nom: '', identifiant: '', mot_de_passe: '', role: 'SUPERVISEUR', permissions: [],
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  SUPERVISEUR: 'Superviseur',
  COMMERCIAL: 'Commercial',
};

const ROLE_BADGES: Record<Role, { bg: string; color: string }> = {
  ADMIN:       { bg: '#DBEAFE', color: '#1E40AF' },
  SUPERVISEUR: { bg: '#EDE9FE', color: '#5B21B6' },
  COMMERCIAL:  { bg: '#D1FAE5', color: '#065F46' },
};

export default function Utilisateurs() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<UtilisateurAdmin | null>(null);
  const [form, setForm]           = useState<FormState>(formVide);

  const { data: utilisateurs = [], isLoading } = useQuery<UtilisateurAdmin[]>({
    queryKey: ['utilisateurs'],
    queryFn: () => api.get('/utilisateurs').then(r => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['utilisateurs'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => api.post('/utilisateurs', data),
    onSuccess: () => { invalidate(); setModalOpen(false); toast.success('Utilisateur créé'); },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<FormState> & { id: number; actif?: boolean }) =>
      api.put(`/utilisateurs/${id}`, data),
    onSuccess: () => { invalidate(); setModalOpen(false); toast.success('Utilisateur mis à jour'); },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Erreur lors de la mise à jour'),
  });

  const openCreate = () => { setEditing(null); setForm(formVide); setModalOpen(true); };

  const openEdit = (u: UtilisateurAdmin) => {
    setEditing(u);
    setForm({
      nom: u.nom,
      identifiant: u.identifiant,
      mot_de_passe: '',
      role: u.role,
      permissions: u.permissions ?? [],
    });
    setModalOpen(true);
  };

  const togglePermission = (key: string) =>
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }));

  const handleSubmit = () => {
    if (!form.nom.trim() || !form.identifiant.trim()) {
      toast.error('Nom et identifiant sont requis'); return;
    }
    if (!editing && form.mot_de_passe.length < 6) {
      toast.error('Mot de passe : 6 caractères minimum'); return;
    }
    if (form.role === 'SUPERVISEUR' && form.permissions.length === 0) {
      toast.error('Sélectionnez au moins une permission'); return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        nom: form.nom,
        identifiant: form.identifiant,
        role: form.role,
        permissions: form.permissions,
        ...(form.mot_de_passe ? { mot_de_passe: form.mot_de_passe } : {}),
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleActif = (u: UtilisateurAdmin) =>
    updateMutation.mutate({ id: u.id, actif: !u.actif });

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: '#E8F1FB' }}>
            <ShieldCheck size={20} style={{ color: '#004B9C' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Utilisateurs</h1>
            <p className="text-xs text-gray-400">Comptes, rôles et permissions d'accès</p>
          </div>
        </div>
        <button onClick={openCreate} className="sim-btn-primary px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Plus size={16} /> Nouvel utilisateur
        </button>
      </div>

      {/* Tableau */}
      <div className="sim-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 size={28} className="animate-spin" style={{ color: '#004B9C' }} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Utilisateur</th>
                <th className="px-5 py-3">Rôle</th>
                <th className="px-5 py-3">Permissions</th>
                <th className="px-5 py-3">Dernière connexion</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map(u => {
                const badge = ROLE_BADGES[u.role];
                return (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{u.nom}</p>
                      <p className="text-xs text-gray-400 font-mono">{u.identifiant}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: badge.bg, color: badge.color }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.role === 'ADMIN' ? (
                        <span className="text-xs text-gray-400">Toutes</span>
                      ) : u.role === 'COMMERCIAL' ? (
                        <span className="text-xs text-gray-400">Espace collecte</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {(u.permissions ?? []).map(p => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: '#E8F1FB', color: '#004B9C' }}>
                              {PERMISSIONS.find(x => x.key === p)?.label ?? p}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {u.derniere_connexion
                        ? new Date(u.derniere_connexion).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={u.actif
                              ? { background: '#D1FAE5', color: '#065F46' }
                              : { background: '#FEE2E2', color: '#991B1B' }}>
                        {u.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(u)} title="Modifier"
                                className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => toggleActif(u)}
                                title={u.actif ? 'Désactiver' : 'Réactiver'}
                                className="p-2 rounded-lg hover:bg-gray-100 transition"
                                style={{ color: u.actif ? '#DC2626' : '#059669' }}>
                          {u.actif ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal création / édition */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
             title={editing ? `Modifier ${editing.nom}` : 'Nouvel utilisateur'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="sim-label">Nom complet</label>
              <input className="sim-input" value={form.nom}
                     onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                     placeholder="Ex : Awa Koné" />
            </div>
            <div>
              <label className="sim-label">Identifiant</label>
              <input className="sim-input" value={form.identifiant}
                     onChange={e => setForm(f => ({ ...f, identifiant: e.target.value }))}
                     placeholder="Ex : akone" />
            </div>
          </div>

          <div>
            <label className="sim-label flex items-center gap-1.5">
              <KeyRound size={12} />
              {editing ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe'}
            </label>
            <input type="password" className="sim-input" value={form.mot_de_passe}
                   onChange={e => setForm(f => ({ ...f, mot_de_passe: e.target.value }))}
                   placeholder="6 caractères minimum" />
          </div>

          <div>
            <label className="sim-label">Rôle</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ADMIN', 'SUPERVISEUR', 'COMMERCIAL'] as Role[]).map(r => (
                <button key={r} type="button"
                        onClick={() => setForm(f => ({ ...f, role: r }))}
                        className="px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition"
                        style={form.role === r
                          ? { borderColor: '#004B9C', background: '#E8F1FB', color: '#004B9C' }
                          : { borderColor: '#E5E7EB', background: 'white', color: '#6B7280' }}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {form.role === 'ADMIN' && 'Accès complet à toutes les fonctionnalités, y compris la gestion des utilisateurs.'}
              {form.role === 'SUPERVISEUR' && 'Accès à l\'espace admin limité aux pages cochées ci-dessous.'}
              {form.role === 'COMMERCIAL' && 'Accès à l\'espace collecte terrain (mobile et web).'}
            </p>
          </div>

          {form.role === 'SUPERVISEUR' && (
            <div>
              <label className="sim-label">Permissions (pages autorisées)</label>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.filter(p => p.key !== 'utilisateurs').map(p => {
                  const checked = form.permissions.includes(p.key);
                  return (
                    <label key={p.key}
                           className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition text-xs font-medium"
                           style={checked
                             ? { borderColor: '#004B9C', background: '#E8F1FB', color: '#004B9C' }
                             : { borderColor: '#E5E7EB', color: '#6B7280' }}>
                      <input type="checkbox" checked={checked}
                             onChange={() => togglePermission(p.key)}
                             className="accent-[#004B9C]" />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={handleSubmit} disabled={pending}
                  className="sim-btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2">
            {pending
              ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</>
              : editing ? 'Enregistrer les modifications' : 'Créer l\'utilisateur'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
