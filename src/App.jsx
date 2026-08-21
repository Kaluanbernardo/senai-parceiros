import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import AppShell from './design-system/AppShell';

// Each route loads on demand so the first paint carries only the shell, the
// login screen and the seed catalog.  LoginPage stays eager: `Protected`
// renders it synchronously for every signed-out visitor.
const HomePage = lazy(() => import('./pages/HomePage'));
const SelectionPage = lazy(() => import('./pages/SelectionPage'));
const PartnerResearchHomePage = lazy(() => import('./pages/PartnerResearchHomePage'));
const PromptGeneratorPage = lazy(() => import('./pages/PromptGeneratorPage'));
const CatalogResearchPage = lazy(() => import('./pages/CatalogResearchPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const OrganizacoesPage = lazy(() => import('./pages/OrganizacoesPage'));
const PesquisadoresPage = lazy(() => import('./pages/PesquisadoresPage'));
const RadarPage = lazy(() => import('./pages/RadarPage'));

function PageFallback() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Carregando a página">
      <CircularProgress />
    </Box>
  );
}

function Protected({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const { catalogReady } = useData();
  if (loading) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!user) return <LoginPage />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  // The seed catalog arrives in its own chunk; every page behind this gate reads
  // it, so waiting here keeps empty lists from flashing as real results.
  if (!catalogReady) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return children;
}

function InShell({ children, adminOnly = false }) {
  const { user, logout } = useAuth();
  return (
    <Protected adminOnly={adminOnly}>
      <AppShell user={user} onLogout={logout}>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </AppShell>
    </Protected>
  );
}

/** Rotas antigas do catálogo, mantidas redirecionando para as novas. */
export const LEGACY_CATALOG_ROUTES = Object.freeze([
  ['/catalogo/pesquisadores', '/catalogo/pessoas-fisicas'],
  ['/catalogo/especialistas', '/catalogo/pessoas-fisicas'],
  ['/catalogo/escolas', '/catalogo/pessoas-juridicas?subtipo=Institui%C3%A7%C3%A3o%20de%20ensino'],
  ['/catalogo/instituicoes-de-educacao', '/catalogo/pessoas-juridicas?subtipo=Institui%C3%A7%C3%A3o%20de%20ensino'],
  ['/catalogo/organizacoes', '/catalogo/pessoas-juridicas'],
  ['/catalogo/outras-organizacoes', '/catalogo/pessoas-juridicas'],
]);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InShell><HomePage /></InShell>} />
      <Route path="/selecionar" element={<InShell><SelectionPage /></InShell>} />
      <Route path="/pesquisar-parceiros" element={<InShell><PartnerResearchHomePage /></InShell>} />
      <Route path="/pesquisar-parceiros/externa" element={<InShell><PromptGeneratorPage /></InShell>} />
      <Route path="/pesquisar-parceiros/interna" element={<InShell adminOnly><CatalogResearchPage /></InShell>} />
      <Route path="/gerador-prompt" element={<Navigate to="/pesquisar-parceiros/externa" replace />} />
      <Route path="/pesquisar-catalogo" element={<Navigate to="/pesquisar-parceiros/interna" replace />} />
      <Route path="/radar" element={<InShell><RadarPage /></InShell>} />
      {/* `/catalogo` era uma tela intermediária com dois cartões que levavam
          exatamente às duas abas que já existem no topo da lista: um clique a
          mais para chegar ao mesmo lugar. O caminho continua válido — links já
          compartilhados apontam para ele — e agora entra direto na primeira
          categoria. */}
      <Route path="/catalogo" element={<Navigate to="/catalogo/pessoas-fisicas" replace />} />
      <Route path="/catalogo/pessoas-fisicas" element={<InShell><PesquisadoresPage /></InShell>} />
      <Route path="/catalogo/pessoas-juridicas" element={<InShell><OrganizacoesPage /></InShell>} />
      {/* Caminhos anteriores. O catch-all abaixo mandaria para a home, o que
          transformaria um link já compartilhado num beco sem explicação. */}
      {LEGACY_CATALOG_ROUTES.map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      {/* A administração passou a viver dentro da casca. Uma barra própria,
          sem trilha e sem marca, fazia perder a orientação justamente onde as
          ações são irreversíveis — e obrigava a manter duas navegações. */}
      <Route path="/admin" element={<InShell adminOnly><AdminPage /></InShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
