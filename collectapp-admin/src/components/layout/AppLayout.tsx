import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  // Le commercial ne peut pas accéder à l'espace admin
  if (user?.role === 'COMMERCIAL') return <Navigate to="/commercial" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[#F4F6FA]">
        <Outlet />
      </main>
    </div>
  );
}
