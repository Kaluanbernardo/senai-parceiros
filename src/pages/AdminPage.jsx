import React, { useEffect, useMemo, useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
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
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';
import RestoreIcon from '@mui/icons-material/Restore';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import AdminTable from '../components/AdminTable';
import EditDialog from '../components/EditDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import CatalogEnrichmentDialog from '../components/catalog/CatalogEnrichmentDialog';
import { ImportReviewGrid, ImportReviewToolbar } from '../components/catalog/ImportReview';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import { withCatalogClassification } from '../domain/catalogTaxonomy';
import { buildLegalEntityCatalog } from '../domain/legalEntityCatalog';
import { countApprovedDecisions } from '../domain/catalogResearchReview';
import { researchDecisionKey } from '../domain/catalogResearchFlow';

/**
 * Administração.
 *
 * Duas mudanças estruturais:
 *
 * - **Vive dentro da casca do produto.** Ela tinha barra própria, num azul que
 *   não existe nos tokens, sem trilha e sem marca — e é justamente aqui que as
 *   ações são irreversíveis, ou seja, o pior lugar para perder a orientação.
 * - **O CSV passa pela mesma revisão da pesquisa por IA.** Escolher o arquivo
 *   disparava prévia e gravação em sequência, com as decisões geradas
 *   automaticamente: o arquivo entrava no catálogo sem que ninguém visse uma
 *   linha. As duas entradas escrevem no mesmo lugar, e desfazer depois custa
 *   mais do que conferir antes.
 */
export default function AdminPage() {
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
  const [batches, setBatches] = useState([]);
  const [batchesBusy, setBatchesBusy] = useState(false);
  const [rollbackBatch, setRollbackBatch] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvDecisions, setCsvDecisions] = useState({});
  const [csvStateFilter, setCsvStateFilter] = useState('all');
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);

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
    { label: 'Pessoas Jurídicas', type: 'legalEntity', addType: 'stakeholder', data: legalEntityRows },
    { label: 'Pessoas Físicas', type: 'person', addType: 'pesquisador', data: personRows },
  ];

  const HISTORY_TAB = tabConfig.length;
  const currentTab = tabConfig[tab] || tabConfig[0];
  const onHistory = tab === HISTORY_TAB;

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

  useEffect(() => {
    if (!importRequested) return undefined;
    const timer = setTimeout(() => csvInputRef.current?.click(), 100);
    return () => clearTimeout(timer);
  }, [importRequested]);

  useEffect(() => {
    // Carregar ao abrir a aba, e não atrás de um item de menu: é aqui que se
    // desfaz um lote — a rede de segurança de todo o fluxo de importação.
    if (onHistory) loadImportBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHistory]);

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
      showSnack('Registro adicionado.');
    } else {
      if (editType === 'stakeholder') data.updateStakeholder(editItem.id, cleanForm);
      else if (editType === 'escola') data.updateEscola(editItem.id, cleanForm);
      else data.updatePesquisador(editItem.id, cleanForm);
      showSnack('Registro atualizado.');
    }
  };

  const handleDeleteClick = (item) => {
    setDeleteItem(item);
    setDeleteType(item._adminType || currentTab.addType);
  };

  const handleDeleteConfirm = () => {
    const id = deleteItem._adminId ?? deleteItem.id;
    if (deleteType === 'stakeholder') data.deleteStakeholder(id);
    else if (deleteType === 'escola') data.deleteEscola(id);
    else data.deletePesquisador(id);
    showSnack('Registro excluído.', 'info');
    setDeleteItem(null);
  };

  const handleExport = (type) => {
    const typeLabels = { legalEntities: 'Pessoas Jurídicas', pesquisadores: 'Pessoas Físicas' };
    if (type === 'all') {
      data.exportAll();
      showSnack('Todos os JSONs exportados.');
    } else {
      data.exportData(type);
      showSnack(`${typeLabels[type]} exportado.`);
    }
    setMenuAnchor(null);
  };

  const handleImportClick = (type) => {
    setImportType(type);
    setMenuAnchor(null);
    setTimeout(() => fileInputRef.current?.click(), 100);
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

  /** A prévia do CSV abre a revisão em vez de gravar. */
  const handleCsvFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || csvBusy) return;
    setCsvBusy(true);
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
        throw new Error(body.error || 'Falha ao ler o CSV.');
      }
      setCsvPreview(body);
      setCsvStateFilter('all');
      // Nada nasce aprovado: quem revisa decide, e a duplicata começa
      // preservando o cadastro atual, que é a escolha sem perda.
      setCsvDecisions(Object.fromEntries((body.rows || []).map((row) => [
        researchDecisionKey(body.batchId, row.rowNumber),
        row.status === 'possible_duplicate' ? 'keep_existing' : 'ignore',
      ])));
    } catch (error) {
      showSnack(error.message || 'Falha ao ler o CSV.', 'error');
    } finally {
      setCsvBusy(false);
    }
  };

  const csvRows = useMemo(
    () => (csvPreview?.rows || []).map((row) => ({ ...row, batchId: csvPreview.batchId })),
    [csvPreview],
  );
  const csvApproved = countApprovedDecisions(csvDecisions);

  const csvExistingById = useMemo(() => {
    if (!csvPreview) return new Map();
    const records = csvPreview.category === 'person'
      ? data.pesquisadores || []
      : buildLegalEntityCatalog({ schools: data.escolas || [], stakeholders: data.stakeholders || [] });
    return new Map(records.map((record) => [String(record.id), record._original || record]));
  }, [csvPreview, data.pesquisadores, data.escolas, data.stakeholders]);

  const commitCsv = async () => {
    if (!csvPreview) return;
    setCsvBusy(true);
    try {
      const decisions = Object.fromEntries((csvPreview.rows || []).map((row) => [
        String(row.rowNumber),
        csvDecisions[researchDecisionKey(csvPreview.batchId, row.rowNumber)] || 'ignore',
      ]));
      const response = await fetch('/api/admin/catalog-import-commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ batchId: csvPreview.batchId, decisions }),
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
      setCsvPreview(null);
      setCsvDecisions({});
      if (!appliedCount) {
        showSnack(`Importação concluída: nenhum registro novo foi aplicado (${ignoredCount} mantido(s) ou já importado(s)).`, 'info');
        return;
      }
      showSnack(
        `${appliedCount} registro(s) aplicado(s).${body.category === 'person' ? (radarUpdated ? ' Radar atualizado.' : ' O catálogo foi salvo; o Radar acompanha apenas perfis acadêmicos.') : ''}`,
        radarUpdated ? 'success' : 'warning',
      );
    } catch (error) {
      showSnack(error.message || 'Falha ao confirmar a importação.', 'error');
    } finally {
      setCsvBusy(false);
    }
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
        showSnack(`${typeLabels[importType]} importado. ${parsed.length} registros.`);
      } catch (err) {
        showSnack(`Erro ao importar: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <PageContainer width="wide" tool="research">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Gestão de dados"
        description={`${legalEntityRows.length} pessoas jurídicas e ${personRows.length} pessoas físicas no catálogo. O que é adicionado ou excluído aqui vale para todo o produto.`}
        accent="research"
        dense
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={csvBusy ? <CircularProgress size={16} color="inherit" /> : <FileUploadIcon />}
              disabled={csvBusy}
              onClick={() => csvInputRef.current?.click()}
            >
              Importar CSV…
            </Button>
            {/* O enriquecimento vivia atrás de um botão dentro de `/catalogo`,
                uma tela de leitura. Ele escreve no catálogo, então pertence
                ao mesmo lugar das outras ações que escrevem. */}
            <Button variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} onClick={() => setEnrichmentOpen(true)}>
              Enriquecer catálogo
            </Button>
            <Button variant="outlined" onClick={(event) => setMenuAnchor(event.currentTarget)}>
              Exportar
            </Button>
            <Button variant="contained" onClick={handleAdd} disabled={onHistory}>
              Novo registro
            </Button>
          </>
        }
      />

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
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
          <ListItemText primaryTypographyProps={{ fontWeight: 600 }}>Exportar tudo</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem disabled><Typography variant="caption" fontWeight={700}>RESTAURAR DE UM JSON</Typography></MenuItem>
        <MenuItem onClick={() => handleImportClick('legalEntities')}>
          <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Pessoas Jurídicas (JSON)</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleImportClick('pesquisadores')}>
          <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Pessoas Físicas (JSON)</ListItemText>
        </MenuItem>
      </Menu>

      <Box sx={{ mt: 2.5, borderBottom: `1px solid ${T.border.subtle}` }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          {tabConfig.map((entry, index) => (
            <Tab key={index} label={`${entry.label} · ${entry.data.length}`} />
          ))}
          {/* O histórico é onde se desfaz um lote. Enterrado num menu de três
              pontinhos, ele não era encontrado na hora em que era necessário. */}
          <Tab label="Histórico de importações" />
        </Tabs>
      </Box>

      <Box sx={{ mt: 2.5 }}>
        {onHistory ? (
          <>
            {batchesBusy && <Alert severity="info" sx={{ mb: 2 }}>Carregando lotes…</Alert>}
            {!batchesBusy && !batches.length && <Alert severity="info">Nenhum lote confirmado neste ambiente.</Alert>}
            <List>
              {batches.map((batch) => (
                <ListItem
                  key={batch.batchId}
                  divider
                  secondaryAction={<Button size="small" color="warning" startIcon={<RestoreIcon />} onClick={() => setRollbackBatch(batch)} disabled={batchesBusy}>Desfazer</Button>}
                >
                  <ListItemText
                    primary={`${batch.filename || 'Planilha'} · ${batch.category}`}
                    secondary={`${batch.committedAt ? new Date(batch.committedAt).toLocaleString('pt-BR') : 'data não informada'} · aplicados: ${batch.applied?.length || 0} · ignorados: ${batch.ignored?.length || 0}`}
                  />
                </ListItem>
              ))}
            </List>
            <Button onClick={loadImportBatches} disabled={batchesBusy} sx={{ mt: 1 }}>Atualizar</Button>
          </>
        ) : (
          <AdminTable
            data={currentTab.data}
            type={currentTab.type}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />
        )}
      </Box>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />
      <input type="file" ref={csvInputRef} style={{ display: 'none' }} accept=".csv,text/csv" onChange={handleCsvFileChange} />

      {/* Revisão do CSV: a mesma superfície da pesquisa por IA. */}
      <Dialog open={Boolean(csvPreview)} onClose={() => !csvBusy && setCsvPreview(null)} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>
          Revisar importação
          <Typography variant="body2" sx={{ color: T.ink.muted }}>
            {csvPreview?.filename || 'Planilha'} · {csvPreview?.category === 'person' ? 'pessoas físicas' : 'pessoas jurídicas'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {csvPreview && (
            <Stack gap={2}>
              <ImportReviewToolbar
                rows={csvRows}
                decisions={csvDecisions}
                onDecisionsChange={setCsvDecisions}
                stateFilter={csvStateFilter}
                onStateFilterChange={setCsvStateFilter}
                busy={csvBusy}
              />
              <ImportReviewGrid
                rows={csvRows}
                stateFilter={csvStateFilter}
                decisions={csvDecisions}
                existingById={csvExistingById}
                dateLabel="Na planilha desde"
                columns={{ xs: 12, md: 6 }}
                onDecision={(key, decision) => setCsvDecisions((previous) => ({ ...previous, [key]: decision }))}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvPreview(null)} disabled={csvBusy}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={csvBusy ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineIcon />}
            disabled={csvBusy || csvApproved === 0}
            onClick={commitCsv}
          >
            Adicionar {csvApproved} ao catálogo
          </Button>
        </DialogActions>
      </Dialog>

      <CatalogEnrichmentDialog
        open={enrichmentOpen}
        onClose={() => setEnrichmentOpen(false)}
        onCatalogChanged={data.refreshCatalog}
      />

      <EditDialog
        open={!!editType}
        onClose={() => { setEditType(null); setEditItem(null); }}
        onSave={handleSave}
        item={editItem}
        type={editType || 'stakeholder'}
        isNew={isNew}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir "${deleteItem?.nome || deleteItem?.instituicao || ''}"? Esta ação não pode ser desfeita.`}
      />

      <ConfirmDialog
        open={Boolean(rollbackBatch)}
        onClose={() => !batchesBusy && setRollbackBatch(null)}
        onConfirm={handleRollbackConfirm}
        title="Desfazer importação"
        message={`Desfazer o lote "${rollbackBatch?.filename || rollbackBatch?.batchId || ''}"? O catálogo voltará ao estado anterior, se não houver conflito posterior.`}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(prev => ({ ...prev, open: false }))} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}
