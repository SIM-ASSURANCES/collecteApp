import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertTriangle, Filter, RefreshCw, Trash2, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import type { Reversement } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

export default function Reversements() {
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState(today());
  const [statutFilter, setStatutFilter] = useState('');
  const [selected, setSelected] = useState<Reversement | null>(null);
  const [motif, setMotif] = useState('');
  const [modal, setModal] = useState<null | 'rejeter' | 'tous'>(null);

  const { data: tousReversements = [], isLoading: tousLoading } = useQuery<Reversement[]>({
    queryKey: ['reversements-tous'],
    queryFn: () => api.get('/reversements').then(r => r.data),
    enabled: modal === 'tous',
  });

  const supprimerMut = useMutation({
    mutationFn: (id: number) => api.delete(`/reversements/${id}`),
    onSuccess: () => {
      toast.success('Reversement supprimé.');
      qc.invalidateQueries({ queryKey: ['reversements'] });
      qc.invalidateQueries({ queryKey: ['reversements-tous'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Suppression impossible'),
  });

  const { data: reversements = [], isLoading } = useQuery<Reversement[]>({
    queryKey: ['reversements', dateFilter, statutFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (statutFilter) params.set('statut', statutFilter);
      return api.get(`/reversements?${params}`).then(r => r.data);
    },
    refetchInterval: 30_000,
  });

  const validerMut = useMutation({
    mutationFn: (id: number) => api.patch(`/reversements/${id}/valider`),
    onSuccess: () => { toast.success('Reversement validé !'); qc.invalidateQueries({ queryKey: ['reversements'] }); },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Validation impossible'),
  });

  const verifierMut = useMutation({
    mutationFn: (id: number) => api.get(`/reversements/${id}/statut-wave`).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reversements'] });
      const s = data.wave_payment_status;
      if (s === 'succeeded') toast.success('Paiement Wave confirmé ✓');
      else if (s === 'failed') toast.error('Paiement Wave échoué');
      else toast('Paiement Wave en cours…');
    },
    onError: () => toast.error('Vérification impossible'),
  });

  const rejeterMut = useMutation({
    mutationFn: ({ id, motif }: { id: number; motif: string }) =>
      api.patch(`/reversements/${id}/rejeter`, { motif }),
    onSuccess: () => {
      toast.success('Reversement rejeté.'); qc.invalidateQueries({ queryKey: ['reversements'] });
      setModal(null); setMotif('');
    },
    onError: () => toast.error('Erreur'),
  });

  const stats = {
    total: reversements.length,
    enAttente: reversements.filter(r => r.statut === 'en_attente').length,
    valides: reversements.filter(r => r.statut === 'valide').length,
    avecEcart: reversements.filter(r => Number(r.ecart) > 0).length,
  };

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Reversements de fin de journée" subtitle={`Journée du ${new Date(dateFilter).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`} />

      <div className="p-6 space-y-5">
        {/* Stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', val: stats.total, color: '#004B9C', bg: '#EBF3FC' },
            { label: 'En attente', val: stats.enAttente, color: '#D97706', bg: '#FEF3C7' },
            { label: 'Validés', val: stats.valides, color: '#059669', bg: '#D1FAE5' },
            { label: 'Avec écart', val: stats.avecEcart, color: '#DC2626', bg: '#FEE2E2' },
          ].map(s => (
            <div key={s.label} className="sim-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={16} className="text-gray-400" />
          <input type="date" className="sim-input w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          <select className="sim-input w-auto" value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="valide">Validé</option>
            <option value="rejete">Rejeté</option>
          </select>
          <button onClick={() => setModal('tous')}
                  className="sim-btn-primary flex items-center gap-2 ml-auto">
            <ListChecks size={16} /> Tous les reversements
          </button>
        </div>

        {/* Tableau */}
        <div className="sim-card overflow-hidden">
          <table className="sim-table w-full">
            <thead><tr>
              <th>Collecteur</th><th>Déclaré</th><th>Attendu</th>
              <th>Écart</th><th>Paiement Wave</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : reversements.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucun reversement pour cette journée</td></tr>
              ) : reversements.map(r => {
                const ecart = Number(r.ecart);
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{r.commercial_nom ?? `#${r.commercial_id}`}</td>
                    <td className="font-semibold" style={{ color: '#004B9C' }}>
                      {Number(r.montant_declare).toLocaleString()} FCFA
                    </td>
                    <td className="text-gray-600">{Number(r.montant_attendu).toLocaleString()} FCFA</td>
                    <td>
                      {ecart === 0 ? (
                        <span className="sim-badge-paye">Conforme</span>
                      ) : (
                        <span className="sim-badge-impaye flex items-center gap-1 w-fit">
                          <AlertTriangle size={11} />
                          -{ecart.toLocaleString()} FCFA
                        </span>
                      )}
                    </td>
                    <td><WaveStatusBadge statut={r.wave_payment_status} /></td>
                    <td>
                      <span className={
                        r.statut === 'valide'    ? 'sim-badge-paye' :
                        r.statut === 'rejete'    ? 'sim-badge-impaye' :
                        'sim-badge-attente'
                      }>
                        {r.statut === 'en_attente' ? 'En attente' : r.statut === 'valide' ? 'Validé' : 'Rejeté'}
                      </span>
                    </td>
                    <td>
                      {r.statut === 'en_attente' && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => verifierMut.mutate(r.id)}
                                  title="Vérifier le paiement Wave"
                                  className="p-1.5 rounded-lg hover:bg-blue-50 transition text-blue-600">
                            <RefreshCw size={15} className={verifierMut.isPending ? 'animate-spin' : ''} />
                          </button>
                          <button
                            onClick={() => {
                              if (r.wave_payment_status !== 'succeeded') {
                                toast.error('Paiement Wave non confirmé : validation impossible.');
                                return;
                              }
                              if (confirm('Valider ce reversement ?')) validerMut.mutate(r.id);
                            }}
                            disabled={r.wave_payment_status !== 'succeeded'}
                            title={r.wave_payment_status === 'succeeded' ? 'Valider' : 'Paiement Wave non confirmé'}
                            className="p-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed text-green-600 hover:bg-green-50">
                            <CheckCircle2 size={16} />
                          </button>
                          <button onClick={() => { setSelected(r); setModal('rejeter'); }}
                                  title="Rejeter" className="p-1.5 rounded-lg hover:bg-red-50 transition text-red-500">
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                      {r.statut !== 'en_attente' && <span className="text-xs text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modal === 'tous'} onClose={() => setModal(null)} title="Tous les reversements" size="lg">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="sim-table w-full text-sm">
            <thead><tr>
              <th>Date</th><th>Collecteur</th><th>Déclaré</th>
              <th>Paiement</th><th>Statut</th><th></th>
            </tr></thead>
            <tbody>
              {tousLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Chargement…</td></tr>
              ) : tousReversements.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucun reversement</td></tr>
              ) : tousReversements.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                  <td className="font-medium">{r.commercial_nom ?? `#${r.commercial_id}`}</td>
                  <td className="font-semibold" style={{ color: '#004B9C' }}>{Number(r.montant_declare).toLocaleString()} F</td>
                  <td><WaveStatusBadge statut={r.wave_payment_status} /></td>
                  <td>
                    <span className={
                      r.statut === 'valide' ? 'sim-badge-paye' :
                      r.statut === 'rejete' ? 'sim-badge-impaye' : 'sim-badge-attente'
                    }>
                      {r.statut === 'en_attente' ? 'En attente' : r.statut === 'valide' ? 'Validé' : 'Rejeté'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => { if (confirm('Supprimer ce reversement ? Action irréversible.')) supprimerMut.mutate(r.id); }}
                            title="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 transition text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal isOpen={modal === 'rejeter'} onClose={() => setModal(null)} title="Rejeter le reversement" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Précisez le motif du rejet :</p>
          <textarea className="sim-input resize-none h-24"
                    value={motif} onChange={e => setMotif(e.target.value)}
                    placeholder="Ex : Montant insuffisant, erreur de calcul…" />
          <div className="flex gap-3">
            <button onClick={() => { if (motif.trim()) rejeterMut.mutate({ id: selected!.id, motif }); }}
                    disabled={!motif.trim()}
                    className="sim-btn-danger flex-1 disabled:opacity-40">
              Confirmer le rejet
            </button>
            <button onClick={() => setModal(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Annuler
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function WaveStatusBadge({ statut }: { statut?: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    succeeded:  { label: 'Payé ✓',      bg: '#D1FAE5', color: '#065F46' },
    processing: { label: 'En cours…',   bg: '#FEF3C7', color: '#92400E' },
    failed:     { label: 'Échoué',      bg: '#FEE2E2', color: '#991B1B' },
    non_paye:   { label: 'Non payé',    bg: '#F3F4F6', color: '#6B7280' },
  };
  const s = map[statut ?? 'non_paye'] ?? map.non_paye;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
