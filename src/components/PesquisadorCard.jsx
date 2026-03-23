import React from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import SchoolIcon from '@mui/icons-material/School';
import { CountryFlag } from '../utils/countryCode';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function usePhotoWithFallback(id, fallbackUrl) {
  const [stage, setStage] = React.useState(0);
  const sources = [`/fotos/${id}.jpg`, fallbackUrl];
  const src = stage < sources.length ? sources[stage] : undefined;
  const onError = () => setStage((s) => s + 1);
  return { src, onError };
}

export default function PesquisadorCard({ item, onClick }) {
  const areas = item.areas ? item.areas.split(';').slice(0, 3) : [];
  const moreCount = item.areas ? item.areas.split(';').length - 3 : 0;
  const photo = usePhotoWithFallback(item.id, item.foto);

  return (
    <Card sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: 2,
    }}>
      {/* Thin top stripe */}
      <Box sx={{ height: 6, bgcolor: 'secondary.main', flexShrink: 0 }} />

      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>

          {/* Top section: photo left + identity right */}
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
            {/* Photo */}
            <Avatar
              src={photo.src}
              alt={item.nome}
              onError={photo.onError}
              sx={{
                width: 80,
                height: 96,
                borderRadius: 1.5,
                bgcolor: 'secondary.light',
                fontSize: 26,
                fontWeight: 700,
                flexShrink: 0,
                border: '1px solid',
                borderColor: 'grey.200',
                '& img': { objectFit: 'cover' },
              }}
            >
              {getInitials(item.nome)}
            </Avatar>

            {/* Identity info */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" color="secondary.main" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1 }}>
                Pesquisador EPT
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, mt: 0.5 }}>
                {item.nome}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3, mt: 0.25 }}>
                {item.instituicao}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                <CountryFlag pais={item.pais} size={13} />
                <Typography variant="caption" color="text.secondary">
                  {item.pais}
                </Typography>
              </Box>
              {item.h_index && (
                <Box sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.75,
                  px: 1,
                  py: 0.2,
                  bgcolor: 'grey.100',
                  border: '1px solid',
                  borderColor: 'secondary.main',
                  borderRadius: 10,
                  alignSelf: 'flex-start',
                }}>
                  <Typography variant="caption" fontWeight={700} color="secondary.main">
                    h-index {item.h_index}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Divider */}
          <Box sx={{ height: '1px', bgcolor: 'divider', mx: -2, mb: 1.5 }} />

          {/* Research summary */}
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
              fontSize: '0.8rem',
            }}
          >
            {item.pesquisa}
          </Typography>

          {/* Footer: chips + scholar link */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
              {areas.map((area, i) => (
                <Chip
                  key={i}
                  label={area.trim()}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: '0.68rem', height: 22 }}
                />
              ))}
              {moreCount > 0 && (
                <Chip
                  label={`+${moreCount}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.68rem', height: 22 }}
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
                  sx={{ color: 'secondary.main', flexShrink: 0, ml: 0.5 }}
                >
                  <SchoolIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
