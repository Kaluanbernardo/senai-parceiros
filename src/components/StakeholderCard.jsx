import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import HandshakeIcon from '@mui/icons-material/Handshake';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CountryFlag } from '../utils/countryCode';

const naturezaColor = {
  'Pública': 'info',
  'Privada': 'warning',
  'PPP': 'success',
};

export default function StakeholderCard({ item, onClick }) {
  const hasPartnership = item.relacao && !item.relacao.includes('Sem registro');
  const initial = item.nome ? item.nome.charAt(0) : '?';
  const [imgError, setImgError] = React.useState(false);

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
      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
            <Avatar
              src={!imgError && item.logo ? item.logo : undefined}
              alt={item.nome}
              onError={() => setImgError(true)}
              sx={{
                width: 40, height: 40,
                bgcolor: item.logo && !imgError ? '#fff' : 'primary.light',
                fontSize: 18, fontWeight: 700, flexShrink: 0,
                border: item.logo && !imgError ? '1px solid' : 'none',
                borderColor: 'grey.200',
                '& img': { objectFit: 'contain', width: '70%', height: '70%', imageRendering: 'auto' },
                overflow: 'hidden',
              }}
            >
              {initial}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, flex: 1, mr: 0.5 }}>
                  {item.nome}
                </Typography>
                {hasPartnership && (
                  <Tooltip title="Tem parceria com SENAI">
                    <HandshakeIcon color="success" fontSize="small" sx={{ flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                <CountryFlag pais={item.pais} size={14} />
                <Typography variant="body2" color="text.secondary">
                  {item.pais}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flex: 1,
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
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
