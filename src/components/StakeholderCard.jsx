import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import HandshakeIcon from '@mui/icons-material/Handshake';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CountryFlag } from '../utils/countryCode';
import { formatInstitutionName } from '../domain/institutionName';

const naturezaColor = {
  'Pública': 'info',
  'Privada': 'warning',
  'PPP': 'success',
};

export default function StakeholderCard({ item, onClick }) {
  const hasPartnership = item.relacao && !item.relacao.includes('Sem registro');
  const displayName = formatInstitutionName(item.nome);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: 3,
        borderColor: naturezaColor[item.natureza] === 'info' ? 'info.main'
          : naturezaColor[item.natureza] === 'warning' ? 'warning.main'
          : naturezaColor[item.natureza] === 'success' ? 'success.main'
          : 'grey.300',
      }}
    >
      <Box sx={{ height: 6, bgcolor: 'primary.main', flexShrink: 0 }} />
      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.9 }}>Organização</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CountryFlag pais={item.pais} size={14} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{item.pais}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25, flex: 1 }}>
                  {displayName}
                </Typography>
                {hasPartnership && (
                  <Tooltip title="Tem parceria com SENAI">
                    <HandshakeIcon color="success" fontSize="small" sx={{ flexShrink: 0 }} />
                  </Tooltip>
                )}
            </Box>
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
            {item.diferencial}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Chip
              label={item.natureza}
              size="small"
              color={naturezaColor[item.natureza] || 'default'}
              variant="filled"
            />
            {item.website && (
              <Tooltip title="Abrir website">
                <IconButton
                  size="small"
                  component="a"
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ color: 'primary.main' }}
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
