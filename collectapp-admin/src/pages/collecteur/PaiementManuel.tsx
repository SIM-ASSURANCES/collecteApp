/**
 * Paiement Manuel (Espèces) — Max 3 clics : [1] cotisant, [2] confirmer, [3] valider
 * Route : /collecteur/manuel
 */
import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, Banknote, CheckCircle2, XCircle, ArrowLeft, Loader2, AlertTriangle, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { addToOfflineQueue } from '../../hooks/usePendingSync';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { ANTICIPATION_PAR_FREQUENCE, FREQ_PERIODE_LABEL } from '../../lib/anticipation';
import type { Souscripteur, FrequenceCollecte } from '../../types';

interface LocationState { cotisant?: Souscripteur }
type Etape = 'selection' | 'confirmation' | 'succes' | 'doublon';

export default function PaiementManuel() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const isOnline    = useNetworkStatus();
  const preselected = (location.state as LocationState)?.cotisant;

  const [etape, setEtape]           = useState<Etape>(preselected ? 'confirmation' : 'selection');
  const [cotisant, setCotisant]     = useState<Souscripteur | null>(preselected ?? null);
  const [montant, setMontant]       = useState(preselected ? String(preselected.montant_journalier) : '');
  const [searchText, setSearchText] = useState('');
  const [nbperiodes, setNbperiodes] = useState(1);

  const { data: cotisants = [] } = useQuery<Souscripteur[]>({
    queryKey: ['souscripteurs-manuel'],
    queryFn: () => api.get('/souscripteurs').then(r => r.data),
    enabled: etape === 'selection',
  });

  const filtres = cotisants.filter(c =>
    c.actif &&
    (c.nom.toLowerCase().includes(searchText.toLowerCase()) || c.telephone.includes(searchText))
  );

  const frequence = (cotisant?.frequence_collecte ?? 'journalier') as FrequenceCollecte;
  const anticipationOptions = ANTICIPATION_PAR_FREQUENCE[frequence] ?? ANTICIPATION_PAR_FREQUENCE.journalier;
  const periodeLabel = FREQ_PERIODE_LABEL[frequence] ?? 'période';

  const paiementMutation = useMutation({
    mutationFn: async (data: { cotisant_id: number; montant: number; nbjours: number }) =>
      api.post('/paiements', { ...data, mode: 'especes', statut: 'paye' }),
    onSuccess: () => setEtape('succes'),
    onError: (err: any) => {
      if (err?.response?.status === 409) setEtape('doublon');
      else toast.error('Erreur lors de l\'enregistrement');
    },
  });

  const handleAnticipation = (opt: number) => {
    const newNb = nbperiodes === opt ? 1 : opt;
    setNbperiodes(newNb);
    if (cotisant) {
      setMontant(String(Math.round(Number(cotisant.montant_journalier) * newNb)));
    }
  };

  const handleValider = useCallback(() => {
    if (!cotisant) return;
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      toast.error('Montant invalide');
      return;
    }

    if (!isOnline) {
      if (nbperiodes > 1) {
        toast.error('La collecte anticipée nécessite une connexion internet.');
        return;
      }
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
    paiementMutation.mutate({ cotisant_id: cotisant.id, montant: montantNum, nbjours: nbperiodes });
  }, [cotisant, montant, nbperiodes, isOnline, paiementMutation]);

  const handleSelectCotisant = (c: Souscripteur) => {
    setCotisant(c);
    setMontant(String(c.montant_journalier));
    setNbperiodes(1);
    setEtape('confirmation');
  };

  // ── SUCCÈS ────────────────────────────────────────────────
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
          {nbperiodes > 1 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {nbperiodes} {periodeLabel}s × {Number(cotisant?.montant_journalier).toLocaleString()} FCFA
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Espèces · {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full mt-2">
          <button onClick={() => { setEtape('selection'); setCotisant(null); setMontant(''); setSearchText(''); setNbperiodes(1); }}
                  className="sim-btn-primary w-full py-3 rounded-xl">
            Nouveau paiement
          </button>
          <button onClick={() => navigate('/collecteur')}
                  className="sim-btn-secondary w-full py-3 rounded-xl">
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  // ── DOUBLON ───────────────────────────────────────────────
  if (etape === 'doublon') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#FEF3C7' }}>
          <AlertTriangle size={44} style={{ color: '#D97706' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">Paiement déjà enregistré</p>
          <p className="text-sm text-gray-500 mt-2">
            <strong>{cotisant?.nom}</strong> a déjà payé pour cette période.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <button onClick={() => { setEtape('selection'); setCotisant(null); setNbperiodes(1); }}
                  className="sim-btn-primary w-full py-3 rounded-xl">
            Choisir un autre souscripteur
          </button>
          <button onClick={() => navigate('/collecteur')}
                  className="sim-btn-secondary w-full py-3 rounded-xl">
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIRMATION ──────────────────────────────────────────
  if (etape === 'confirmation' && cotisant) {
    const montantNum  = parseFloat(montant) || 0;
    const montantAuto = Math.round(Number(cotisant.montant_journalier) * nbperiodes);
    const estModifie  = montantNum !== montantAuto;
    const isSubmitting = paiementMutation.isPending;

    return (
      <div className="p-4 space-y-5">
        <button onClick={() => { setEtape('selection'); setNbperiodes(1); }}
                className="flex items-center gap-2 text-sm font-medium" style={{ color: '#004B9C' }}>
          <ArrowLeft size={16} /> Changer de souscripteur
        </button>

        {/* Récapitulatif */}
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
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Mode</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#F0FDF4' }}>
                <Banknote size={14} style={{ color: '#059669' }} />
                <span className="text-xs font-semibold" style={{ color: '#059669' }}>Espèces</span>
              </div>
            </div>

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
                <button onClick={() => { setMontant(String(cotisant.montant_journalier)); setNbperiodes(1); }}
                        className="text-xs px-2 py-1.5 rounded-lg"
                        style={{ background: '#EBF3FC', color: '#004B9C' }}>
                  Défaut
                </button>
              </div>
              {estModifie && (
                <p className="text-xs mt-1" style={{ color: '#D97706' }}>
                  ⚠ Montant modifié (attendu : {montantAuto.toLocaleString()} F)
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-800">
                {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Sélecteur d'anticipation */}
        {anticipationOptions.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(0,75,156,0.08)' }}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={15} style={{ color: '#059669' }} />
              <p className="text-sm font-semibold" style={{ color: '#059669' }}>Paiement anticipé</p>
              {nbperiodes > 1 && (
                <button onClick={() => { setNbperiodes(1); setMontant(String(cotisant.montant_journalier)); }}
                        className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  Annuler
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {anticipationOptions.map(opt => (
                <button
                  key={opt.nbperiodes}
                  onClick={() => handleAnticipation(opt.nbperiodes)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                  style={nbperiodes === opt.nbperiodes
                    ? { background: '#059669', color: '#fff' }
                    : { background: '#F0FDF4', color: '#059669' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {nbperiodes > 1 && (
              <p className="text-xs text-gray-500 mt-2">
                {Number(cotisant.montant_journalier).toLocaleString()} × {nbperiodes} {periodeLabel}s = {montantAuto.toLocaleString()} FCFA
              </p>
            )}
          </div>
        )}

        {/* Total */}
        <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg,#004B9C,#1565C0)' }}>
          <p className="text-white/70 text-sm">Total à encaisser</p>
          <p className="text-white text-3xl font-bold mt-1">
            {montantNum > 0 ? montantNum.toLocaleString() : '—'} FCFA
          </p>
          {nbperiodes > 1 && (
            <p className="text-white/60 text-xs mt-0.5">{nbperiodes} {periodeLabel}s</p>
          )}
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
               style={{ background: '#FEF3C7', color: '#92400E' }}>
            ⚠ Hors ligne — le paiement sera synchronisé à la reconnexion
          </div>
        )}

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

  // ── SÉLECTION ─────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      <p className="font-semibold text-sm text-gray-600">Sélectionner le souscripteur</p>

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
          <p className="text-center text-gray-400 text-sm py-8">Aucun souscripteur trouvé</p>
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
