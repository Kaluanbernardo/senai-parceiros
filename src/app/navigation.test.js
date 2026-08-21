import { describe, expect, it } from 'vitest';
import { findTool, getAllRoutes, getBreadcrumbs, getSiblingLinks, isActive } from './navigation';

describe('seção ativa', () => {
  it('acende a home só na home', () => {
    // Todo caminho começa com "/". Comparar por prefixo deixaria a home acesa
    // em todas as telas, que é exatamente o que a barra antiga evitava com um
    // caso especial escrito dentro do JSX.
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/radar', '/')).toBe(false);
    expect(isActive('/catalogo/pessoas-fisicas', '/')).toBe(false);
  });

  it('acende a ferramenta a partir de qualquer caminho dentro dela', () => {
    expect(isActive('/catalogo', '/catalogo', '/catalogo')).toBe(true);
    expect(isActive('/catalogo/pessoas-fisicas', '/catalogo', '/catalogo')).toBe(true);
  });

  it('não acende por prefixo parcial de nome', () => {
    // Sem a barra separadora, "/radar-arquivado" acenderia o Radar.
    expect(isActive('/radar-arquivado', '/radar', '/radar')).toBe(false);
    expect(isActive('/selecionar-tudo', '/selecionar', '/selecionar')).toBe(false);
  });
});

describe('ferramenta de um caminho', () => {
  it('resolve a ferramenta pelo prefixo mais longo', () => {
    expect(findTool('/catalogo/pessoas-juridicas')?.id).toBe('catalog');
    expect(findTool('/radar')?.id).toBe('radar');
    expect(findTool('/pesquisar-parceiros')?.id).toBe('research');
    expect(findTool('/pesquisar-parceiros/externa')?.id).toBe('research');
    expect(findTool('/pesquisar-parceiros/interna')?.id).toBe('research');
  });

  it('devolve nada para a home e para caminhos desconhecidos', () => {
    expect(findTool('/')).toBeNull();
    expect(findTool('/inexistente')).toBeNull();
  });
});

describe('trilha', () => {
  it('mostra só o início quando se está no início', () => {
    expect(getBreadcrumbs('/')).toEqual([{ label: 'Início' }]);
  });

  it('encadeia início › ferramenta em uma página de primeiro nível', () => {
    expect(getBreadcrumbs('/radar')).toEqual([
      { label: 'Início', route: '/' },
      { label: 'Radar' },
    ]);
  });

  it('encadeia início › catálogo › categoria em uma subpágina', () => {
    expect(getBreadcrumbs('/catalogo/pessoas-fisicas')).toEqual([
      { label: 'Início', route: '/' },
      { label: 'Catálogo', route: '/catalogo' },
      { label: 'Pessoas Físicas' },
    ]);
  });

  it('nunca deixa o último item clicável', () => {
    // Um link para a página em que já se está é um clique que não leva a lugar
    // nenhum; a trilha existe para subir, não para ficar.
    ['/radar', '/catalogo', '/catalogo/pessoas-fisicas', '/admin', '/selecionar'].forEach((path) => {
      const trail = getBreadcrumbs(path);
      expect(trail.at(-1).route).toBeUndefined();
      trail.slice(0, -1).forEach((step) => expect(step.route).toBeTruthy());
    });
  });

  it('dá trilha à administração, que não é uma ferramenta pública', () => {
    expect(getBreadcrumbs('/admin')).toEqual([
      { label: 'Início', route: '/' },
      { label: 'Administração' },
    ]);
  });

  it('cai para o início em um caminho que não existe', () => {
    expect(getBreadcrumbs('/nao-existe')).toEqual([{ label: 'Início' }]);
  });
});

describe('irmãos', () => {
  it('lista as categorias do catálogo marcando a atual', () => {
    const siblings = getSiblingLinks('/catalogo/pessoas-juridicas');
    expect(siblings.map((entry) => entry.route)).toEqual([
      '/catalogo/pessoas-fisicas',
      '/catalogo/pessoas-juridicas',
    ]);
    expect(siblings.filter((entry) => entry.active)).toHaveLength(1);
    expect(siblings.find((entry) => entry.active).label).toBe('Pessoas Jurídicas');
  });

  it('não inventa irmãos para ferramentas sem subseções', () => {
    expect(getSiblingLinks('/radar')).toEqual([]);
    expect(getSiblingLinks('/')).toEqual([]);
  });
});

describe('rotas achatadas', () => {
  it('inclui as ferramentas e as subseções sem repetir rota', () => {
    const routes = getAllRoutes();
    expect(new Set(routes.map((entry) => entry.route)).size).toBe(routes.length);
    expect(routes.filter((entry) => entry.isTool)).toHaveLength(4);
    expect(routes.filter((entry) => entry.parentRoute === '/catalogo')).toHaveLength(2);
    routes.forEach((entry) => expect(entry.label).toBeTruthy());
  });
});
