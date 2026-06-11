import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, Award, Repeat } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';
import api from '../api/axios';
import TopBar from '../components/layout/TopBar';

const today = () => new Date().toISOString().slice(0, 10);
const COLORS = ['#004B9C', '#51AEE2', '#E86B1F', '#F5C518', '#E02020'];

export default function Statistiques() {
  const [debut, setDebut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10);
  });
  const [fin, setFin]   = useState(today);
  const [format, setFmt] = useState<'csv' | 'pdf'>('csv');

  const { data: taux } = useQuery({
    queryKey: ['taux', debut, fin],
    queryFn: () => api.get(`/stats/taux-collecte?date=${fin}`).then(r => r.data),
  });

  const { data: classement = [] } = useQuery({
    queryKey: ['classement', debut, fin],
    queryFn: () => api.get(`/stats/commerciaux?debut=${debut}&fin=${fin}`).then(r => r.data),
  });

  const { data: retard = [] } = useQuery({
    queryKey: ['retard', 3],
    queryFn: () => api.get('/stats/retardataires?jours=3').then(r => r.data),
  });

  const handleExport = async () => {
    try {
      const res = await api.get(`/stats/export?debut=${debut}&fin=${fin}&format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json',
      });
      if (format === 'csv') {
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url; a.download = `paiements_${debut}_${fin}.csv`; a.click();
      }
    } catch { /* silencieux */ }
  };

  const barData = classement.map((c: { nom: string; total_collecte: string; nb_paiements: string }) => ({
    name: c.nom.split(' ')[0],
    collecte: parseFloat(c.total_collecte),
    paiements: parseInt(c.nb_paiements),
  }));

  const tauxVal = taux?.taux_collecte ?? 0;

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Statistiques & Rapports" subtitle="Analyse des performances de collecte" />

      <div className="p-6 space-y-6">
        {/* Filtres + export */}
        <div className="sim-card p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Du</span>
              <input type="date" className="sim-input w-auto" value={debut} onChange={e => setDebut(e.target.value)} max={fin} />
              <span>au</span>
              <input type="date" className="sim-input w-auto" value={fin} onChange={e => setFin(e.target.value)} min={debut} max={today()} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="sim-input w-24" value={format} onChange={e => setFmt(e.target.value as 'csv' | 'pdf')}>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button onClick={handleExport} className="sim-btn-primary flex items-center gap-2">
              <Download size={15} /> Exporter
            </button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sim-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#EBF3FC' }}>
              <TrendingUp size={22} style={{ color: '#004B9C' }} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Taux de collecte</p>
              <p className="text-3xl font-bold mt-0.5" style={{ color: '#004B9C' }}>{tauxVal}%</p>
              <div className="h-1.5 rounded-full bg-gray-100 mt-1.5 w-32 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${tauxVal}%`, background: 'linear-gradient(90deg,#004B9C,#51AEE2)' }} />
              </div>
            </div>
          </div>
          <div className="sim-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#D1FAE5' }}>
              <Award size={22} style={{ color: '#059669' }} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Meilleur commercial</p>
              <p className="text-base font-bold mt-0.5" style={{ color: '#059669' }}>
                {classement[0]?.nom ?? '—'}
              </p>
              <p className="text-xs text-gray-400">
                {classement[0] ? `${parseFloat(classement[0].total_collecte).toLocaleString()} FCFA` : ''}
              </p>
            </div>
          </div>
          <div className="sim-card p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#FEE2E2' }}>
              <Repeat size={22} style={{ color: '#DC2626' }} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Retardataires (3j)</p>
              <p className="text-3xl font-bold mt-0.5" style={{ color: '#DC2626' }}>
                {retard?.count ?? '…'}
              </p>
            </div>
          </div>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar — classement commerciaux */}
          <div className="sim-card p-5">
            <p className="sim-section-title mb-4">Classement des commerciaux</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBF3FC" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
                  <Bar dataKey="collecte" fill="#004B9C" radius={[4, 4, 0, 0]} name="Collecté" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
            )}
          </div>

          {/* Pie — taux payés vs impayés */}
          <div className="sim-card p-5">
            <p className="sim-section-title mb-4">Payés vs Non payés</p>
            {taux ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Ont payé', value: taux.payes },
                      { name: "N'ont pas payé", value: taux.total - taux.payes },
                    ]}
                    cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell fill="#004B9C" />
                    <Cell fill="#FEE2E2" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-gray-400 text-sm">Chargement…</div>
            )}
          </div>
        </div>

        {/* Tableau nb paiements par commercial */}
        {barData.length > 0 && (
          <div className="sim-card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <p className="sim-section-title">Détail par commercial</p>
            </div>
            <table className="sim-table w-full">
              <thead><tr><th>Rang</th><th>Commercial</th><th>Paiements</th><th>Montant collecté</th><th>Progression</th></tr></thead>
              <tbody>
                {classement.map((c: { nom: string; total_collecte: string; nb_paiements: string }, i: number) => {
                  const max = parseFloat(classement[0]?.total_collecte ?? '1');
                  const pct = (parseFloat(c.total_collecte) / max * 100).toFixed(0);
                  return (
                    <tr key={i}>
                      <td><span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{ background: i === 0 ? '#004B9C' : i === 1 ? '#51AEE2' : '#9CA3AF' }}>{i + 1}</span></td>
                      <td className="font-medium">{c.nom}</td>
                      <td>{c.nb_paiements}</td>
                      <td className="font-semibold" style={{ color: '#004B9C' }}>{parseFloat(c.total_collecte).toLocaleString()} FCFA</td>
                      <td className="w-36">
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#004B9C' }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
