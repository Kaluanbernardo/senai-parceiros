export const CATALOG_SCHEMA_VERSION = 'senai_catalog_v2';
export const LEGACY_CATALOG_SCHEMA_VERSION = 'senai_catalog_v1';
export const CATALOG_SHEET_NAME = 'Stakeholders';
export const CATALOG_METADATA_SHEET_NAME = 'Metadados';

const COMMON_COLUMNS = [
  { name: 'schema_version', type: 'texto', required: true, description: 'Valor fixo: senai_catalog_v2.' },
  { name: 'tipo_registro', type: 'texto', required: true, description: 'person, school ou organization.' },
  { name: 'nome', type: 'texto', required: true, description: 'Nome oficial ou nome completo.' },
  { name: 'pais', type: 'texto', required: true, description: 'País de atuação principal.' },
  { name: 'cidade_estado', type: 'texto', required: false, description: 'Cidade e estado/província, quando públicos.' },
  { name: 'resumo', type: 'texto', required: false, essential: true, description: 'Resumo curto baseado em fatos públicos.' },
  { name: 'descricao', type: 'texto', required: false, description: 'Descrição detalhada e pública.' },
  { name: 'areas_temas', type: 'lista', required: false, essential: true, description: 'Temas separados por ponto e vírgula.' },
  { name: 'aderencia_contexto', type: 'texto', required: false, description: 'Aderência ao contexto pesquisado.' },
  { name: 'relacao_publica', type: 'texto', required: false, description: 'Relação pública com SENAI-SP, indústria ou ecossistema relevante.' },
  { name: 'evidencias_publicas', type: 'lista', required: false, description: 'Fatos/evidências e URLs resumidos, separados por ponto e vírgula.' },
  { name: 'riscos_sinais', type: 'lista', required: false, description: 'Riscos ou sinais públicos que exigem validação, separados por ponto e vírgula.' },
  { name: 'website_oficial', type: 'url', required: false, essential: true, description: 'URL institucional.' },
  { name: 'contato_publico', type: 'texto', required: false, description: 'Contato profissional publicado.' },
  { name: 'fontes', type: 'lista', required: false, essential: true, description: 'URLs separadas por ponto e vírgula.' },
  { name: 'data_consulta', type: 'data', required: false, description: 'Data no formato AAAA-MM-DD.' },
  { name: 'confianca', type: 'numero_0_100', required: false, description: 'Confiança da coleta entre 0 e 100.' },
  { name: 'dados_nao_localizados', type: 'lista', required: false, description: 'Campos não localizados, separados por ponto e vírgula.' },
];

const CATEGORY_COLUMNS = {
  person: [
    { name: 'perfis_atuacao', type: 'lista', essential: true, description: 'Atuações profissionais, como pesquisa, indústria, educação, imprensa ou gestão pública.' },
    { name: 'instituicao_atual', type: 'texto', essential: true, description: 'Instituição e vínculo atual.' },
    { name: 'cargo', type: 'texto', description: 'Cargo ou função pública atual.' },
    { name: 'areas_especialidade', type: 'lista', essential: true, description: 'Áreas de especialidade.' },
    { name: 'perfil_principal_url', type: 'url', essential: true, description: 'Melhor perfil profissional público localizado.' },
    { name: 'linkedin_url', type: 'url', description: 'Perfil público no LinkedIn, quando localizado.' },
    { name: 'producoes_relevantes', type: 'lista', description: 'Título | URL | ano | tipo; ...' },
    { name: 'credenciais_relevantes', type: 'lista', description: 'Credenciais profissionais públicas relevantes.' },
    { name: 'linhas_pesquisa', type: 'texto', description: 'Linhas de pesquisa relacionadas.' },
    { name: 'publicacoes_relevantes', type: 'lista', description: 'Título | URL | ano; ...' },
    { name: 'citacoes', type: 'numero', description: 'Citações públicas, quando localizadas.' },
    { name: 'h_index', type: 'numero', essential: true, description: 'h-index público e verificável, quando localizado.' },
    { name: 'orcid', type: 'texto', description: 'ORCID público.' },
    { name: 'google_scholar_url', type: 'url', description: 'Perfil público no Google Scholar.' },
    { name: 'openalex_id', type: 'texto', description: 'Identificador OpenAlex.' },
  ],
  school: [
    { name: 'tipo_instituicao', type: 'texto', essential: true, description: 'Tipo e natureza da instituição.' },
    { name: 'nivel_rede', type: 'texto', description: 'national, regional ou local.' },
    { name: 'areas_formacao', type: 'lista', essential: true, description: 'Áreas de formação.' },
    { name: 'niveis_oferta', type: 'lista', description: 'Níveis e modalidades de EPT.' },
    { name: 'relacao_industria', type: 'texto', description: 'Evidências da relação com indústria e trabalho.' },
    { name: 'escala', type: 'texto', description: 'Alcance, unidades ou público atendido.' },
    { name: 'acreditacoes', type: 'lista', description: 'Acreditações e reconhecimentos.' },
    { name: 'dominio_oficial', type: 'texto', description: 'Domínio institucional normalizado.' },
    { name: 'identificador_publico', type: 'texto', description: 'Identificador público, quando existir.' },
  ],
  organization: [
    { name: 'natureza_juridica', type: 'texto', description: 'Pública, privada, terceiro setor ou outra.' },
    { name: 'setor', type: 'texto', essential: true, description: 'Setor de atividade.' },
    { name: 'atuacao', type: 'texto', essential: true, description: 'Atuação e alcance.' },
    { name: 'programas_relevantes', type: 'lista', description: 'Programas relacionados ao contexto.' },
    { name: 'parcerias_industriais', type: 'lista', description: 'Parcerias e relação com a indústria.' },
    { name: 'alcance_geografico', type: 'texto', description: 'Alcance territorial.' },
    { name: 'dominio_oficial', type: 'texto', description: 'Domínio institucional normalizado.' },
    { name: 'identificador_publico', type: 'texto', description: 'Identificador público, quando existir.' },
  ],
};

export const CATALOG_COLUMNS = Object.freeze(Object.fromEntries(
  Object.entries(CATEGORY_COLUMNS).map(([category, specific]) => [category, Object.freeze([...COMMON_COLUMNS, ...specific])]),
));

export const CATALOG_CATEGORIES = Object.freeze(Object.keys(CATALOG_COLUMNS));

export function normalizeCatalogCategory(category) {
  return category === 'researcher' ? 'person' : category;
}

export function getCatalogColumns(category) {
  return CATALOG_COLUMNS[normalizeCatalogCategory(category)] || CATALOG_COLUMNS.organization;
}

export function getCatalogHeaders(category) {
  return getCatalogColumns(category).map((column) => column.name);
}

export function parseListCell(value) {
  return String(value || '').split(';').map((item) => item.trim()).filter(Boolean);
}

export function serializeList(value) {
  return Array.isArray(value) ? value.filter(Boolean).join('; ') : String(value || '');
}

export function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value.text) return String(value.text);
  return String(value).trim();
}

/** Colunas sem as quais a linha não vira registro. */
export function getRequiredHeaders(category) {
  return getCatalogColumns(category).filter((column) => column.required).map((column) => column.name);
}

/** Recorte sugerido: o suficiente para um registro útil e conferível. */
export function getEssentialHeaders(category) {
  return getCatalogColumns(category).filter((column) => column.required || column.essential).map((column) => column.name);
}

/**
 * Resolve o recorte de colunas pedido para uma lista de colunas de verdade.
 *
 * As obrigatórias entram sempre, mesmo que não tenham sido escolhidas: sem elas
 * o arquivo não importa, e é melhor acrescentá-las em silêncio do que deixar o
 * usuário gerar uma pesquisa inteira que será recusada no fim. Nomes
 * desconhecidos são descartados, e a ordem canônica é preservada para que o
 * cabeçalho gerado seja sempre o mesmo para o mesmo recorte.
 */
export function resolveCatalogColumns(category, selected) {
  const columns = getCatalogColumns(category);
  if (!Array.isArray(selected) || !selected.length) return [...columns];
  const wanted = new Set(selected);
  return columns.filter((column) => column.required || wanted.has(column.name));
}

/**
 * Valida o cabeçalho aceitando um subconjunto das colunas da categoria.
 *
 * Antes exigia o conjunto completo na ordem exata, o que obrigava a IA a
 * devolver 26 colunas mesmo quando a busca precisava de seis — e fazia o
 * gerador de prompt pedir tudo, já que qualquer recorte produzia um arquivo
 * rejeitado na importação.
 *
 * O que continua obrigatório: estarem presentes as colunas sem as quais não há
 * registro, não haver coluna desconhecida (que indicaria arquivo de outra
 * categoria ou invenção do modelo) e não haver coluna repetida (que tornaria
 * ambígua a leitura da linha). A ordem é livre porque a linha é lida pelo nome
 * da coluna, não pela posição.
 */
export function validateCatalogHeaders(headers, category) {
  const expected = getCatalogHeaders(category);
  const actual = headers.map((header) => String(header || '').trim()).filter(Boolean);
  const known = new Set(expected);
  const errors = [];

  const missing = getRequiredHeaders(category).filter((header) => !actual.includes(header));
  if (missing.length) errors.push(`Faltam colunas obrigatórias: ${missing.join(', ')}.`);

  const unknown = actual.filter((header) => !known.has(header));
  if (unknown.length) errors.push(`Colunas desconhecidas para ${category}: ${unknown.join(', ')}.`);

  const duplicated = actual.filter((header, index) => actual.indexOf(header) !== index);
  if (duplicated.length) errors.push(`Colunas repetidas: ${[...new Set(duplicated)].join(', ')}.`);

  return { valid: errors.length === 0, errors, expected, actual, missing, unknown, present: actual.filter((header) => known.has(header)) };
}

export function validateCatalogRow(row, category, rowNumber = 2) {
  const normalizedCategory = normalizeCatalogCategory(category);
  const columns = getCatalogColumns(normalizedCategory);
  const errors = [];
  const legacyPerson = row.schema_version === LEGACY_CATALOG_SCHEMA_VERSION && row.tipo_registro === 'researcher';
  if (row.schema_version !== CATALOG_SCHEMA_VERSION && !legacyPerson) errors.push(`Linha ${rowNumber}: schema_version deve ser ${CATALOG_SCHEMA_VERSION}.`);
  if (normalizeCatalogCategory(row.tipo_registro) !== normalizedCategory) errors.push(`Linha ${rowNumber}: tipo_registro deve ser ${normalizedCategory}.`);
  for (const column of columns.filter((column) => column.required)) {
    if (!String(row[column.name] || '').trim()) errors.push(`Linha ${rowNumber}: ${column.name} é obrigatório.`);
  }
  for (const field of ['website_oficial', 'perfil_principal_url', 'linkedin_url', 'google_scholar_url']) {
    if (!row[field] || isUnavailableValue(row[field])) continue;
    try {
      const url = new URL(row[field]);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      errors.push(`Linha ${rowNumber}: ${field} deve ser uma URL http(s).`);
    }
  }
  if (row.data_consulta && !/^\d{4}-\d{2}-\d{2}$/.test(row.data_consulta)) errors.push(`Linha ${rowNumber}: data_consulta deve usar AAAA-MM-DD.`);
  // Coluna ausente não é valor inválido: com subconjunto de colunas, `confianca`
  // pode simplesmente não ter sido pedida. Antes, `undefined !== ''` entrava na
  // checagem e Number(undefined) reprovava a linha.
  const confianca = row.confianca;
  if (confianca !== '' && confianca !== undefined && confianca !== null
      && (Number.isNaN(Number(confianca)) || Number(confianca) < 0 || Number(confianca) > 100)) {
    errors.push(`Linha ${rowNumber}: confianca deve estar entre 0 e 100.`);
  }
  return { valid: errors.length === 0, errors };
}

function isUnavailableValue(value) {
  return ['não localizado', 'nao localizado', 'não informado', 'nao informado', 'n/a', '—', '-'].includes(String(value).trim().toLowerCase());
}

export function rowToCanonical(row) {
  const category = normalizeCatalogCategory(row.tipo_registro);
  const list = parseListCell;
  const base = {
    nome: row.nome,
    pais: row.pais,
    website: isUnavailableValue(row.website_oficial) ? '' : row.website_oficial,
    website_oficial: isUnavailableValue(row.website_oficial) ? '' : row.website_oficial,
    cidade_estado: row.cidade_estado,
    descricao: row.descricao || row.resumo,
    diferencial: row.resumo,
    areas: list(row.areas_temas),
    fontes: list(row.fontes),
    data_consulta: row.data_consulta,
    confianca: row.confianca === '' ? null : Number(row.confianca),
    dados_nao_localizados: list(row.dados_nao_localizados),
    aderencia_contexto: row.aderencia_contexto,
    relacao: row.relacao_publica,
    relacao_publica: row.relacao_publica,
    evidencias_publicas: list(row.evidencias_publicas),
    risco: list(row.riscos_sinais).join('; '),
    riscos_sinais: list(row.riscos_sinais),
    relevancia: row.aderencia_contexto || row.resumo,
    contato_publico: row.contato_publico,
    categoria: category === 'person' ? 'Pessoa' : category === 'school' ? 'Escola' : 'Organização',
    importSchemaVersion: CATALOG_SCHEMA_VERSION,
  };
  if (category === 'person') return {
    ...base,
    areas: [...new Set([...base.areas, ...list(row.areas_especialidade)])],
    perfis_atuacao: list(row.perfis_atuacao || (row.tipo_registro === 'researcher' ? 'pesquisa' : '')),
    instituicao: row.instituicao_atual,
    cargo: row.cargo,
    perfil_principal_url: isUnavailableValue(row.perfil_principal_url) ? '' : row.perfil_principal_url,
    linkedin_url: isUnavailableValue(row.linkedin_url) ? '' : row.linkedin_url,
    producoes_relevantes: list(row.producoes_relevantes).map((value) => {
      const [titulo, url, ano, tipo] = value.split('|').map((part) => part.trim());
      return { titulo, url, ano, tipo };
    }).filter((item) => item.titulo || item.url),
    credenciais_relevantes: list(row.credenciais_relevantes),
    pesquisa: row.linhas_pesquisa,
    miniBio: row.descricao || row.resumo,
    citacoes: row.citacoes,
    h_index: row.h_index,
    scholar: isUnavailableValue(row.google_scholar_url) ? '' : row.google_scholar_url,
    orcid: row.orcid,
    openalex_id: row.openalex_id,
    artigos: list(row.publicacoes_relevantes).map((value) => {
      const [titulo, url, ano] = value.split('|').map((part) => part.trim());
      return { titulo, url, ano };
    }).filter((article) => article.titulo || article.url),
  };
  if (category === 'school') return {
    ...base,
    instituicao: row.nome,
    areas_formacao: list(row.areas_formacao),
    niveis_oferta: list(row.niveis_oferta),
    tipo_instituicao: row.tipo_instituicao,
    nivel_rede: row.nivel_rede,
    relacao_industria: row.relacao_industria,
    escala: row.escala,
    acreditacoes: list(row.acreditacoes),
    dominio_oficial: row.dominio_oficial,
    identificador_publico: row.identificador_publico,
  };
  return {
    ...base,
    atuacao: row.atuacao,
    natureza_juridica: row.natureza_juridica,
    setor: row.setor,
    programas_relevantes: list(row.programas_relevantes),
    parcerias_industriais: list(row.parcerias_industriais),
    alcance_geografico: row.alcance_geografico,
    dominio_oficial: row.dominio_oficial,
    identificador_publico: row.identificador_publico,
  };
}
