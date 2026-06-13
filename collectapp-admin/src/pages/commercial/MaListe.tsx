import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, XCircle, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import type { Cotisant } from '../../types';

interface CotisantAvecStatut extends Cotisant {
  paye_aujourd_hui: boolean;
  heure_paiement?: string;
  mode_paiement?: string;
}

export default function MaListe() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<'tous' | 'payes' | 'impayes'>('tous');

  // Récupérer la liste des cotisants du commercial + paiements du jour
  const { data: cotisants = [], isLoading, refetch, isFetching } = useQuery<CotisantAvecStatut[]>({
    queryKey: ['ma-liste-commercial'],
    queryFn: async () => {
      const [listRes, paiementsRes] = await Promise.all([
        api.get('/cotisants'),
        api.get('/paiements/today'),
      ]);
      const paiementsAujourdhui = paiementsRes.data as { cotisant_id: number; horodatage: string; mode: string }[];
      return listRes.data.map((c: Cotisant) => {
        const p = paiementsAujourdhui.find(p => p.cotisant_id === c.id);
        return {
          ...c,
          paye_aujourd_hui: !!p,
          heure_paiement: p ? new Date(p.horodatage).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : undefined,
          mode_paiement: p?.mode,
        };
      });
    },
    refetchInterval: 30_000,
  });

  const filtered = cotisants.filter(c => {
    const matchSearch = !search ||
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.telephone.includes(search);
    const matchFiltre =
      filtre === 'tous' ? true :
      filtre === 'payes' ? c.paye_aujourd_hui :
      !c.paye_aujourd_hui;
    return matchSearch && matchFiltre && c.actif;
  });

  const stats = {
    total: cotisants.filter(c => c.actif).length,
    payes: cotisants.filter(c => c.paye_aujourd_hui).length,
    impayes: cotisants.filter(c => c.actif && !c.paye_aujourd_hui).length,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Stats du jour */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', val: stats.total, color: '#004B9C', bg: '#EBF3FC' },
          { label: 'Payés', val: stats.payes, color: '#059669', bg: '#D1FAE5' },
          { label: 'Impayés', val: stats.impayes, color: '#DC2626', bg: '#FEE2E2' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Barre collecte */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium" style={{ color: '#004B9C' }}>Progression du jour</span>
              <span className="font-bold" style={{ color: '#004B9C' }}>
                {Math.round(stats.payes / stats.total * 100)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${stats.payes / stats.total * 100}%`,
                            background: 'linear-gradient(90deg,#004B9C,#51AEE2)' }} />
            </div>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
                  className="p-2 rounded-lg transition" style={{ background: '#EBF3FC' }}>
            <RefreshCw size={16} style={{ color: '#004B9C' }}
                       className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="sim-input pl-9"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['tous', 'impayes', 'payes'] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
                  style={filtre === f
                    ? { background: '#004B9C', color: 'white' }
                    : { background: 'white', color: '#6B7280' }}>
            {f === 'tous' ? 'Tous' : f === 'impayes' ? '⚠ Impayés' : '✓ Payés'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Chargement de votre liste…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Aucun cotisant trouvé</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <button key={c.id}
                    onClick={() => navigate('/commercial/paiement', { state: { cotisant: c } })}
                    className="w-full bg-white rounded-xl p-4 flex items-center gap-3 text-left transition active:scale-95"
                    style={{ boxShadow: '0 1px 4px rgba(0,75,156,0.07)' }}>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                   style={{ background: c.paye_aujourd_hui ? '#059669' : '#DC2626' }}>
                {c.nom.charAt(0).toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">{c.nom}</p>
                <p className="text-xs text-gray-400 font-mono">{c.telephone}</p>
                {c.paye_aujourd_hui && c.heure_paiement && (
                  <p className="text-xs mt-0.5 font-medium" style={{ color: '#059669' }}>
                    ✓ Payé · {c.mode_paiement} · {c.heure_paiement}
                  </p>
                )}
              </div>
              {/* Statut + montant */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="font-bold text-sm" style={{ color: '#004B9C' }}>
                  {Number(c.montant_journalier).toLocaleString()} F
                </span>
                {c.paye_aujourd_hui
                  ? <CheckCircle2 size={18} style={{ color: '#059669' }} />
                  : <XCircle     size={18} style={{ color: '#DC2626' }} />
                }
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
