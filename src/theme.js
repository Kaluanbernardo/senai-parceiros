import { createTheme } from '@mui/material/styles';
import { DESIGN_TOKENS } from './design-system/tokens';

const theme = createTheme({
  cssVariables: { cssVarPrefix: 'senai' },
  palette: {
    primary: {
      main: DESIGN_TOKENS.brand.navy,
      light: DESIGN_TOKENS.brand.cobalt,
      dark: '#06233D',
      contrastText: '#fff',
    },
    secondary: {
      main: DESIGN_TOKENS.brand.red,
      light: '#ED6D78',
      dark: '#A92534',
      contrastText: '#fff',
    },
    background: {
      default: DESIGN_TOKENS.brand.canvas,
      paper: '#FFFFFF',
    },
    text: {
      primary: '#17324D',
      secondary: '#5C6F82',
    },
    divider: '#DCE5EE',
    success: { main: '#16855B' },
    warning: { main: '#C56A00' },
    info: { main: '#1769AA' },
    tool: DESIGN_TOKENS.tools,
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-.035em' },
    h2: { fontWeight: 800, letterSpacing: '-.03em' },
    h3: { fontWeight: 800, letterSpacing: '-.02em' },
    h4: { fontWeight: 750 },
    h5: { fontWeight: 750 },
    h6: { fontWeight: 700 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    button: { fontWeight: 700 },
  },
  shape: {
    borderRadius: DESIGN_TOKENS.radius.md,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: DESIGN_TOKENS.radius.md,
          boxShadow: DESIGN_TOKENS.shadow.soft,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: DESIGN_TOKENS.radius.md },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 11,
          minHeight: 42,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 650 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 11 },
      },
    },
  },
});

export default theme;
