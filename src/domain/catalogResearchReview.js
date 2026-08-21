import { researchDecisionKey } from './catalogResearchFlow.js';

/**
 * Estado de revisão de um lote de pesquisa.
 *
 * A revisão card a card é o ponto mais forte do fluxo — nada entra no catálogo
 * sem aprovação. O que faltava era a visão do lote: depois de uma espera que
 * pode passar de um minuto, o contador dizia "Adicionar aprovados (0)" com o
 * botão desligado, porque a decisão padrão de todo card é descartar. Com vinte
 * resultados, o primeiro efeito visível custava vinte cliques.
 */

export const RESEARCH_STATES = Object.freeze([
  Object.freeze({ id: 'all', label: 'Todos' }),
  Object.freeze({ id: 'new', label: 'Novos' }),
  Object.freeze({ id: 'duplicate', label: 'Já no catálogo' }),
  Object.freeze({ id: 'invalid', label: 'Sem evidência' }),
]);

/** A que grupo de revisão um resultado pertence. Cada grupo pede uma decisão diferente. */
export function researchRowState(row) {
  if (row?.status === 'invalid') return 'invalid';
  if (row?.status === 'possible_duplicate') return 'duplicate';
  if (row?.status === 'already_imported') return 'invalid';
  return 'new';
}

export function countResearchStates(rows = []) {
  const counts = { all: rows.length, new: 0, duplicate: 0, invalid: 0 };
  for (const row of rows) counts[researchRowState(row)] += 1;
  return counts;
}

export function filterResearchRows(rows = [], state = 'all') {
  if (state === 'all') return rows;
  return rows.filter((row) => researchRowState(row) === state);
}

/**
 * Decisões que aprovam de uma vez todos os resultados sem ressalva.
 *
 * Só toca nos que estão como "novos": duplicata e resultado sem evidência
 * continuam exigindo uma decisão individual, que é justamente onde a atenção
 * de quem revisa deve ficar.
 */
export function approveAllNew(rows = [], decisions = {}) {
  const next = { ...decisions };
  for (const row of rows) {
    if (researchRowState(row) !== 'new') continue;
    next[researchDecisionKey(row.batchId, row.rowNumber)] = 'use_imported';
  }
  return next;
}

export function countApprovedDecisions(decisions = {}) {
  return Object.values(decisions).filter((decision) => ['use_imported', 'merge'].includes(decision)).length;
}

const COMPARISON_FIELDS = Object.freeze([
  { key: 'pais', label: 'País' },
  { key: 'subtipo', label: 'Subtipo' },
  { key: 'instituicao', label: 'Instituição' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'setor', label: 'Setor' },
]);

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  return String(value ?? '').trim();
}

function describeLength(value) {
  const size = text(value).length;
  return size ? `${size} caracteres` : '';
}

function countUrls(record) {
  const fontes = Array.isArray(record?.fontes) ? record.fontes : [];
  const extra = [record?.website, record?.website_oficial, record?.linkedin_url, record?.scholar, record?.perfil_principal_url];
  const all = [...fontes, ...extra].map(text).filter((value) => /^https?:\/\//i.test(value));
  return new Set(all).size;
}

/**
 * O que muda entre o registro que já existe e o que a pesquisa encontrou.
 *
 * "Mesclar" era uma decisão às cegas: o card não mostrava o que o registro
 * atual tem e o encontrado não tem, então o caminho seguro era sempre manter o
 * atual — e a pesquisa deixava de melhorar o catálogo.
 */
export function compareCatalogRecords(existing, incoming) {
  if (!existing || !incoming) return [];
  const rows = COMPARISON_FIELDS
    .map((field) => ({
      label: field.label,
      existing: text(existing[field.key]),
      incoming: text(incoming[field.key]),
    }))
    .filter((row) => row.existing || row.incoming);

  const existingAreas = text(existing.areas || existing.areas_temas || existing.areas_especialidade);
  const incomingAreas = text(incoming.areas || incoming.areas_temas || incoming.areas_especialidade);
  if (existingAreas || incomingAreas) {
    rows.push({
      label: 'Áreas',
      existing: existingAreas ? `${existingAreas.split(';').filter(Boolean).length}` : '0',
      incoming: incomingAreas ? `${incomingAreas.split(';').filter(Boolean).length}` : '0',
    });
  }

  rows.push({
    label: 'Descrição',
    existing: describeLength(existing.descricao || existing.pesquisa || existing.miniBio) || 'nenhuma',
    incoming: describeLength(incoming.descricao || incoming.resumo || incoming.pesquisa || incoming.miniBio) || 'nenhuma',
  });

  rows.push({
    label: 'Links públicos',
    existing: String(countUrls(existing)),
    incoming: String(countUrls(incoming)),
  });

  return rows.map((row) => ({ ...row, differs: row.existing !== row.incoming }));
}
