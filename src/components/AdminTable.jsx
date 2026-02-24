import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CountryFlag } from '../utils/countryCode';

const COLUMNS = {
  stakeholder: [
    { id: 'id', label: '#', width: 50 },
    { id: 'logo', label: '', width: 50, sortable: false },
    { id: 'nome', label: 'Nome', flex: true },
    { id: 'pais', label: 'Pais', width: 130 },
    { id: 'natureza', label: 'Natureza', width: 100 },
    { id: 'relacao_status', label: 'Parceria', width: 100, sortable: false },
    { id: 'website', label: 'Site', width: 60, sortable: false },
    { id: 'actions', label: 'Acoes', width: 100, sortable: false },
  ],
  escola: [
    { id: 'id', label: '#', width: 50 },
    { id: 'logo', label: '', width: 50, sortable: false },
    { id: 'instituicao', label: 'Instituicao', flex: true },
    { id: 'pais', label: 'Pais', width: 130 },
    { id: 'areas', label: 'Areas', width: 200 },
    { id: 'website', label: 'Site', width: 60, sortable: false },
    { id: 'actions', label: 'Acoes', width: 100, sortable: false },
  ],
  pesquisador: [
    { id: 'id', label: '#', width: 50 },
    { id: 'foto', label: '', width: 50, sortable: false },
    { id: 'nome', label: 'Nome', flex: true },
    { id: 'instituicao', label: 'Instituicao', width: 180 },
    { id: 'pais', label: 'Pais', width: 130 },
    { id: 'h_index', label: 'h-index', width: 80 },
    { id: 'scholar', label: 'Scholar', width: 60, sortable: false },
    { id: 'actions', label: 'Acoes', width: 100, sortable: false },
  ],
};

const naturezaColors = { 'Publica': 'info', 'Privada': 'warning', 'PPP': 'success' };

function descendingComparator(a, b, orderBy) {
  const aVal = (a[orderBy] || '').toString().toLowerCase();
  const bVal = (b[orderBy] || '').toString().toLowerCase();
  if (bVal < aVal) return -1;
  if (bVal > aVal) return 1;
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export default function AdminTable({ data, type, onEdit, onDelete, onAdd }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('id');

  const columns = COLUMNS[type] || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(item => {
      return Object.values(item).some(val =>
        val && val.toString().toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort(getComparator(order, orderBy));
  }, [filtered, order, orderBy]);

  const paged = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleSort = (columnId) => {
    const isAsc = orderBy === columnId && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(columnId);
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const getNameField = (item) => {
    if (type === 'escola') return item.instituicao;
    return item.nome;
  };

  const getImageUrl = (item) => {
    if (type === 'pesquisador') return item.foto;
    return item.logo;
  };

  const renderCell = (item, colId) => {
    switch (colId) {
      case 'id':
        return <Typography variant="body2" color="text.secondary">{item.id}</Typography>;
      case 'logo':
      case 'foto': {
        const url = getImageUrl(item);
        const name = getNameField(item) || '?';
        return (
          <Avatar
            src={url || undefined}
            sx={{
              width: 32, height: 32,
              bgcolor: type === 'pesquisador' ? 'secondary.light' : 'primary.light',
              fontSize: 14, fontWeight: 700,
              border: url && type !== 'pesquisador' ? '1px solid' : 'none',
              borderColor: 'grey.200',
              '& img': { objectFit: 'contain', width: type !== 'pesquisador' ? '70%' : '100%', height: type !== 'pesquisador' ? '70%' : '100%' },
            }}
          >
            {name.charAt(0).toUpperCase()}
          </Avatar>
        );
      }
      case 'nome':
      case 'instituicao':
        return (
          <Typography variant="body2" fontWeight={600} noWrap>
            {item[colId]}
          </Typography>
        );
      case 'pais':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CountryFlag pais={item.pais} size={16} />
            <Typography variant="body2" noWrap>{item.pais}</Typography>
          </Box>
        );
      case 'natureza':
        return (
          <Chip
            label={item.natureza}
            size="small"
            color={naturezaColors[item.natureza] || 'default'}
          />
        );
      case 'relacao_status': {
        const has = item.relacao && !item.relacao.includes('Sem registro');
        return (
          <Chip
            label={has ? 'Sim' : 'Nao'}
            size="small"
            color={has ? 'success' : 'default'}
            variant={has ? 'filled' : 'outlined'}
          />
        );
      }
      case 'areas': {
        const areas = item.areas ? item.areas.split(';').slice(0, 2) : [];
        const more = item.areas ? Math.max(0, item.areas.split(';').length - 2) : 0;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {areas.map((a, i) => (
              <Chip key={i} label={a.trim()} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            ))}
            {more > 0 && <Chip label={`+${more}`} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />}
          </Box>
        );
      }
      case 'h_index':
        return <Typography variant="body2" noWrap>{item.h_index || '-'}</Typography>;
      case 'website':
        return item.website ? (
          <Tooltip title={item.website}>
            <IconButton
              size="small"
              component="a"
              href={item.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : <Typography variant="body2" color="text.disabled">-</Typography>;
      case 'scholar':
        return item.scholar ? (
          <Tooltip title="Google Scholar">
            <IconButton
              size="small"
              component="a"
              href={item.scholar}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : <Typography variant="body2" color="text.disabled">-</Typography>;
      case 'actions':
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Editar">
              <IconButton size="small" color="primary" onClick={() => onEdit(item)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" color="error" onClick={() => onDelete(item)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      default:
        return <Typography variant="body2" noWrap>{item[colId] || '-'}</Typography>;
    }
  };

  return (
    <Box>
      {/* Search + Add */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar em todos os campos..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          sx={{ flex: 1, maxWidth: 400 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {filtered.length} de {data.length} registros
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          size="small"
        >
          Adicionar
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={1} sx={{ maxHeight: 'calc(100vh - 320px)' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell
                  key={col.id}
                  sx={{
                    width: col.width || 'auto',
                    minWidth: col.width || 'auto',
                    fontWeight: 700,
                    bgcolor: 'grey.100',
                    ...(col.flex ? { width: '100%' } : {}),
                  }}
                  sortDirection={orderBy === col.id ? order : false}
                >
                  {col.sortable === false ? (
                    col.label
                  ) : (
                    <TableSortLabel
                      active={orderBy === col.id}
                      direction={orderBy === col.id ? order : 'asc'}
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map(item => (
              <TableRow
                key={item.id}
                hover
                sx={{ '&:last-child td': { borderBottom: 0 }, cursor: 'pointer' }}
                onDoubleClick={() => onEdit(item)}
              >
                {columns.map(col => (
                  <TableCell key={col.id} sx={{ py: 1 }}>
                    {renderCell(item, col.id)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nenhum registro encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="Linhas por pagina:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
      />
    </Box>
  );
}
