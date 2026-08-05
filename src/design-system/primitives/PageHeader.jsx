import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DESIGN_TOKENS as T } from '../tokens';

/**
 * Cabeçalho de página.
 *
 * O eyebrow perdeu a barra vertical colorida à esquerda: com a trilha logo
 * acima, eram dois indicadores de contexto disputando o mesmo canto. Ficou um
 * ponto do acento da ferramenta, que orienta sem competir com o título.
 */
export default function PageHeader({ eyebrow, title, description, actions, accent = 'selection', dense = false }) {
  const tone = T.tools[accent] || T.tools.selection;

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'flex-end' }}
      gap={{ xs: 2, md: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && <Typography variant="overline" sx={{ display: 'block', mb: .75, color: tone.dark }}>{eyebrow}</Typography>}
        <Typography variant={dense ? 'h2' : 'h1'} sx={{ color: T.ink.strong }}>{title}</Typography>
        {description && (
          // A medida de linha para em ~65 caracteres. Descrição correndo a
          // largura inteira de uma tela de 1400px obriga o olho a saltos longos
          // e é onde a leitura efetivamente falha.
          <Typography sx={{ mt: 1, maxWidth: T.layout.prose, color: T.ink.muted, fontSize: dense ? T.fontSize.body : '1.05rem' }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
