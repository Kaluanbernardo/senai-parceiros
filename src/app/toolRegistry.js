/**
 * Registro único das ferramentas do produto.
 *
 * O registro é deliberadamente livre de JSX para poder ser reutilizado por
 * navegação, Home, telemetria futura e integrações sem acoplar o domínio à UI.
 */
export const TOOL_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'research',
    route: '/pesquisar-parceiros',
    matchPrefix: '/pesquisar-parceiros',
    label: 'Pesquisar novos parceiros',
    navLabel: 'Pesquisar',
    description: 'Escolha entre pesquisar no Farol ou preparar um pedido para usar em outra IA.',
    actionLabel: 'Escolher como pesquisar',
    iconKey: 'research',
    themeKey: 'research',
    status: 'ready',
  }),
  Object.freeze({
    id: 'selection',
    route: '/selecionar',
    matchPrefix: '/selecionar',
    label: 'Seleção de parceiros',
    navLabel: 'Seleção',
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
    description: 'Pesquise pessoas físicas e jurídicas por subtipo, tema ou país.',
    actionLabel: 'Pesquisar',
    iconKey: 'catalog',
    themeKey: 'catalog',
    status: 'ready',
    children: Object.freeze([
      Object.freeze({ route: '/catalogo/pessoas-fisicas', label: 'Pessoas Físicas', iconKey: 'researcher' }),
      Object.freeze({ route: '/catalogo/pessoas-juridicas', label: 'Pessoas Jurídicas', iconKey: 'organization' }),
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
]);

export function getToolById(id) {
  return TOOL_REGISTRY.find((tool) => tool.id === id) || null;
}

export function getNavTools(role) {
  return TOOL_REGISTRY.filter((tool) => tool.status !== 'hidden' && (!role || !tool.roles || tool.roles.includes(role)));
}

export function getNavItems(role) {
  return getNavTools(role).flatMap((tool) => [
    { ...tool, isPrimary: true },
    ...(tool.children || []).map((child) => ({ ...child, parentId: tool.id, isPrimary: false })),
  ]);
}
