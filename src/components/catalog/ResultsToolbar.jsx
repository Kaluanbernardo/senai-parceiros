import React from 'react';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { SORT_OPTIONS } from '../../domain/catalogFilters';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';

/**
 * Contagem, ordenação e densidade da lista.
 *
 * A contagem antes era uma ficha ("128 de 322 resultados") no meio de outras
 * fichas decorativas, com o mesmo peso visual de "12 países" — informação que
 * ninguém pediu ocupando o mesmo destaque da que responde "a minha busca
 * funcionou?". Aqui ela é uma frase, em `aria-live`, para quem usa leitor de
 * tela saber que a lista mudou depois de digitar.
 *
 * A alternância grade/lista é nova. Com 322 perfis, a grade de cartões obriga a
 * rolar muito para comparar nomes; a lista mostra três vezes mais por tela.
 */
export default function ResultsToolbar({ shown, total, noun, sort, onSortChange, view, onViewChange }) {
  const filtering = shown < total;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      gap={1.5}
      sx={{ py: 1.5 }}
    >
      <Typography
        // `aria-live="polite"` avisa a mudança sem interromper a digitação.
        aria-live="polite"
        sx={{ fontSize: T.fontSize.small, color: T.ink.muted }}
      >
        <Box component="strong" sx={{ color: T.ink.strong, fontWeight: 750 }}>
          {shown.toLocaleString('pt-BR')}
        </Box>{' '}
        {shown === 1 ? noun.singular : noun.plural}
        {filtering && ` de ${total.toLocaleString('pt-BR')}`}
      </Typography>

      <Stack direction="row" gap={1} alignItems="center" justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
        <TextField
          select
          size="small"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          label="Ordenar por"
          sx={{ minWidth: 190 }}
        >
          {SORT_OPTIONS.map((option) => (
            <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
          ))}
        </TextField>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          // `null` chega quando se clica no botão que já está ativo; aceitar o
          // valor apagaria o modo de exibição e a lista sumiria.
          onChange={(_event, next) => next && onViewChange(next)}
          aria-label="Modo de exibição"
        >
          <ToggleButton value="grid" aria-label="Exibir em cartões">
            <Tooltip title="Cartões"><ViewModuleOutlinedIcon sx={{ fontSize: 19 }} /></Tooltip>
          </ToggleButton>
          <ToggleButton value="list" aria-label="Exibir em lista compacta">
            <Tooltip title="Lista compacta"><ViewListOutlinedIcon sx={{ fontSize: 19 }} /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Stack>
  );
}
