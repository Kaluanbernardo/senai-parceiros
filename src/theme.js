import { createTheme } from '@mui/material/styles';
import { DESIGN_TOKENS as T } from './design-system/tokens';

/**
 * Tema MUI derivado inteiramente dos tokens.
 *
 * Os overrides abaixo existem para que as páginas não precisem repetir decisão
 * de aparência em `sx`. Antes, cada página escolhia sua própria sombra, seu
 * próprio raio e sua própria altura de campo, e o produto tinha três aparências
 * conforme a tela — a lista de catálogo usava `elevation`, a Home usava cartão
 * com borda, e o Radar usava outra coisa.
 */
const theme = createTheme({
  cssVariables: { cssVarPrefix: 'senai' },

  palette: {
    primary: { main: T.ink.accent, light: T.tools.catalog.main, dark: T.surface.inverted, contrastText: '#fff' },
    secondary: { main: T.tools.radar.main, light: T.tools.radar.soft, dark: T.tools.radar.dark, contrastText: '#fff' },
    background: { default: T.surface.canvas, paper: T.surface.raised },
    text: { primary: T.ink.strong, secondary: T.ink.muted, disabled: T.ink.subtle },
    divider: T.border.subtle,
    success: { main: T.feedback.success },
    warning: { main: T.feedback.warning },
    error: { main: T.feedback.danger },
    info: { main: T.feedback.info },
    tool: T.tools,
  },

  typography: {
    fontFamily: T.fontFamily.text,
    // `letterSpacing` negativo cresce com o tamanho: títulos grandes precisam de
    // mais aperto que títulos pequenos para parecerem igualmente compostos.
    h1: { fontFamily: T.fontFamily.display, fontSize: T.fontSize.h1, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1 },
    h2: { fontFamily: T.fontFamily.display, fontSize: T.fontSize.h2, fontWeight: 800, letterSpacing: '-.022em', lineHeight: 1.18 },
    h3: { fontFamily: T.fontFamily.display, fontSize: T.fontSize.h3, fontWeight: 750, letterSpacing: '-.015em', lineHeight: 1.25 },
    h4: { fontFamily: T.fontFamily.display, fontSize: T.fontSize.h4, fontWeight: 750, letterSpacing: '-.01em', lineHeight: 1.3 },
    h5: { fontSize: T.fontSize.h5, fontWeight: 700, lineHeight: 1.35 },
    h6: { fontSize: T.fontSize.h6, fontWeight: 700, lineHeight: 1.4 },
    subtitle1: { fontSize: T.fontSize.body, fontWeight: 650, lineHeight: 1.45 },
    subtitle2: { fontSize: T.fontSize.small, fontWeight: 700, lineHeight: 1.45 },
    body1: { fontSize: T.fontSize.body, lineHeight: 1.62 },
    body2: { fontSize: T.fontSize.small, lineHeight: 1.55 },
    caption: { fontSize: T.fontSize.caption, lineHeight: 1.45 },
    overline: { fontSize: T.fontSize.overline, fontWeight: 800, letterSpacing: '.1em', lineHeight: 1.4 },
    button: { fontSize: T.fontSize.small, fontWeight: 700, letterSpacing: '.005em' },
  },

  shape: { borderRadius: T.radius.md },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // O anel de foco é do produto inteiro e não some ao trocar de tela.
        // `:focus-visible` mantém o anel para teclado sem sujar o clique.
        ':focus-visible': { outline: T.focus.outline, outlineOffset: T.focus.offset },
        // Quem pede menos movimento recebe menos movimento — inclusive nas
        // transições que os componentes abaixo introduzem.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': { animationDuration: '.01ms !important', transitionDuration: '.01ms !important', scrollBehavior: 'auto !important' },
        },
        body: { WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' },
        // Âncoras herdam a cor de ação e sublinham só no hover.
        a: { color: T.ink.accent, textUnderlineOffset: '.18em' },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0, variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: T.radius.md, borderColor: T.border.subtle, backgroundImage: 'none' },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: T.radius.md },
        outlined: { borderColor: T.border.subtle },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: T.radius.sm,
          minHeight: 40,
          paddingInline: 16,
          transition: `background-color ${T.motion.fast}, border-color ${T.motion.fast}, color ${T.motion.fast}`,
        },
        sizeLarge: { minHeight: 48, paddingInline: 22, fontSize: T.fontSize.body },
        sizeSmall: { minHeight: 32, paddingInline: 12 },
        // A borda de 1.5px impede que o botão contornado pareça mais leve que o
        // preenchido quando os dois estão lado a lado numa barra de ações.
        outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 650, borderRadius: T.radius.pill },
        // Chip clicável precisa parecer clicável antes do clique.
        clickable: { transition: `background-color ${T.motion.fast}, border-color ${T.motion.fast}` },
        sizeSmall: { height: 26, fontSize: T.fontSize.caption },
        outlined: { borderColor: T.border.base },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: T.radius.sm,
          backgroundColor: T.surface.raised,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border.base },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.border.strong },
        },
      },
    },

    MuiTextField: { defaultProps: { variant: 'outlined' } },

    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, minHeight: 44, fontSize: T.fontSize.small },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: T.radius.sm, border: '1px solid', alignItems: 'flex-start' },
        standardInfo: { backgroundColor: T.feedback.infoSoft, borderColor: T.border.subtle, color: T.ink.strong },
        standardSuccess: { backgroundColor: T.feedback.successSoft, borderColor: T.border.subtle, color: T.ink.strong },
        standardWarning: { backgroundColor: T.feedback.warningSoft, borderColor: T.border.subtle, color: T.ink.strong },
        standardError: { backgroundColor: T.feedback.dangerSoft, borderColor: T.border.subtle, color: T.ink.strong },
      },
    },

    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: { backgroundColor: T.surface.inverted, fontSize: T.fontSize.caption, padding: '6px 10px', borderRadius: T.radius.xs },
        arrow: { color: T.surface.inverted },
      },
    },

    MuiDialog: {
      styleOverrides: { paper: { borderRadius: T.radius.lg, boxShadow: T.shadow.overlay } },
    },

    MuiLinearProgress: {
      styleOverrides: { root: { height: 6, borderRadius: T.radius.pill, backgroundColor: T.border.subtle } },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: T.border.subtle } } },

    MuiSkeleton: { defaultProps: { animation: 'wave' }, styleOverrides: { root: { backgroundColor: T.surface.sunken } } },
  },
});

export default theme;
