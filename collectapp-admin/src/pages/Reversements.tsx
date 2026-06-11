import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertTriangle, Filter } from 'lucide-react';
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
  const [modal, setModal] = useState<null | 'rejeter'>(null);

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
    onError: () => toast.error('Erreur'),
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
        </div>

        {/* Tableau */}
        <div className="sim-card overflow-hidden">
          <table className="sim-table w-full">
            <thead><tr>
              <th>Commercial</th><th>Déclaré</th><th>Attendu</th>
              <th>Écart</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : reversements.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aucun reversement pour cette journée</td></tr>
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
                        <div className="flex items-center gap-2">
                          <button onClick={() => { if (confirm('Valider ce reversement ?')) validerMut.mutate(r.id); }}
                                  title="Valider" className="p-1.5 rounded-lg hover:bg-green-50 transition text-green-600">
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
