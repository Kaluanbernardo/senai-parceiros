import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PublicIcon from '@mui/icons-material/Public';
import ScienceIcon from '@mui/icons-material/Science';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import OrganizacoesPage from './pages/OrganizacoesPage';
import PesquisadoresPage from './pages/PesquisadoresPage';
import AdminPage from './pages/AdminPage';

function MainView() {
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={2} sx={{ bgcolor: 'primary.main' }}>
        <Toolbar>
          <PublicIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5 }}>
            SENAI-SP &nbsp;|&nbsp; Parceiros Educacionais
          </Typography>
          <Tooltip title="Painel Administrativo">
            <IconButton color="inherit" onClick={() => navigate('/admin')} sx={{ ml: 1 }}>
              <AdminPanelSettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{
            px: 2,
            '& .MuiTab-root': { minHeight: 48, fontWeight: 600, fontSize: '0.95rem' },
            '& .Mui-selected': { color: '#fff' },
          }}
        >
          <Tab icon={<AccountBalanceIcon />} iconPosition="start" label="Organizações" />
          <Tab icon={<ScienceIcon />} iconPosition="start" label="Pesquisadores" />
        </Tabs>
      </AppBar>

      <Box sx={{ flex: 1, bgcolor: 'background.default' }}>
        {tab === 0 && <OrganizacoesPage />}
        {tab === 1 && <PesquisadoresPage />}
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: 'center',
          bgcolor: 'primary.dark',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.8rem',
        }}
      >
        SENAI-SP &middot; Gerencia de Relacoes Internacionais &middot; {new Date().getFullYear()}
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainView />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
