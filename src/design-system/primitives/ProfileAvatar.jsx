import React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function nameToSlug(name = '') {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase();
}

function localReference(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('/')) return value;
  if (value.startsWith('./') || value.startsWith('../')) return value;
  return null;
}

export function getLocalProfileSources(person = {}) {
  const name = person.nome || person.name || '';
  const slug = nameToSlug(name);
  const explicit = localReference(person.image?.path) || localReference(person.foto);
  return [...new Set([
    `/fotos/${slug}.jpg`,
    `/fotos/${slug}.png`,
    explicit,
  ].filter(Boolean))];
}

export default function ProfileAvatar({ person = {}, size = 56, showStatus = false, sx = {}, className }) {
  const name = person.nome || person.name || 'Perfil sem nome';
  const [sourceIndex, setSourceIndex] = React.useState(0);
  const sources = React.useMemo(() => getLocalProfileSources(person), [person]);

  React.useEffect(() => { setSourceIndex(0); }, [person]);

  const source = sources[sourceIndex];
  const isLocal = Boolean(source);
  const imageStatus = person.image?.status;
  const status = isLocal
    ? (imageStatus === 'approved' ? 'Foto local - aprovada' : 'Foto local - em revisao')
    : 'Fallback - iniciais';
  const width = typeof size === 'object' ? size.width : size;
  const height = typeof size === 'object' ? size.height : size;

  return (
    <Box className={className} sx={{ width, flexShrink: 0, textAlign: 'center' }}>
      <Avatar
        src={source}
        alt={`${name} - ${status}`}
        onError={() => setSourceIndex((current) => current + 1)}
        sx={{
          width,
          height,
          bgcolor: 'secondary.light',
          color: 'secondary.contrastText',
          fontSize: typeof width === 'number' ? Math.max(18, width * .32) : 22,
          fontWeight: 700,
          border: '1px solid',
          borderColor: 'divider',
          '& img': { objectFit: 'cover' },
          ...sx,
        }}
      >
        {initials(name)}
      </Avatar>
      {showStatus && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .35, lineHeight: 1.1 }}>{status}</Typography>}
    </Box>
  );
}
