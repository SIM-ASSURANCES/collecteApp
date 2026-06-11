/**
 * Paiement Wave — scan QR ou saisie du numéro, puis confirmation
 * Route : /commercial/wave  (peut recevoir state.cotisant depuis MaListe ou Paiement)
 * Max 2 interactions : [1] Sélectionner cotisant, [2] Confirmer le paiement
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Smartphone, CheckCircle2, XCircle, Search, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
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

  const filtres = cotisants.filter(c =>
    c.actif &&
    (c.nom.toLowerCase().includes(searchText.toLowerCase()) || c.telephone.includes(searchText))
  );

  // Mutation : enregistrer paiement Wave
  const paiementMutation = useMutation({
    mutationFn: async (data: { cotisant_id: number; montant: number }) => {
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
  const handleConfirmer = useCallback(() => {
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
    paiementMutation.mutate({ cotisant_id: cotisant.id, montant: Number(cotisant.montant_journalier) });
  }, [cotisant, isOnline, paiementMutation]);

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
    // Générer un "QR code" SVG symbolique avec les infos de paiement
    const qrData = `WAVE;${cotisant.telephone};${cotisant.montant_journalier};SIM`;
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

        {/* Affichage QR Wave (simulé) */}
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4"
             style={{ boxShadow: '0 2px 8px rgba(0,75,156,0.08)' }}>
          <div className="flex items-center gap-2">
            <Smartphone size={20} style={{ color: '#004B9C' }} />
            <p className="font-semibold text-sm" style={{ color: '#004B9C' }}>Paiement Wave</p>
          </div>

          {/* QR Code SVG symbolique */}
          <div className="border-4 rounded-xl p-3" style={{ borderColor: '#004B9C' }}>
            <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
              {/* Coin TL */}
              <rect x="10" y="10" width="50" height="50" rx="4" fill="none" stroke="#004B9C" strokeWidth="4"/>
              <rect x="20" y="20" width="30" height="30" rx="2" fill="#004B9C"/>
              {/* Coin TR */}
              <rect x="100" y="10" width="50" height="50" rx="4" fill="none" stroke="#004B9C" strokeWidth="4"/>
              <rect x="110" y="20" width="30" height="30" rx="2" fill="#004B9C"/>
              {/* Coin BL */}
              <rect x="10" y="100" width="50" height="50" rx="4" fill="none" stroke="#004B9C" strokeWidth="4"/>
              <rect x="20" y="110" width="30" height="30" rx="2" fill="#004B9C"/>
              {/* Données simulées */}
              {[70,80,90,100,110].map((y, i) => (
                <rect key={y} x="70" y={y} width="8" height="8" rx="1" fill="#004B9C" opacity={0.5 + i * 0.1}/>
              ))}
              {[70,80,90,100,110].map((x, i) => (
                <rect key={x} x={x} y="70" width="8" height="8" rx="1" fill="#004B9C" opacity={0.5 + i * 0.1}/>
              ))}
              {[85,95,105,115].map((x, i) => (
                <rect key={x} x={x} y="85" width="6" height="6" rx="1" fill="#51AEE2" opacity={0.7 + i * 0.05}/>
              ))}
              {/* Logo Wave au centre */}
              <circle cx="80" cy="80" r="12" fill="white"/>
              <text x="80" y="85" textAnchor="middle" fill="#004B9C" fontSize="11" fontWeight="bold">W</text>
            </svg>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">Numéro Wave du client</p>
            <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#004B9C' }}>
              {cotisant.telephone}
            </p>
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
