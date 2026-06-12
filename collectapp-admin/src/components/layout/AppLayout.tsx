import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { PERMISSIONS, hasPermission, firstAllowedPath } from '../../lib/permissions';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  // Le commercial ne peut pas accéder à l'espace admin
  if (user?.role === 'COMMERCIAL') return <Navigate to="/commercial" replace />;

  // Garde par permission : un superviseur ne voit que ses pages autorisées
  const page = PERMISSIONS.find(p => p.path === location.pathname);
  if (page && !hasPermission(user, page.key)) {
    const fallback = firstAllowedPath(user);
    if (fallback === '/login') return <Navigate to="/login" replace />;
    if (fallback !== location.pathname) return <Navigate to={fallback} replace />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[#F4F6FA]">
        <Outlet />
      </main>
    </div>
  );
}
