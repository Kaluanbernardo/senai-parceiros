/**
 * Registro único das ferramentas públicas do produto.
 *
 * O registro é deliberadamente livre de JSX para poder ser reutilizado por
 * navegação, Home, telemetria futura e integrações sem acoplar o domínio à UI.
 */
export const TOOL_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'selection',
    route: '/selecionar',
    matchPrefix: '/selecionar',
    label: 'Encontrar parceiros',
    navLabel: 'Encontrar',
    description: 'Responda a perguntas rápidas e receba recomendações para o seu objetivo.',
    actionLabel: 'Começar',
    iconKey: 'selection',
    themeKey: 'selection',
    status: 'ready',
  }),
  Object.freeze({
    id: 'catalog',
    route: '/catalogo',
    matchPrefix: '/catalogo',
    label: 'Explorar o catálogo',
    navLabel: 'Catálogo',
    description: 'Pesquise diretamente por pessoa, instituição, tema ou país.',
    actionLabel: 'Pesquisar',
    iconKey: 'catalog',
    themeKey: 'catalog',
    status: 'ready',
    children: Object.freeze([
      Object.freeze({ route: '/catalogo/especialistas', label: 'Especialistas', iconKey: 'researcher' }),
      Object.freeze({ route: '/catalogo/instituicoes-de-educacao', label: 'Instituições de Educação', iconKey: 'school' }),
      Object.freeze({ route: '/catalogo/outras-organizacoes', label: 'Outras organizações', iconKey: 'organization' }),
    ]),
  }),
  Object.freeze({
    id: 'radar',
    route: '/radar',
    matchPrefix: '/radar',
    label: 'Radar',
    navLabel: 'Radar',
    description: 'Acompanhe pesquisas, decisões públicas e iniciativas internacionais.',
    actionLabel: 'Ver novidades',
    iconKey: 'radar',
    themeKey: 'radar',
    status: 'ready',
  }),
  Object.freeze({
    id: 'prompt',
    route: '/gerador-prompt',
    matchPrefix: '/gerador-prompt',
    label: 'Preparar uma pesquisa',
    navLabel: 'Preparar pesquisa',
    description: 'Organize o que você precisa e crie um pedido pronto para usar em uma IA.',
    actionLabel: 'Montar pedido',
    iconKey: 'prompt',
    themeKey: 'prompt',
    status: 'ready',
  }),
]);

export function getToolById(id) {
  return TOOL_REGISTRY.find((tool) => tool.id === id) || null;
}

export function getNavTools() {
  return TOOL_REGISTRY.filter((tool) => tool.status !== 'hidden');
}

export function getNavItems() {
  return getNavTools().flatMap((tool) => [
    { ...tool, isPrimary: true },
    ...(tool.children || []).map((child) => ({ ...child, parentId: tool.id, isPrimary: false })),
  ]);
}
