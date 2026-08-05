import { TOOL_REGISTRY, getNavTools } from './toolRegistry';

/**
 * Modelo de navegação, separado do JSX.
 *
 * A barra antiga sabia responder "qual aba está acesa" e nada mais. Quem
 * entrava direto em `/catalogo/especialistas` — por um link compartilhado, que
 * é o caminho normal — via a aba "Catálogo" acesa e nenhuma indicação de onde
 * estava dentro dela, nem como voltar um nível. Estas funções produzem a
 * trilha e a seção ativa a partir do caminho, e por serem puras podem ser
 * testadas sem montar a árvore React.
 */

export const HOME = Object.freeze({ route: '/', label: 'Início' });

/** Rotas que existem mas não são ferramentas públicas. */
const EXTRA_ROUTES = Object.freeze({
  '/admin': Object.freeze({ label: 'Administração', parent: null }),
});

/** Toda rota navegável, achatada, incluindo as filhas do catálogo. */
export function getAllRoutes() {
  return getNavTools().flatMap((tool) => [
    { route: tool.route, label: tool.label, navLabel: tool.navLabel, toolId: tool.id, isTool: true },
    ...(tool.children || []).map((child) => ({
      route: child.route,
      label: child.label,
      navLabel: child.label,
      toolId: tool.id,
      parentRoute: tool.route,
      isTool: false,
    })),
  ]);
}

/**
 * A ferramenta a que um caminho pertence.
 *
 * Casa pelo prefixo mais longo: `/catalogo/especialistas` pertence ao catálogo,
 * e um futuro `/radar/item/123` continuará pertencendo ao radar sem precisar
 * ser cadastrado.
 */
export function findTool(pathname) {
  if (!pathname || pathname === '/') return null;
  return (
    TOOL_REGISTRY
      .filter((tool) => matchesPrefix(pathname, tool.matchPrefix || tool.route))
      .sort((a, b) => (b.matchPrefix || b.route).length - (a.matchPrefix || a.route).length)[0] || null
  );
}

function matchesPrefix(pathname, prefix) {
  if (pathname === prefix) return true;
  // Sem a barra, `/radar-antigo` casaria com o prefixo `/radar`.
  return pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

/**
 * Se um item da navegação principal deve aparecer aceso.
 *
 * A home é o único caso de igualdade exata: como todo caminho começa com `/`,
 * um prefixo a deixaria acesa em todas as telas.
 */
export function isActive(pathname, route, matchPrefix) {
  if (route === '/') return pathname === '/';
  return matchesPrefix(pathname, matchPrefix || route);
}

/**
 * Trilha do início até a página atual.
 *
 * O último item é a página em que se está — vem sem `route` de propósito, para
 * a interface renderizá-lo como texto e não como link para o lugar onde o
 * usuário já está.
 */
export function getBreadcrumbs(pathname) {
  if (!pathname || pathname === '/') return [{ label: HOME.label }];

  const extra = EXTRA_ROUTES[pathname];
  if (extra) return [{ label: HOME.label, route: HOME.route }, { label: extra.label }];

  const tool = findTool(pathname);
  if (!tool) return [{ label: HOME.label }];

  const trail = [{ label: HOME.label, route: HOME.route }];
  const child = (tool.children || []).find((entry) => entry.route === pathname);

  if (child) {
    trail.push({ label: tool.navLabel || tool.label, route: tool.route });
    trail.push({ label: child.label });
    return trail;
  }

  trail.push({ label: tool.label });
  return trail;
}

/**
 * Itens irmãos da página atual, quando ela vive dentro de uma ferramenta com
 * subseções. É o que permite trocar de categoria do catálogo sem voltar dois
 * níveis — o percurso que a interface antiga obrigava.
 */
export function getSiblingLinks(pathname) {
  const tool = findTool(pathname);
  if (!tool?.children?.length) return [];
  return tool.children.map((child) => ({ ...child, active: child.route === pathname }));
}
