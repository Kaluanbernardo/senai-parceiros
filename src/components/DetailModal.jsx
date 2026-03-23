import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SchoolIcon from '@mui/icons-material/School';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { CountryFlag } from '../utils/countryCode';

function InfoRow({ label, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  );
}

const naturezaColor = {
  'Pública': 'info',
  'Privada': 'warning',
  'PPP': 'success',
};

const profileLabels = {
  scholar: 'Google Scholar',
  lattes: 'Lattes / CNPq',
  orcid: 'ORCID',
  researchgate: 'ResearchGate',
  academia: 'Academia.edu',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function usePhotoWithFallback(id, fallbackUrl) {
  const [stage, setStage] = React.useState(0);
  React.useEffect(() => { setStage(0); }, [id, fallbackUrl]);
  const sources = [`/fotos/${id}.jpg`, fallbackUrl];
  const src = stage < sources.length ? sources[stage] : undefined;
  const onError = () => setStage((s) => s + 1);
  return { src, onError };
}

export default function DetailModal({ open, onClose, item, type = 'stakeholder' }) {
  const [imgError, setImgError] = React.useState(false);
  const pesqPhoto = usePhotoWithFallback(item?.id, item?.foto);

  // Reset error state when item changes
  React.useEffect(() => { setImgError(false); }, [item]);

  if (!item) return null;

  const title =
    type === 'stakeholder' ? item.nome :
    type === 'pesquisador' ? item.nome :
    item.instituicao;

  const subtitle =
    type === 'pesquisador' ? item.instituicao : null;

  const imageUrl =
    type === 'pesquisador' ? pesqPhoto.src :
    (item.logo || undefined);

  const imageOnError =
    type === 'pesquisador' ? pesqPhoto.onError :
    () => setImgError(true);

  const initial =
    type === 'pesquisador' ? getInitials(item.nome) :
    (title ? title.charAt(0) : '?');

  const avatarBg =
    type === 'pesquisador' ? 'secondary.light' : 'primary.light';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={type === 'pesquisador' ? imageUrl : (!imgError && imageUrl ? imageUrl : undefined)}
            alt={title}
            onError={imageOnError}
            sx={{
              width: 56,
              height: 56,
              bgcolor: imageUrl && !imgError && type !== 'pesquisador' ? '#fff' : avatarBg,
              fontSize: 22,
              fontWeight: 700,
              border: imageUrl && !imgError && type !== 'pesquisador' ? '1px solid' : 'none',
              borderColor: 'grey.200',
              '& img': { objectFit: 'contain', width: type !== 'pesquisador' ? '70%' : '100%', height: type !== 'pesquisador' ? '70%' : '100%', imageRendering: 'auto' },
              overflow: 'hidden',
            }}
          >
            {initial}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" fontWeight={700}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.primary" fontWeight={500}>
                {subtitle}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
              <CountryFlag pais={item.pais} size={16} />
              <Typography variant="body2" color="text.secondary">
                {item.pais}
              </Typography>
            </Box>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {/* Links */}
        {(item.website || item.scholar) && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {item.website && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Website
              </Button>
            )}
            {item.scholar && type === 'pesquisador' && (
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<SchoolIcon />}
                component="a"
                href={item.scholar}
                target="_blank"
                rel="noopener noreferrer"
              >
                {profileLabels[item.profileType] || 'Perfil Acadêmico'}
              </Button>
            )}
          </Box>
        )}

        {type === 'stakeholder' && (
          <>
            <InfoRow label="Natureza">
              <Chip
                label={item.natureza}
                color={naturezaColor[item.natureza] || 'default'}
                size="small"
              />
            </InfoRow>

            <InfoRow label="Diferencial">
              <Typography variant="body2">{item.diferencial}</Typography>
            </InfoRow>

            <InfoRow label="Relação com o SENAI">
              <Typography
                variant="body2"
                sx={{
                  p: 1.5,
                  bgcolor: item.relacao?.includes('Sem registro') ? 'grey.50' : 'success.50',
                  borderRadius: 1,
                  borderLeft: 3,
                  borderColor: item.relacao?.includes('Sem registro') ? 'grey.300' : 'success.main',
                }}
              >
                {item.relacao || 'Sem informação'}
              </Typography>
            </InfoRow>
          </>
        )}

        {type === 'escola' && (
          <>
            <InfoRow label="Áreas de Atuação">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {item.areas?.split(';').map((area, i) => (
                  <Chip
                    key={i}
                    label={area.trim()}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Box>
            </InfoRow>

            <InfoRow label="Relevância">
              <Typography variant="body2">{item.relevancia}</Typography>
            </InfoRow>
          </>
        )}

        {type === 'pesquisador' && (
          <>
            {item.h_index && (
              <InfoRow label="h-index">
                <Typography variant="h6" color="secondary.main" fontWeight={700}>
                  {item.h_index}
                </Typography>
              </InfoRow>
            )}

            <InfoRow label="Áreas de Pesquisa">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {item.areas?.split(';').map((area, i) => (
                  <Chip
                    key={i}
                    label={area.trim()}
                    size="small"
                    variant="outlined"
                    color="secondary"
                  />
                ))}
              </Box>
            </InfoRow>

            <InfoRow label="Pesquisa">
              <Typography
                variant="body2"
                sx={{
                  p: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  borderLeft: 3,
                  borderColor: 'secondary.main',
                  lineHeight: 1.7,
                }}
              >
                {item.pesquisa || 'Sem informação detalhada'}
              </Typography>
            </InfoRow>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
