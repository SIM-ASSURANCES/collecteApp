import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface Props { title: string; subtitle?: string; }

export default function TopBar({ title, subtitle }: Props) {
  const { user } = useAuthStore();
  const now = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold" style={{ color: '#004B9C' }}>{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 capitalize">{subtitle || now}</p>}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400 hidden sm:block capitalize">{now}</span>
        <button className="relative p-2 rounded-lg hover:bg-blue-50 transition">
          <Bell size={18} style={{ color: '#004B9C' }} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E02020]" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#004B9C' }}>
            {user?.nom?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.nom}</span>
        </div>
      </div>
    </header>
  );
}
