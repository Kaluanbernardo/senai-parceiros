import React from 'react';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TOOL_THEME } from '../tokens';

export default function ToolCard({ icon, label, description, themeKey = 'selection', meta, onClick, actionLabel = 'Abrir ferramenta' }) {
  const colors = TOOL_THEME[themeKey] || TOOL_THEME.selection;
  return (
    <Card variant="outlined" sx={{ height: '100%', borderTop: `4px solid ${colors.main}`, transition: 'box-shadow .2s ease', '&:hover': { boxShadow: '0 12px 28px rgba(11,53,88,.12)' }, '&:focus-within': { outline: `3px solid ${colors.soft}`, outlineOffset: 2 }, '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
      <ButtonBase onClick={onClick} sx={{ display: 'block', textAlign: 'left', width: '100%', height: '100%', borderRadius: 1.5 }} aria-label={`${actionLabel}: ${label}`}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 3, bgcolor: colors.soft, color: colors.dark }}>{icon}</Box>
            {meta && <Chip size="small" label={meta} sx={{ bgcolor: colors.soft, color: colors.dark, fontWeight: 700 }} />}
          </Stack>
          <Typography variant="h5" sx={{ mt: 2, fontSize: { xs: '1.2rem', md: '1.35rem' } }}>{label}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, minHeight: { md: 52 } }}>{description}</Typography>
          <Stack direction="row" alignItems="center" gap={.5} sx={{ mt: 2, color: colors.dark, fontWeight: 700, fontSize: '.9rem' }}>
            {actionLabel}<ArrowForwardIcon sx={{ fontSize: 17 }} />
          </Stack>
        </CardContent>
      </ButtonBase>
    </Card>
  );
}
