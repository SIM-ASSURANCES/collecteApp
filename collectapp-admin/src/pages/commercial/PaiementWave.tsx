/**
 * Paiement Wave — scan QR ou saisie du numéro, puis confirmation
 * Route : /commercial/wave  (peut recevoir state.cotisant depuis MaListe ou Paiement)
 * Max 2 interactions : [1] Sélectionner cotisant, [2] Confirmer le paiement
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Smartphone, CheckCircle2, XCircle, Search, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { addToOfflineQueue } from '../../hooks/usePendingSync';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { Cotisant } from '../../types';

interface LocationState { cotisant?: Cotisant }

type Etape = 'selection' | 'confirmation' | 'succes' | 'doublon';

export default function PaiementWave() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const isOnline   = useNetworkStatus();
  const preselected = (location.state as LocationState)?.cotisant;

  const [etape, setEtape]             = useState<Etape>(preselected ? 'confirmation' : 'selection');
  const [cotisant, setCotisant]       = useState<Cotisant | null>(preselected ?? null);
  const [searchText, setSearchText]   = useState('');
  const [polling, setPolling]         = useState(false);

  // Liste cotisants pour la sélection
  const { data: cotisants = [] } = useQuery<Cotisant[]>({
    queryKey: ['cotisants-wave'],
    queryFn: () => api.get('/cotisants').then(r => r.data),
    enabled: etape === 'selection',
  });

  // Session Wave Checkout — créée à l'arrivée sur l'étape confirmation
  const {
    data: waveSession,
    isLoading: sessionLoading,
    isError: sessionError,
    refetch: refetchSession,
  } = useQuery<{ id: string; wave_launch_url: string; montant: number }>({
    queryKey: ['wave-session', cotisant?.id],
    queryFn: () =>
      api.post('/paiements/wave/session', { cotisant_id: cotisant!.id }).then(r => r.data),
    enabled: etape === 'confirmation' && !!cotisant && isOnline,
    staleTime: Infinity,
    retry: 1,
  });

  const filtres = cotisants.filter(c =>
    c.actif &&
    (c.nom.toLowerCase().includes(searchText.toLowerCase()) || c.telephone.includes(searchText))
  );

  // Mutation : enregistrer paiement Wave
  const paiementMutation = useMutation({
    mutationFn: async (data: { cotisant_id: number; montant: number; reference_wave?: string }) => {
      return api.post('/paiements', { ...data, mode: 'wave', statut: 'paye' });
    },
    onSuccess: () => {
      setEtape('succes');
      setPolling(false);
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        setEtape('doublon');
      } else {
        toast.error('Erreur lors de l\'enregistrement du paiement');
      }
      setPolling(false);
    },
  });

  // Confirmer le paiement (en ligne ou hors ligne)
  const handleConfirmer = useCallback(async () => {
    if (!cotisant) return;
    setPolling(true);

    if (!isOnline) {
      addToOfflineQueue({
        type: 'paiement_wave',
        cotisant_id: cotisant.id,
        cotisant_nom: cotisant.nom,
        montant: cotisant.montant_journalier,
        mode: 'wave',
      });
      setEtape('succes');
      setPolling(false);
      return;
    }

    // Vérifier le statut du paiement chez Wave avant d'enregistrer
    if (waveSession) {
      try {
        const { data: st } = await api.get(`/paiements/wave/session/${waveSession.id}`);
        if (st.payment_status !== 'succeeded') {
          const force = window.confirm(
            'Wave n\'a pas encore confirmé ce paiement.\nVoulez-vous quand même l\'enregistrer ?'
          );
          if (!force) { setPolling(false); return; }
        }
      } catch { /* Wave injoignable → confirmation manuelle autorisée */ }
    }

    paiementMutation.mutate({
      cotisant_id: cotisant.id,
      montant: Number(cotisant.montant_journalier),
      reference_wave: waveSession?.id,
    });
  }, [cotisant, isOnline, paiementMutation, waveSession]);

  const handleSelectCotisant = (c: Cotisant) => {
    setCotisant(c);
    setEtape('confirmation');
  };

  // ──────────────────────── RENDU ────────────────────────

  if (etape === 'succes') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#D1FAE5' }}>
          <CheckCircle2 size={44} style={{ color: '#059669' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Paiement enregistré !</p>
          {!isOnline && (
            <p className="text-xs mt-1 px-3 py-1 rounded-full font-medium"
               style={{ background: '#FEF3C7', color: '#92400E' }}>
              Hors ligne — sera synchronisé dès reconnexion
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2">{cotisant?.nom}</p>
          <p className="text-2xl font-bold mt-2" style={{ color: '#004B9C' }}>
            {Number(cotisant?.montant_journalier).toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">Wave · {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex flex-col gap-3 w-full mt-2">
          <button onClick={() => { setEtape('selection'); setCotisant(null); setSearchText(''); }}
                  className="sim-btn-primary w-full py-3 rounded-xl">
            Nouveau paiement
          </button>
          <button onClick={() => navigate('/commercial')}
                  className="sim-btn-secondary w-full py-3 rounded-xl">
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  if (etape === 'doublon') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#FEE2E2' }}>
          <XCircle size={44} style={{ color: '#DC2626' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Paiement déjà enregistré</p>
          <p className="text-sm text-gray-500 mt-2">{cotisant?.nom} a déjà payé aujourd'hui.</p>
        </div>
        <div className="flex flex-col gap-3 w-full mt-2">
          <button onClick={() => { setEtape('selection'); setCotisant(null); }}
                  className="sim-btn-primary w-full py-3 rounded-xl">
            Choisir un autre cotisant
          </button>
          <button onClick={() => navigate('/commercial')}
                  className="sim-btn-secondary w-full py-3 rounded-xl">
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  if (etape === 'confirmation' && cotisant) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => setEtape('selection')}
                className="flex items-center gap-2 text-sm font-medium" style={{ color: '#004B9C' }}>
          <ArrowLeft size={16} /> Changer de cotisant
        </button>

        {/* Infos cotisant */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-3"
             style={{ boxShadow: '0 2px 8px rgba(0,75,156,0.08)' }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
               style={{ background: 'linear-gradient(135deg,#004B9C,#51AEE2)' }}>
            {cotisant.nom.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{cotisant.nom}</p>
            <p className="text-xs text-gray-400 font-mono">{cotisant.telephone}</p>
          </div>
          <p className="font-bold text-lg" style={{ color: '#004B9C' }}>
            {Number(cotisant.montant_journalier).toLocaleString()} F
          </p>
        </div>

        {/* QR Wave réel (session Checkout) */}
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4"
             style={{ boxShadow: '0 2px 8px rgba(0,75,156,0.08)' }}>
          <div className="flex items-center gap-2">
            <Smartphone size={20} style={{ color: '#004B9C' }} />
            <p className="font-semibold text-sm" style={{ color: '#004B9C' }}>Paiement Wave</p>
          </div>

          {sessionLoading ? (
            <div className="w-[176px] h-[176px] flex items-center justify-center">
              <Loader2 size={36} className="animate-spin" style={{ color: '#004B9C' }} />
            </div>
          ) : waveSession ? (
            <div className="border-4 rounded-xl p-3 bg-white" style={{ borderColor: '#004B9C' }}>
              <QRCodeSVG value={waveSession.wave_launch_url} size={160} fgColor="#1B1B1B" level="M" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-[176px] h-[176px] border-4 rounded-xl flex flex-col items-center justify-center gap-2 text-center px-3"
                   style={{ borderColor: '#E5E7EB' }}>
                <XCircle size={32} className="text-gray-300" />
                <p className="text-xs text-gray-400">
                  {sessionError ? 'QR Wave indisponible — encaissez via le numéro' : 'Hors ligne — QR indisponible'}
                </p>
              </div>
              {sessionError && isOnline && (
                <button onClick={() => refetchSession()}
                        className="flex items-center gap-1 text-xs font-medium" style={{ color: '#004B9C' }}>
                  <RefreshCw size={12} /> Réessayer
                </button>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-500">
              {waveSession ? 'Le client scanne ce QR avec son app Wave' : 'Numéro Wave du client'}
            </p>
            <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#004B9C' }}>
              {cotisant.telephone}
            </p>
            {waveSession && (
              <p className="text-xs text-gray-400 mt-1">
                Montant pré-rempli : {waveSession.montant.toLocaleString()} FCFA
              </p>
            )}
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-full justify-center"
                 style={{ background: '#FEF3C7', color: '#92400E' }}>
              ⚠ Hors ligne — sera synchronisé à la reconnexion
            </div>
          )}
        </div>

        {/* Bouton confirmation */}
        <button onClick={handleConfirmer} disabled={polling}
                className="sim-btn-primary w-full py-4 rounded-2xl text-base flex items-center justify-center gap-3 transition">
          {polling
            ? <><Loader2 size={20} className="animate-spin" /> Enregistrement…</>
            : <><CheckCircle2 size={20} /> Confirmer le paiement Wave</>
          }
        </button>

        <p className="text-center text-xs text-gray-400">
          Appuyez après que le client a effectué le paiement sur Wave
        </p>
      </div>
    );
  }

  // ÉTAPE 1 : sélection cotisant
  return (
    <div className="p-4 space-y-4">
      <p className="font-semibold text-sm text-gray-600">Sélectionner le cotisant</p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="sim-input pl-9"
               placeholder="Nom ou téléphone…"
               value={searchText}
               onChange={e => setSearchText(e.target.value)}
               autoFocus />
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {filtres.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Aucun cotisant trouvé</p>
        ) : filtres.map(c => (
          <button key={c.id} onClick={() => handleSelectCotisant(c)}
                  className="w-full bg-white rounded-xl p-4 flex items-center gap-3 text-left transition active:scale-95"
                  style={{ boxShadow: '0 1px 4px rgba(0,75,156,0.07)' }}>
            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                 style={{ background: '#004B9C' }}>
              {c.nom.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 truncate">{c.nom}</p>
              <p className="text-xs text-gray-400 font-mono">{c.telephone}</p>
            </div>
            <span className="font-bold text-sm flex-shrink-0" style={{ color: '#004B9C' }}>
              {Number(c.montant_journalier).toLocaleString()} F
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
