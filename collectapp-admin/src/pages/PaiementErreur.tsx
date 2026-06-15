/**
 * Page publique d'échec — le cotisant y est redirigé par Wave
 * si le paiement échoue ou est annulé (error_url de la session Checkout).
 */
import { XCircle } from 'lucide-react';

export default function PaiementErreur() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(160deg,#004B9C 0%,#1565C0 55%,#51AEE2 100%)' }}>
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
           style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <img src="/logo_sim.webp" alt="SIM Assurances CI" className="h-12 w-auto object-contain" />

        <div className="w-24 h-24 rounded-full flex items-center justify-center"
             style={{ background: '#FEE2E2' }}>
          <XCircle size={56} style={{ color: '#DC2626' }} />
        </div>

        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#004B9C' }}>Paiement non abouti</h1>
          <p className="text-sm text-gray-500 mt-2">
            Le paiement a été annulé ou n'a pas pu être traité.
            Rapprochez-vous de votre collecteur pour réessayer.
          </p>
        </div>
      </div>

      <p className="text-white/50 text-xs mt-6">© 2026 SIM Assurances CI</p>
    </div>
  );
}
