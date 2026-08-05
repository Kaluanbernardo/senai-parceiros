import React from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import SchoolIcon from '@mui/icons-material/School';
import { CountryFlag } from '../utils/countryCode';
import { getCategoriasFromAreas } from '../utils/areaCategories';

function summarize(text, maxSentences = 2) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, maxSentences).join(' ').trim();
}

export default function PesquisadorCard({ item, onClick }) {
  const categorias = getCategoriasFromAreas(item.areas);

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

          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="secondary.main" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.9 }}>
                Especialista EPT
              </Typography>
              {item.h_index ? <Chip label={`h-index ${item.h_index}`} size="small" color="secondary" variant="outlined" sx={{ height: 23, fontWeight: 700 }} /> : null}
            </Box>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25 }}>
              {item.nome}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4, mt: 0.5 }}>
              {item.instituicao}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
              <CountryFlag pais={item.pais} size={14} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {item.pais}
              </Typography>
            </Box>
          </Box>

          {/* Divider */}
          <Box sx={{ height: '1px', bgcolor: 'divider', mx: -2, mb: 1.5 }} />

          {/* Research summary preview (miniBio field, max 4 lines) */}
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
            {item.miniBio || summarize(item.pesquisa)}
          </Typography>

          {/* Footer: category chips + scholar link */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
              {categorias.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: '0.67rem', height: 22 }}
                />
              ))}
              {categorias.length === 0 && item.areas && item.areas !== '-' && (
                <Chip
                  label={item.areas.split(';')[0].trim()}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: '0.67rem', height: 22 }}
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
