import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import LockIcon from '@mui/icons-material/Lock';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import AdminTable from '../components/AdminTable';
import EditDialog from '../components/EditDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const ADMIN_PASSWORD = 'SENAISP2026';

function LoginGate({ onAuth }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', '1');
      onAuth();
    } else {
      setError(true);
      setPwd('');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }}>
      <Paper sx={{ p: 5, maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 3 }} elevation={6}>
        <LockIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Painel Administrativo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Digite a senha para acessar a gestao de dados.
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="password"
            label="Senha"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setError(false); }}
            error={error}
            helperText={error ? 'Senha incorreta. Tente novamente.' : ''}
            autoFocus
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" fullWidth size="large" sx={{ mb: 1.5 }}>
            Entrar
          </Button>
          <Button color="inherit" fullWidth onClick={() => navigate('/')}>
            Voltar ao site
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const data = useData();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_auth') === '1');
  const [tab, setTab] = useState(0);
  const [editItem, setEditItem] = useState(null);
  const [editType, setEditType] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [menuAnchor, setMenuAnchor] = useState(null);
  const fileInputRef = useRef(null);
  const [importType, setImportType] = useState(null);

  const showSnack = (message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  };

  const tabConfig = [
    { label: 'Stakeholders', icon: <HandshakeIcon />, type: 'stakeholder', data: data.stakeholders },
    { label: 'Escolas', icon: <SchoolIcon />, type: 'escola', data: data.escolas },
    { label: 'Pesquisadores', icon: <ScienceIcon />, type: 'pesquisador', data: data.pesquisadores },
  ];

  const currentTab = tabConfig[tab];

  // Edit handlers
  const handleEdit = (item) => {
    setEditItem(item);
    setEditType(currentTab.type);
    setIsNew(false);
  };

  const handleAdd = () => {
    setEditItem(null);
    setEditType(currentTab.type);
    setIsNew(true);
  };

  const handleSave = (formData) => {
    if (isNew) {
      if (editType === 'stakeholder') data.addStakeholder(formData);
      else if (editType === 'escola') data.addEscola(formData);
      else data.addPesquisador(formData);
      showSnack('Registro adicionado com sucesso!');
    } else {
      if (editType === 'stakeholder') data.updateStakeholder(editItem.id, formData);
      else if (editType === 'escola') data.updateEscola(editItem.id, formData);
      else data.updatePesquisador(editItem.id, formData);
      showSnack('Registro atualizado com sucesso!');
    }
  };

  // Delete handlers
  const handleDeleteClick = (item) => {
    setDeleteItem(item);
    setDeleteType(currentTab.type);
  };

  const handleDeleteConfirm = () => {
    if (deleteType === 'stakeholder') data.deleteStakeholder(deleteItem.id);
    else if (deleteType === 'escola') data.deleteEscola(deleteItem.id);
    else data.deletePesquisador(deleteItem.id);
    showSnack('Registro excluido!', 'info');
    setDeleteItem(null);
  };

  // Export handler
  const handleExport = (type) => {
    const typeLabels = { stakeholders: 'Stakeholders', escolas: 'Escolas', pesquisadores: 'Pesquisadores' };
    if (type === 'all') {
      data.exportAll();
      showSnack('Todos os JSONs exportados!');
    } else {
      data.exportData(type);
      showSnack(`${typeLabels[type]} exportado!`);
    }
    setMenuAnchor(null);
  };

  // Import handler
  const handleImportClick = (type) => {
    setImportType(type);
    setMenuAnchor(null);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !importType) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error('JSON deve ser um array');
        data.importData(importType, parsed);
        const typeLabels = { stakeholders: 'Stakeholders', escolas: 'Escolas', pesquisadores: 'Pesquisadores' };
        showSnack(`${typeLabels[importType]} importado com sucesso! (${parsed.length} registros)`);
      } catch (err) {
        showSnack(`Erro ao importar: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!authed) {
    return <LoginGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={2} sx={{ bgcolor: '#1a1a2e' }}>
        <Toolbar>
          <Tooltip title="Voltar ao site">
            <IconButton color="inherit" onClick={() => navigate('/')} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <AdminPanelSettingsIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5 }}>
            Admin &nbsp;|&nbsp; Gestao de Dados
          </Typography>

          <Tooltip title="Opcoes de Export/Import">
            <IconButton color="inherit" onClick={e => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>
              <Typography variant="caption" fontWeight={700}>EXPORTAR</Typography>
            </MenuItem>
            <MenuItem onClick={() => handleExport('stakeholders')}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Stakeholders JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport('escolas')}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Escolas JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport('pesquisadores')}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Pesquisadores JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport('all')}>
              <ListItemIcon><DownloadIcon fontSize="small" color="primary" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600 }}>Exportar Tudo</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem disabled>
              <Typography variant="caption" fontWeight={700}>IMPORTAR</Typography>
            </MenuItem>
            <MenuItem onClick={() => handleImportClick('stakeholders')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Stakeholders JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleImportClick('escolas')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Escolas JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleImportClick('pesquisadores')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Pesquisadores JSON</ListItemText>
            </MenuItem>
          </Menu>
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
          {tabConfig.map((t, i) => (
            <Tab
              key={i}
              icon={t.icon}
              iconPosition="start"
              label={`${t.label} (${t.data.length})`}
            />
          ))}
        </Tabs>
      </AppBar>

      <Box sx={{ flex: 1, bgcolor: '#f5f5f7', p: { xs: 2, md: 3 } }}>
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <AdminTable
            data={currentTab.data}
            type={currentTab.type}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onAdd={handleAdd}
          />
        </Box>
      </Box>

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileChange}
      />

      {/* Edit Dialog */}
      <EditDialog
        open={!!editType}
        onClose={() => { setEditType(null); setEditItem(null); }}
        onSave={handleSave}
        item={editItem}
        type={editType || 'stakeholder'}
        isNew={isNew}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir "${deleteItem?.nome || deleteItem?.instituicao || ''}"? Esta acao nao pode ser desfeita.`}
      />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(prev => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
