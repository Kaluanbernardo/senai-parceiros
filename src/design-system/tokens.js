import { AMBER, BLUE, GREEN, RED, NEUTRAL, FEEDBACK, TYPE } from './brand';

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
  inverted: NEUTRAL[950],
  invertedSoft: NEUTRAL[900],
  accentSoft: NEUTRAL[0],
});

/** Texto. `onInverted` é o par de leitura das superfícies escuras. */
const ink = Object.freeze({
  strong: NEUTRAL[900],
  base: NEUTRAL[800],
  muted: NEUTRAL[600],
  subtle: NEUTRAL[500],
  onInverted: NEUTRAL[0],
  onInvertedMuted: NEUTRAL[300],
  accent: RED[800],
});

const border = Object.freeze({
  subtle: NEUTRAL[200],
  base: NEUTRAL[300],
  strong: NEUTRAL[400],
  accent: RED[700],
  onInverted: 'rgba(255,255,255,.20)',
});

/**
 * Cada ferramenta tem uma cor funcional forte. O vermelho ancora a marca; azul,
 * verde e âmbar distinguem catálogo, radar e geração sem usar fundos pastéis.
 */
const tools = Object.freeze({
  selection: Object.freeze({ main: RED[700], soft: NEUTRAL[0], dark: RED[900], contrast: NEUTRAL[0] }),
  catalog: Object.freeze({ main: BLUE[700], soft: NEUTRAL[0], dark: BLUE[900], contrast: NEUTRAL[0] }),
  radar: Object.freeze({ main: GREEN[700], soft: NEUTRAL[0], dark: GREEN[800], contrast: NEUTRAL[0] }),
  prompt: Object.freeze({ main: AMBER[700], soft: NEUTRAL[0], dark: AMBER[800], contrast: NEUTRAL[0] }),
  research: Object.freeze({ main: BLUE[900], soft: NEUTRAL[0], dark: NEUTRAL[950], contrast: NEUTRAL[0] }),
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
 * Sombras neutras e curtas: só separam superfícies interativas do fundo.
 */
const shadow = Object.freeze({
  none: 'none',
  hairline: '0 1px 2px rgba(17, 18, 20, .06)',
  soft: '0 2px 4px rgba(17, 18, 20, .05), 0 8px 20px rgba(17, 18, 20, .07)',
  raised: '0 4px 8px rgba(17, 18, 20, .06), 0 16px 36px rgba(17, 18, 20, .11)',
  overlay: '0 12px 24px rgba(17, 18, 20, .12), 0 32px 64px rgba(17, 18, 20, .18)',
});

/**
 * Anel de foco único para todo o produto. Dois tons: um claro para superfícies
 * escuras e um escuro para as claras — um anel só nunca é visível nos dois.
 */
const focus = Object.freeze({
  ring: `0 0 0 3px ${RED[200]}, 0 0 0 1px ${RED[800]}`,
  ringInverted: '0 0 0 3px rgba(255,255,255,.55)',
  outline: `2px solid ${RED[800]}`,
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
