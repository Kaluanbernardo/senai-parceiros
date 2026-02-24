import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
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
import StakeholderCard from '../components/StakeholderCard';
import DetailModal from '../components/DetailModal';
import { useData } from '../context/DataContext';

export default function StakeholdersPage() {
  const { stakeholders: stakeholdersData } = useData();
  const [search, setSearch] = useState('');
  const [natureza, setNatureza] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [onlyPartnership, setOnlyPartnership] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const allCountries = useMemo(() => {
    const set = new Set(stakeholdersData.map((s) => s.pais).filter(Boolean));
    return [...set].sort();
  }, [stakeholdersData]);

  const filtered = useMemo(() => {
    return stakeholdersData.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.nome.toLowerCase().includes(q) ||
        item.diferencial.toLowerCase().includes(q) ||
        item.pais.toLowerCase().includes(q);

      const matchNatureza =
        natureza.length === 0 || natureza.includes(item.natureza);

      const matchCountry =
        selectedCountries.length === 0 || selectedCountries.includes(item.pais);

      const matchPartnership =
        !onlyPartnership ||
        (item.relacao && !item.relacao.includes('Sem registro'));

      return matchSearch && matchNatureza && matchCountry && matchPartnership;
    });
  }, [search, natureza, selectedCountries, onlyPartnership]);

  const stats = useMemo(() => {
    const countries = new Set(filtered.map((s) => s.pais));
    const withPartnership = filtered.filter(
      (s) => s.relacao && !s.relacao.includes('Sem registro')
    ).length;
    return { countries: countries.size, withPartnership };
  }, [filtered]);

  const hasActiveFilters =
    natureza.length > 0 || selectedCountries.length > 0 || onlyPartnership || search;

  const clearFilters = () => {
    setSearch('');
    setNatureza([]);
    setSelectedCountries([]);
    setOnlyPartnership(false);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          Stakeholders Educacionais
        </Typography>
        <IconButton onClick={() => setShowFilters(!showFilters)} color="primary">
          <FilterListIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2.5, mb: 2 }} elevation={1}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nome, diferencial ou país..."
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
                  <TextField {...params} label="País / Região" variant="outlined" />
                )}
                limitTags={2}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <ToggleButtonGroup
                value={natureza}
                onChange={(_, v) => setNatureza(v || [])}
                size="small"
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="Pública" sx={{ textTransform: 'none', px: 2 }}>
                  Pública
                </ToggleButton>
                <ToggleButton value="Privada" sx={{ textTransform: 'none', px: 2 }}>
                  Privada
                </ToggleButton>
                <ToggleButton value="PPP" sx={{ textTransform: 'none', px: 2 }}>
                  PPP
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            <Grid size={{ xs: 12, md: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={onlyPartnership}
                    onChange={(e) => setOnlyPartnership(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Typography variant="body2">Com parceria</Typography>
                }
              />
            </Grid>
          </Grid>

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
        total={stakeholdersData.length}
        filtered={filtered.length}
        countries={stats.countries}
        withPartnership={stats.withPartnership}
      />

      {/* Grid of cards */}
      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        {filtered.map((item) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={item.id}>
            <StakeholderCard item={item} onClick={() => setSelectedItem(item)} />
          </Grid>
        ))}
      </Grid>

      {filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            Nenhum stakeholder encontrado
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
        type="stakeholder"
      />
    </Box>
  );
}
