import React from 'react';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
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
 * A contagem é a frase que responde "a minha busca funcionou?", e ela precisa
 * estar escrita na tela. O componente já recebia `shown` e `total` e não
 * desenhava nenhum dos dois: o único texto era um `aria-live` escondido
 * dizendo "Lista atualizada", que avisa quem usa leitor de tela de que algo
 * mudou sem dizer o quê, e não avisa ninguém mais de nada. Agora o mesmo texto
 * serve aos dois — visível e anunciado.
 *
 * A alternância grade/lista é nova. Com 322 perfis, a grade de cartões obriga a
 * rolar muito para comparar nomes; a lista mostra três vezes mais por tela.
 */

/**
 * "24 de 88 pessoas" enquanto há recorte; "88 pessoas" quando a lista está
 * inteira. Repetir o total contra ele mesmo ("88 de 88") sugere um filtro que
 * não existe.
 */
export function describeResultCount(shown, total, noun) {
  const count = Number.isFinite(shown) ? shown : 0;
  const universe = Number.isFinite(total) ? total : count;
  const word = count === 1 ? noun?.singular : noun?.plural;
  const label = word ? ` ${word}` : '';
  if (count === universe) return `${count}${label}`;
  return `${count} de ${universe}${label}`;
}

export default function ResultsToolbar({ shown, total, noun, sort, onSortChange, view, onViewChange }) {
  return (
    <Stack
      // Uma linha só, inclusive no celular: empilhada, esta barra custava duas
      // faixas de altura entre a busca e o primeiro resultado.
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1.5}
      sx={{ py: 1.5 }}
    >
      <Typography
        // `aria-live` no próprio texto visível: uma região escondida com uma
        // frase fixa anunciava a mudança sem dizer qual foi.
        aria-live="polite"
        sx={{ fontWeight: 700, color: T.ink.strong, fontSize: T.fontSize.small }}
      >
        {describeResultCount(shown, total, noun)}
      </Typography>

      <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end" sx={{ flexShrink: 0 }}>
        <TextField
          select
          size="small"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          label="Ordenar por"
          sx={{ minWidth: { xs: 150, sm: 210 } }}
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
          // Numa coluna só, grade e lista compacta desenham a mesma coisa: a
          // alternância seria um controle que não altera nada.
          sx={{ display: { xs: 'none', sm: 'flex' } }}
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
