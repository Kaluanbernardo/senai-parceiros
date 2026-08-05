import React from 'react';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DESIGN_TOKENS as T } from '../tokens';

/**
 * Estado vazio.
 *
 * As quatro versões espalhadas pelo produto diziam a mesma coisa inútil:
 * "Nenhum X encontrado / Tente ajustar os filtros". Isso descreve o problema e
 * deixa a saída por conta do usuário. Este componente pede uma ação de verdade
 * — normalmente "limpar os filtros", que é o que resolve — e aceita dizer
 * *quais* filtros estão ativos, porque numa tela com o painel recolhido a causa
 * do vazio pode estar fora de vista.
 */
export default function EmptyState({
  icon = <SearchOffOutlinedIcon />,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
}) {
  return (
    <Stack
      alignItems="center"
      sx={{ textAlign: 'center', py: { xs: 6, md: 8 }, px: 3 }}
      role="status"
    >
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: T.surface.sunken,
          color: T.ink.subtle,
          mb: 2,
          '& svg': { fontSize: 28 },
        }}
      >
        {icon}
      </Box>
      <Typography variant="h4" sx={{ color: T.ink.strong }}>{title}</Typography>
      {description && (
        <Typography sx={{ mt: 1, maxWidth: 460, color: T.ink.muted, fontSize: T.fontSize.small }}>
          {description}
        </Typography>
      )}
      {(action || secondaryAction) && (
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center" sx={{ mt: 2.5 }}>
          {action && <Button variant="contained" onClick={action}>{actionLabel}</Button>}
          {secondaryAction && <Button variant="outlined" onClick={secondaryAction}>{secondaryActionLabel}</Button>}
        </Stack>
      )}
    </Stack>
  );
}
