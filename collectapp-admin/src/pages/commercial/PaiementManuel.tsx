/**
 * Paiement Manuel (Espèces) — Max 3 clics : [1] cotisant, [2] confirmer, [3] valider
 * Route : /commercial/manuel
 */
import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, Banknote, CheckCircle2, XCircle, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { addToOfflineQueue } from '../../hooks/usePendingSync';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { Cotisant } from '../../types';

interface LocationState { cotisant?: Cotisant }
type Etape = 'selection' | 'confirmation' | 'succes' | 'doublon';

export default function PaiementManuel() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const isOnline    = useNetworkStatus();
  const preselected = (location.state as LocationState)?.cotisant;

  const [etape, setEtape]           = useState<Etape>(preselected ? 'confirmation' : 'selection');
  const [cotisant, setCotisant]     = useState<Cotisant | null>(preselected ?? null);
  const [montant, setMontant]       = useState(preselected ? String(preselected.montant_journalier) : '');
  const [searchText, setSearchText] = useState('');

  // Liste cotisants pour la sélection
  const { data: cotisants = [] } = useQuery<Cotisant[]>({
    queryKey: ['cotisants-manuel'],
    queryFn: () => api.get('/cotisants').then(r => r.data),
    enabled: etape === 'selection',
  });

  const filtres = cotisants.filter(c =>
    c.actif &&
    (c.nom.toLowerCase().includes(searchText.toLowerCase()) || c.telephone.includes(searchText))
  );

  const paiementMutation = useMutation({
    mutationFn: async (data: { cotisant_id: number; montant: number }) =>
      api.post('/paiements', { ...data, mode: 'especes', statut: 'paye' }),
    onSuccess: () => setEtape('succes'),
    onError: (err: any) => {
      if (err?.response?.status === 409) setEtape('doublon');
      else toast.error('Erreur lors de l\'enregistrement');
    },
  });

  // CLIC 3 : Validation finale
  const handleValider = useCallback(() => {
    if (!cotisant) return;
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      toast.error('Montant invalide');
      return;
    }

    if (!isOnline) {
      addToOfflineQueue({
        type: 'paiement_especes',
        cotisant_id: cotisant.id,
        cotisant_nom: cotisant.nom,
        montant: montantNum,
        mode: 'especes',
      });
      setEtape('succes');
      return;
    }
    paiementMutation.mutate({ cotisant_id: cotisant.id, montant: montantNum });
  }, [cotisant, montant, isOnline, paiementMutation]);

  // CLIC 1 : Sélection cotisant
  const handleSelectCotisant = (c: Cotisant) => {
    setCotisant(c);
    setMontant(String(c.montant_journalier));
    setEtape('confirmation'); // CLIC 2 : passer à la confirmation
  };

  // ──────────────────────────────────── SUCCES ────────────────────────────────────
  if (etape === 'succes') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#D1FAE5' }}>
          <CheckCircle2 size={44} style={{ color: '#059669' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Paiement enregistré !</p>
          {!isOnline && (
            <p className="text-xs mt-1 px-3 py-1 rounded-full font-medium inline-block"
               style={{ background: '#FEF3C7', color: '#92400E' }}>
              ⚠ Hors ligne — sera synchronisé à la reconnexion
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2">{cotisant?.nom}</p>
          <p className="text-2xl font-bold mt-2" style={{ color: '#004B9C' }}>
            {parseFloat(montant).toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Espèces · {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full mt-2">
          <button onClick={() => { setEtape('selection'); setCotisant(null); setMontant(''); setSearchText(''); }}
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

  // ──────────────────────────────────── DOUBLON ────────────────────────────────────
  if (etape === 'doublon') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#FEF3C7' }}>
          <AlertTriangle size={44} style={{ color: '#D97706' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Paiement déjà enregistré</p>
          <p className="text-sm text-gray-500 mt-2">
            <strong>{cotisant?.nom}</strong> a déjà une cotisation enregistrée pour aujourd'hui.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full">
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

  // ──────────────────────────────────── CONFIRMATION (CLIC 2 → 3) ────────────────────────────────────
  if (etape === 'confirmation' && cotisant) {
    const montantNum   = parseFloat(montant) || 0;
    const estModifie   = montantNum !== Number(cotisant.montant_journalier);
    const isSubmitting = paiementMutation.isPending;

    return (
      <div className="p-4 space-y-5">
        <button onClick={() => setEtape('selection')}
                className="flex items-center gap-2 text-sm font-medium" style={{ color: '#004B9C' }}>
          <ArrowLeft size={16} /> Changer de cotisant
        </button>

        {/* Récapitulatif cotisant */}
        <div className="bg-white rounded-2xl p-5"
             style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg"
                 style={{ background: 'linear-gradient(135deg,#004B9C,#51AEE2)' }}>
              {cotisant.nom.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-800">{cotisant.nom}</p>
              <p className="text-xs text-gray-400 font-mono">{cotisant.telephone}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            {/* Mode de paiement */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Mode</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                   style={{ background: '#F0FDF4' }}>
                <Banknote size={14} style={{ color: '#059669' }} />
                <span className="text-xs font-semibold" style={{ color: '#059669' }}>Espèces</span>
              </div>
            </div>

            {/* Montant */}
            <div>
              <label className="sim-label">Montant (FCFA)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  className="sim-input flex-1 text-center text-lg font-bold"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                  min="0"
                />
                <button onClick={() => setMontant(String(cotisant.montant_journalier))}
                        className="text-xs px-2 py-1.5 rounded-lg"
                        style={{ background: '#EBF3FC', color: '#004B9C' }}>
                  Défaut
                </button>
              </div>
              {estModifie && (
                <p className="text-xs mt-1" style={{ color: '#D97706' }}>
                  ⚠ Montant modifié (défaut : {Number(cotisant.montant_journalier).toLocaleString()} F)
                </p>
              )}
            </div>

            {/* Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-800">
                {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Total récap */}
        <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg,#004B9C,#1565C0)' }}>
          <p className="text-white/70 text-sm">Total à encaisser</p>
          <p className="text-white text-3xl font-bold mt-1">
            {montantNum > 0 ? montantNum.toLocaleString() : '—'} FCFA
          </p>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
               style={{ background: '#FEF3C7', color: '#92400E' }}>
            ⚠ Hors ligne — le paiement sera synchronisé à la reconnexion
          </div>
        )}

        {/* CLIC 3 : Validation */}
        <button onClick={handleValider} disabled={isSubmitting || montantNum <= 0}
                className="sim-btn-primary w-full py-4 rounded-2xl text-base flex items-center justify-center gap-3 disabled:opacity-50">
          {isSubmitting
            ? <><Loader2 size={20} className="animate-spin" /> Enregistrement…</>
            : <><CheckCircle2 size={20} /> Valider l'encaissement</>
          }
        </button>
      </div>
    );
  }

  // ──────────────────────────────────── SÉLECTION (CLIC 1) ────────────────────────────────────
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
                 style={{ background: '#059669' }}>
              {c.nom.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 truncate">{c.nom}</p>
              <p className="text-xs text-gray-400 font-mono">{c.telephone}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="font-bold text-sm block" style={{ color: '#004B9C' }}>
                {Number(c.montant_journalier).toLocaleString()} F
              </span>
              <Banknote size={14} style={{ color: '#059669' }} className="ml-auto mt-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
