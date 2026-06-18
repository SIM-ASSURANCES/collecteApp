import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, UserX, UserCheck, Trash2, Users, ArrowRightLeft, Eye, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import type { Collecteur, Souscripteur } from '../types';

function CollecteurForm({ initial, onSave, onClose }: {
  initial?: Partial<Collecteur>;
  onSave: (data: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nom: initial?.nom ?? '',
    identifiant: initial?.identifiant ?? '',
    mot_de_passe: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div><label className="sim-label">Nom complet *</label>
        <input className="sim-input" value={form.nom} onChange={e => set('nom', e.target.value)} required placeholder="Ex: Diallo Moussa" />
      </div>
      <div><label className="sim-label">Identifiant de connexion *</label>
        <input className="sim-input" value={form.identifiant} onChange={e => set('identifiant', e.target.value)} required placeholder="diallo.moussa" />
      </div>
      <div>
        <label className="sim-label">{initial?.id ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
        <input className="sim-input" type="password" value={form.mot_de_passe}
               onChange={e => set('mot_de_passe', e.target.value)}
               required={!initial?.id} minLength={6} placeholder="••••••" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="sim-btn-primary flex-1">
          {initial?.id ? 'Enregistrer' : 'Créer le collecteur'}
        </button>
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          Annuler
        </button>
      </div>
    </form>
  );
}

interface CollecteurDetail extends Collecteur {
  nombre_cotisants: number;
  nombre_payes: number;
  nombre_impayes: number;
  ca_collecte: number;
  ca_non_collecte: number;
  ca_total_collecte: number;
  cotisants: (Souscripteur & { paye_aujourd_hui?: boolean; mode_paiement?: string | null; heure_paiement?: string | null })[];
}

export default function Collecteurs() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'portefeuille' | 'details'>(null);
  const [selected, setSelected] = useState<Collecteur | null>(null);
  const [reassignIds, setReassignIds] = useState<number[]>([]);
  const [targetCollecteur, setTargetCollecteur] = useState('');

  const { data: collecteurs = [], isLoading } = useQuery<Collecteur[]>({
    queryKey: ['collecteurs'],
    queryFn: () => api.get('/collecteurs').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: detail } = useQuery<CollecteurDetail>({
    queryKey: ['collecteur-detail', selected?.id, modal],
    queryFn: () => api.get(`/collecteurs/${selected!.id}`).then(r => r.data),
    enabled: (modal === 'portefeuille' || modal === 'details') && !!selected,
  });

  const createMut = useMutation({
    mutationFn: (d: Record<string, string>) => api.post('/collecteurs', d),
    onSuccess: () => { toast.success('Collecteur créé !'); qc.invalidateQueries({ queryKey: ['collecteurs'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur'),
  });

  const editMut = useMutation({
    mutationFn: (d: Record<string, string>) => api.put(`/collecteurs/${selected!.id}`, d),
    onSuccess: () => { toast.success('Collecteur mis à jour !'); qc.invalidateQueries({ queryKey: ['collecteurs'] }); setModal(null); },
    onError: () => toast.error('Erreur lors de la modification'),
  });

  const desactiverMut = useMutation({
    mutationFn: (id: number) => api.patch(`/collecteurs/${id}/desactiver`),
    onSuccess: () => { toast.success('Collecteur désactivé.'); qc.invalidateQueries({ queryKey: ['collecteurs'] }); },
  });

  const activerMut = useMutation({
    mutationFn: (id: number) => api.patch(`/collecteurs/${id}/activer`),
    onSuccess: () => { toast.success('Collecteur réactivé.'); qc.invalidateQueries({ queryKey: ['collecteurs'] }); },
  });

  const supprimerMut = useMutation({
    mutationFn: (id: number) => api.delete(`/collecteurs/${id}`),
    onSuccess: () => { toast.success('Collecteur supprimé.'); qc.invalidateQueries({ queryKey: ['collecteurs'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Suppression impossible'),
  });

  const reassignMut = useMutation({
    mutationFn: () => api.patch(`/collecteurs/${selected!.id}/reassigner`, {
      cotisant_ids: reassignIds,
      nouveau_commercial_id: parseInt(targetCollecteur),
    }),
    onSuccess: () => {
      toast.success(`${reassignIds.length} souscripteur(s) réassigné(s) !`);
      qc.invalidateQueries({ queryKey: ['collecteurs'] });
      setModal(null); setReassignIds([]); setTargetCollecteur('');
    },
    onError: () => toast.error('Erreur lors de la réassignation'),
  });

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Gestion des Collecteurs" subtitle={`${collecteurs.length} collecteur(s)`} />

      <div className="p-6 space-y-5">
        <div className="flex justify-end">
          <button className="sim-btn-primary flex items-center gap-2" onClick={() => { setSelected(null); setModal('create'); }}>
            <Plus size={16} /> Nouveau collecteur
          </button>
        </div>

        {/* Grille cards collecteurs */}
        {isLoading ? (
          <p className="text-center text-gray-400 py-10">Chargement…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collecteurs.map(c => (
              <div key={c.id} className="sim-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                         style={{ background: c.actif ? '#004B9C' : '#9CA3AF' }}>
                      {c.nom.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1A2B4A' }}>{c.nom}</p>
                      <p className="text-xs text-gray-400">{c.identifiant}</p>
                    </div>
                  </div>
                  <span className={c.actif ? 'sim-badge-paye' : 'sim-badge-impaye'}>{c.actif ? 'Actif' : 'Inactif'}</span>
                </div>

                <div className="flex items-center gap-2 py-2 border-t border-gray-50 mb-3">
                  <Users size={14} style={{ color: '#51AEE2' }} />
                  <span className="text-xs text-gray-500">Portefeuille souscripteurs</span>
                </div>

                <button onClick={() => { setSelected(c); setModal('details'); }}
                        className="w-full mb-2 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                        style={{ background: '#004B9C' }}>
                  <Eye size={13} className="inline mr-1" />Voir les détails
                </button>

                <div className="flex gap-2">
                  <button onClick={() => { setSelected(c); setModal('edit'); }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition hover:bg-blue-50"
                          style={{ color: '#004B9C', borderColor: '#004B9C' }}>
                    <Edit2 size={13} className="inline mr-1" />Modifier
                  </button>
                  <button onClick={() => { setSelected(c); setModal('portefeuille'); }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition hover:bg-sky-50"
                          style={{ color: '#51AEE2', borderColor: '#51AEE2' }}>
                    <ArrowRightLeft size={13} className="inline mr-1" />Réassigner
                  </button>
                  {c.actif ? (
                    <button title="Désactiver" onClick={() => { if (confirm(`Désactiver ${c.nom} ?`)) desactiverMut.mutate(c.id); }}
                            className="py-1.5 px-2.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition text-xs">
                      <UserX size={13} />
                    </button>
                  ) : (
                    <button title="Réactiver" onClick={() => activerMut.mutate(c.id)}
                            className="py-1.5 px-2.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition text-xs">
                      <UserCheck size={13} />
                    </button>
                  )}
                  <button title="Supprimer" onClick={() => {
                            if (confirm(`Supprimer définitivement ${c.nom} ? Cette action est irréversible.`)) supprimerMut.mutate(c.id);
                          }}
                          className="py-1.5 px-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-xs">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouveau collecteur">
        <CollecteurForm onSave={d => createMut.mutate(d)} onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier le collecteur">
        {selected && <CollecteurForm initial={selected} onSave={d => editMut.mutate(d)} onClose={() => setModal(null)} />}
      </Modal>

      <Modal isOpen={modal === 'details'} onClose={() => setModal(null)} title={`Détails — ${selected?.nom}`} size="lg">
        <div className="space-y-4">
          {/* Cartes CA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: '#EBF3FC' }}>
              <p className="text-lg font-bold" style={{ color: '#004B9C' }}>{detail?.nombre_cotisants ?? 0}</p>
              <p className="text-xs text-gray-500">Souscripteurs</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#D1FAE5' }}>
              <p className="text-lg font-bold" style={{ color: '#059669' }}>{(detail?.ca_collecte ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">CA collecté (jour)</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#FEE2E2' }}>
              <p className="text-lg font-bold" style={{ color: '#DC2626' }}>{(detail?.ca_non_collecte ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">CA non collecté (jour)</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#F4F6FA' }}>
              <p className="text-lg font-bold" style={{ color: '#1A2B4A' }}>{(detail?.ca_total_collecte ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">CA total collecté</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">Souscripteurs assignés</span>
            <span className="text-xs text-gray-500">
              {detail?.nombre_payes ?? 0} payé(s) · {detail?.nombre_impayes ?? 0} impayé(s) aujourd'hui
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y">
            {(detail?.cotisants ?? []).map((cot) => (
              <div key={cot.id} className="flex items-center gap-3 px-4 py-2.5">
                {cot.paye_aujourd_hui
                  ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
                  : <XCircle size={16} style={{ color: '#DC2626' }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cot.nom}</p>
                  <p className="text-xs text-gray-400 font-mono">{cot.telephone}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: '#004B9C' }}>
                  {Number(cot.montant_journalier).toLocaleString()} F
                </span>
              </div>
            ))}
            {(detail?.cotisants ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-6 text-sm">Aucun souscripteur assigné</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'portefeuille'} onClose={() => { setModal(null); setReassignIds([]); }} title={`Portefeuille — ${selected?.nom}`} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Sélectionnez les souscripteurs à réassigner :</p>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl divide-y">
            {(detail?.cotisants ?? []).map((cot: Souscripteur) => (
              <label key={cot.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="rounded"
                       checked={reassignIds.includes(cot.id)}
                       onChange={e => setReassignIds(prev =>
                         e.target.checked ? [...prev, cot.id] : prev.filter(id => id !== cot.id)
                       )} />
                <span className="text-sm">{cot.nom}</span>
                <span className="text-xs text-gray-400 ml-auto">{cot.telephone}</span>
              </label>
            ))}
            {(detail?.cotisants ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-6 text-sm">Aucun souscripteur assigné</p>
            )}
          </div>
          {reassignIds.length > 0 && (
            <div>
              <label className="sim-label">Réassigner vers *</label>
              <select className="sim-input" value={targetCollecteur} onChange={e => setTargetCollecteur(e.target.value)}>
                <option value="">-- Choisir un collecteur --</option>
                {collecteurs.filter(c => c.id !== selected?.id && c.actif).map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button disabled={reassignIds.length === 0 || !targetCollecteur}
                    onClick={() => reassignMut.mutate()}
                    className="sim-btn-secondary flex-1 disabled:opacity-40">
              Réassigner {reassignIds.length > 0 ? `(${reassignIds.length})` : ''}
            </button>
            <button onClick={() => { setModal(null); setReassignIds([]); }}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Fermer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
