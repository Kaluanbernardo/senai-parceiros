import React, { useEffect, useMemo, useState, useRef } from 'react';
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
import { withCatalogClassification } from '../domain/catalogTaxonomy';
import { buildLegalEntityCatalog } from '../domain/legalEntityCatalog';

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

  const legalEntityRows = useMemo(() => buildLegalEntityCatalog({
    schools: data.escolas,
    stakeholders: data.stakeholders,
  }).map((record) => {
    const adminType = record._type === 'stakeholder' ? 'stakeholder' : 'escola';
    const original = record._original && typeof record._original === 'object' ? record._original : record;
    const adminId = original.id ?? record._sourceId ?? record.id;
    return {
      ...record,
      _adminType: adminType,
      _adminKey: `${adminType}:${adminId}`,
      _adminId: adminId,
      _adminOriginal: original,
    };
  }), [data.escolas, data.stakeholders]);

  const personRows = useMemo(() => data.pesquisadores.map((record) => ({
    ...withCatalogClassification(record, 'person'),
    _adminType: 'pesquisador',
    _adminKey: `pesquisador:${record.id}`,
  })), [data.pesquisadores]);

  const tabConfig = [
    { label: 'Pessoas Jurídicas', icon: <HandshakeIcon />, type: 'legalEntity', addType: 'stakeholder', data: legalEntityRows },
    { label: 'Pessoas Físicas', icon: <ScienceIcon />, type: 'person', addType: 'pesquisador', data: personRows },
  ];

  const currentTab = tabConfig[tab];

  useEffect(() => {
    if (!importRequested) return undefined;
    const timer = setTimeout(() => csvInputRef.current?.click(), 100);
    return () => clearTimeout(timer);
  }, [importRequested]);

  // Edit handlers
  const handleEdit = (item) => {
    setEditItem({ ...(item._adminOriginal || item), subtipo: item.subtipo });
    setEditType(item._adminType || currentTab.addType);
    setIsNew(false);
  };

  const handleAdd = () => {
    setEditItem(null);
    setEditType(currentTab.addType);
    setIsNew(true);
  };

  const handleSave = (formData) => {
    const cleanForm = Object.fromEntries(Object.entries(formData).filter(([key]) => !key.startsWith('_admin')));
    if (editType === 'escola') delete cleanForm.nome;
    if (isNew) {
      if (editType === 'stakeholder') data.addStakeholder(cleanForm);
      else if (editType === 'escola') data.addEscola(cleanForm);
      else data.addPesquisador(cleanForm);
      showSnack('Registro adicionado com sucesso!');
    } else {
      if (editType === 'stakeholder') data.updateStakeholder(editItem.id, cleanForm);
      else if (editType === 'escola') data.updateEscola(editItem.id, cleanForm);
      else data.updatePesquisador(editItem.id, cleanForm);
      showSnack('Registro atualizado com sucesso!');
    }
  };

  // Delete handlers
  const handleDeleteClick = (item) => {
    setDeleteItem(item);
    setDeleteType(item._adminType || currentTab.addType);
  };

  const handleDeleteConfirm = () => {
    const id = deleteItem._adminId ?? deleteItem.id;
    if (deleteType === 'stakeholder') data.deleteStakeholder(id);
    else if (deleteType === 'escola') data.deleteEscola(id);
    else data.deletePesquisador(id);
    showSnack('Registro excluido!', 'info');
    setDeleteItem(null);
  };

  // Export handler
  const handleExport = (type) => {
    const typeLabels = { legalEntities: 'Pessoas Jurídicas', pesquisadores: 'Pessoas Físicas' };
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
      if (!response.ok) {
        if (body.error === 'catalog_mixed_categories') {
          const categoryLabels = { person: 'pessoas físicas', researcher: 'pessoas físicas', organization: 'pessoas jurídicas', school: 'pessoas jurídicas' };
          const categories = (body.categories || []).map((category) => categoryLabels[category] || category).join(', ');
          throw new Error(`CSV misto (${categories}). Separe pessoas físicas e pessoas jurídicas em arquivos diferentes.`);
        }
        throw new Error(body.error || 'Falha ao importar CSV.');
      }
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
    if (body.category === 'person' && body.applied?.length) {
      const radarResponse = await fetch('/api/radar/refresh', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      radarUpdated = radarResponse.ok;
    }
    const appliedCount = body.applied?.length || 0;
    const ignoredCount = body.ignored?.length || 0;
    if (!appliedCount) {
      showSnack(`Importação concluída: nenhum registro novo foi aplicado (${ignoredCount} mantido(s) ou já importado(s)).`, 'info');
      return;
    }
    showSnack(
      `Importação confirmada: ${appliedCount} registro(s) aplicado(s).${body.category === 'person' ? (radarUpdated ? ' Radar atualizado.' : ' O catálogo foi salvo; o Radar acompanha apenas perfis acadêmicos.') : ''}`,
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
        const typeLabels = { legalEntities: 'Pessoas Jurídicas', pesquisadores: 'Pessoas Físicas' };
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
            <MenuItem onClick={() => handleExport('legalEntities')}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Pessoas Jurídicas (JSON)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport('pesquisadores')}>
              <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Pessoas Físicas (JSON)</ListItemText>
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
            <MenuItem onClick={() => handleImportClick('legalEntities')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Pessoas Jurídicas (JSON)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleImportClick('pesquisadores')}>
              <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Pessoas Físicas (JSON)</ListItemText>
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
