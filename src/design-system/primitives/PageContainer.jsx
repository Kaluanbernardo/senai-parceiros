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

export default function PageContainer({ children, width = 'page', sx, ...props }) {
  return (
    <Box
      sx={{
        maxWidth: WIDTHS[width] || WIDTHS.page,
        mx: 'auto',
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 4.5 },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
