import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import Autocomplete from '@mui/material/Autocomplete';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';

/**
 * Busca e filtros do catálogo, em três peças que a casca posiciona.
 *
 * Antes tudo isto era um bloco só, com as facetas atrás de um botão fechado.
 * Num catálogo de 88 pessoas e 188 organizações, filtrar *é* a tarefa: manter
 * as cinco dimensões escondidas deixava a busca por texto como única entrada —
 * justamente a que exige saber de antemão o nome de quem se procura.
 *
 * Separando as peças, o desktop pode manter as facetas permanentemente à vista
 * numa coluna, e a tela estreita — onde uma coluna fixa não cabe — continua com
 * o painel sob demanda, agora com contador. As fichas de filtro ativo ficam
 * junto dos resultados nos dois casos, porque é lá que se percebe o recorte.
 */

/** Campo de busca. O rótulo acessível não pode ser só o `placeholder`: ele some assim que a pessoa digita. */
export function SearchField({ query, onQueryChange, placeholder = 'Buscar…' }) {
  return (
    <TextField
      fullWidth
      size="small"
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 20, color: T.ink.subtle }} />
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onQueryChange('')} aria-label="Limpar a busca" edge="end">
                <CloseIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}

/** Botão que abre as facetas onde elas não cabem em coluna. O contador some quando não há filtro: um "0" pendurado parece erro de renderização. */
export function FilterToggleButton({ count = 0, onClick, expanded }) {
  return (
    <Badge color="primary" badgeContent={count} invisible={count === 0}>
      <Button
        variant={count > 0 ? 'contained' : 'outlined'}
        startIcon={<TuneIcon />}
        onClick={onClick}
        aria-expanded={expanded}
        aria-controls="painel-de-filtros"
        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        Filtros
      </Button>
    </Badge>
  );
}

/**
 * Fichas do que está recortando a lista.
 *
 * Cada ficha tira o seu próprio filtro e "Limpar tudo" zera. Sem elas, uma
 * seleção feita e esquecida faz a lista simplesmente ter menos coisas, sem
 * explicação visível.
 */
export function ActiveFilterChips({ chips = [], onRemoveChip, onClearAll }) {
  if (!chips.length) return null;
  return (
    <Stack direction="row" gap={.75} flexWrap="wrap" alignItems="center">
      <Typography variant="caption" sx={{ color: T.ink.muted, fontWeight: 700, mr: .25 }}>
        Filtrando por
      </Typography>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          size="small"
          onDelete={() => onRemoveChip(chip)}
          // `deleteIcon` com rótulo próprio: sem ele o leitor de tela anuncia
          // três "excluir" idênticos numa fileira de fichas.
          deleteIcon={<CloseIcon aria-label={`Remover filtro ${chip.label}`} />}
          sx={{
            bgcolor: T.surface.raised,
            color: T.tools.catalog.dark,
            border: `1px solid ${T.tools.catalog.main}`,
            fontWeight: 650,
            '& .MuiChip-deleteIcon': { color: T.tools.catalog.dark },
          }}
        />
      ))}
      <Button size="small" onClick={onClearAll} sx={{ ml: .5 }}>
        Limpar tudo
      </Button>
    </Stack>
  );
}

/** As facetas em si. Serve tanto à coluna do desktop quanto à gaveta do celular. */
export function FilterPanel({ facets = [], children, onClearAll, activeCount = 0, showHeading = true }) {
  return (
    <Box component="section" aria-label="Filtros" id="painel-de-filtros">
      {/* Na gaveta o título já está no cabeçalho dela; repeti-lo logo abaixo
          faz parecer que são dois blocos diferentes. */}
      {(showHeading || activeCount > 0) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          {showHeading
            ? <Typography variant="overline" sx={{ color: T.tools.catalog.dark }}>Filtros</Typography>
            : <Box />}
          {activeCount > 0 && (
            <Button size="small" onClick={onClearAll}>Limpar tudo</Button>
          )}
        </Stack>
      )}

      <Stack gap={2.25}>
        {facets.map((facet) => (
          <Autocomplete
            key={facet.key}
            multiple
            size="small"
            options={facet.options}
            value={facet.value}
            onChange={(_event, next) => facet.onChange(next)}
            groupBy={facet.groupBy}
            limitTags={2}
            renderInput={(params) => <TextField {...params} label={facet.label} />}
          />
        ))}
        {children}
      </Stack>
    </Box>
  );
}
