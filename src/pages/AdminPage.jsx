import React, { useEffect, useState, useRef } from 'react';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import AdminTable from '../components/AdminTable';
import EditDialog from '../components/EditDialog';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const data = useData();
  const importRequested = searchParams.get('import') === '1';
  const [tab, setTab] = useState(0);
  const [editItem, setEditItem] = useState(null);
  const [editType, setEditType] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [menuAnchor, setMenuAnchor] = useState(null);
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const [importType, setImportType] = useState(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [batches, setBatches] = useState([]);
  const [batchesBusy, setBatchesBusy] = useState(false);
  const [rollbackBatch, setRollbackBatch] = useState(null);

  const showSnack = (message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  };

  const tabConfig = [
    { label: 'Stakeholders', icon: <HandshakeIcon />, type: 'stakeholder', data: data.stakeholders },
    { label: 'Instituições de Educação', icon: <SchoolIcon />, type: 'escola', data: data.escolas },
    { label: 'Especialistas', icon: <ScienceIcon />, type: 'pesquisador', data: data.pesquisadores },
  ];

  const currentTab = tabConfig[tab];

  useEffect(() => {
    if (!importRequested) return undefined;
    const timer = setTimeout(() => csvInputRef.current?.click(), 100);
    return () => clearTimeout(timer);
  }, [importRequested]);

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
    const typeLabels = { stakeholders: 'Stakeholders', escolas: 'Instituições de Educação', pesquisadores: 'Especialistas' };
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

  const handleCsvClick = () => {
    setMenuAnchor(null);
    setTimeout(() => csvInputRef.current?.click(), 100);
  };

  const loadImportBatches = async () => {
    setBatchesBusy(true);
    try {
      const response = await fetch('/api/admin/catalog-import-batches', { credentials: 'include' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao carregar histórico.');
      setBatches(body.batches || []);
    } catch (error) {
      showSnack(error.message || 'Falha ao carregar histórico.', 'error');
    } finally {
      setBatchesBusy(false);
    }
  };

  const handleBatchesClick = () => {
    setMenuAnchor(null);
    setBatchesOpen(true);
    loadImportBatches();
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackBatch) return;
    setBatchesBusy(true);
    try {
      const response = await fetch('/api/admin/catalog-import-rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ batchId: rollbackBatch.batchId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao desfazer lote.');
      await data.refreshCatalog();
      setRollbackBatch(null);
      showSnack('Lote desfeito e catálogo atualizado.', 'info');
      await loadImportBatches();
    } catch (error) {
      showSnack(error.message || 'Falha ao desfazer lote.', 'error');
    } finally {
      setBatchesBusy(false);
    }
  };

  const handleCsvFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || csvBusy) return;
    setCsvBusy(true);
    showSnack('Importando CSV; registros existentes serão mantidos automaticamente.', 'info');
    try {
      const buffer = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      const response = await fetch('/api/admin/catalog-import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: file.name, contentBase64: btoa(binary) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao importar CSV.');
      const decisions = Object.fromEntries((body.rows || []).map((row) => [String(row.rowNumber), row.status === 'new' ? 'use_imported' : 'keep_existing']));
      await commitCsv(body, decisions);
    } catch (error) {
      showSnack(error.message || 'Falha ao importar CSV.', 'error');
    } finally {
      setCsvBusy(false);
    }
  };

  const commitCsv = async (preview, decisions) => {
    const response = await fetch('/api/admin/catalog-import-commit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ batchId: preview.batchId, decisions }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Falha ao confirmar a importação.');
    data.mergeImportedRecords(body.category, body.records || []);
    let radarUpdated = true;
    if (body.category === 'researcher' && body.applied?.length) {
      const radarResponse = await fetch('/api/radar/refresh', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      radarUpdated = radarResponse.ok;
    }
    showSnack(
      `Importação confirmada: ${body.applied?.length || 0} registro(s) aplicado(s).${body.category === 'researcher' ? (radarUpdated ? ' Radar atualizado.' : ' O catálogo foi salvo, mas o Radar precisa de atualização manual.') : ''}`,
      radarUpdated ? 'success' : 'warning',
    );
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
        const typeLabels = { stakeholders: 'Stakeholders', escolas: 'Instituições de Educação', pesquisadores: 'Especialistas' };
        showSnack(`${typeLabels[importType]} importado com sucesso! (${parsed.length} registros)`);
      } catch (err) {
        showSnack(`Erro ao importar: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
              <ListItemText>Instituições de Educação (JSON)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport('pesquisadores')}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Especialistas (JSON)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport('all')}>
              <ListItemIcon><DownloadIcon fontSize="small" color="primary" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600 }}>Exportar Tudo</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem disabled>
              <Typography variant="caption" fontWeight={700}>IMPORTAR</Typography>
            </MenuItem>
            <MenuItem onClick={handleCsvClick} disabled={csvBusy}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Importar CSV em massa" secondary="A categoria é lida do arquivo; existentes são mantidos" />
            </MenuItem>
            <MenuItem onClick={handleBatchesClick}>
              <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Histórico de importações" secondary="Consultar lotes e desfazer quando permitido" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleImportClick('stakeholders')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Stakeholders JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleImportClick('escolas')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Instituições de Educação (JSON)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleImportClick('pesquisadores')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Especialistas (JSON)</ListItemText>
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
          <Alert severity="info" sx={{ mb: 2 }}>
            Importações CSV adicionam registros novos e mantêm automaticamente tudo que já existe. Para persistência entre instâncias, configure o adapter durável do catálogo antes do handoff Azure.
          </Alert>
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
      <input type="file" ref={csvInputRef} style={{ display: 'none' }} accept=".csv,text/csv" onChange={handleCsvFileChange} />

      <Dialog open={batchesOpen} onClose={() => !batchesBusy && setBatchesOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Histórico de importações</DialogTitle>
        <DialogContent dividers>
          {batchesBusy && <Alert severity="info" sx={{ mb: 2 }}>Carregando lotes…</Alert>}
          {!batchesBusy && !batches.length && <Alert severity="info">Nenhum lote confirmado neste ambiente.</Alert>}
          <List dense>
            {batches.map((batch) => (
              <ListItem key={batch.batchId} divider secondaryAction={<Button size="small" color="warning" startIcon={<RestoreIcon />} onClick={() => setRollbackBatch(batch)} disabled={batchesBusy}>Desfazer</Button>}>
                <ListItemText
                  primary={`${batch.filename || 'Planilha'} · ${batch.category}`}
                  secondary={`${batch.committedAt ? new Date(batch.committedAt).toLocaleString('pt-BR') : 'data não informada'} · aplicados: ${batch.applied?.length || 0} · ignorados: ${batch.ignored?.length || 0}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setBatchesOpen(false)} disabled={batchesBusy}>Fechar</Button><Button onClick={loadImportBatches} disabled={batchesBusy}>Atualizar</Button></DialogActions>
      </Dialog>

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

      <ConfirmDialog
        open={Boolean(rollbackBatch)}
        onClose={() => !batchesBusy && setRollbackBatch(null)}
        onConfirm={handleRollbackConfirm}
        title="Desfazer importação"
        message={`Desfazer o lote "${rollbackBatch?.filename || rollbackBatch?.batchId || ''}"? O catálogo voltará ao estado anterior, se não houver conflito posterior.`}
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
