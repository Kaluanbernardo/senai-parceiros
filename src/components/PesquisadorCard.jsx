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
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import SchoolIcon from '@mui/icons-material/School';
import { CountryFlag } from '../utils/countryCode';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

export default function PesquisadorCard({ item, onClick }) {
  const areas = item.areas ? item.areas.split(';').slice(0, 3) : [];
  const moreCount = item.areas ? item.areas.split(';').length - 3 : 0;
  const [imgError, setImgError] = React.useState(false);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderTop: 3, borderColor: 'secondary.main' }}>
      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
            <Avatar
              src={!imgError && item.foto ? item.foto : undefined}
              alt={item.nome}
              onError={() => setImgError(true)}
              sx={{ width: 48, height: 48, bgcolor: 'secondary.light', fontSize: 18, fontWeight: 700, flexShrink: 0 }}
            >
              {getInitials(item.nome)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                {item.nome}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3, mt: 0.25 }}>
                {item.instituicao}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                <CountryFlag pais={item.pais} size={14} />
                <Typography variant="caption" color="text.secondary">
                  {item.pais}
                </Typography>
              </Box>
            </Box>
          </Box>

          {item.h_index && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <FormatQuoteIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
              <Typography variant="caption" fontWeight={600} color="secondary.main">
                h-index: {item.h_index}
              </Typography>
            </Box>
          )}

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flex: 1,
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
            }}
          >
            {item.pesquisa}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
              {areas.map((area, i) => (
                <Chip
                  key={i}
                  label={area.trim()}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: '0.7rem', height: 24 }}
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
            {item.scholar && (
              <Tooltip title={{ scholar: 'Google Scholar', lattes: 'Lattes / CNPq', orcid: 'ORCID', researchgate: 'ResearchGate', academia: 'Academia.edu' }[item.profileType] || 'Perfil Acadêmico'}>
                <IconButton
                  size="small"
                  component="a"
                  href={item.scholar}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ color: 'secondary.main', flexShrink: 0 }}
                >
                  <SchoolIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
