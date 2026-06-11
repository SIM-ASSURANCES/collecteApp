/**
 * Page dispatch : cotisant sélectionné depuis MaListe → choix Wave ou Manuel
 * Route : /commercial/paiement (avec state.cotisant)
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Smartphone, Banknote, ArrowLeft } from 'lucide-react';
import type { Cotisant } from '../../types';

interface LocationState { cotisant: Cotisant & { paye_aujourd_hui?: boolean; heure_paiement?: string; mode_paiement?: string } }

export default function Paiement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cotisant } = (location.state as LocationState) ?? {};

  if (!cotisant) {
    navigate('/commercial');
    return null;
  }

  if (cotisant.paye_aujourd_hui) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#D1FAE5' }}>
          <CheckCircle2 size={44} style={{ color: '#059669' }} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{cotisant.nom}</p>
          <p className="text-sm font-semibold mt-1" style={{ color: '#059669' }}>
            Déjà payé aujourd'hui ✓
          </p>
          {cotisant.heure_paiement && (
            <p className="text-xs text-gray-500 mt-1">
              {cotisant.mode_paiement} · {cotisant.heure_paiement}
            </p>
          )}
          <p className="text-xl font-bold mt-3" style={{ color: '#004B9C' }}>
            {Number(cotisant.montant_journalier).toLocaleString()} FCFA
          </p>
        </div>
        <button onClick={() => navigate('/commercial')}
                className="sim-btn-primary w-full py-3 rounded-xl mt-2">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <button onClick={() => navigate('/commercial')}
              className="flex items-center gap-2 text-sm font-medium" style={{ color: '#004B9C' }}>
        <ArrowLeft size={16} /> Retour à la liste
      </button>

      {/* Carte cotisant */}
      <div className="bg-white rounded-2xl p-5 text-center"
           style={{ boxShadow: '0 2px 12px rgba(0,75,156,0.10)' }}>
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold mb-3"
             style={{ background: 'linear-gradient(135deg,#004B9C,#51AEE2)' }}>
          {cotisant.nom.charAt(0).toUpperCase()}
        </div>
        <p className="text-lg font-bold text-gray-800">{cotisant.nom}</p>
        <p className="text-sm text-gray-400 font-mono mt-0.5">{cotisant.telephone}</p>
        <p className="text-2xl font-bold mt-3" style={{ color: '#004B9C' }}>
          {Number(cotisant.montant_journalier).toLocaleString()} FCFA
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Cotisation journalière</p>
      </div>

      {/* Choix du mode de paiement */}
      <p className="text-sm font-semibold text-gray-600 text-center">Choisir le mode de paiement</p>

      <div className="space-y-3">
        <button onClick={() => navigate('/commercial/wave', { state: { cotisant } })}
                className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 text-left transition active:scale-95"
                style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)', border: '2px solid #EBF3FC' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: '#EBF3FC' }}>
            <Smartphone size={24} style={{ color: '#004B9C' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800">Paiement Wave</p>
            <p className="text-xs text-gray-500 mt-0.5">Mobile Money · Scan QR</p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#EBF3FC', color: '#004B9C' }}>
            Recommandé
          </span>
        </button>

        <button onClick={() => navigate('/commercial/manuel', { state: { cotisant } })}
                className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 text-left transition active:scale-95"
                style={{ boxShadow: '0 2px 10px rgba(0,75,156,0.08)', border: '2px solid #F0FDF4' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: '#F0FDF4' }}>
            <Banknote size={24} style={{ color: '#059669' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800">Espèces</p>
            <p className="text-xs text-gray-500 mt-0.5">Paiement manuel en cash</p>
          </div>
        </button>
      </div>
    </div>
  );
}
