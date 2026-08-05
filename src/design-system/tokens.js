import { BLUE, RED, NEUTRAL, FEEDBACK, TYPE } from './brand';

/**
 * Tokens semânticos.
 *
 * A regra é simples: `brand.js` diz *que cores a marca tem*; este arquivo diz
 * *para que elas servem*. Componente nenhum importa `brand.js` — todos leem
 * daqui ou do tema. Assim uma troca de paleta não obriga a caçar `bgcolor` no
 * meio do JSX.
 */

/** Superfícies, do fundo da página ao cartão em destaque. */
const surface = Object.freeze({
  canvas: NEUTRAL[50],
  raised: NEUTRAL[0],
  sunken: NEUTRAL[100],
  inverted: BLUE[900],
  invertedSoft: BLUE[800],
  accentSoft: BLUE[50],
});

/** Texto. `onInverted` é o par de leitura das superfícies escuras. */
const ink = Object.freeze({
  strong: NEUTRAL[900],
  base: NEUTRAL[800],
  muted: NEUTRAL[600],
  subtle: NEUTRAL[500],
  onInverted: NEUTRAL[0],
  onInvertedMuted: BLUE[200],
  accent: BLUE[700],
});

const border = Object.freeze({
  subtle: NEUTRAL[200],
  base: NEUTRAL[300],
  strong: NEUTRAL[400],
  accent: BLUE[600],
  onInverted: 'rgba(255,255,255,.20)',
});

/**
 * Cada ferramenta tem um acento próprio para orientar quem navega entre elas,
 * mas todos saem da paleta institucional. Antes eram roxo, teal e laranja —
 * cores que não existem na identidade do SENAI-SP e faziam o produto parecer
 * quatro produtos.
 */
const tools = Object.freeze({
  selection: Object.freeze({ main: BLUE[700], soft: BLUE[50], dark: BLUE[800], contrast: NEUTRAL[0] }),
  catalog: Object.freeze({ main: BLUE[600], soft: BLUE[50], dark: BLUE[800], contrast: NEUTRAL[0] }),
  radar: Object.freeze({ main: RED[600], soft: RED[50], dark: RED[800], contrast: NEUTRAL[0] }),
  prompt: Object.freeze({ main: NEUTRAL[700], soft: NEUTRAL[100], dark: NEUTRAL[900], contrast: NEUTRAL[0] }),
});

/**
 * Escala tipográfica fluida.
 *
 * `clamp()` no lugar de `fontSize: { xs, md }` espalhado pelas páginas: o texto
 * cresce continuamente com a viewport em vez de saltar num breakpoint, e a
 * escala fica descrita uma vez só.
 */
const fontSize = Object.freeze({
  display: 'clamp(2.1rem, 1.35rem + 2.6vw, 3.25rem)',
  h1: 'clamp(1.85rem, 1.3rem + 1.9vw, 2.6rem)',
  h2: 'clamp(1.5rem, 1.2rem + 1.05vw, 2rem)',
  h3: 'clamp(1.25rem, 1.1rem + 0.55vw, 1.55rem)',
  h4: 'clamp(1.1rem, 1.03rem + 0.3vw, 1.28rem)',
  h5: '1.05rem',
  h6: '0.95rem',
  body: '0.975rem',
  small: '0.86rem',
  caption: '0.78rem',
  overline: '0.72rem',
});

/**
 * Espaçamento em passos de 4px. Exposto como escala nomeada para as decisões de
 * densidade ficarem legíveis: `space.section` diz mais do que `mt: 6`.
 */
const space = Object.freeze({
  hair: 4,
  tight: 8,
  snug: 12,
  base: 16,
  cozy: 24,
  loose: 32,
  section: 48,
  page: 72,
});

const radius = Object.freeze({ xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 });

/**
 * Sombras tingidas de azul. Preto puro sobre um fundo azulado produz um cinza
 * sujo; a sombra tingida some no fundo em vez de manchá-lo.
 */
const shadow = Object.freeze({
  none: 'none',
  hairline: '0 1px 2px rgba(8, 50, 79, .06)',
  soft: '0 2px 4px rgba(8, 50, 79, .04), 0 8px 20px rgba(8, 50, 79, .06)',
  raised: '0 4px 8px rgba(8, 50, 79, .06), 0 16px 36px rgba(8, 50, 79, .10)',
  overlay: '0 12px 24px rgba(8, 50, 79, .10), 0 32px 64px rgba(8, 50, 79, .16)',
});

/**
 * Anel de foco único para todo o produto. Dois tons: um claro para superfícies
 * escuras e um escuro para as claras — um anel só nunca é visível nos dois.
 */
const focus = Object.freeze({
  ring: `0 0 0 3px ${BLUE[200]}, 0 0 0 1px ${BLUE[700]}`,
  ringInverted: '0 0 0 3px rgba(255,255,255,.55)',
  outline: `2px solid ${BLUE[700]}`,
  offset: 2,
});

/** Larguras máximas de conteúdo, por tipo de página. */
const layout = Object.freeze({
  prose: 720,
  form: 880,
  page: 1200,
  wide: 1400,
  headerHeight: 64,
});

const motion = Object.freeze({
  fast: '120ms cubic-bezier(.4,0,.2,1)',
  base: '200ms cubic-bezier(.4,0,.2,1)',
  slow: '320ms cubic-bezier(.4,0,.2,1)',
});

export const DESIGN_TOKENS = Object.freeze({
  surface,
  ink,
  border,
  tools,
  feedback: FEEDBACK,
  fontSize,
  fontFamily: TYPE,
  space,
  radius,
  shadow,
  focus,
  layout,
  motion,
  /**
   * Mantido para o código que já lia `DESIGN_TOKENS.brand.navy`. As chaves
   * apontam para a escala nova, então não há dois azuis concorrentes.
   */
  brand: Object.freeze({
    navy: BLUE[900],
    cobalt: BLUE[700],
    red: RED[600],
    canvas: NEUTRAL[50],
  }),
});

export const TOOL_THEME = tools;
