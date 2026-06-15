import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
// ── Layouts ──
import AppLayout        from './components/layout/AppLayout';
import CollecteurLayout from './components/layout/CollecteurLayout';
// ── Pages admin ──
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Souscripteurs from './pages/Souscripteurs';
import Collecteurs    from './pages/Collecteurs';
import Reversements from './pages/Reversements';
import Statistiques from './pages/Statistiques';
import Relances     from './pages/Relances';
import Utilisateurs      from './pages/Utilisateurs';
import JournalActivites  from './pages/JournalActivites';
// ── Pages publiques (redirections Wave) ──
import PaiementOk     from './pages/PaiementOk';
import PaiementErreur from './pages/PaiementErreur';
// ── Pages collecteur ──
import MaListe                from './pages/collecteur/MaListe';
import Paiement               from './pages/collecteur/Paiement';
import PaiementWave           from './pages/collecteur/PaiementWave';
import PaiementManuel         from './pages/collecteur/PaiementManuel';
import CollecteurReversement  from './pages/collecteur/CollecteurReversement';

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

          {/* ── Pages publiques — redirections après paiement Wave ── */}
          <Route path="/paiement-ok"     element={<PaiementOk />}     />
          <Route path="/paiement-erreur" element={<PaiementErreur />} />

          {/* ── Espace ADMIN ── */}
          <Route element={<AppLayout />}>
            <Route index                element={<Dashboard />}    />
            <Route path="souscripteurs" element={<Souscripteurs />} />
            <Route path="collecteurs"   element={<Collecteurs />}  />
            <Route path="reversements"  element={<Reversements />} />
            <Route path="statistiques"  element={<Statistiques />} />
            <Route path="relances"      element={<Relances />}     />
            <Route path="utilisateurs"  element={<Utilisateurs />} />
            <Route path="journal"       element={<JournalActivites />} />
          </Route>

          {/* ── Espace COLLECTEUR (mobile-first) ── */}
          <Route path="/collecteur" element={<CollecteurLayout />}>
            <Route index                  element={<MaListe />}               />
            <Route path="paiement"        element={<Paiement />}              />
            <Route path="wave"            element={<PaiementWave />}          />
            <Route path="manuel"          element={<PaiementManuel />}        />
            <Route path="reversement"     element={<CollecteurReversement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
