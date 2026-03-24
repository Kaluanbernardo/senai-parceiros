import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SearchBar from '../components/SearchBar';
import OrgCard from '../components/OrgCard';
import DetailModal from '../components/DetailModal';
import { useData } from '../context/DataContext';

function extractUniqueAreas(items) {
  const set = new Set();
  items.forEach((item) => {
    if (!item.areas) return;
    item.areas.split(';').forEach((a) => {
      const clean = a.trim().replace(/\(.*\)/, '').trim();
      if (clean) set.add(clean);
    });
  });
  return [...set].sort();
}

const QUICK_AREAS = [
  'Engenharia', 'TI', 'Saúde', 'Manufatura', 'Construção Civil',
  'Mecânica', 'Automotivo', 'Energia', 'Agropecuária', 'Gestão', 'Multissetorial',
];

export default function EscolasUnificadaPage() {
  const { stakeholders: stakeholdersData, escolas: escolasData } = useData();
  const [search, setSearch] = useState('');
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const allEscolas = useMemo(() => {
    const orgs = [];
    for (const item of stakeholdersData) {
      if (item.categoria !== 'Escola') continue;
      orgs.push({
        id: `s-${item.id}`,
        nome: item.nome,
        descricao: item.diferencial,
        pais: item.pais,
        logo: item.logo,
        website: item.website,
        categoria: 'Escola',
        areas: null,
        hasPartnership: !!(item.relacao && !item.relacao.includes('Sem registro')),
        _type: 'stakeholder',
        _original: item,
      });
    }
    for (const item of escolasData) {
      orgs.push({
        id: `e-${item.id}`,
        nome: item.instituicao,
        descricao: item.relevancia,
        pais: item.pais,
        logo: item.logo,
        website: item.website,
        categoria: 'Escola',
        areas: item.areas,
        hasPartnership: false,
        _type: 'escola',
        _original: item,
      });
    }
    return orgs;
  }, [stakeholdersData, escolasData]);

  const allCountries = useMemo(() => {
    const set = new Set(allEscolas.map((o) => o.pais).filter(Boolean));
    return [...set].sort();
  }, [allEscolas]);

  const allAreas = useMemo(() => extractUniqueAreas(allEscolas), [allEscolas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allEscolas.filter((item) => {
      const matchSearch =
        !q ||
        item.nome.toLowerCase().includes(q) ||
        (item.descricao && item.descricao.toLowerCase().includes(q)) ||
        (item.pais && item.pais.toLowerCase().includes(q)) ||
        (item.areas && item.areas.toLowerCase().includes(q));
      const matchCountry =
        selectedCountries.length === 0 || selectedCountries.includes(item.pais);
      const matchArea =
        selectedAreas.length === 0 ||
        selectedAreas.some((area) => item.areas && item.areas.toLowerCase().includes(area.toLowerCase()));
      return matchSearch && matchCountry && matchArea;
    });
  }, [allEscolas, search, selectedCountries, selectedAreas]);

  const hasActiveFilters = selectedCountries.length > 0 || selectedAreas.length > 0 || !!search;
  const clearFilters = () => {
    setSearch('');
    setSelectedCountries([]);
    setSelectedAreas([]);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700} color="primary.main">
          Escolas &amp; Institutos
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
                placeholder="Buscar por nome, área ou país..."
              />
            </Box>
            <Box sx={{ minWidth: 200 }}>
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
            </Box>
            <Box sx={{ minWidth: 220 }}>
              <Autocomplete
                multiple
                size="small"
                options={allAreas}
                value={selectedAreas}
                onChange={(_, v) => setSelectedAreas(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Área de Atuação" variant="outlined" />
                )}
                limitTags={2}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {QUICK_AREAS.map((area) => {
              const active = selectedAreas.includes(area);
              return (
                <Chip
                  key={area}
                  label={area}
                  size="small"
                  variant={active ? 'filled' : 'outlined'}
                  color={active ? 'primary' : 'default'}
                  onClick={() =>
                    setSelectedAreas((prev) =>
                      active ? prev.filter((a) => a !== area) : [...prev, area]
                    )
                  }
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
            {hasActiveFilters && (
              <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters} sx={{ ml: 1 }}>
                Limpar
              </Button>
            )}
          </Box>
        </Box>
      </Collapse>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filtered.length} de {allEscolas.length} escolas e institutos
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
            Nenhuma escola encontrada
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
