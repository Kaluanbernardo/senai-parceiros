export const DESIGN_TOKENS = Object.freeze({
  brand: Object.freeze({
    navy: '#0B3558',
    cobalt: '#1769AA',
    red: '#D83A4A',
    canvas: '#F5F7FB',
  }),
  tools: Object.freeze({
    selection: Object.freeze({ main: '#6654E8', soft: '#F0EEFF', dark: '#4130B8' }),
    catalog: Object.freeze({ main: '#1769AA', soft: '#EAF4FC', dark: '#0B4778' }),
    radar: Object.freeze({ main: '#087F8C', soft: '#E7F8F6', dark: '#055761' }),
    prompt: Object.freeze({ main: '#D77700', soft: '#FFF3DF', dark: '#995000' }),
  }),
  radius: Object.freeze({ sm: 10, md: 16, lg: 24 }),
  shadow: Object.freeze({
    soft: '0 8px 24px rgba(11, 53, 88, 0.08)',
    raised: '0 16px 36px rgba(11, 53, 88, 0.14)',
  }),
});

export const TOOL_THEME = DESIGN_TOKENS.tools;
