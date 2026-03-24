import React from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import HandshakeIcon from '@mui/icons-material/Handshake';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CountryFlag } from '../utils/countryCode';

export default function OrgCard({ item, onClick }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = item.nome ? item.nome.charAt(0) : '?';
  const areas = item.areas ? item.areas.split(';').slice(0, 3) : [];
  const moreAreas = item.areas ? Math.max(0, item.areas.split(';').length - 3) : 0;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: 2,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: 'primary.light', boxShadow: 3 },
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
                {item.hasPartnership && (
                  <Tooltip title="Tem parceria com SENAI">
                    <HandshakeIcon color="success" fontSize="small" sx={{ flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                <CountryFlag pais={item.pais} size={14} />
                <Typography variant="body2" color="text.secondary">{item.pais}</Typography>
              </Box>
            </Box>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flex: 1,
              mb: areas.length > 0 ? 1.5 : 0,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
            }}
          >
            {item.descricao}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
              {areas.map((area, i) => (
                <Chip
                  key={i}
                  label={area.trim().replace(/\(.*\)/, '').trim()}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: '0.68rem', height: 22 }}
                />
              ))}
              {moreAreas > 0 && (
                <Chip label={`+${moreAreas}`} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 22 }} />
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
