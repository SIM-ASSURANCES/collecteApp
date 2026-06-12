/**
 * Page publique de confirmation — le cotisant y est redirigé par Wave
 * après un paiement réussi (success_url de la session Checkout).
 */
import { CheckCircle2 } from 'lucide-react';

export default function PaiementOk() {
  const maintenant = new Date();
  const date = maintenant.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const heure = maintenant.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(160deg,#004B9C 0%,#1565C0 55%,#51AEE2 100%)' }}>
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
           style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <img src="/logo_sim.webp" alt="SIM Assurances CI" className="h-12 w-auto object-contain" />

        <div className="w-24 h-24 rounded-full flex items-center justify-center"
             style={{ background: '#D1FAE5' }}>
          <CheckCircle2 size={56} style={{ color: '#059669' }} />
        </div>

        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#004B9C' }}>Félicitations !</h1>
          <p className="text-lg font-semibold mt-1" style={{ color: '#059669' }}>Paiement réussi</p>
        </div>

        <div className="w-full rounded-2xl px-4 py-3" style={{ background: '#F4F6FA' }}>
          <p className="text-sm font-semibold text-gray-700 capitalize">{date}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: '#004B9C' }}>{heure}</p>
        </div>

        <p className="text-xs text-gray-400">
          Votre cotisation a bien été enregistrée auprès de SIM Assurances CI.
          Vous pouvez fermer cette page.
        </p>
      </div>

      <p className="text-white/50 text-xs mt-6">© 2026 SIM Assurances CI</p>
    </div>
  );
}
