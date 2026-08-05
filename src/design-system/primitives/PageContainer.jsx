import React from 'react';
import Box from '@mui/material/Box';
import { DESIGN_TOKENS as T } from '../tokens';

/**
 * Largura, respiro e alinhamento das páginas.
 *
 * Antes cada página escolhia os seus: 1100, 1180, 1220, 1240, 1400 e 900, com
 * `px` ora 2/3 ora 2/4 e `py` ora 3 ora 4 ora 5. O efeito é sutil e constante —
 * o conteúdo desliza de lado a cada navegação, como se cada tela fosse de um
 * site diferente. Aqui são quatro larguras nomeadas pelo que a página faz.
 */
const WIDTHS = {
  prose: T.layout.prose,   // texto corrido
  form: T.layout.form,     // uma pergunta ou um formulário por vez
  page: T.layout.page,     // o padrão: home, painéis, resultados
  wide: T.layout.wide,     // grades de catálogo e tabelas
};

export default function PageContainer({ children, width = 'page', tool, sx, ...props }) {
  const tone = tool ? T.tools[tool] : null;
  return (
    <Box
      sx={{
        maxWidth: WIDTHS[width] || WIDTHS.page,
        mx: 'auto',
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 4.5 },
        ...(tone && {
          '& .MuiButton-containedPrimary': { bgcolor: tone.main, '&:hover': { bgcolor: tone.dark } },
          '& .MuiButton-outlinedPrimary': { color: tone.dark, borderColor: tone.main, '&:hover': { borderColor: tone.dark, bgcolor: `${tone.main}0A` } },
          '& .MuiButton-textPrimary': { color: tone.dark },
          '& .MuiTabs-indicator': { bgcolor: tone.main },
          '& .MuiTab-root.Mui-selected': { color: tone.dark },
          '& .MuiChip-colorPrimary': { bgcolor: tone.main, color: tone.contrast },
          '& .MuiChip-outlinedPrimary': { bgcolor: 'transparent', color: tone.dark, borderColor: tone.main },
          '& .MuiBadge-badge.MuiBadge-colorPrimary': { bgcolor: tone.main, color: tone.contrast },
          '& .MuiLinearProgress-barColorPrimary': { bgcolor: tone.main },
          '& .MuiCircularProgress-colorPrimary': { color: tone.main },
          '& .MuiInputLabel-root.Mui-focused': { color: tone.dark },
          '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tone.main },
          '& .MuiCheckbox-root.Mui-checked, & .MuiRadio-root.Mui-checked': { color: tone.main },
        }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
