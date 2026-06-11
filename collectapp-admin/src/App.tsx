import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
// ── Layouts ──
import AppLayout        from './components/layout/AppLayout';
import CommercialLayout from './components/layout/CommercialLayout';
// ── Pages admin ──
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Cotisants    from './pages/Cotisants';
import Commerciaux  from './pages/Commerciaux';
import Reversements from './pages/Reversements';
import Statistiques from './pages/Statistiques';
import Relances     from './pages/Relances';
// ── Pages commercial ──
import MaListe                from './pages/commercial/MaListe';
import Paiement               from './pages/commercial/Paiement';
import PaiementWave           from './pages/commercial/PaiementWave';
import PaiementManuel         from './pages/commercial/PaiementManuel';
import CommercialReversement  from './pages/commercial/CommercialReversement';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { fontFamily: 'Montserrat, Arial, sans-serif', fontSize: '14px' },
          success: { iconTheme: { primary: '#004B9C', secondary: '#fff' } },
        }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ── Espace ADMIN ── */}
          <Route element={<AppLayout />}>
            <Route index                element={<Dashboard />}    />
            <Route path="cotisants"     element={<Cotisants />}    />
            <Route path="commerciaux"   element={<Commerciaux />}  />
            <Route path="reversements"  element={<Reversements />} />
            <Route path="statistiques"  element={<Statistiques />} />
            <Route path="relances"      element={<Relances />}     />
          </Route>

          {/* ── Espace COMMERCIAL (mobile-first) ── */}
          <Route path="/commercial" element={<CommercialLayout />}>
            <Route index                  element={<MaListe />}               />
            <Route path="paiement"        element={<Paiement />}              />
            <Route path="wave"            element={<PaiementWave />}          />
            <Route path="manuel"          element={<PaiementManuel />}        />
            <Route path="reversement"     element={<CommercialReversement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
