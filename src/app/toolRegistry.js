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
    label: 'Selecionar stakeholders',
    navLabel: 'Seleção',
    description: 'Entenda seu contexto e encontre parceiros com critérios explicáveis.',
    iconKey: 'selection',
    themeKey: 'selection',
    status: 'ready',
  }),
  Object.freeze({
    id: 'catalog',
    route: '/catalogo',
    matchPrefix: '/catalogo',
    label: 'Catálogo',
    navLabel: 'Catálogo',
    description: 'Consulte especialistas, instituições de educação e outras organizações já cadastrados.',
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
    label: 'Radar EPT/VET',
    navLabel: 'Radar',
    description: 'Acompanhe pesquisas e novidades oficiais sobre educação profissional.',
    iconKey: 'radar',
    themeKey: 'radar',
    status: 'ready',
  }),
  Object.freeze({
    id: 'prompt',
    route: '/gerador-prompt',
    matchPrefix: '/gerador-prompt',
    label: 'Gerador de prompt',
    navLabel: 'Prompt',
    description: 'Monte pedidos estruturados para pesquisas profundas e comparáveis.',
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
