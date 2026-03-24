import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import BusinessIcon from '@mui/icons-material/Business';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SchoolIcon from '@mui/icons-material/School';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import SearchBar from '../components/SearchBar';
import OrgCard from '../components/OrgCard';
import DetailModal from '../components/DetailModal';
import { useData } from '../context/DataContext';

const CATEGORIAS = [
  {
    key: 'Empresa',
    label: 'Empresas privadas',
    Icon: BusinessIcon,
    color: 'warning.main',
  },
  {
    key: 'Pública/PPP',
    label: 'Instituições públicas e público-privadas',
    Icon: AccountBalanceIcon,
    color: 'info.main',
  },
  {
    key: 'Escola',
    label: 'Escolas',
    Icon: SchoolIcon,
    color: 'primary.main',
  },
  {
    key: 'Terceiro setor',
    label: 'Instituições do terceiro setor',
    Icon: VolunteerActivismIcon,
    color: 'success.main',
  },
];

export default function OrganizacoesPage() {
  const { stakeholders: stakeholdersData, escolas: escolasData } = useData();
  const [search, setSearch] = useState('');
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const allOrgs = useMemo(() => {
    const orgs = [];
    for (const item of stakeholdersData) {
      orgs.push({
        id: `s-${item.id}`,
        nome: item.nome,
        descricao: item.diferencial,
        pais: item.pais,
        logo: item.logo,
        website: item.website,
        categoria: item.categoria || 'Pública/PPP',
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
        categoria: item.categoria || 'Escola',
        areas: item.areas,
        hasPartnership: false,
        _type: 'escola',
        _original: item,
      });
    }
    return orgs;
  }, [stakeholdersData, escolasData]);

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
      return matchSearch && matchCountry;
    });
  }, [allOrgs, search, selectedCountries]);

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIAS) map[cat.key] = [];
    for (const item of filtered) {
      const key = item.categoria;
      if (map[key]) map[key].push(item);
    }
    return map;
  }, [filtered]);

  const hasActiveFilters = selectedCountries.length > 0 || !!search;
  const clearFilters = () => {
    setSearch('');
    setSelectedCountries([]);
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
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
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
          {hasActiveFilters && (
            <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </Box>
      </Collapse>

      {CATEGORIAS.map(({ key, label, Icon, color }) => {
        const items = grouped[key] || [];
        if (items.length === 0) return null;
        return (
          <Box key={key} sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Icon sx={{ color, fontSize: 22 }} />
              <Typography variant="h6" fontWeight={700}>
                {label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ({items.length})
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {items.map((item) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={item.id}>
                  <OrgCard item={item} onClick={() => setSelectedItem(item)} />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}

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
