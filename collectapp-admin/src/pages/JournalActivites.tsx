import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, RefreshCw, Filter } from 'lucide-react';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';
import type { JournalActivite } from '../types';

const ENTITE_COLORS: Record<string, { bg: string; color: string }> = {
  souscripteur: { bg: '#EBF3FC', color: '#004B9C' },
  collecteur:   { bg: '#D1FAE5', color: '#065F46' },
  reversement:  { bg: '#FEF3C7', color: '#92400E' },
  utilisateur:  { bg: '#EDE9FE', color: '#5B21B6' },
};

const ACTION_ICONS: Record<string, string> = {
  LOGIN: '🔐',
  SOUSCRIPTEUR_CREE: '➕',
  SOUSCRIPTEUR_MODIFIE: '✏️',
  SOUSCRIPTEUR_SUPPRIME: '🗑️',
  SOUSCRIPTEUR_ACTIVE: '✅',
  SOUSCRIPTEUR_DESACTIVE: '⛔',
  COLLECTEUR_CREE: '➕',
  COLLECTEUR_MODIFIE: '✏️',
  COLLECTEUR_SUPPRIME: '🗑️',
  REVERSEMENT_VALIDE: '✅',
  REVERSEMENT_REJETE: '❌',
  REVERSEMENT_SUPPRIME: '🗑️',
  UTILISATEUR_CREE: '👤',
  UTILISATEUR_MODIFIE: '✏️',
};

export default function JournalActivites() {
  const [entiteFilter, setEntiteFilter] = useState('');

  const { data: journal = [], isLoading, refetch, isFetching } = useQuery<JournalActivite[]>({
    queryKey: ['journal', entiteFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (entiteFilter) params.set('entite', entiteFilter);
      return api.get(`/journal?${params}`).then(r => r.data);
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Journal d'activités" subtitle="Historique des actions effectuées sur la plateforme" />

      <div className="p-6 space-y-5">
        {/* Filtres */}
        <div className="sim-card p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter size={15} className="text-gray-400" />
            <select className="sim-input w-auto text-sm" value={entiteFilter} onChange={e => setEntiteFilter(e.target.value)}>
              <option value="">Toutes les entités</option>
              <option value="souscripteur">Souscripteurs</option>
              <option value="collecteur">Collecteurs</option>
              <option value="reversement">Reversements</option>
              <option value="utilisateur">Utilisateurs</option>
            </select>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {/* Tableau */}
        <div className="sim-card overflow-hidden">
          {journal.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#EBF3FC' }}>
                <ScrollText size={26} style={{ color: '#004B9C' }} />
              </div>
              <p className="text-gray-400 text-sm">Aucune activité enregistrée</p>
              <p className="text-gray-300 text-xs">Les actions apparaîtront ici au fur et à mesure</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">Date / Heure</th>
                  <th className="px-5 py-3">Utilisateur</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entité</th>
                  <th className="px-5 py-3">Détails</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">Chargement…</td></tr>
                ) : journal.map(entry => {
                  const entiteStyle = ENTITE_COLORS[entry.entite ?? ''] ?? { bg: '#F3F4F6', color: '#6B7280' };
                  return (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/40 transition">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-800 text-xs">{entry.utilisateur_nom ?? '—'}</p>
                        {entry.utilisateur_role && (
                          <p className="text-[10px] text-gray-400 uppercase">{entry.utilisateur_role}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <span>{ACTION_ICONS[entry.action] ?? '•'}</span>
                          {entry.action_label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {entry.entite && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                                style={{ background: entiteStyle.bg, color: entiteStyle.color }}>
                            {entry.entite} {entry.entite_id ? `#${entry.entite_id}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                        {entry.details
                          ? Object.entries(entry.details)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 text-right">
          {journal.length} entrée(s) affichée(s) · Les 200 plus récentes
        </p>
      </div>
    </div>
  );
}
