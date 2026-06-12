import { useEffect, useRef } from 'react';
import { Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutList, Smartphone, Banknote, Wallet2, LogOut, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usePendingSync, getOfflineQueue, clearOfflineQueue } from '../../hooks/usePendingSync';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';

const navLinks = [
  { to: '/commercial',             icon: LayoutList, label: 'Ma liste'    },
  { to: '/commercial/wave',        icon: Smartphone, label: 'Wave'        },
  { to: '/commercial/manuel',      icon: Banknote,   label: 'Manuel'      },
  { to: '/commercial/reversement', icon: Wallet2,    label: 'Reversement' },
];

export default function CommercialLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const isOnline      = useNetworkStatus();
  const pendingCount  = usePendingSync();
  const prevOnline    = useRef(isOnline);

  // ── Synchronisation automatique au retour en ligne ──
  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      const queue = getOfflineQueue();
      if (queue.length === 0) { prevOnline.current = true; return; }

      const toastId = toast.loading(`Synchronisation de ${queue.length} paiement(s)…`);
      api.post('/paiements/sync', { operations: queue })
        .then(({ data }) => {
          const doublons = data.resultats.filter((r: any) => r.statut === 'doublon').length;
          const ok       = data.resultats.filter((r: any) => r.statut === 'ok').length;
          clearOfflineQueue();
          queryClient.invalidateQueries();
          toast.success(
            `${ok} paiement(s) synchronisé(s)${doublons ? ` · ${doublons} doublon(s) ignoré(s)` : ''}`,
            { id: toastId }
          );
        })
        .catch(() => toast.error('Échec de la synchronisation', { id: toastId }));
    }
    prevOnline.current = isOnline;
  }, [isOnline, queryClient]);

  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (user?.role !== 'COMMERCIAL') return <Navigate to="/" replace />;

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* silencieux */ }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative" style={{ background: '#F4F6FA' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between"
              style={{ background: 'linear-gradient(90deg,#004B9C,#1565C0)' }}>
        <div className="flex items-center gap-2">
          <img src="/logo_sim.webp" alt="SIM Assurances CI" className="h-5 w-auto object-contain" />
          <p className="text-xs leading-none" style={{ color: '#51AEE2' }}>Collecte terrain</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicateur réseau */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
               style={{ background: isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        color: isOnline ? '#6EE7B7' : '#FCA5A5' }}>
            {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
            {isOnline ? 'En ligne' : 'Hors ligne'}
            {pendingCount > 0 && (
              <span className="ml-1 bg-yellow-400 text-yellow-900 rounded-full px-1.5 text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </div>
          {/* Avatar + déconnexion */}
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/70 hover:text-white transition text-xs">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                 style={{ background: '#51AEE2' }}>
              {user?.nom?.charAt(0).toUpperCase()}
            </div>
          </button>
        </div>
      </header>

      {/* Commercial info bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 bg-white">
        <div>
          <p className="text-xs text-gray-500">Commercial</p>
          <p className="font-semibold text-sm" style={{ color: '#004B9C' }}>{user?.nom}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 capitalize">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Contenu */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-gray-100 bg-white z-20 flex">
        {navLinks.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/commercial'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-[#004B9C]' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} className="mb-0.5" strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
                {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: '#004B9C' }} />}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={handleLogout}
                className="flex-1 flex flex-col items-center justify-center py-2.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={22} className="mb-0.5" strokeWidth={1.8} />
          Quitter
        </button>
      </nav>
    </div>
  );
}
