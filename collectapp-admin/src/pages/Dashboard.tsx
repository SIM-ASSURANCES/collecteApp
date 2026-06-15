import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, CheckCircle2, XCircle, TrendingUp, Smartphone, Banknote, Clock, Wallet, CalendarRange } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../api/axios';
import { useSSE } from '../hooks/useSSE';
import TopBar from '../components/layout/TopBar';
import type { DashboardData } from '../types';

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; bg: string;
}) {
  return (
    <div className="sim-card p-5 flex items-start gap-4">
      <div className="p-3 rounded-xl flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: '#1A2B4A' }}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const COLORS = ['#004B9C', '#51AEE2', '#7EC8E3', '#E86B1F'];

type PeriodeKey = 'jour' | 'semaine' | 'mois' | 'annee' | 'perso';

// Calcule la plage [debut, fin] (format YYYY-MM-DD) pour une période
function calcPeriode(key: PeriodeKey, anneeSel: number): { debut: string; fin: string } | null {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  if (key === 'jour') return null; // pas de filtre période → vue du jour
  if (key === 'semaine') {
    const d = new Date(now); const day = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - day);
    return { debut: fmt(d), fin: fmt(now) };
  }
  if (key === 'mois') {
    return { debut: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fin: fmt(now) };
  }
  if (key === 'annee' || key === 'perso') {
    return { debut: `${anneeSel}-01-01`, fin: `${anneeSel}-12-31` };
  }
  return null;
}

export default function Dashboard() {
  const [periode, setPeriode] = useState<PeriodeKey>('jour');
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);

  const plage = useMemo(() => calcPeriode(periode, annee), [periode, annee]);
  const periodeQs = plage ? `?debut=${plage.debut}&fin=${plage.fin}` : '';

  const { data, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', periodeQs],
    queryFn: () => api.get(`/stats/dashboard${periodeQs}`).then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: taux } = useQuery({
    queryKey: ['taux-collecte'],
    queryFn: () => api.get('/stats/taux-collecte').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: classement } = useQuery({
    queryKey: ['classement'],
    queryFn: () => api.get('/stats/commerciaux').then(r => r.data),
    refetchInterval: 120_000,
  });

  const handleSSE = useCallback((event: unknown) => {
    const e = event as { type: string };
    if (['PAIEMENT_NOUVEAU', 'WAVE_DOUBLON', 'WAVE_INCONNU'].includes(e.type)) refetch();
  }, [refetch]);
  useSSE(handleSSE);

  const totalManuel = data?.montants_par_mode
    .filter(m => m.mode !== 'wave')
    .reduce((s, m) => s + parseFloat(m.total), 0) ?? 0;
  const totalWave = parseFloat(data?.montants_par_mode.find(m => m.mode === 'wave')?.total ?? '0');
  const totalCollecte = totalManuel + totalWave;

  const pieData = (data?.montants_par_mode ?? []).map(m => ({
    name: m.mode.charAt(0).toUpperCase() + m.mode.slice(1),
    value: parseFloat(m.total),
  }));

  const barData = (classement ?? []).slice(0, 6).map((c: { nom: string; total_collecte: string }) => ({
    name: c.nom.split(' ')[0],
    montant: parseFloat(c.total_collecte),
  }));

  const tauxVal = taux?.taux_collecte ?? 0;

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Tableau de bord" subtitle={taux?.date} />

      <div className="p-6 space-y-6">
        {/* Filtres de période */}
        <div className="sim-card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange size={16} style={{ color: '#004B9C' }} />
            <span className="text-sm font-medium" style={{ color: '#004B9C' }}>Période :</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {([['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['annee', 'Année']] as [PeriodeKey, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setPeriode(k)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
                      style={periode === k ? { background: '#004B9C', color: 'white' } : { background: '#EBF3FC', color: '#004B9C' }}>
                {label}
              </button>
            ))}
          </div>
          {(periode === 'annee') && (
            <select className="sim-input w-auto ml-1" value={annee} onChange={e => setAnnee(parseInt(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => anneeCourante - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          {plage && data?.ca_periode != null && (
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">CA collecté sur la période</p>
              <p className="font-bold text-lg" style={{ color: '#004B9C' }}>
                {data.ca_periode.toLocaleString()} FCFA
                <span className="text-xs text-gray-400 font-normal ml-2">{data.nombre_paiements_periode} paiement(s)</span>
              </p>
            </div>
          )}
        </div>

        {/* Cartes CA globales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Wallet}     label="CA collecté du jour"      value={`${(data?.ca_collecte_jour ?? 0).toLocaleString()} F`}     sub="global, aujourd'hui" color="#059669" bg="#D1FAE5" />
          <StatCard icon={Clock}      label="CA non collecté du jour"  value={`${(data?.ca_non_collecte_jour ?? 0).toLocaleString()} F`} sub="reste à encaisser"   color="#DC2626" bg="#FEE2E2" />
          <StatCard icon={TrendingUp} label="CA total collecté"        value={`${(data?.ca_total ?? 0).toLocaleString()} F`}            sub="toutes périodes"     color="#004B9C" bg="#EBF3FC" />
        </div>

        {/* Bande de statut collecte */}
        <div className="sim-card p-4 flex items-center gap-4" style={{ borderLeft: '4px solid #004B9C' }}>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-semibold" style={{ color: '#004B9C' }}>
                Taux de collecte du jour
              </span>
              <span className="text-sm font-bold" style={{ color: '#004B9C' }}>{tauxVal}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${tauxVal}%`, background: 'linear-gradient(90deg,#004B9C,#51AEE2)' }}
              />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-500">Payés</p>
            <p className="font-bold text-lg" style={{ color: '#004B9C' }}>
              {taux?.payes ?? '…'} / {taux?.total ?? '…'}
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}        label="Cotisants actifs"  value={data?.total_cotisants ?? '…'} color="#004B9C" bg="#EBF3FC" />
          <StatCard icon={CheckCircle2} label="Ont payé"          value={data?.payes ?? '…'}          sub="aujourd'hui" color="#059669" bg="#D1FAE5" />
          <StatCard icon={XCircle}      label="N'ont pas payé"    value={data?.non_payes ?? '…'}      sub="à relancer"  color="#DC2626" bg="#FEE2E2" />
          <StatCard icon={TrendingUp}   label="Total collecté"    value={`${totalCollecte.toLocaleString()} F`} sub="CFA aujourd'hui" color="#D97706" bg="#FEF3C7" />
        </div>

        {/* Ligne 2 : Mode de paiement + Classement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart modes */}
          <div className="sim-card p-5">
            <p className="sim-section-title mb-4">Répartition par mode</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                Aucun paiement enregistré aujourd'hui
              </div>
            )}
          </div>

          {/* Bar chart classement commerciaux */}
          <div className="sim-card p-5">
            <p className="sim-section-title mb-4">Top commerciaux du jour</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
                  <Bar dataKey="montant" fill="#004B9C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>

        {/* Détail modes de paiement */}
        <div className="sim-card p-5">
          <p className="sim-section-title mb-4">Détail des collectes — aujourd'hui</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#EBF3FC' }}>
              <Smartphone size={22} style={{ color: '#004B9C' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Wave Mobile</p>
                <p className="font-bold text-lg" style={{ color: '#004B9C' }}>
                  {totalWave.toLocaleString()} FCFA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F0FDF4' }}>
              <Banknote size={22} style={{ color: '#059669' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Espèces / Manuel</p>
                <p className="font-bold text-lg" style={{ color: '#059669' }}>
                  {totalManuel.toLocaleString()} FCFA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#FEF3C7' }}>
              <Clock size={22} style={{ color: '#D97706' }} />
              <div>
                <p className="text-xs text-gray-500 font-medium">Total collecté</p>
                <p className="font-bold text-lg" style={{ color: '#D97706' }}>
                  {totalCollecte.toLocaleString()} FCFA
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
