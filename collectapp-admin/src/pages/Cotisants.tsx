import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, UserX, History, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import type { Cotisant, Commercial } from '../types';

const PAGE_SIZE = 20;

function CotisantForm({ initial, commerciaux, onSave, onClose }: {
  initial?: Partial<Cotisant>;
  commerciaux: Commercial[];
  onSave: (data: Partial<Cotisant>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nom: initial?.nom ?? '',
    telephone: initial?.telephone ?? '',
    montant_journalier: initial?.montant_journalier ?? '',
    commercial_id: initial?.commercial_id ?? '',
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div><label className="sim-label">Nom complet *</label>
        <input className="sim-input" value={form.nom} onChange={e => set('nom', e.target.value)} required placeholder="Ex: Koné Aminata" />
      </div>
      <div><label className="sim-label">Numéro de téléphone *</label>
        <input className="sim-input" value={form.telephone} onChange={e => set('telephone', e.target.value)} required placeholder="07XXXXXXXX" />
      </div>
      <div><label className="sim-label">Cotisation journalière (FCFA) *</label>
        <input className="sim-input" type="number" min="1" value={form.montant_journalier}
               onChange={e => set('montant_journalier', e.target.value)} required placeholder="500" />
      </div>
      <div><label className="sim-label">Commercial assigné *</label>
        <select className="sim-input" value={form.commercial_id} onChange={e => set('commercial_id', e.target.value)} required>
          <option value="">-- Sélectionner --</option>
          {commerciaux.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="sim-btn-primary flex-1">
          {initial?.id ? 'Enregistrer' : 'Créer le cotisant'}
        </button>
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function Cotisants() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'history'>(null);
  const [selected, setSelected] = useState<Cotisant | null>(null);

  const { data: cotisants = [], isLoading } = useQuery<Cotisant[]>({
    queryKey: ['cotisants', page, search],
    queryFn: () => {
      const params = search
        ? `/cotisants/search?q=${encodeURIComponent(search)}`
        : `/cotisants?page=${page}&limit=${PAGE_SIZE}`;
      return api.get(params).then(r => r.data);
    },
  });

  const { data: commerciaux = [] } = useQuery<Commercial[]>({
    queryKey: ['commerciaux-list'],
    queryFn: () => api.get('/commerciaux').then(r => r.data),
  });

  const { data: historique = [] } = useQuery({
    queryKey: ['historique', selected?.id],
    queryFn: () => api.get(`/paiements/cotisant/${selected!.id}`).then(r => r.data),
    enabled: modal === 'history' && !!selected,
  });

  const createMut = useMutation({
    mutationFn: (d: Partial<Cotisant>) => api.post('/cotisants', d),
    onSuccess: () => { toast.success('Cotisant créé !'); qc.invalidateQueries({ queryKey: ['cotisants'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur'),
  });

  const editMut = useMutation({
    mutationFn: (d: Partial<Cotisant>) => api.put(`/cotisants/${selected!.id}`, d),
    onSuccess: () => { toast.success('Cotisant mis à jour !'); qc.invalidateQueries({ queryKey: ['cotisants'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur'),
  });

  const desactiverMut = useMutation({
    mutationFn: (id: number) => api.patch(`/cotisants/${id}/desactiver`),
    onSuccess: () => { toast.success('Cotisant désactivé.'); qc.invalidateQueries({ queryKey: ['cotisants'] }); },
    onError: () => toast.error('Erreur lors de la désactivation'),
  });

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Gestion des Cotisants" subtitle={`${cotisants.length} cotisant(s) trouvé(s)`} />

      <div className="p-6 space-y-5">
        {/* Barre d'actions */}
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
            <Plus size={16} /> Nouveau cotisant
          </button>
        </div>

        {/* Tableau */}
        <div className="sim-card overflow-hidden">
          <table className="sim-table w-full">
            <thead><tr>
              <th>Nom</th><th>Téléphone</th><th>Cotisation/jour</th>
              <th>Commercial</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : cotisants.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aucun cotisant trouvé</td></tr>
              ) : cotisants.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.nom}</td>
                  <td className="font-mono text-sm">{c.telephone}</td>
                  <td className="font-semibold" style={{ color: '#004B9C' }}>{Number(c.montant_journalier).toLocaleString()} FCFA</td>
                  <td className="text-gray-500 text-sm">
                    {commerciaux.find(cm => cm.id === c.commercial_id)?.nom ?? '—'}
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
                      {c.actif && (
                        <button title="Désactiver" onClick={() => {
                          if (confirm(`Désactiver ${c.nom} ?`)) desactiverMut.mutate(c.id);
                        }} className="p-1.5 rounded-lg hover:bg-red-50 transition text-red-500">
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {!search && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Page {page}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                  <ChevronLeft size={16} />
                </button>
                <button disabled={cotisants.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Créer */}
      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Nouveau cotisant">
        <CotisantForm commerciaux={commerciaux} onSave={d => createMut.mutate(d)} onClose={() => setModal(null)} />
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Modifier le cotisant">
        {selected && <CotisantForm initial={selected} commerciaux={commerciaux}
          onSave={d => editMut.mutate(d)} onClose={() => setModal(null)} />}
      </Modal>

      {/* Modal Historique */}
      <Modal isOpen={modal === 'history'} onClose={() => setModal(null)} title={`Historique — ${selected?.nom}`} size="lg">
        <div className="overflow-x-auto">
          <table className="sim-table w-full text-sm">
            <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Statut</th><th>Commercial</th></tr></thead>
            <tbody>
              {historique.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Aucun paiement enregistré</td></tr>
              ) : historique.map((p: { id: number; date: string; montant: number; mode: string; statut: string }) => (
                <tr key={p.id}>
                  <td>{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                  <td className="font-semibold">{Number(p.montant).toLocaleString()} FCFA</td>
                  <td className="capitalize">{p.mode}</td>
                  <td><span className={p.statut === 'paye' ? 'sim-badge-paye' : 'sim-badge-impaye'}>{p.statut}</span></td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
