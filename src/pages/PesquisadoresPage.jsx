import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import Button from '@mui/material/Button';
import SearchBar from '../components/SearchBar';
import StatsBar from '../components/StatsBar';
import PesquisadorCard from '../components/PesquisadorCard';
import DetailModal from '../components/DetailModal';
import { useData } from '../context/DataContext';

function extractUniqueAreas(data) {
  const set = new Set();
  data.forEach((item) => {
    if (!item.areas) return;
    item.areas.split(';').forEach((a) => {
      const clean = a.trim();
      if (clean) set.add(clean);
    });
  });
  return [...set].sort();
}

export default function PesquisadoresPage() {
  const { pesquisadores: pesquisadoresData } = useData();
  const [search, setSearch] = useState('');
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [selectedGenero, setSelectedGenero] = useState('todos');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const allCountries = useMemo(() => {
    const set = new Set(pesquisadoresData.map((s) => s.pais).filter(Boolean));
    return [...set].sort();
  }, [pesquisadoresData]);

  const allAreas = useMemo(() => extractUniqueAreas(pesquisadoresData), [pesquisadoresData]);

  const filtered = useMemo(() => {
    return pesquisadoresData.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.nome.toLowerCase().includes(q) ||
        (item.instituicao && item.instituicao.toLowerCase().includes(q)) ||
        (item.areas && item.areas.toLowerCase().includes(q)) ||
        (item.pais && item.pais.toLowerCase().includes(q)) ||
        (item.pesquisa && item.pesquisa.toLowerCase().includes(q));

      const matchCountry =
        selectedCountries.length === 0 || selectedCountries.includes(item.pais);

      const matchArea =
        selectedAreas.length === 0 ||
        selectedAreas.some((area) => {
          if (!item.areas) return false;
          return item.areas.toLowerCase().includes(area.toLowerCase());
        });

      const matchGenero =
        selectedGenero === 'todos' || item.genero === selectedGenero;

      return matchSearch && matchCountry && matchArea && matchGenero;
    });
  }, [search, selectedCountries, selectedAreas, selectedGenero]);

  const stats = useMemo(() => {
    const countries = new Set(filtered.map((s) => s.pais));
    return { countries: countries.size };
  }, [filtered]);

  const hasActiveFilters =
    selectedCountries.length > 0 || selectedAreas.length > 0 || search || selectedGenero !== 'todos';

  const clearFilters = () => {
    setSearch('');
    setSelectedCountries([]);
    setSelectedAreas([]);
    setSelectedGenero('todos');
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          Pesquisadores em EPT
        </Typography>
        <IconButton onClick={() => setShowFilters(!showFilters)} color="primary">
          <FilterListIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2.5, mb: 2 }} elevation={1}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nome, instituição, área ou pesquisa..."
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Autocomplete
                multiple
                size="small"
                options={allCountries}
                value={selectedCountries}
                onChange={(_, v) => setSelectedCountries(v)}
                renderInput={(params) => (
                  <TextField {...params} label="País" variant="outlined" />
                )}
                limitTags={2}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                multiple
                size="small"
                options={allAreas}
                value={selectedAreas}
                onChange={(_, v) => setSelectedAreas(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Área de Pesquisa" variant="outlined" />
                )}
                limitTags={2}
              />
            </Grid>
          </Grid>

          {/* Gender filter */}
          <Box sx={{ display: 'flex', gap: 0.75, mt: 2 }}>
            {[
              { label: 'Todos', value: 'todos' },
              { label: 'Feminino', value: 'F' },
              { label: 'Masculino', value: 'M' },
            ].map(({ label, value }) => {
              const isActive = selectedGenero === value;
              return (
                <Chip
                  key={value}
                  label={label}
                  size="small"
                  variant={isActive ? 'filled' : 'outlined'}
                  color={isActive ? 'primary' : 'default'}
                  onClick={() => setSelectedGenero(value)}
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
          </Box>

          {hasActiveFilters && (
            <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
                Limpar filtros
              </Button>
            </Box>
          )}
        </Paper>
      </Collapse>

      {/* Stats */}
      <StatsBar
        total={pesquisadoresData.length}
        filtered={filtered.length}
        countries={stats.countries}
      />

      {/* Grid of cards */}
      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        {filtered.map((item) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={item.id}>
            <PesquisadorCard item={item} onClick={() => setSelectedItem(item)} />
          </Grid>
        ))}
      </Grid>

      {filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            Nenhum pesquisador encontrado
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Tente ajustar os filtros ou a busca
          </Typography>
        </Box>
      )}

      {/* Detail Modal */}
      <DetailModal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        type="pesquisador"
      />
    </Box>
  );
}
