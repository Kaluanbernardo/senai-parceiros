import React from 'react';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DESIGN_TOKENS as T } from '../tokens';

/**
 * Cartão de entrada de uma ferramenta.
 *
 * A borda superior de 4px colorida saiu: com quatro cartões lado a lado, quatro
 * faixas de cores diferentes fazem a fileira parecer um gráfico. O acento ficou
 * no ícone, que é onde ele identifica a ferramenta, e reaparece na borda e na
 * seta quando o cartão é apontado — sinal de "aqui se clica" no momento em que
 * a pergunta é essa.
 *
 * O `ButtonBase` anterior virou `CardActionArea` para o cartão ganhar o realce
 * de toque padrão do MUI, e a seta deixou de ser um enfeite estático: ela anda.
 */
export default function ToolCard({ icon, label, description, themeKey = 'selection', meta, onClick, actionLabel = 'Abrir' }) {
  const tone = T.tools[themeKey] || T.tools.selection;

  return (
    <Card
      sx={{
        height: '100%',
        transition: `border-color ${T.motion.base}, box-shadow ${T.motion.base}, transform ${T.motion.base}`,
        '&:hover': { borderColor: tone.main, boxShadow: T.shadow.raised, transform: 'translateY(-2px)' },
        '&:focus-within': { borderColor: tone.main, boxShadow: T.focus.ring },
        '@media (prefers-reduced-motion: reduce)': { '&:hover': { transform: 'none' } },
      }}
    >
      <CardActionArea
        onClick={onClick}
        aria-label={`${actionLabel}: ${label}`}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', p: { xs: 2.25, md: 2.75 }, '&:focus-visible': { outline: 'none' } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: `${T.radius.sm}px`,
              bgcolor: tone.main,
              color: tone.contrast,
            }}
          >
            {icon}
          </Box>
          {meta && (
            // Tom do acento, não verde: a ficha carrega tanto "Disponível"
            // quanto uma contagem, e verde num número o faz parecer um
            // indicador de saúde do sistema.
            <Chip
              size="small"
              label={meta}
              variant="outlined"
              // Sem limite, uma ficha longa atravessa a borda do cartão numa
              // coluna estreita e deixa de ser legível.
              sx={{ bgcolor: T.surface.raised, color: tone.dark, borderColor: tone.main, fontWeight: 700, height: 22, fontSize: T.fontSize.overline, maxWidth: '60%' }}
            />
          )}
        </Stack>

        <Typography variant="h4" sx={{ mt: 2, color: T.ink.strong }}>{label}</Typography>
        <Typography variant="body2" sx={{ mt: .75, color: T.ink.muted, flex: 1 }}>{description}</Typography>

        <Stack
          direction="row"
          alignItems="center"
          gap={.5}
          sx={{
            mt: 2,
            color: tone.dark,
            fontWeight: 750,
            fontSize: T.fontSize.small,
            '.MuiCardActionArea-root:hover &  svg': { transform: 'translateX(3px)' },
          }}
        >
          {actionLabel}
          <ArrowForwardIcon sx={{ fontSize: 16, transition: `transform ${T.motion.base}` }} />
        </Stack>
      </CardActionArea>
    </Card>
  );
}
