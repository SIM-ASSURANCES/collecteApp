import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { firstAllowedPath } from '../lib/permissions';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse]   = useState('');
  const [loading, setLoading]         = useState(false);
  const { login } = useAuthStore();
  const navigate  = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifiant, mot_de_passe: motDePasse });
      login(data.token, data.user);
      // Redirection selon le rôle et les permissions
      if (data.user.role === 'COLLECTEUR') {
        navigate('/collecteur');
      } else {
        navigate(firstAllowedPath(data.user));
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Identifiant ou mot de passe incorrect.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F4F6FA' }}>
      {/* Panneau gauche – décoration */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg,#004B9C 0%,#1565C0 55%,#51AEE2 100%)' }}>
        {/* Motif géométrique */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 600 800" fill="none">
          <polygon points="0,0 250,0 0,250" fill="white"/>
          <polygon points="600,0 600,300 300,0" fill="white"/>
          <polygon points="0,800 300,800 0,500" fill="white"/>
          <polygon points="600,800 600,500 300,800" fill="white"/>
          <polygon points="200,200 400,200 300,400" fill="white" opacity="0.5"/>
        </svg>
        {/* Logo + Texte centrés */}
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <img src="/logo_sim.webp" alt="SIM Assurances CI" className="h-14 w-auto object-contain" />
          <div>
            <h2 className="text-white text-4xl font-bold leading-tight mb-4">
              Gestion des<br />
              <span style={{ color: '#51AEE2' }}>Paiements</span><br />
              Journaliers
            </h2>
            <p className="text-white/70 text-sm max-w-xs mx-auto">
              Plateforme de collecte et de suivi des cotisations terrain en temps réel.
            </p>
          </div>
        </div>
        {/* Copyright en bas */}
        <p className="absolute bottom-6 text-white/40 text-xs z-10">© 2026 SIM Assurances CI — Tous droits réservés</p>
      </div>

      {/* Panneau droit – formulaire */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex lg:hidden justify-center mb-8">
            <div className="px-5 py-3 rounded-2xl" style={{ background: 'linear-gradient(135deg,#004B9C,#1565C0)' }}>
              <img src="/logo_sim.webp" alt="SIM Assurances CI" className="h-10 w-auto object-contain" />
            </div>
          </div>

          <div className="sim-card p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-1" style={{ color: '#004B9C' }}>Connexion</h3>
              <p className="text-sm text-gray-500">Accès réservé aux administrateurs</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="sim-label">Identifiant</label>
                <input
                  type="text"
                  className="sim-input"
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="Votre identifiant"
                  required autoFocus
                />
              </div>

              <div>
                <label className="sim-label">Mot de passe</label>
                <input
                  type="password"
                  className="sim-input"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="sim-btn-primary w-full py-2.5 mt-2"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Connexion en cours…' : 'Se connecter'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            CollectApp v1.0 — SIM Assurances CI
          </p>
        </div>
      </div>
    </div>
  );
}
