import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SearchBar from '../components/SearchBar';
import OrgCard from '../components/OrgCard';
import DetailModal from '../components/DetailModal';
import { useData } from '../context/DataContext';

const FILTER_LABELS = {
  'Empresa': 'Empresas privadas',
  'Pública': 'Públicas',
  'PPP': 'Público-privadas',
  'Terceiro setor': 'Terceiro setor',
};

export default function OrganizacoesPage() {
  const { stakeholders: stakeholdersData } = useData();
  const [search, setSearch] = useState('');
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedCategorias, setSelectedCategorias] = useState([]);
  const [onlyPartnership, setOnlyPartnership] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const allOrgs = useMemo(() => {
    return stakeholdersData
      .filter((item) => item.categoria !== 'Escola')
      .map((item) => ({
        id: `s-${item.id}`,
        nome: item.nome,
        descricao: item.diferencial,
        pais: item.pais,
        logo: item.logo,
        website: item.website,
        categoria: item.categoria || 'Pública/PPP',
        filterKey: item.categoria === 'Pública/PPP'
          ? (item.natureza === 'PPP' ? 'PPP' : 'Pública')
          : (item.categoria || 'Pública'),
        areas: null,
        hasPartnership: !!(item.relacao && item.relacao.includes('✅')),
        _type: 'stakeholder',
        _original: item,
      }));
  }, [stakeholdersData]);

  const allCountries = useMemo(() => {
    const set = new Set(allOrgs.map((o) => o.pais).filter(Boolean));
    return [...set].sort();
  }, [allOrgs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allOrgs.filter((item) => {
      const matchSearch =
        !q ||
        item.nome.toLowerCase().includes(q) ||
        (item.descricao && item.descricao.toLowerCase().includes(q)) ||
        (item.pais && item.pais.toLowerCase().includes(q));
      const matchCountry =
        selectedCountries.length === 0 || selectedCountries.includes(item.pais);
      const matchCat =
        selectedCategorias.length === 0 || selectedCategorias.includes(item.filterKey);
      const matchPartnership = !onlyPartnership || item.hasPartnership;
      return matchSearch && matchCountry && matchCat && matchPartnership;
    });
  }, [allOrgs, search, selectedCountries, selectedCategorias, onlyPartnership]);

  const hasActiveFilters = selectedCountries.length > 0 || selectedCategorias.length > 0 || onlyPartnership || !!search;
  const clearFilters = () => {
    setSearch('');
    setSelectedCountries([]);
    setSelectedCategorias([]);
    setOnlyPartnership(false);
  };

  const toggleCategoria = (key) => {
    setSelectedCategorias((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          Organizações Parceiras
        </Typography>
        <IconButton onClick={() => setShowFilters((v) => !v)} color="primary">
          <FilterListIcon />
        </IconButton>
      </Box>

      <Collapse in={showFilters}>
        <Box
          sx={{
            p: 2,
            mb: 2.5,
            border: '1px solid',
            borderColor: 'grey.200',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nome, país..."
              />
            </Box>
            <Box sx={{ minWidth: 220 }}>
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
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(FILTER_LABELS).map(([key, label]) => {
              const active = selectedCategorias.includes(key);
              return (
                <Chip
                  key={key}
                  label={label}
                  size="small"
                  variant={active ? 'filled' : 'outlined'}
                  color={active ? 'primary' : 'default'}
                  onClick={() => toggleCategoria(key)}
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
            <FormControlLabel
              sx={{ ml: 1 }}
              control={
                <Switch
                  checked={onlyPartnership}
                  onChange={(e) => setOnlyPartnership(e.target.checked)}
                  color="success"
                  size="small"
                />
              }
              label={<Typography variant="body2">Com parceria SENAI</Typography>}
            />
            {hasActiveFilters && (
              <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters} sx={{ ml: 0.5 }}>
                Limpar
              </Button>
            )}
          </Box>
        </Box>
      </Collapse>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filtered.length} de {allOrgs.length} organizações
      </Typography>

      <Grid container spacing={2}>
        {filtered.map((item) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={item.id}>
            <OrgCard item={item} onClick={() => setSelectedItem(item)} />
          </Grid>
        ))}
      </Grid>

      {filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            Nenhuma organização encontrada
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Tente ajustar os filtros ou a busca
          </Typography>
        </Box>
      )}

      <DetailModal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem?._original}
        type={selectedItem?._type}
      />
    </Box>
  );
}
