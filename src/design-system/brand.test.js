import { describe, expect, it } from 'vitest';
import { BLUE, RED, NEUTRAL, FEEDBACK } from './brand';
import { DESIGN_TOKENS } from './tokens';

/**
 * A paleta é reconstruída, não transcrita do manual (ver o cabeçalho de
 * `brand.js`). Estes testes existem para que a substituição pelos valores
 * oficiais seja segura: quem trocar um hex descobre na hora se quebrou a
 * legibilidade em vez de descobrir num relatório de acessibilidade meses depois.
 */

function channel(component) {
  const value = component / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const parsed = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!parsed) throw new Error(`cor fora do formato hexadecimal de 6 dígitos: ${hex}`);
  const int = Number.parseInt(parsed[1], 16);
  return 0.2126 * channel((int >> 16) & 255) + 0.7152 * channel((int >> 8) & 255) + 0.0722 * channel(int & 255);
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE = '#FFFFFF';

describe('paleta da marca', () => {
  it('declara toda cor como hexadecimal de 6 dígitos', () => {
    const every = [...Object.values(BLUE), ...Object.values(RED), ...Object.values(NEUTRAL), ...Object.values(FEEDBACK)];
    every.forEach((value) => expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/));
  });

  it.each([
    ['azul', BLUE],
    ['vermelho', RED],
    ['neutro', NEUTRAL],
  ])('mantém a escala de %s monotônica do escuro para o claro', (_name, scale) => {
    // Uma escala que sobe e desce quebra qualquer regra do tipo "use dois
    // degraus acima para o hover": o degrau deixa de significar uma direção.
    const steps = Object.keys(scale)
      .map(Number)
      .sort((a, b) => b - a)
      .map((step) => luminance(scale[step]));
    steps.forEach((value, index) => {
      if (index === 0) return;
      expect(value).toBeGreaterThan(steps[index - 1]);
    });
  });
});

describe('contraste do texto', () => {
  it('lê o texto principal e o secundário sobre as superfícies claras', () => {
    const { ink, surface } = DESIGN_TOKENS;
    [surface.canvas, surface.raised, surface.sunken].forEach((background) => {
      expect(contrast(ink.strong, background)).toBeGreaterThanOrEqual(7);
      expect(contrast(ink.base, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink.muted, background)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('lê o texto sobre as superfícies escuras do cabeçalho e do rodapé', () => {
    const { ink, surface } = DESIGN_TOKENS;
    [surface.inverted, surface.invertedSoft].forEach((background) => {
      expect(contrast(ink.onInverted, background)).toBeGreaterThanOrEqual(7);
      // O texto de apoio no cabeçalho é pequeno; 4.5 é o mínimo, não o alvo.
      expect(contrast(ink.onInvertedMuted, background)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('lê rótulo branco em cima de cada acento de ferramenta', () => {
    // É a garantia que permite `contrastText: '#fff'` em botão, chip preenchido
    // e faixa de cabeçalho sem conferir caso a caso.
    Object.entries(DESIGN_TOKENS.tools).forEach(([name, tool]) => {
      expect(contrast(WHITE, tool.main), name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(WHITE, tool.dark), name).toBeGreaterThanOrEqual(7);
      // E o par escuro/claro do mesmo acento, usado em chip e ícone suaves.
      expect(contrast(tool.dark, tool.soft), name).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('lê cada cor de feedback sobre a sua própria superfície suave', () => {
    const pairs = [
      [FEEDBACK.success, FEEDBACK.successSoft],
      [FEEDBACK.warning, FEEDBACK.warningSoft],
      [FEEDBACK.danger, FEEDBACK.dangerSoft],
      [FEEDBACK.info, FEEDBACK.infoSoft],
    ];
    pairs.forEach(([foreground, background]) => {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(WHITE, foreground)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('distingue o vermelho da marca do vermelho de erro', () => {
    // Os dois aparecem na mesma tela: o acento do Radar e um alerta de falha.
    // Se fossem o mesmo tom, a cor deixaria de carregar informação.
    expect(contrast(RED[600], FEEDBACK.danger)).toBeGreaterThan(1.25);
  });
});

describe('tokens semânticos', () => {
  it('não deixa nenhum papel sem cor', () => {
    const { surface, ink, border, tools } = DESIGN_TOKENS;
    [surface, ink, border].forEach((group) => {
      Object.entries(group).forEach(([role, value]) => {
        expect(value, role).toBeTruthy();
      });
    });
    ['selection', 'catalog', 'radar', 'prompt'].forEach((id) => {
      expect(tools[id]).toMatchObject({ main: expect.any(String), soft: expect.any(String), dark: expect.any(String) });
    });
  });

  it('mantém os apelidos antigos apontando para a escala nova', () => {
    // `DESIGN_TOKENS.brand.*` sobreviveu à reforma para não quebrar quem já
    // lia esses nomes; o que ele não pode é virar uma segunda paleta.
    expect(DESIGN_TOKENS.brand.navy).toBe(BLUE[900]);
    expect(DESIGN_TOKENS.brand.cobalt).toBe(BLUE[700]);
    expect(DESIGN_TOKENS.brand.red).toBe(RED[600]);
    expect(DESIGN_TOKENS.brand.canvas).toBe(NEUTRAL[50]);
  });
});
