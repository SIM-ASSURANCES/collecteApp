import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, BarChart2,
  AlertTriangle, LogOut, Wallet, ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, type PermissionKey } from '../../lib/permissions';

const allLinks: { to: string; icon: typeof Users; label: string; perm: PermissionKey }[] = [
  { to: '/',             icon: LayoutDashboard, label: 'Tableau de bord', perm: 'dashboard'    },
  { to: '/cotisants',    icon: Users,            label: 'Cotisants',       perm: 'cotisants'    },
  { to: '/commerciaux',  icon: UserCog,          label: 'Commerciaux',     perm: 'commerciaux'  },
  { to: '/reversements', icon: Wallet,           label: 'Reversements',    perm: 'reversements' },
  { to: '/statistiques', icon: BarChart2,        label: 'Statistiques',    perm: 'statistiques' },
  { to: '/relances',     icon: AlertTriangle,    label: 'Relances',        perm: 'relances'     },
  { to: '/utilisateurs', icon: ShieldCheck,      label: 'Utilisateurs',    perm: 'utilisateurs' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const links = allLinks.filter(l => hasPermission(user, l.perm));

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen" style={{ background: 'linear-gradient(180deg,#004B9C 0%,#003A7A 100%)' }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo_sim.webp" alt="SIM Assurances CI" className="h-20 w-auto object-contain" /> 
        </div>
      </div>

      {/* Utilisateur connecté */}
      <div className="px-5 py-3 border-b border-white/10 bg-white/5">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Connecté en tant que</p>
        <p className="text-white font-semibold text-sm truncate">{user?.nom}</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#51AEE2', color: 'white' }}>{user?.role}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-[#51AEE2]' : ''} />
                {label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#51AEE2]" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Déconnexion */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-6 py-4 text-sm text-blue-200 hover:bg-white/10 hover:text-white transition border-t border-white/10"
      >
        <LogOut size={16} />
        Déconnexion
      </button>
    </aside>
  );
}
