import React, { useMemo, useState } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MergeIcon from '@mui/icons-material/Merge';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DetailModal from '../DetailModal';
import EntityCard from './EntityCard';
import { formatInstitutionName } from '../../domain/institutionName';
import { researchDecisionKey } from '../../domain/catalogResearchFlow';
import {
  RESEARCH_STATES,
  approveAllNew,
  compareCatalogRecords,
  countResearchStates,
  filterResearchRows,
} from '../../domain/catalogResearchReview';
import { getCategoriasFromAreas } from '../../utils/areaCategories';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';

/**
 * Revisão de registros antes de entrarem no catálogo.
 *
 * Existiam dois caminhos para o mesmo destino, com garantias opostas: a
 * pesquisa por IA revisava card a card e a importação de CSV ia da prévia
 * direto para a gravação, com as decisões geradas automaticamente. As duas
 * escrevem no mesmo catálogo, e desfazer depois é mais caro do que conferir
 * antes — então as duas passam por aqui.
 */

function summarize(text, maxSentences = 2) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, maxSentences).join(' ').trim();
}

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export function importCardPresentation(record) {
  const category = record.categoria === 'Pessoa Física' || record.tipo_registro === 'person' ? 'person' : 'organization';
  const item = { ...record, addedAt: record.data_consulta || record.addedAt };
  if (category === 'person') {
    const href = record.perfil_principal_url || record.website_oficial || record.linkedin_url || record.scholar;
    return {
      category,
      item,
      detailItem: record,
      detailType: 'person',
      eyebrow: record.subtipo || (record.perfis_atuacao || [])[0] || 'Pessoa física',
      title: record.nome,
      subtitle: [record.cargo, record.instituicao_atual || record.instituicao].filter(Boolean).join(' · '),
      summary: record.miniBio || record.resumo || summarize(record.pesquisa || record.descricao),
      tags: getCategoriasFromAreas(record.areas || record.areas_especialidade || []),
      badge: record.h_index ? `h-index ${record.h_index}` : undefined,
      link: isHttpUrl(href) ? { href, label: href === record.linkedin_url ? 'LinkedIn' : 'Perfil público' } : undefined,
    };
  }
  const href = record.website_oficial || record.website;
  return {
    category,
    item,
    detailItem: { ...record, natureza: record.natureza || record.natureza_juridica },
    detailType: 'stakeholder',
    eyebrow: record.subtipo || record.tipo_instituicao || 'Pessoa jurídica',
    title: formatInstitutionName(record.nome),
    subtitle: [record.setor, record.cidade_estado].filter(Boolean).join(' · '),
    summary: record.resumo || record.descricao,
    tags: Array.isArray(record.areas) ? record.areas : (record.areas_temas || record.areas_formacao || []),
    link: isHttpUrl(href) ? { href, label: 'Abrir site oficial' } : undefined,
  };
}

/**
 * Lado a lado do que já existe e do que chegou.
 *
 * Sem isto, "Mesclar" é uma decisão às cegas: o card não mostra o que o
 * registro atual tem e o novo não tem, então a saída segura é sempre manter o
 * atual — e nem a pesquisa nem a importação melhoram o catálogo.
 */
function DuplicateComparison({ existing, incoming }) {
  const [open, setOpen] = useState(false);
  const rows = compareCatalogRecords(existing, incoming);
  if (!rows.length) return null;
  const changed = rows.filter((row) => row.differs).length;
  return (
    <Box sx={{ mb: 1 }}>
      {/* Recolhida por padrão. Aberta, esta tabela deixa o card do duplicado
          bem mais alto que os vizinhos e abre um vão na fileira; e ela é
          consultada no momento de decidir, não o tempo todo. O rótulo diz o
          que há dentro, então continua sendo uma decisão informada. */}
      <Button
        size="small"
        fullWidth
        onClick={() => setOpen((current) => !current)}
        endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: `transform ${T.motion.fast}` }} />}
        sx={{ justifyContent: 'space-between', color: T.ink.muted, border: `1px solid ${T.border.subtle}`, mb: open ? 1 : 0 }}
        aria-expanded={open}
      >
        {changed ? `Ver o que muda · ${changed} ${changed === 1 ? 'campo' : 'campos'}` : 'Ver a comparação'}
      </Button>
      <Collapse in={open}>
    <Box sx={{ border: `1px solid ${T.border.subtle}`, borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction="row" sx={{ bgcolor: T.surface.sunken, px: 1.25, py: .5 }}>
        <Typography variant="caption" sx={{ flex: 1, fontWeight: 700, color: T.ink.muted }}>No catálogo</Typography>
        <Typography variant="caption" sx={{ flex: 1, fontWeight: 700, color: T.ink.muted }}>Chegando agora</Typography>
      </Stack>
      {rows.map((row) => (
        <Stack key={row.label} direction="row" sx={{ px: 1.25, py: .4, borderTop: `1px solid ${T.border.subtle}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: 'block', color: T.ink.subtle }}>{row.label}</Typography>
            <Typography variant="caption" sx={{ color: T.ink.base }}>{row.existing || '—'}</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: 'block', color: T.ink.subtle }}>&nbsp;</Typography>
            <Typography variant="caption" sx={{ color: row.differs ? T.feedback.success : T.ink.base, fontWeight: row.differs ? 700 : 400 }}>
              {row.incoming || '—'}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Box>
      </Collapse>
    </Box>
  );
}

export function ImportCandidateCard({ row, decision, onDecision, existingRecord, dateLabel = 'Pesquisada em' }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const record = row.record || {};
  const invalid = row.status === 'invalid';
  const duplicate = row.status === 'possible_duplicate';
  const importedDuplicate = duplicate && row.match?.source === 'imported';
  const presentation = importCardPresentation(record);
  const approved = ['use_imported', 'merge'].includes(decision);

  return (
    <>
      {/* Sem altura forçada. Um card com a tabela de comparação da duplicata é
          muito mais alto que os demais, e esticar a fileira inteira até ele
          inflava os vizinhos — o resumo perdia o limite de três linhas e
          virava um paredão de texto ao lado de um card que informa. */}
      <Stack gap={1.25}>
        <Box sx={{ borderRadius: 1, outline: approved ? `2px solid ${T.feedback.success}` : 'none', outlineOffset: 2 }}>
          <EntityCard
            item={presentation.item}
            view="grid"
            accent="catalog"
            eyebrow={presentation.eyebrow}
            title={presentation.title}
            subtitle={presentation.subtitle}
            summary={presentation.summary}
            tags={presentation.tags}
            badge={presentation.badge}
            link={presentation.link}
            dateLabel={dateLabel}
            onClick={() => setDetailsOpen(true)}
          />
        </Box>

        <Box>
          {/* Três origens de duplicata, três consequências diferentes. Dizer
              "já está no catálogo" para um registro repetido dentro da própria
              planilha manda procurar no lugar errado. */}
          {duplicate && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {row.match?.source === 'file'
                ? <>Repetido na própria planilha: a linha {row.match?.id} traz <strong>{row.match?.name}</strong> com o mesmo identificador. Só a primeira ocorrência será considerada.</>
                : importedDuplicate
                  ? <><strong>{row.match?.name}</strong> já está no catálogo. Escolha manter o cadastro atual ou mesclar as informações.</>
                  : <><strong>{row.match?.name}</strong> já está no catálogo e será mantido.</>}
            </Alert>
          )}
          {importedDuplicate && <DuplicateComparison existing={existingRecord} incoming={record} />}
          {invalid && <Alert severity="error" sx={{ mb: 1 }}>Este registro não tem evidências suficientes para ser adicionado.</Alert>}
          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
            {!invalid && !duplicate && row.status !== 'already_imported' && (
              <>
                <Button size="small" variant={decision === 'ignore' ? 'contained' : 'outlined'} color="inherit" startIcon={<CloseIcon />} onClick={() => onDecision('ignore')}>Descartar</Button>
                <Button size="small" variant={decision === 'use_imported' ? 'contained' : 'outlined'} color="success" startIcon={<CheckCircleOutlineIcon />} onClick={() => onDecision('use_imported')}>Adicionar</Button>
              </>
            )}
            {importedDuplicate && (
              <>
                <Button size="small" variant={decision === 'keep_existing' ? 'contained' : 'outlined'} color="inherit" onClick={() => onDecision('keep_existing')}>Manter atual</Button>
                <Button size="small" variant={decision === 'merge' ? 'contained' : 'outlined'} color="success" startIcon={<MergeIcon />} onClick={() => onDecision('merge')}>Mesclar</Button>
              </>
            )}
          </Stack>
        </Box>
      </Stack>
      <DetailModal open={detailsOpen} onClose={() => setDetailsOpen(false)} item={presentation.detailItem} type={presentation.detailType} />
    </>
  );
}

/**
 * Barra do lote: contagem por estado, aprovação em massa e filtros.
 *
 * A decisão padrão de todo registro é descartar, então sem uma ação em massa o
 * primeiro efeito visível custa um clique por card. Aprovar de uma vez só toca
 * nos que não têm ressalva; duplicata e registro sem evidência continuam
 * pedindo decisão individual, que é onde a atenção deve ficar.
 */
export function ImportReviewToolbar({ rows, decisions, onDecisionsChange, stateFilter, onStateFilterChange, busy, children, accent = 'research' }) {
  const counts = useMemo(() => countResearchStates(rows), [rows]);
  const tone = T.tools[accent] || T.tools.research;

  return (
    <Box>
      <Stack direction={{ xs: 'column', lg: 'row' }} gap={2} alignItems={{ lg: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {rows.length} {rows.length === 1 ? 'registro para revisar' : 'registros para revisar'}
          </Typography>
          <Typography variant="caption" sx={{ color: T.ink.muted }}>
            {counts.new} {counts.new === 1 ? 'novo' : 'novos'} · {counts.duplicate} já no catálogo · {counts.invalid} sem evidência suficiente
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DoneAllIcon />}
            disabled={busy || counts.new === 0}
            onClick={() => onDecisionsChange(approveAllNew(rows, decisions))}
          >
            Aprovar {counts.new === 1 ? 'o novo' : `os ${counts.new} novos`}
          </Button>
          {children}
        </Stack>
      </Stack>

      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
        {RESEARCH_STATES.map((state) => (
          <Chip
            key={state.id}
            label={`${state.label} · ${counts[state.id]}`}
            size="small"
            onClick={() => onStateFilterChange(state.id)}
            aria-pressed={stateFilter === state.id}
            variant={stateFilter === state.id ? 'filled' : 'outlined'}
            disabled={counts[state.id] === 0 && state.id !== 'all'}
            sx={stateFilter === state.id ? { bgcolor: tone.main, color: '#fff' } : undefined}
          />
        ))}
      </Stack>
    </Box>
  );
}

export function ImportReviewGrid({ rows, stateFilter, decisions, onDecision, existingById, dateLabel, columns = { xs: 12, sm: 6, lg: 4 } }) {
  const visible = useMemo(() => filterResearchRows(rows, stateFilter), [rows, stateFilter]);
  return (
    // `flex-start`: cada card tem a altura do seu conteúdo. Alinhados pelo
    // topo, a duplicata pode crescer com a comparação sem arrastar a fileira.
    <Grid container spacing={2} alignItems="flex-start">
      {visible.map((row) => (
        <Grid size={columns} key={`${row.batchId}:${row.hash || row.rowNumber}`}>
          <ImportCandidateCard
            row={row}
            dateLabel={dateLabel}
            existingRecord={row.match?.id !== undefined ? existingById?.get(String(row.match.id)) : undefined}
            decision={decisions[researchDecisionKey(row.batchId, row.rowNumber)] || 'ignore'}
            onDecision={(decision) => onDecision(researchDecisionKey(row.batchId, row.rowNumber), decision)}
          />
        </Grid>
      ))}
    </Grid>
  );
}
