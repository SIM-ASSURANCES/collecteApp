/**
 * Déclaration du reversement de fin de journée
 * Route : /commercial/reversement
 * EF-26 : affiche le montant attendu (calculé par le serveur)
 * EF-27 : saisie du montant déclaré + confirmation
 * EF-28 : affiche l'écart et le statut soumis
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wallet2, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, Loader2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

interface SommairePaiements {
  total_encaisse: number;
  nombre_paiements: number;
  date: string;
}

interface ReversementSoumis {
  id: number;
  montant_attendu: number;
  montant_declare: number;
  ecart: number;
  statut: string;
  date: string;
}

type Etape = 'saisie' | 'confirmation' | 'soumis';

export default function CommercialReversement() {
  const { user } = useAuthStore();
  const [etape, setEtape] = useState<Etape>('saisie');
  const [montantDeclare, setMontantDeclare] = useState('');
  const [reversementSoumis, setReversementSoumis] = useState<ReversementSoumis | null>(null);

  // Récupérer le sommaire des paiements du jour (montant attendu)
  const { data: sommaire, isLoading } = useQuery<SommairePaiements>({
    queryKey: ['sommaire-paiements-today'],
    queryFn: () => api.get('/paiements/today/sommaire').then(r => r.data),
    refetchInterval: 60_000,
  });

  // Vérifier si un reversement a déjà été soumis aujourd'hui
  const { data: reversementExistant } = useQuery<ReversementSoumis | null>({
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

  const reversementMutation = useMutation({
    mutationFn: (data: { montant_declare: number; montant_attendu: number }) =>
      api.post('/reversements', data).then(r => r.data),
    onSuccess: (data) => {
      setReversementSoumis(data);
      setEtape('soumis');
    },
    onError: () => toast.error('Erreur lors de la soumission du reversement'),
  });

  const montantAttendu = sommaire?.total_encaisse ?? 0;
  const montantDeclareNum = parseFloat(montantDeclare) || 0;
  const ecart = montantDeclareNum - montantAttendu;

  const handleConfirmer = () => {
    if (montantDeclareNum <= 0) {
      toast.error('Veuillez saisir un montant valide');
      return;
    }
    setEtape('confirmation');
  };

  const handleSoumettre = () => {
    reversementMutation.mutate({
      montant_declare: montantDeclareNum,
      montant_attendu: montantAttendu,
    });
  };

  // ── Si reversement déjà soumis aujourd'hui ──
  if (reversementExistant) {
    const e = reversementExistant.ecart;
    return (
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-5 space-y-4"
             style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                 style={{ background: '#EBF3FC' }}>
              <Wallet2 size={22} style={{ color: '#004B9C' }} />
            </div>
            <div>
              <p className="font-bold text-gray-800">Reversement du jour</p>
              <p className="text-xs text-gray-400">
                {new Date(reversementExistant.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
              </p>
            </div>
            <div className="ml-auto">
              <StatusBadge statut={reversementExistant.statut} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div className="text-center p-3 rounded-xl" style={{ background: '#EBF3FC' }}>
              <p className="text-xs text-gray-500 mb-1">Attendu</p>
              <p className="font-bold" style={{ color: '#004B9C' }}>
                {reversementExistant.montant_attendu.toLocaleString()} F
              </p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: '#F0FDF4' }}>
              <p className="text-xs text-gray-500 mb-1">Déclaré</p>
              <p className="font-bold" style={{ color: '#059669' }}>
                {reversementExistant.montant_declare.toLocaleString()} F
              </p>
            </div>
          </div>

          <EcartCard ecart={reversementExistant.ecart} />
        </div>

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
             style={{ background: '#EBF3FC', color: '#004B9C' }}>
          <Clock size={16} />
          <p>En attente de validation par l'administrateur</p>
        </div>
      </div>
    );
  }

  // ── SOUMIS ──
  if (etape === 'soumis' && reversementSoumis) {
    return (
      <div className="p-6 flex flex-col items-center gap-5 min-h-[60vh] justify-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
             style={{ background: '#D1FAE5' }}>
          <CheckCircle2 size={44} style={{ color: '#059669' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Reversement soumis !</p>
          <p className="text-sm text-gray-500 mt-1">En attente de validation admin</p>
        </div>

        <div className="w-full bg-white rounded-2xl p-5 space-y-3"
             style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          {[
            { label: 'Montant attendu', val: reversementSoumis.montant_attendu, color: '#004B9C', bg: '#EBF3FC' },
            { label: 'Montant déclaré', val: reversementSoumis.montant_declare, color: '#059669', bg: '#F0FDF4' },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className="flex justify-between items-center px-3 py-2 rounded-xl" style={{ background: bg }}>
              <span className="text-sm text-gray-600">{label}</span>
              <span className="font-bold" style={{ color }}>{val.toLocaleString()} F</span>
            </div>
          ))}
          <EcartCard ecart={reversementSoumis.ecart} />
        </div>
      </div>
    );
  }

  // ── CONFIRMATION ──
  if (etape === 'confirmation') {
    return (
      <div className="p-4 space-y-5">
        <p className="font-semibold text-gray-700 text-center">Confirmer le reversement</p>

        <div className="bg-white rounded-2xl p-5 space-y-4"
             style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 rounded-xl" style={{ background: '#EBF3FC' }}>
              <p className="text-xs text-gray-500 mb-1">Montant attendu</p>
              <p className="text-xl font-bold" style={{ color: '#004B9C' }}>
                {montantAttendu.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">FCFA</p>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: '#F0FDF4' }}>
              <p className="text-xs text-gray-500 mb-1">Montant déclaré</p>
              <p className="text-xl font-bold" style={{ color: '#059669' }}>
                {montantDeclareNum.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">FCFA</p>
            </div>
          </div>

          <EcartCard ecart={ecart} />

          <div className="text-sm text-gray-600 text-center">
            <p>Vous déclarez reverser</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#004B9C' }}>
              {montantDeclareNum.toLocaleString()} FCFA
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setEtape('saisie')}
                  className="sim-btn-secondary flex-1 py-3 rounded-xl">
            Modifier
          </button>
          <button onClick={handleSoumettre} disabled={reversementMutation.isPending}
                  className="sim-btn-primary flex-1 py-3 rounded-xl flex items-center justify-center gap-2">
            {reversementMutation.isPending
              ? <><Loader2 size={18} className="animate-spin" /> Envoi…</>
              : <><CheckCircle2 size={18} /> Soumettre</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── SAISIE ──
  return (
    <div className="p-4 space-y-5">
      {/* Sommaire journalier */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={24} className="animate-spin" style={{ color: '#004B9C' }} />
        </div>
      ) : (
        <div className="rounded-2xl p-5 text-center"
             style={{ background: 'linear-gradient(135deg,#004B9C,#1565C0)' }}>
          <p className="text-white/70 text-sm">Paiements collectés aujourd'hui</p>
          <p className="text-white text-3xl font-bold mt-2">
            {montantAttendu.toLocaleString()} FCFA
          </p>
          <p className="text-white/60 text-xs mt-1">
            {sommaire?.nombre_paiements ?? 0} paiement{(sommaire?.nombre_paiements ?? 0) > 1 ? 's' : ''} enregistré{(sommaire?.nombre_paiements ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Saisie montant déclaré */}
      <div className="bg-white rounded-2xl p-5 space-y-4"
           style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: '#EBF3FC' }}>
            <Wallet2 size={20} style={{ color: '#004B9C' }} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Déclarer votre reversement</p>
            <p className="text-xs text-gray-500">Montant physique en votre possession</p>
          </div>
        </div>

        <div>
          <label className="sim-label">Montant à reverser (FCFA)</label>
          <input
            type="number"
            className="sim-input mt-1 text-center text-2xl font-bold py-4"
            placeholder="0"
            value={montantDeclare}
            onChange={e => setMontantDeclare(e.target.value)}
            min="0"
            autoFocus
          />
        </div>

        {/* Pré-remplir avec montant attendu */}
        <button onClick={() => setMontantDeclare(String(montantAttendu))}
                className="w-full py-2 rounded-xl text-sm font-medium transition"
                style={{ background: '#EBF3FC', color: '#004B9C' }}>
          Utiliser le montant attendu ({montantAttendu.toLocaleString()} F)
        </button>

        {/* Aperçu écart en temps réel */}
        {montantDeclare !== '' && montantAttendu > 0 && (
          <EcartCard ecart={ecart} />
        )}
      </div>

      <button onClick={handleConfirmer} disabled={montantDeclareNum <= 0}
              className="sim-btn-primary w-full py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
        Continuer vers la confirmation
      </button>
    </div>
  );
}

// ──────────── Composant Écart ────────────
function EcartCard({ ecart }: { ecart: number }) {
  const isExact   = ecart === 0;
  const isExcedent = ecart > 0;
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl"
         style={{ background: isExact ? '#F0FDF4' : isExcedent ? '#EFF6FF' : '#FEF2F2' }}>
      <div className="flex items-center gap-2">
        {isExact
          ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
          : isExcedent
          ? <TrendingUp  size={16} style={{ color: '#2563EB' }} />
          : <TrendingDown size={16} style={{ color: '#DC2626' }} />
        }
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

// ──────────── Badge statut ────────────
function StatusBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    en_attente: { label: 'En attente', bg: '#FEF3C7', color: '#92400E' },
    valide:     { label: 'Validé ✓',   bg: '#D1FAE5', color: '#065F46' },
    rejete:     { label: 'Rejeté',     bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = map[statut] ?? map.en_attente;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
