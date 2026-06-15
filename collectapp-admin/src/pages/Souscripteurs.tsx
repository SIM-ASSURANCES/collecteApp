import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, UserX, UserCheck, Trash2, History, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import type { Souscripteur, Collecteur, FrequenceCollecte } from '../types';

const PAGE_SIZE = 20;

const FREQUENCES: { value: FrequenceCollecte; label: string; badge: string }[] = [
  { value: 'journalier',   label: 'Journalière',    badge: '1J' },
  { value: 'hebdomadaire', label: 'Hebdomadaire',   badge: '7J' },
  { value: 'mensuel',      label: 'Mensuelle',      badge: '1M' },
  { value: 'trimestriel',  label: 'Trimestrielle',  badge: '3M' },
  { value: 'semestriel',   label: 'Semestrielle',   badge: '6M' },
  { value: 'annuel',       label: 'Annuelle',       badge: '1A' },
];

const FREQ_COLORS: Record<FrequenceCollecte, string> = {
  journalier:   'background:#EBF3FC;color:#004B9C',
  hebdomadaire: 'background:#F0FDF4;color:#059669',
  mensuel:      'background:#FFF7ED;color:#D97706',
  trimestriel:  'background:#F5F3FF;color:#7C3AED',
  semestriel:   'background:#FFF1F2;color:#E11D48',
  annuel:       'background:#ECFEFF;color:#0E7490',
};

function freqLabel(f: FrequenceCollecte) {
  return FREQUENCES.find(x => x.value === f)?.label ?? f;
}
function freqBadge(f: FrequenceCollecte) {
  return FREQUENCES.find(x => x.value === f)?.badge ?? f;
}
function montantLabel(f: FrequenceCollecte) {
  const labels: Record<FrequenceCollecte, string> = {
    journalier:   'Souscription journalière (FCFA)',
    hebdomadaire: 'Souscription hebdomadaire (FCFA)',
    mensuel:      'Souscription mensuelle (FCFA)',
    trimestriel:  'Souscription trimestrielle (FCFA)',
    semestriel:   'Souscription semestrielle (FCFA)',
    annuel:       'Souscription annuelle (FCFA)',
  };
  return labels[f] ?? 'Souscription (FCFA)';
}

function SouscripteurForm({ initial, collecteurs, onSave, onClose }: {
  initial?: Partial<Souscripteur>;
  collecteurs: Collecteur[];
  onSave: (data: Partial<Souscripteur>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nom:                initial?.nom ?? '',
    telephone:          initial?.telephone ?? '',
    montant_journalier: initial?.montant_journalier ?? '',
    commercial_id:      initial?.commercial_id ?? '',
    frequence_collecte: (initial?.frequence_collecte ?? 'journalier') as FrequenceCollecte,
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      {/* Fréquence — en premier, elle conditionne le libellé du montant */}
      <div>
        <label className="sim-label">Fréquence de collecte *</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {FREQUENCES.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => set('frequence_collecte', f.value)}
              className="py-2 px-3 rounded-xl text-xs font-semibold text-center transition border"
              style={form.frequence_collecte === f.value
                ? { background: '#004B9C', color: '#fff', borderColor: '#004B9C' }
                : { background: '#F8FAFC', color: '#64748B', borderColor: '#E2E8F0' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="sim-label">Nom complet *</label>
        <input className="sim-input" value={form.nom} onChange={e => set('nom', e.target.value)} required placeholder="Ex: Koné Aminata" />
      </div>
      <div>
        <label className="sim-label">Numéro de téléphone *</label>
        <input className="sim-input" value={form.telephone} onChange={e => set('telephone', e.target.value)} required placeholder="07XXXXXXXX" />
      </div>
      <div>
        <label className="sim-label">{montantLabel(form.frequence_collecte)} *</label>
        <input className="sim-input" type="number" min="1" value={form.montant_journalier}
               onChange={e => set('montant_journalier', e.target.value)} required placeholder="500" />
      </div>
      <div>
        <label className="sim-label">Collecteur assigné *</label>
        <select className="sim-input" value={form.commercial_id} onChange={e => set('commercial_id', e.target.value)} required>
          <option value="">-- Sélectionner --</option>
          {collecteurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="sim-btn-primary flex-1">
          {initial?.id ? 'Enregistrer' : 'Créer le souscripteur'}
        </button>
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function Souscripteurs() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'history'>(null);
  const [selected, setSelected] = useState<Souscripteur | null>(null);

  const { data: souscripteurs = [], isLoading } = useQuery<Souscripteur[]>({
    queryKey: ['souscripteurs', page, search],
    queryFn: () => {
      const params = search
        ? `/souscripteurs/search?q=${encodeURIComponent(search)}`
        : `/souscripteurs?page=${page}&limit=${PAGE_SIZE}`;
      return api.get(params).then(r => r.data);
    },
  });

  const { data: collecteurs = [] } = useQuery<Collecteur[]>({
    queryKey: ['collecteurs-list'],
    queryFn: () => api.get('/collecteurs').then(r => r.data),
  });

  const { data: historique = [] } = useQuery({
    queryKey: ['historique-souscripteur', selected?.id],
    queryFn: () => api.get(`/paiements/cotisant/${selected!.id}`).then(r => r.data),
    enabled: modal === 'history' && !!selected,
  });

  const createMut = useMutation({
    mutationFn: (d: Partial<Souscripteur>) => api.post('/souscripteurs', d),
    onSuccess: () => { toast.success('Souscripteur créé !'); qc.invalidateQueries({ queryKey: ['souscripteurs'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur'),
  });

  const editMut = useMutation({
    mutationFn: (d: Partial<Souscripteur>) => api.put(`/souscripteurs/${selected!.id}`, d),
    onSuccess: () => { toast.success('Souscripteur mis à jour !'); qc.invalidateQueries({ queryKey: ['souscripteurs'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur'),
  });

  const desactiverMut = useMutation({
    mutationFn: (id: number) => api.patch(`/souscripteurs/${id}/desactiver`),
    onSuccess: () => { toast.success('Souscripteur désactivé.'); qc.invalidateQueries({ queryKey: ['souscripteurs'] }); },
    onError: () => toast.error('Erreur lors de la désactivation'),
  });

  const activerMut = useMutation({
    mutationFn: (id: number) => api.patch(`/souscripteurs/${id}/activer`),
    onSuccess: () => { toast.success('Souscripteur réactivé.'); qc.invalidateQueries({ queryKey: ['souscripteurs'] }); },
    onError: () => toast.error('Erreur lors de la réactivation'),
  });

  const supprimerMut = useMutation({
    mutationFn: (id: number) => api.delete(`/souscripteurs/${id}`),
    onSuccess: () => { toast.success('Souscripteur supprimé.'); qc.invalidateQueries({ queryKey: ['souscripteurs'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Suppression impossible'),
  });

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Gestion des Souscripteurs" subtitle={`${souscripteurs.length} souscripteur(s) trouvé(s)`} />

      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="sim-input pl-9"
              placeholder="Rechercher par nom ou téléphone…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="sim-btn-primary flex items-center gap-2" onClick={() => { setSelected(null); setModal('create'); }}>
            <Plus size={16} /> Nouveau souscripteur
          </button>
        </div>

        <div className="sim-card overflow-hidden">
          <table className="sim-table w-full">
            <thead><tr>
              <th>Nom</th><th>Téléphone</th><th>Fréquence</th><th>Montant</th>
              <th>Collecteur</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : souscripteurs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucun souscripteur trouvé</td></tr>
              ) : souscripteurs.map(c => {
                const freq = (c.frequence_collecte || 'journalier') as FrequenceCollecte;
                return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.nom}</td>
                    <td className="font-mono text-sm">{c.telephone}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={Object.fromEntries(FREQ_COLORS[freq].split(';').map(s => s.split(':').map(x => x.trim()) as [string,string]))}>
                        {freqBadge(freq)} · {freqLabel(freq)}
                      </span>
                    </td>
                    <td className="font-semibold" style={{ color: '#004B9C' }}>
                      {Number(c.montant_journalier).toLocaleString()} FCFA
                    </td>
                    <td className="text-gray-500 text-sm">
                      {collecteurs.find(cm => cm.id === c.commercial_id)?.nom ?? '—'}
                    </td>
                    <td>
                      <span className={c.actif ? 'sim-badge-paye' : 'sim-badge-impaye'}>
                        {c.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button title="Modifier" onClick={() => { setSelected(c); setModal('edit'); }}
                                className="p-1.5 rounded-lg hover:bg-blue-50 transition" style={{ color: '#004B9C' }}>
                          <Edit2 size={15} />
                        </button>
                        <button title="Historique" onClick={() => { setSelected(c); setModal('history'); }}
                                className="p-1.5 rounded-lg hover:bg-blue-50 transition" style={{ color: '#51AEE2' }}>
                          <History size={15} />
                        </button>
                        {c.actif ? (
                          <button title="Désactiver" onClick={() => {
                            if (confirm(`Désactiver ${c.nom} ?`)) desactiverMut.mutate(c.id);
                          }} className="p-1.5 rounded-lg hover:bg-amber-50 transition text-amber-600">
                            <UserX size={15} />
                          </button>
                        ) : (
                          <button title="Réactiver" onClick={() => activerMut.mutate(c.id)}
                                  className="p-1.5 rounded-lg hover:bg-green-50 transition text-green-600">
                            <UserCheck size={15} />
                          </button>
                        )}
                        <button title="Supprimer" onClick={() => {
                          if (confirm(`Supprimer définitivement ${c.nom} ? Cette action est irréversible.`)) supprimerMut.mutate(c.id);
                        }} className="p-1.5 rounded-lg hover:bg-red-50 transition text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!search && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Page {page}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                  <ChevronLeft size={16} />
                </button>
                <button disabled={souscripteurs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouveau souscripteur">
        <SouscripteurForm collecteurs={collecteurs} onSave={d => createMut.mutate(d)} onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier le souscripteur">
        {selected && <SouscripteurForm initial={selected} collecteurs={collecteurs}
          onSave={d => editMut.mutate(d)} onClose={() => setModal(null)} />}
      </Modal>

      <Modal isOpen={modal === 'history'} onClose={() => setModal(null)} title={`Historique — ${selected?.nom}`} size="lg">
        <div className="overflow-x-auto">
          <table className="sim-table w-full text-sm">
            <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Statut</th></tr></thead>
            <tbody>
              {historique.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-gray-400">Aucun paiement enregistré</td></tr>
              ) : historique.map((p: { id: number; date: string; montant: number; mode: string; statut: string }) => (
                <tr key={p.id}>
                  <td>{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                  <td className="font-semibold">{Number(p.montant).toLocaleString()} FCFA</td>
                  <td className="capitalize">{p.mode}</td>
                  <td><span className={p.statut === 'paye' ? 'sim-badge-paye' : 'sim-badge-impaye'}>{p.statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
