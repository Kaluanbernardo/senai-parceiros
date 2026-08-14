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
const CatalogHomePage = lazy(() => import('./pages/CatalogHomePage'));
const SelectionPage = lazy(() => import('./pages/SelectionPage'));
const PromptGeneratorPage = lazy(() => import('./pages/PromptGeneratorPage'));
const CatalogResearchPage = lazy(() => import('./pages/CatalogResearchPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const EscolasUnificadaPage = lazy(() => import('./pages/EscolasUnificadaPage'));
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
  ['/catalogo/pesquisadores', '/catalogo/especialistas'],
  ['/catalogo/escolas', '/catalogo/instituicoes-de-educacao'],
  ['/catalogo/organizacoes', '/catalogo/outras-organizacoes'],
]);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InShell><HomePage /></InShell>} />
      <Route path="/selecionar" element={<InShell><SelectionPage /></InShell>} />
      <Route path="/gerador-prompt" element={<InShell><PromptGeneratorPage /></InShell>} />
      <Route path="/pesquisar-catalogo" element={<InShell adminOnly><CatalogResearchPage /></InShell>} />
      <Route path="/radar" element={<InShell><RadarPage /></InShell>} />
      <Route path="/catalogo" element={<InShell><CatalogHomePage /></InShell>} />
      <Route path="/catalogo/especialistas" element={<InShell><PesquisadoresPage /></InShell>} />
      <Route path="/catalogo/instituicoes-de-educacao" element={<InShell><EscolasUnificadaPage /></InShell>} />
      <Route path="/catalogo/outras-organizacoes" element={<InShell><OrganizacoesPage /></InShell>} />
      {/* Caminhos anteriores. O catch-all abaixo mandaria para a home, o que
          transformaria um link já compartilhado num beco sem explicação. */}
      {LEGACY_CATALOG_ROUTES.map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="/admin" element={<Protected adminOnly><Suspense fallback={<PageFallback />}><AdminPage /></Suspense></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
