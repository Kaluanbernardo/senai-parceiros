import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CountryFlag } from '../utils/countryCode';
import { formatInstitutionName } from '../domain/institutionName';

const areaColorMap = {
  'Engenharia': '#1565c0',
  'TI': '#7b1fa2',
  'Saúde': '#c62828',
  'Manufatura': '#e65100',
  'Mecânica': '#4e342e',
  'Mecatrônica': '#00695c',
  'Automotivo': '#283593',
  'Construção Civil': '#ef6c00',
  'Energia': '#f9a825',
  'Mineração': '#795548',
  'Agropecuária': '#2e7d32',
  'Gestão': '#0277bd',
  'Design': '#ad1457',
  'Turismo': '#00838f',
  'Educação': '#5c6bc0',
  'Multissetorial': '#546e7a',
};

function getAreaColor(area) {
  const trimmed = area.trim();
  for (const [key, color] of Object.entries(areaColorMap)) {
    if (trimmed.startsWith(key) || trimmed.includes(key)) return color;
  }
  return '#78909c';
}

export default function EscolaCard({ item, onClick }) {
  const areas = item.areas ? item.areas.split(';').slice(0, 4) : [];
  const moreCount = item.areas ? item.areas.split(';').length - 4 : 0;
  const displayName = formatInstitutionName(item.instituicao);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderTop: 3, borderColor: 'primary.main' }}>
      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.9 }}>Escola ou instituto</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CountryFlag pais={item.pais} size={14} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{item.pais}</Typography>
              </Box>
            </Box>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25 }}>{displayName}</Typography>
          </Box>

          <Box sx={{ height: '1px', bgcolor: 'divider', mx: -2, mb: 1.5 }} />

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flex: 1,
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
              fontSize: '0.8rem',
            }}
          >
            {item.relevancia}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
              {areas.map((area, i) => (
                <Chip
                  key={i}
                  label={area.trim().replace(/\(.*\)/, '').trim()}
                  size="small"
                  sx={{
                    bgcolor: getAreaColor(area),
                    color: '#fff',
                    fontSize: '0.7rem',
                    height: 24,
                  }}
                />
              ))}
              {moreCount > 0 && (
                <Chip
                  label={`+${moreCount}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 24 }}
                />
              )}
            </Box>
            {item.website && (
              <Tooltip title="Abrir website">
                <IconButton
                  size="small"
                  component="a"
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ color: 'primary.main', flexShrink: 0 }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
