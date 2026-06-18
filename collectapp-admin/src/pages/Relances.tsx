import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, Phone, User, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';
import type { Souscripteur } from '../types';

interface Retardataire extends Souscripteur { commercial_nom: string; }

export default function Relances() {
  const [jours, setJours] = useState(3);

  const { data, isLoading, refetch, isFetching } = useQuery<{ jours: number; count: number; retardataires: Retardataire[] }>({
    queryKey: ['retardataires', jours],
    queryFn: () => api.get(`/stats/retardataires?jours=${jours}`).then(r => r.data),
    refetchInterval: 60_000,
  });

  const retardataires = data?.retardataires ?? [];

  const handleExportCSV = () => {
    if (retardataires.length === 0) return;
    const header = 'Nom,Telephone,Montant journalier,Collecteur\n';
    const rows = retardataires.map(r =>
      `"${r.nom}",${r.telephone},${r.montant_journalier},"${r.commercial_nom ?? ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `relances_${jours}j_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Relances & Souscripteurs en retard" subtitle="Gestion des impayés" />

      <div className="p-6 space-y-5">
        {/* Alerte principale */}
        {(data?.count ?? 0) > 0 && (
          <div className="rounded-xl p-4 flex items-center gap-3 border" style={{ background: '#FEF3C7', borderColor: '#F5C518' }}>
            <AlertTriangle size={20} style={{ color: '#D97706' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#92400E' }}>
                {data!.count} souscripteur(s) n'ont pas payé depuis {jours} jour(s) ou plus
              </p>
              <p className="text-xs" style={{ color: '#B45309' }}>
                Montant total non collecté : {retardataires.reduce((s, r) => s + Number(r.montant_journalier) * jours, 0).toLocaleString()} FCFA estimé
              </p>
            </div>
          </div>
        )}

        {/* Filtres + actions */}
        <div className="sim-card p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: '#004B9C' }}>
              Souscripteurs en retard depuis :
            </label>
            <div className="flex gap-2">
              {[1, 3, 7, 14, 30].map(n => (
                <button key={n} onClick={() => setJours(n)}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
                        style={jours === n
                          ? { background: '#004B9C', color: 'white' }
                          : { background: '#EBF3FC', color: '#004B9C' }}>
                  {n}j
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} disabled={isFetching}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button onClick={handleExportCSV} disabled={retardataires.length === 0}
                    className="sim-btn-primary flex items-center gap-2 disabled:opacity-40">
              <Download size={15} /> Exporter CSV
            </button>
          </div>
        </div>

        {/* Tableau retardataires */}
        <div className="sim-card overflow-hidden">
          <div className="p-4 flex items-center gap-2 border-b border-gray-100" style={{ background: '#FEF3C7' }}>
            <AlertTriangle size={16} style={{ color: '#D97706' }} />
            <span className="text-sm font-semibold" style={{ color: '#92400E' }}>
              {isLoading ? '…' : `${data?.count ?? 0} souscripteur(s) en retard de ${jours} jour(s) ou plus`}
            </span>
          </div>
          <table className="sim-table w-full">
            <thead><tr>
              <th>Souscripteur</th><th>Téléphone</th>
              <th>Cotisation/jour</th><th>Collecteur</th>
              <th>Manque estimé ({jours}j)</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : retardataires.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: '#D1FAE5' }}>
                      <AlertTriangle size={20} style={{ color: '#059669' }} />
                    </div>
                    <p className="text-gray-500 text-sm">Aucun retardataire pour cette période 🎉</p>
                  </div>
                </td></tr>
              ) : retardataires.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                           style={{ background: '#E02020' }}>
                        {r.nom.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{r.nom}</span>
                    </div>
                  </td>
                  <td>
                    <a href={`tel:${r.telephone}`} className="flex items-center gap-1.5 hover:underline"
                       style={{ color: '#51AEE2' }}>
                      <Phone size={13} /> {r.telephone}
                    </a>
                  </td>
                  <td className="font-semibold" style={{ color: '#004B9C' }}>
                    {Number(r.montant_journalier).toLocaleString()} FCFA
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <User size={13} /> {r.commercial_nom ?? '—'}
                    </div>
                  </td>
                  <td>
                    <span className="sim-badge-impaye">
                      -{(Number(r.montant_journalier) * jours).toLocaleString()} FCFA
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {retardataires.length > 0 && (
            <div className="p-3 border-t border-gray-100 text-right">
              <span className="text-xs text-gray-400">{retardataires.length} résultat(s)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
