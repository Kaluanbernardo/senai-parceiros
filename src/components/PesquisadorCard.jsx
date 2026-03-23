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
      boxShadow: 3,
    }}>
      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        {/* ID Card Header Band */}
        <Box sx={{
          bgcolor: 'secondary.main',
          px: 2,
          pt: 2,
          pb: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <Avatar
            src={photo.src}
            alt={item.nome}
            onError={photo.onError}
            sx={{
              width: 96,
              height: 96,
              bgcolor: 'secondary.dark',
              fontSize: 32,
              fontWeight: 700,
              border: '3px solid',
              borderColor: 'white',
              mb: 1.5,
              '& img': { objectFit: 'cover' },
            }}
          >
            {getInitials(item.nome)}
          </Avatar>
        </Box>

        {/* Card Body */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
          {/* Name */}
          <Typography
            variant="subtitle1"
            fontWeight={700}
            align="center"
            sx={{ lineHeight: 1.3, mb: 0.25 }}
          >
            {item.nome}
          </Typography>

          {/* Institution */}
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ lineHeight: 1.3, mb: 0.75 }}
          >
            {item.instituicao}
          </Typography>

          {/* Country */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mb: 1.25 }}>
            <CountryFlag pais={item.pais} size={14} />
            <Typography variant="caption" color="text.secondary">
              {item.pais}
            </Typography>
          </Box>

          {/* Divider line */}
          <Box sx={{ height: '1px', bgcolor: 'divider', mx: -2, mb: 1.25 }} />

          {/* h-index badge */}
          {item.h_index && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.25 }}>
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.25,
                bgcolor: 'secondary.50',
                border: '1px solid',
                borderColor: 'secondary.main',
                borderRadius: 10,
              }}>
                <Typography variant="caption" fontWeight={700} color="secondary.main">
                  h-index
                </Typography>
                <Typography variant="caption" fontWeight={900} color="secondary.main">
                  {item.h_index}
                </Typography>
              </Box>
            </Box>
          )}

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
