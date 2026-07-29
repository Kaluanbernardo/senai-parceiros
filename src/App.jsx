import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { getNavTools } from './app/toolRegistry';
import { getToolIcon } from './app/toolIcons';

// Each route loads on demand so the first paint carries only the shell, the
// login screen and the seed catalog.  LoginPage stays eager: `Protected`
// renders it synchronously for every signed-out visitor.
const HomePage = lazy(() => import('./pages/HomePage'));
const CatalogHomePage = lazy(() => import('./pages/CatalogHomePage'));
const SelectionPage = lazy(() => import('./pages/SelectionPage'));
const PromptGeneratorPage = lazy(() => import('./pages/PromptGeneratorPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const EscolasUnificadaPage = lazy(() => import('./pages/EscolasUnificadaPage'));
const OrganizacoesPage = lazy(() => import('./pages/OrganizacoesPage'));
const PesquisadoresPage = lazy(() => import('./pages/PesquisadoresPage'));
const RadarPage = lazy(() => import('./pages/RadarPage'));

const navigation = [
  { path: '/', label: 'Início', icon: <HomeOutlinedIcon />, matchPrefix: '/' },
  ...getNavTools().map((tool) => ({
    path: tool.route,
    label: tool.navLabel,
    icon: getToolIcon(tool.iconKey),
    matchPrefix: tool.matchPrefix,
  })),
];

function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'primary.main', backgroundImage: 'linear-gradient(120deg, #0B3558 0%, #1769AA 100%)' }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 64, md: 72 } }}>
          <AccountBalanceIcon sx={{ fontSize: 30, mr: .5 }} />
          <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap', mr: 1 }}>SENAI-SP <Box component="span" sx={{ opacity: .65, fontWeight: 400 }}>| Parceiros</Box></Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' }, opacity: .75 }}>{user?.username}</Typography>
          {user?.role === 'admin' && <Tooltip title="Painel administrativo"><IconButton color="inherit" onClick={() => navigate('/admin')}><AdminPanelSettingsIcon /></IconButton></Tooltip>}
          <Tooltip title="Sair"><IconButton color="inherit" onClick={logout}><LogoutIcon /></IconButton></Tooltip>
        </Toolbar>
        <Box sx={{ overflowX: 'auto', px: { xs: 1, md: 2 }, bgcolor: 'rgba(0,0,0,.14)', borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <Stack direction="row" sx={{ minWidth: 'max-content' }}>
            {navigation.map((item) => {
              const selected = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.matchPrefix || item.path);
              return <Button key={item.path} onClick={() => navigate(item.path)} startIcon={item.icon} sx={{ color: 'white', borderRadius: 0, minHeight: 48, px: 1.5, opacity: selected ? 1 : .72, borderBottom: selected ? '3px solid #fff' : '3px solid transparent', whiteSpace: 'nowrap' }}>{item.label}</Button>;
            })}
          </Stack>
        </Box>
      </AppBar>
      <Box component="main" sx={{ flex: 1, bgcolor: 'background.default' }}>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </Box>
      <Box component="footer" sx={{ py: 2, px: 2, textAlign: 'center', bgcolor: 'primary.dark', color: 'rgba(255,255,255,.65)', fontSize: '.78rem' }}>SENAI-SP · Gerência de Educação · Ferramenta pública de MVP</Box>
    </Box>
  );
}

function PageFallback() {
  return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
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
  return <Protected adminOnly={adminOnly}><AppShell>{children}</AppShell></Protected>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InShell><HomePage /></InShell>} />
      <Route path="/selecionar" element={<InShell><SelectionPage /></InShell>} />
      <Route path="/gerador-prompt" element={<InShell><PromptGeneratorPage /></InShell>} />
      <Route path="/radar" element={<InShell><RadarPage /></InShell>} />
      <Route path="/catalogo" element={<InShell><CatalogHomePage /></InShell>} />
      <Route path="/catalogo/pesquisadores" element={<InShell><PesquisadoresPage /></InShell>} />
      <Route path="/catalogo/escolas" element={<InShell><EscolasUnificadaPage /></InShell>} />
      <Route path="/catalogo/organizacoes" element={<InShell><OrganizacoesPage /></InShell>} />
      <Route path="/admin" element={<Protected adminOnly><Suspense fallback={<PageFallback />}><AdminPage /></Suspense></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
