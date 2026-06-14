/**
 * Reversement de fin de journée (espèces uniquement) + historique
 * Route : /commercial/reversement
 * Le commercial charge son compte Wave avec les espèces collectées,
 * saisit le montant + son numéro Wave, valide, puis consulte son historique.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet2, CheckCircle2, TrendingDown, TrendingUp, Loader2,
  Smartphone, History, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

interface SommairePaiements {
  total_especes: number;
  nombre_especes: number;
  total_wave: number;
  date: string;
}

interface ReversementItem {
  id: number;
  montant_attendu: number;
  montant_declare: number;
  ecart: number;
  numero_wave?: string | null;
  wave_payment_status?: 'non_paye' | 'processing' | 'succeeded' | 'failed';
  statut: string;
  date: string;
  horodatage: string;
}

type Etape = 'saisie' | 'confirmation' | 'soumis';
type Onglet = 'nouveau' | 'historique';

export default function CommercialReversement() {
  const queryClient = useQueryClient();
  const [onglet, setOnglet] = useState<Onglet>('nouveau');
  const [etape, setEtape] = useState<Etape>('saisie');
  const [montantDeclare, setMontantDeclare] = useState('');
  const [numeroWave, setNumeroWave] = useState('');
  const [waveLoading, setWaveLoading] = useState(false);
  const [verifLoading, setVerifLoading] = useState(false);
  const [reversementSoumis, setReversementSoumis] = useState<ReversementItem | null>(null);

  const verifierStatut = async (id: number) => {
    setVerifLoading(true);
    try {
      const { data } = await api.get(`/reversements/${id}/statut-wave`);
      queryClient.invalidateQueries({ queryKey: ['reversement-today'] });
      queryClient.invalidateQueries({ queryKey: ['mes-reversements'] });
      const s = data.wave_payment_status;
      if (s === 'succeeded') toast.success('Paiement Wave confirmé ✓');
      else if (s === 'failed') toast.error('Paiement Wave échoué — reprenez le reversement');
      else toast('Paiement Wave toujours en cours…');
    } catch {
      toast.error('Vérification impossible');
    } finally {
      setVerifLoading(false);
    }
  };

  // Paiement Wave obligatoire : crée la session, ouvre Wave, puis enregistre le reversement
  const payerEtReverser = async () => {
    setWaveLoading(true);
    try {
      const { data } = await api.post('/reversements/wave-session', { montant: montantDeclareNum });
      if (!data?.wave_launch_url) { toast.error('Lien Wave indisponible'); return; }
      window.open(data.wave_launch_url, '_blank', 'noopener');
      reversementMutation.mutate({
        montant_declare: montantDeclareNum,
        montant_attendu: montantAttendu,
        numero_wave: numeroWave.trim() || data.id,
        wave_session_id: data.id,
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Paiement Wave impossible. Réessayez.');
    } finally {
      setWaveLoading(false);
    }
  };

  const { data: sommaire, isLoading } = useQuery<SommairePaiements>({
    queryKey: ['sommaire-paiements-today'],
    queryFn: () => api.get('/paiements/today/sommaire').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: reversementExistant } = useQuery<ReversementItem | null>({
    queryKey: ['reversement-today'],
    queryFn: async () => {
      try {
        return await api.get('/reversements/today').then(r => r.data);
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });

  const { data: historique = [], isLoading: histLoading } = useQuery<ReversementItem[]>({
    queryKey: ['mes-reversements'],
    queryFn: () => api.get('/reversements/mes').then(r => r.data),
    enabled: onglet === 'historique',
  });

  const reversementMutation = useMutation({
    mutationFn: (data: { montant_declare: number; montant_attendu: number; numero_wave: string; wave_session_id?: string }) =>
      api.post('/reversements', data).then(r => r.data),
    onSuccess: (data) => {
      setReversementSoumis(data);
      setEtape('soumis');
      queryClient.invalidateQueries({ queryKey: ['reversement-today'] });
      queryClient.invalidateQueries({ queryKey: ['mes-reversements'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Erreur lors de la soumission'),
  });

  const montantAttendu = sommaire?.total_especes ?? 0;
  const montantDeclareNum = parseFloat(montantDeclare) || 0;
  const ecart = montantDeclareNum - montantAttendu;

  const handleConfirmer = () => {
    if (montantDeclareNum <= 0) { toast.error('Saisissez un montant valide'); return; }
    if (numeroWave.trim().length < 8) { toast.error('Saisissez un numéro Wave valide'); return; }
    setEtape('confirmation');
  };

  // ════════ ONGLET HISTORIQUE ════════
  if (onglet === 'historique') {
    return (
      <div className="p-4 space-y-4">
        <OngletSwitch onglet={onglet} setOnglet={setOnglet} />
        {histLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin" style={{ color: '#004B9C' }} />
          </div>
        ) : historique.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Aucun reversement enregistré</div>
        ) : (
          <div className="space-y-2">
            {historique.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-4"
                   style={{ boxShadow: '0 1px 4px rgba(0,75,156,0.07)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm text-gray-800 capitalize">
                    {new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long' })}
                  </p>
                  <StatusBadge statut={r.statut} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#004B9C' }}>
                      {r.montant_declare.toLocaleString()} F
                    </p>
                    {r.numero_wave && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Smartphone size={11} /> {r.numero_wave}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>Attendu : {r.montant_attendu.toLocaleString()} F</p>
                    <p className="mt-0.5">
                      {new Date(r.horodatage).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════ ONGLET NOUVEAU ════════

  // Déjà soumis aujourd'hui
  if (reversementExistant && etape !== 'soumis') {
    return (
      <div className="p-4 space-y-4">
        <OngletSwitch onglet={onglet} setOnglet={setOnglet} />
        <div className="bg-white rounded-2xl p-5 space-y-4"
             style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#EBF3FC' }}>
              <Wallet2 size={22} style={{ color: '#004B9C' }} />
            </div>
            <div>
              <p className="font-bold text-gray-800">Reversement du jour</p>
              <p className="text-xs text-gray-400">
                {new Date(reversementExistant.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
              </p>
            </div>
            <div className="ml-auto"><StatusBadge statut={reversementExistant.statut} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div className="text-center p-3 rounded-xl" style={{ background: '#EBF3FC' }}>
              <p className="text-xs text-gray-500 mb-1">Attendu (espèces)</p>
              <p className="font-bold" style={{ color: '#004B9C' }}>{reversementExistant.montant_attendu.toLocaleString()} F</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: '#F0FDF4' }}>
              <p className="text-xs text-gray-500 mb-1">Déclaré</p>
              <p className="font-bold" style={{ color: '#059669' }}>{reversementExistant.montant_declare.toLocaleString()} F</p>
            </div>
          </div>
          {reversementExistant.numero_wave && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: '#F4F6FA' }}>
              <Smartphone size={15} style={{ color: '#004B9C' }} />
              <span className="text-gray-600">Reversé via Wave :</span>
              <span className="font-semibold font-mono" style={{ color: '#004B9C' }}>{reversementExistant.numero_wave}</span>
            </div>
          )}
          <EcartCard ecart={reversementExistant.ecart} />

          {/* Statut du paiement Wave */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm"
               style={{ background: '#F4F6FA' }}>
            <span className="text-gray-600">Paiement Wave</span>
            <WaveStatusPill statut={reversementExistant.wave_payment_status} />
          </div>
        </div>

        {reversementExistant.wave_payment_status === 'failed' ? (
          <button onClick={() => { setEtape('saisie'); setMontantDeclare(String(reversementExistant.montant_declare)); }}
                  className="sim-btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Reprendre le paiement
          </button>
        ) : reversementExistant.wave_payment_status === 'succeeded' ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: '#D1FAE5', color: '#065F46' }}>
            <CheckCircle2 size={16} />
            <p>Paiement confirmé — en attente de validation admin</p>
          </div>
        ) : (
          <button onClick={() => verifierStatut(reversementExistant.id)} disabled={verifLoading}
                  className="sim-btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2">
            {verifLoading ? <><Loader2 size={16} className="animate-spin" /> Vérification…</>
                          : <><RefreshCw size={16} /> Vérifier le paiement Wave</>}
          </button>
        )}
      </div>
    );
  }

  // Soumis (confirmation de succès)
  if (etape === 'soumis' && reversementSoumis) {
    return (
      <div className="p-6 flex flex-col items-center gap-5 min-h-[60vh] justify-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#D1FAE5' }}>
          <CheckCircle2 size={44} style={{ color: '#059669' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Reversement soumis !</p>
          <p className="text-sm text-gray-500 mt-1">En attente de validation admin</p>
        </div>
        <div className="w-full bg-white rounded-2xl p-5 space-y-3" style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          {[
            { label: 'Montant attendu (espèces)', val: reversementSoumis.montant_attendu, color: '#004B9C', bg: '#EBF3FC' },
            { label: 'Montant déclaré', val: reversementSoumis.montant_declare, color: '#059669', bg: '#F0FDF4' },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className="flex justify-between items-center px-3 py-2 rounded-xl" style={{ background: bg }}>
              <span className="text-sm text-gray-600">{label}</span>
              <span className="font-bold" style={{ color }}>{val.toLocaleString()} F</span>
            </div>
          ))}
          {reversementSoumis.numero_wave && (
            <div className="flex justify-between items-center px-3 py-2 rounded-xl" style={{ background: '#F4F6FA' }}>
              <span className="text-sm text-gray-600">Numéro Wave</span>
              <span className="font-bold font-mono" style={{ color: '#004B9C' }}>{reversementSoumis.numero_wave}</span>
            </div>
          )}
          <EcartCard ecart={reversementSoumis.ecart} />
        </div>
        <button onClick={() => setOnglet('historique')}
                className="sim-btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2">
          <History size={16} /> Voir mon historique
        </button>
      </div>
    );
  }

  // Confirmation
  if (etape === 'confirmation') {
    return (
      <div className="p-4 space-y-5">
        <p className="font-semibold text-gray-700 text-center">Confirmer le reversement</p>
        <div className="bg-white rounded-2xl p-5 space-y-4" style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 rounded-xl" style={{ background: '#EBF3FC' }}>
              <p className="text-xs text-gray-500 mb-1">Attendu (espèces)</p>
              <p className="text-xl font-bold" style={{ color: '#004B9C' }}>{montantAttendu.toLocaleString()}</p>
              <p className="text-xs text-gray-400">FCFA</p>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: '#F0FDF4' }}>
              <p className="text-xs text-gray-500 mb-1">Déclaré</p>
              <p className="text-xl font-bold" style={{ color: '#059669' }}>{montantDeclareNum.toLocaleString()}</p>
              <p className="text-xs text-gray-400">FCFA</p>
            </div>
          </div>
          <EcartCard ecart={ecart} />
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: '#F4F6FA' }}>
            <Smartphone size={15} style={{ color: '#004B9C' }} />
            <span className="text-gray-600">Numéro Wave :</span>
            <span className="font-semibold font-mono" style={{ color: '#004B9C' }}>{numeroWave}</span>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Le reversement se règle via Wave. En continuant, vous payez le montant à SIM et le reversement est enregistré.
        </p>

        <button onClick={payerEtReverser} disabled={waveLoading || reversementMutation.isPending}
                className="sim-btn-primary w-full py-4 rounded-xl flex items-center justify-center gap-2">
          {(waveLoading || reversementMutation.isPending)
            ? <><Loader2 size={18} className="animate-spin" /> Ouverture de Wave…</>
            : <><Smartphone size={18} /> Payer le reversement via Wave</>}
        </button>
        <button onClick={() => setEtape('saisie')} className="w-full py-2 text-sm font-medium" style={{ color: '#004B9C' }}>
          Modifier le montant
        </button>
      </div>
    );
  }

  // Saisie
  return (
    <div className="p-4 space-y-5">
      <OngletSwitch onglet={onglet} setOnglet={setOnglet} />

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={24} className="animate-spin" style={{ color: '#004B9C' }} />
        </div>
      ) : (
        <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#004B9C,#1565C0)' }}>
          <p className="text-white/70 text-sm">Espèces collectées aujourd'hui</p>
          <p className="text-white text-3xl font-bold mt-2">{montantAttendu.toLocaleString()} FCFA</p>
          <p className="text-white/60 text-xs mt-1">
            {sommaire?.nombre_especes ?? 0} paiement(s) espèces
            {(sommaire?.total_wave ?? 0) > 0 && ` · ${(sommaire?.total_wave ?? 0).toLocaleString()} F en Wave (déjà encaissé)`}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 space-y-4" style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#EBF3FC' }}>
            <Wallet2 size={20} style={{ color: '#004B9C' }} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Déclarer votre reversement</p>
            <p className="text-xs text-gray-500">Espèces chargées sur votre compte Wave</p>
          </div>
        </div>

        <div>
          <label className="sim-label">Montant à reverser (FCFA)</label>
          <input type="number" className="sim-input mt-1 text-center text-2xl font-bold py-4"
                 placeholder="0" value={montantDeclare}
                 onChange={e => setMontantDeclare(e.target.value)} min="0" autoFocus />
        </div>

        <button onClick={() => setMontantDeclare(String(montantAttendu))}
                className="w-full py-2 rounded-xl text-sm font-medium transition"
                style={{ background: '#EBF3FC', color: '#004B9C' }}>
          Utiliser le montant attendu ({montantAttendu.toLocaleString()} F)
        </button>

        <div>
          <label className="sim-label flex items-center gap-1.5">
            <Smartphone size={13} /> Votre numéro Wave (chargé du montant)
          </label>
          <input type="tel" className="sim-input mt-1 text-center text-lg font-semibold font-mono py-3"
                 placeholder="07 00 00 00 00" value={numeroWave}
                 onChange={e => setNumeroWave(e.target.value)} />
        </div>

        {montantDeclare !== '' && montantAttendu > 0 && <EcartCard ecart={ecart} />}
      </div>

      <button onClick={handleConfirmer} disabled={montantDeclareNum <= 0}
              className="sim-btn-primary w-full py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
        Continuer vers la confirmation
      </button>
    </div>
  );
}

// ──────────── Sélecteur d'onglet ────────────
function OngletSwitch({ onglet, setOnglet }: { onglet: Onglet; setOnglet: (o: Onglet) => void }) {
  return (
    <div className="flex gap-2">
      {([['nouveau', 'Nouveau'], ['historique', 'Historique']] as [Onglet, string][]).map(([key, label]) => (
        <button key={key} onClick={() => setOnglet(key)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                style={onglet === key
                  ? { background: '#004B9C', color: 'white' }
                  : { background: 'white', color: '#6B7280' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function EcartCard({ ecart }: { ecart: number }) {
  const isExact = ecart === 0;
  const isExcedent = ecart > 0;
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl"
         style={{ background: isExact ? '#F0FDF4' : isExcedent ? '#EFF6FF' : '#FEF2F2' }}>
      <div className="flex items-center gap-2">
        {isExact ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
          : isExcedent ? <TrendingUp size={16} style={{ color: '#2563EB' }} />
          : <TrendingDown size={16} style={{ color: '#DC2626' }} />}
        <span className="text-sm font-medium"
              style={{ color: isExact ? '#059669' : isExcedent ? '#2563EB' : '#DC2626' }}>
          {isExact ? 'Montant exact' : isExcedent ? 'Excédent' : 'Déficit'}
        </span>
      </div>
      <span className="font-bold text-sm"
            style={{ color: isExact ? '#059669' : isExcedent ? '#2563EB' : '#DC2626' }}>
        {isExact ? '—' : `${ecart > 0 ? '+' : ''}${ecart.toLocaleString()} F`}
      </span>
    </div>
  );
}

function WaveStatusPill({ statut }: { statut?: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    succeeded:  { label: 'Payé ✓',    bg: '#D1FAE5', color: '#065F46' },
    processing: { label: 'En cours…', bg: '#FEF3C7', color: '#92400E' },
    failed:     { label: 'Échoué',    bg: '#FEE2E2', color: '#991B1B' },
    non_paye:   { label: 'Non payé',  bg: '#F3F4F6', color: '#6B7280' },
  };
  const s = map[statut ?? 'non_paye'] ?? map.non_paye;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    en_attente: { label: 'En attente', bg: '#FEF3C7', color: '#92400E' },
    valide:     { label: 'Validé ✓',   bg: '#D1FAE5', color: '#065F46' },
    rejete:     { label: 'Rejeté',     bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = map[statut] ?? map.en_attente;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
