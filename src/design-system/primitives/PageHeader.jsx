import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TOOL_THEME } from '../tokens';

export default function PageHeader({ eyebrow, title, description, actions, accent = 'selection' }) {
  const color = TOOL_THEME[accent]?.main || TOOL_THEME.selection.main;
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} gap={3}>
      <Box sx={{ borderLeft: `4px solid ${color}`, pl: 2 }}>
        {eyebrow && <Typography variant="overline" sx={{ color, fontWeight: 800, letterSpacing: '.08em' }}>{eyebrow}</Typography>}
        <Typography variant="h1" sx={{ mt: .5, fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1.08 }}>{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760, fontSize: { xs: '1rem', md: '1.1rem' } }}>{description}</Typography>}
      </Box>
      {actions && <Stack direction="row" gap={1} flexWrap="wrap">{actions}</Stack>}
    </Stack>
  );
}
