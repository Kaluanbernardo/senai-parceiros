/**
 * Maps granular researcher area strings to the 9 broad categories.
 * Each entry: { pattern, categories[] }
 * pattern is matched via String.includes() (case-insensitive).
 *
 * A researcher may belong to multiple categories if their areas span several groups.
 */

export const CATEGORIAS = [
  'Política e Governança',
  'Pedagogia e Currículo',
  'Formação Docente',
  'Trabalho e Economia',
  'Digitalização e Inovação',
  'Sustentabilidade',
  'Transições e Empregabilidade',
  'VET Comparado e Internacional',
  'Inclusão e Equidade',
];

// area substring → one or more category labels
const AREA_MAP = [
  // ── Política e Governança ──────────────────────────────────────
  { pattern: 'política',          cats: ['Política e Governança'] },
  { pattern: 'políticas',         cats: ['Política e Governança'] },
  { pattern: 'governança',        cats: ['Política e Governança'] },
  { pattern: 'gestão do sistema', cats: ['Política e Governança'] },
  { pattern: 'qualificações',     cats: ['Política e Governança'] },
  { pattern: 'qualidade vet',     cats: ['Política e Governança'] },
  { pattern: 'qualificação',      cats: ['Política e Governança'] },
  { pattern: 'nqf',               cats: ['Política e Governança'] },
  { pattern: 'qnq',               cats: ['Política e Governança'] },
  { pattern: 'regimes de',        cats: ['Política e Governança'] },
  { pattern: 'avaliação de impacto', cats: ['Política e Governança'] },
  { pattern: 'avaliação perkins', cats: ['Política e Governança'] },
  { pattern: 'liderança',         cats: ['Política e Governança'] },
  { pattern: 'harmonização',      cats: ['Política e Governança', 'VET Comparado e Internacional'] },
  { pattern: 'kof index',         cats: ['Política e Governança'] },
  { pattern: 'tracking educacional', cats: ['Política e Governança'] },
  { pattern: 'pesquisa empírica', cats: ['Política e Governança'] },
  { pattern: 'competência organizacional', cats: ['Política e Governança'] },
  { pattern: 'cte (career',       cats: ['Política e Governança', 'Transições e Empregabilidade'] },
  { pattern: 'políticas públicas', cats: ['Política e Governança'] },
  { pattern: 'reformas',          cats: ['Política e Governança'] },

  // ── Pedagogia e Currículo ──────────────────────────────────────
  { pattern: 'pedagogia',         cats: ['Pedagogia e Currículo'] },
  { pattern: 'currículo',         cats: ['Pedagogia e Currículo'] },
  { pattern: 'curriculo',         cats: ['Pedagogia e Currículo'] },
  { pattern: 'aprendizagem',      cats: ['Pedagogia e Currículo'] },
  { pattern: 'design instrução',  cats: ['Pedagogia e Currículo'] },
  { pattern: 'realismo social',   cats: ['Pedagogia e Currículo'] },
  { pattern: 'auto-direcionado',  cats: ['Pedagogia e Currículo'] },
  { pattern: 'processos de aprendizagem', cats: ['Pedagogia e Currículo'] },
  { pattern: 'simulações',        cats: ['Pedagogia e Currículo'] },
  { pattern: 'competências transversais', cats: ['Pedagogia e Currículo'] },
  { pattern: 'diagnóstico de competência', cats: ['Pedagogia e Currículo'] },
  { pattern: 'psicologia vet',    cats: ['Pedagogia e Currículo'] },
  { pattern: 'criatividade',      cats: ['Pedagogia e Currículo'] },
  { pattern: 'cognição',          cats: ['Pedagogia e Currículo'] },
  { pattern: 'competência profissional', cats: ['Pedagogia e Currículo', 'Transições e Empregabilidade'] },
  { pattern: 'workplace learning', cats: ['Pedagogia e Currículo'] },

  // ── Formação Docente ───────────────────────────────────────────
  { pattern: 'professores',       cats: ['Formação Docente'] },
  { pattern: 'professor',         cats: ['Formação Docente'] },
  { pattern: 'formação de inst',  cats: ['Formação Docente'] },
  { pattern: 'identidade docente', cats: ['Formação Docente'] },
  { pattern: 'desenvolvimento docente', cats: ['Formação Docente'] },
  { pattern: 'desenvolvimento profissional de professores', cats: ['Formação Docente'] },
  { pattern: 'hrm em vet',        cats: ['Formação Docente'] },
  { pattern: 'tvet internacional, docência', cats: ['Formação Docente', 'VET Comparado e Internacional'] },

  // ── Trabalho e Economia ────────────────────────────────────────
  { pattern: 'economia vet',      cats: ['Trabalho e Economia'] },
  { pattern: 'economia política', cats: ['Trabalho e Economia'] },
  { pattern: 'economia da aprendizagem', cats: ['Trabalho e Economia'] },
  { pattern: 'economia do trabalho', cats: ['Trabalho e Economia'] },
  { pattern: 'trabalho e educação', cats: ['Trabalho e Economia'] },
  { pattern: 'mercados de trabalho', cats: ['Trabalho e Economia'] },
  { pattern: 'demanda de skills', cats: ['Trabalho e Economia'] },
  { pattern: 'roi em vet',        cats: ['Trabalho e Economia'] },
  { pattern: 'high skills',       cats: ['Trabalho e Economia', 'VET Comparado e Internacional'] },
  { pattern: 'processos de trabalho', cats: ['Trabalho e Economia', 'Digitalização e Inovação'] },
  { pattern: 'politecnia',        cats: ['Trabalho e Economia'] },

  // ── Digitalização e Inovação ───────────────────────────────────
  { pattern: 'indústria 4.0',     cats: ['Digitalização e Inovação'] },
  { pattern: 'ind. 4.0',          cats: ['Digitalização e Inovação'] },
  { pattern: 'digitalização',     cats: ['Digitalização e Inovação'] },
  { pattern: 'digital',           cats: ['Digitalização e Inovação'] },
  { pattern: 'tecnologia em vet', cats: ['Digitalização e Inovação'] },
  { pattern: 'inovação vet',      cats: ['Digitalização e Inovação'] },
  { pattern: 'inovação, criatividade', cats: ['Digitalização e Inovação'] },
  { pattern: 'e-learning',        cats: ['Digitalização e Inovação', 'Transições e Empregabilidade'] },

  // ── Sustentabilidade ───────────────────────────────────────────
  { pattern: 'tvet verde',        cats: ['Sustentabilidade'] },
  { pattern: 'competências verdes', cats: ['Sustentabilidade'] },
  { pattern: 'green skills',      cats: ['Sustentabilidade'] },
  { pattern: 'verde',             cats: ['Sustentabilidade'] },
  { pattern: 'tvet ásia, green',  cats: ['Sustentabilidade', 'VET Comparado e Internacional'] },

  // ── Transições e Empregabilidade ──────────────────────────────
  { pattern: 'transição',         cats: ['Transições e Empregabilidade'] },
  { pattern: 'transições',        cats: ['Transições e Empregabilidade'] },
  { pattern: 'empregabilidade',   cats: ['Transições e Empregabilidade'] },
  { pattern: 'juventude',         cats: ['Transições e Empregabilidade'] },
  { pattern: 'career shocks',     cats: ['Transições e Empregabilidade'] },
  { pattern: 'orientação carreira', cats: ['Transições e Empregabilidade'] },
  { pattern: 'lifelong learning', cats: ['Transições e Empregabilidade'] },
  { pattern: 'aprendizagem ao longo', cats: ['Transições e Empregabilidade'] },
  { pattern: 'aprendizagem dual', cats: ['Transições e Empregabilidade', 'Pedagogia e Currículo'] },
  { pattern: 'apprenticeships',   cats: ['Transições e Empregabilidade', 'Pedagogia e Currículo'] },

  // ── VET Comparado e Internacional ─────────────────────────────
  { pattern: 'comparad',          cats: ['VET Comparado e Internacional'] },
  { pattern: 'comparação vet',    cats: ['VET Comparado e Internacional'] },
  { pattern: 'comparativa',       cats: ['VET Comparado e Internacional'] },
  { pattern: 'transferência',     cats: ['VET Comparado e Internacional'] },
  { pattern: 'internacionaliz',   cats: ['VET Comparado e Internacional'] },
  { pattern: 'sistemas pós-soviéticos', cats: ['VET Comparado e Internacional'] },
  { pattern: 'história vet',      cats: ['VET Comparado e Internacional'] },
  { pattern: 'história do vet',   cats: ['VET Comparado e Internacional'] },
  { pattern: 'história educação', cats: ['VET Comparado e Internacional'] },
  { pattern: 'normas globais',    cats: ['VET Comparado e Internacional'] },
  { pattern: 'desenvolvimento vet', cats: ['VET Comparado e Internacional'] },
  { pattern: 'vet e desenvolvimento', cats: ['VET Comparado e Internacional'] },
  { pattern: 'tvet em desenvolvimento', cats: ['VET Comparado e Internacional', 'Inclusão e Equidade'] },
  { pattern: 'filosofia da educação', cats: ['VET Comparado e Internacional', 'Pedagogia e Currículo'] },
  { pattern: 'sistemas educacionais', cats: ['VET Comparado e Internacional', 'Inclusão e Equidade'] },
  { pattern: 'inovação vet global', cats: ['VET Comparado e Internacional', 'Digitalização e Inovação'] },
  { pattern: 'tvet ásia',         cats: ['VET Comparado e Internacional'] },
  { pattern: 'estratégia global', cats: ['VET Comparado e Internacional', 'Digitalização e Inovação'] },

  // ── Inclusão e Equidade ────────────────────────────────────────
  { pattern: 'inclusão',          cats: ['Inclusão e Equidade'] },
  { pattern: 'equidade',          cats: ['Inclusão e Equidade'] },
  { pattern: 'equidade',          cats: ['Inclusão e Equidade'] },
  { pattern: 'teoria crítica',    cats: ['Inclusão e Equidade'] },
  { pattern: 'permeabilidade',    cats: ['Inclusão e Equidade'] },
  { pattern: 'igualdade',         cats: ['Inclusão e Equidade'] },
  { pattern: 'sociologia da educação', cats: ['Inclusão e Equidade'] },
];

/**
 * Derives the set of broad categories for a researcher's areas string.
 * @param {string} areasStr  — semicolon-separated raw areas (item.areas)
 * @returns {string[]}       — unique, sorted category labels
 */
export function getCategoriasFromAreas(areasStr) {
  if (!areasStr) return [];
  const areasLower = areasStr.toLowerCase();
  const found = new Set();
  for (const { pattern, cats } of AREA_MAP) {
    if (areasLower.includes(pattern.toLowerCase())) {
      cats.forEach((c) => found.add(c));
    }
  }
  // preserve canonical order
  return CATEGORIAS.filter((c) => found.has(c));
}
