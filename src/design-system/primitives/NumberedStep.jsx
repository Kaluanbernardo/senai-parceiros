import React from 'react';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DESIGN_TOKENS as T } from '../tokens';

/**
 * Um passo de um preparo, com o trilho numerado à esquerda.
 *
 * O trilho é o que transforma blocos soltos numa sequência: sem ele, "1." e
 * "2." são apenas texto em negrito, e nada liga um ao outro. Um rótulo de
 * 11px acima de um campo de 60px também não sustenta a leitura — o número
 * precisa de peso próprio para a tela virar uma ordem de decisões.
 *
 * Vive no design system porque as duas telas que perguntam o que a pessoa
 * precisa — a entrevista guiada e a pesquisa para o catálogo — faziam a mesma
 * coisa de formas diferentes.
 */
export default function NumberedStep({
  number,
  title,
  hint,
  children,
  done = false,
  disabled = false,
  disabledHint,
  accent = 'selection',
  last = false,
}) {
  const tone = T.tools[accent] || T.tools.selection;

  return (
    <Box sx={{ display: 'flex', gap: 2, opacity: disabled ? .55 : 1 }}>
      <Stack alignItems="center" sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: T.fontSize.caption,
            flexShrink: 0,
            bgcolor: done ? tone.main : T.surface.sunken,
            color: done ? tone.contrast : T.ink.muted,
            border: `2px solid ${done ? tone.main : T.border.base}`,
          }}
        >
          {done ? <CheckIcon sx={{ fontSize: 17 }} /> : number}
        </Box>
        {/* A linha entre os números é o que faz os passos lerem como um
            percurso, e não como três caixas empilhadas por acaso. */}
        {!last && <Box aria-hidden sx={{ width: '2px', flex: 1, mt: .75, bgcolor: T.border.subtle }} />}
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0 : 4 }}>
        <Typography variant="h5" sx={{ color: T.ink.strong }}>
          <Box component="span" sx={{ display: { md: 'none' }, color: tone.dark, mr: .75 }}>{number}.</Box>
          {title}
        </Typography>
        {hint && !disabled && (
          <Typography variant="body2" sx={{ mt: .25, color: T.ink.muted }}>{hint}</Typography>
        )}
        {disabled && disabledHint && (
          <Typography variant="body2" sx={{ mt: .5, color: T.ink.subtle }}>{disabledHint}</Typography>
        )}
        <Box sx={{ mt: 1.75, pointerEvents: disabled ? 'none' : 'auto' }} aria-disabled={disabled || undefined}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
