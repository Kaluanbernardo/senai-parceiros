import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import Autocomplete from '@mui/material/Autocomplete';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';

/**
 * Barra de busca e filtros do catálogo.
 *
 * Quatro mudanças em relação aos três painéis que existiam antes:
 *
 * 1. **A busca nunca se esconde.** Antes o botão de filtro recolhia o painel
 *    inteiro, campo de busca junto — o controle mais usado desaparecia com os
 *    menos usados. Agora a busca fica sempre visível e só as facetas colapsam.
 * 2. **Os filtros ativos ficam à vista.** Com o painel recolhido não havia
 *    nenhum sinal de que uma seleção estava recortando a lista; a tela
 *    simplesmente tinha menos coisas, sem explicação. Cada filtro ativo virou
 *    uma ficha removível, e o botão traz um contador.
 * 3. **Limpar é um alvo só.** Cada ficha tira o seu filtro; "Limpar tudo"
 *    zera. Antes, desfazer uma seleção exigia reabrir o painel e caçar o
 *    controle que a produziu.
 * 4. **A busca tem botão de apagar.** Selecionar e apagar um campo de texto é
 *    o gesto mais chato do teclado no celular.
 */
export default function FilterBar({
  query,
  onQueryChange,
  placeholder = 'Buscar…',
  facets = [],
  activeChips = [],
  onRemoveChip,
  onClearAll,
  expanded,
  onToggleExpanded,
  children,
}) {
  const hasFacets = facets.length > 0 || Boolean(children);

  return (
    <Box
      component="section"
      aria-label="Busca e filtros"
      sx={{ bgcolor: T.surface.raised, border: `1px solid ${T.border.subtle}`, borderRadius: `${T.radius.md}px`, p: { xs: 1.5, md: 2 } }}
    >
      <Stack direction="row" gap={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          // O rótulo acessível fica no `aria-label`: o `placeholder` some assim
          // que a pessoa digita, e um campo sem nome é um campo sem nome.
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
        {hasFacets && (
          <Badge
            color="primary"
            badgeContent={activeChips.filter((chip) => chip.group !== 'query').length}
            // O contador some quando não há filtro: um "0" pendurado no botão
            // parece um erro de renderização.
            invisible={activeChips.filter((chip) => chip.group !== 'query').length === 0}
          >
            <Button
              variant={expanded ? 'contained' : 'outlined'}
              startIcon={<TuneIcon />}
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              aria-controls="painel-de-filtros"
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Filtros
            </Button>
          </Badge>
        )}
      </Stack>

      {hasFacets && (
        <Collapse in={expanded} id="painel-de-filtros">
          <Stack
            direction="row"
            gap={1.5}
            flexWrap="wrap"
            sx={{ mt: 2, pt: 2, borderTop: `1px solid ${T.border.subtle}` }}
          >
            {facets.map((facet) => (
              <Autocomplete
                key={facet.key}
                multiple
                size="small"
                options={facet.options}
                value={facet.value}
                onChange={(_event, next) => facet.onChange(next)}
                limitTags={2}
                sx={{ minWidth: 240, flex: '1 1 240px' }}
                renderInput={(params) => <TextField {...params} label={facet.label} />}
              />
            ))}
          </Stack>
          {children && <Box sx={{ mt: 1.75 }}>{children}</Box>}
        </Collapse>
      )}

      {activeChips.length > 0 && (
        <Stack
          direction="row"
          gap={.75}
          flexWrap="wrap"
          alignItems="center"
          sx={{ mt: 1.75, pt: 1.5, borderTop: `1px solid ${T.border.subtle}` }}
        >
          <Typography variant="caption" sx={{ color: T.ink.muted, fontWeight: 700, mr: .25 }}>
            Filtrando por
          </Typography>
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              size="small"
              onDelete={() => onRemoveChip(chip)}
              // `deleteIcon` com rótulo próprio: sem ele o leitor de tela
              // anuncia três "excluir" idênticos numa fileira de fichas.
              deleteIcon={<CloseIcon aria-label={`Remover filtro ${chip.label}`} />}
              sx={{ bgcolor: T.surface.raised, color: T.tools.catalog.dark, border: `1px solid ${T.tools.catalog.main}`, fontWeight: 650, '& .MuiChip-deleteIcon': { color: T.tools.catalog.dark } }}
            />
          ))}
          <Button size="small" onClick={onClearAll} sx={{ ml: .5 }}>
            Limpar tudo
          </Button>
        </Stack>
      )}
    </Box>
  );
}
