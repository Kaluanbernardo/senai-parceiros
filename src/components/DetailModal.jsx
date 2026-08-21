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
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { CountryFlag } from '../utils/countryCode';
import { formatInstitutionName } from '../domain/institutionName';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const catalogActionSx = {
  color: T.tools.catalog.main,
  borderColor: T.tools.catalog.main,
  '&:hover': { borderColor: T.tools.catalog.dark, bgcolor: T.tools.catalog.soft },
};

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

function listValues(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(';').map((entry) => entry.trim()).filter(Boolean);
}

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

const naturezaColor = {
  'Pública': 'info',
  'Privada': 'warning',
  'PPP': 'success',
};

export function personProfileLinks(item = {}) {
  const orcid = isHttpUrl(item.orcid)
    ? item.orcid
    : /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(String(item.orcid || '').trim())
      ? `https://orcid.org/${String(item.orcid).trim()}`
      : '';
  const candidates = [
    { label: 'Website', href: item.website },
    { label: 'Perfil institucional', href: item.perfil_principal_url },
    { label: 'LinkedIn', href: item.linkedin_url },
    { label: 'Google Scholar', href: item.scholar },
    { label: 'ORCID', href: orcid },
  ].filter((entry) => isHttpUrl(entry.href));
  const links = [];
  for (const candidate of candidates) {
    const existing = links.find((entry) => entry.href === candidate.href);
    if (!existing) links.push(candidate);
    else if (existing.label === 'Perfil institucional' && candidate.label !== 'Website') existing.label = candidate.label;
  }
  return links;
}

/**
 * Título, subtítulo e país de um registro, para o cabeçalho de quem o exibe.
 *
 * A ficha aparece em dois lugares — no painel lateral do catálogo e no diálogo
 * da revisão de pesquisa. Ter o mesmo registro nomeado de duas formas conforme
 * a tela é como um catálogo perde a confiança de quem o usa.
 */
export function describeDetailHeader(item, type = 'stakeholder') {
  const isPerson = type === 'person' || type === 'pesquisador';
  // As duas origens de pessoa jurídica nomeiam o registro em campos
  // diferentes: `escolas` usa `instituicao`, `stakeholders` usa `nome`. Um
  // stakeholder classificado como "Instituição de ensino" chegava aqui como
  // tipo `escola` e abria a ficha sem título nenhum — ler os dois campos é o
  // que impede a ficha de ficar anônima conforme a procedência do registro.
  const rawTitle = isPerson ? item?.nome : (item?.nome || item?.instituicao);
  return {
    isPerson,
    title: isPerson ? rawTitle : formatInstitutionName(rawTitle),
    subtitle: isPerson ? [item?.cargo, item?.instituicao].filter(Boolean).join(' · ') : null,
    country: item?.pais || '',
  };
}

/**
 * Corpo da ficha, sem moldura.
 *
 * Separado do diálogo para o catálogo poder abrir o mesmo conteúdo num painel
 * lateral — que mantém a lista visível e cabe numa largura de leitura — sem
 * que as duas superfícies passem a mostrar campos diferentes.
 */
export function DetailBody({ item, type = 'stakeholder' }) {
  if (!item) return null;
  const isPerson = type === 'person' || type === 'pesquisador';
  const profileLinks = isPerson ? personProfileLinks(item) : [];

  return (
    <>
      {/* Links */}
        {(profileLinks.length > 0 || (!isPerson && isHttpUrl(item.website))) && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {!isPerson && isHttpUrl(item.website) && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
                sx={catalogActionSx}
              >
                Website
              </Button>
            )}
            {profileLinks.map((profile) => (
              <Button
                key={profile.href}
                variant="outlined"
                size="small"
                startIcon={profile.label === 'Google Scholar' ? <SchoolIcon /> : <OpenInNewIcon />}
                component="a"
                href={profile.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={catalogActionSx}
              >
                {profile.label}
              </Button>
            ))}
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

            {item.descricao && (
              <InfoRow label="Descrição">
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.75 }}>
                  {item.descricao}
                </Typography>
              </InfoRow>
            )}

            <InfoRow label="Diferencial">
              <Typography
                variant="body2"
                sx={{
                  p: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  borderLeft: 3,
                  borderColor: T.tools.catalog.main,
                  lineHeight: 1.7,
                }}
              >
                {item.diferencial}
              </Typography>
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
            {item.areas && (
              <InfoRow label="Áreas de Atuação">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {listValues(item.areas).map((area, i) => (
                    <Chip
                      key={i}
                      label={area.trim()}
                      size="small"
                      variant="outlined"
                      sx={{ color: T.tools.catalog.main, borderColor: T.tools.catalog.main }}
                    />
                  ))}
                </Box>
              </InfoRow>
            )}

            {item.relevancia && (
              <InfoRow label="Perfil em destaque">
                <Typography
                  variant="body2"
                  sx={{
                    p: 1.5,
                    bgcolor: T.tools.catalog.soft,
                    borderRadius: 1,
                    borderLeft: 3,
                    borderColor: T.tools.catalog.main,
                    fontWeight: 500,
                  }}
                >
                  {item.relevancia}
                </Typography>
              </InfoRow>
            )}

            {item.descricao && (
              <InfoRow label="Descrição">
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-line', lineHeight: 1.75 }}
                >
                  {item.descricao}
                </Typography>
              </InfoRow>
            )}

            {item.diferencial && (
              <InfoRow label="Diferenciais">
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
                  {item.diferencial}
                </Typography>
              </InfoRow>
            )}
          </>
        )}

        {isPerson && (
          <>
            {listValues(item.perfis_atuacao).length > 0 && (
              <InfoRow label="Experiência de contribuição">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {listValues(item.perfis_atuacao).map((profile) => <Chip key={profile} label={profile} size="small" variant="outlined" />)}
                </Box>
              </InfoRow>
            )}
            {item.h_index && (
              <InfoRow label="h-index">
                <Typography variant="h6" color="secondary.main" fontWeight={700}>
                  {item.h_index}
                </Typography>
              </InfoRow>
            )}

            <InfoRow label="Áreas de especialidade">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {listValues(item.areas).map((area, i) => (
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

            {(item.pesquisa || item.miniBio || item.descricao) && <InfoRow label="Perfil">
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
                {item.pesquisa || item.miniBio || item.descricao}
              </Typography>
            </InfoRow>}

            {item.artigos && item.artigos.length > 0 && (
              <InfoRow label="Artigos Relevantes">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {item.artigos.map((artigo, i) => (
                    <Box
                      key={i}
                      component="a"
                      href={artigo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { borderColor: 'secondary.main', bgcolor: 'grey.50' },
                        transition: 'border-color 0.15s, background-color 0.15s',
                      }}
                    >
                      <Typography variant="caption" color="secondary.main" fontWeight={700} sx={{ mt: 0.15, flexShrink: 0 }}>
                        {artigo.ano}
                      </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.4, flex: 1 }}>
                        {artigo.titulo}
                      </Typography>
                      <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0, mt: 0.3 }} />
                    </Box>
                  ))}
                </Box>
              </InfoRow>
            )}
            {item.producoes_relevantes && item.producoes_relevantes.length > 0 && (
              <InfoRow label="Produções relevantes">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {item.producoes_relevantes.map((producao, i) => (
                    <Button key={i} href={producao.url} target="_blank" rel="noopener noreferrer" variant="text" sx={{ justifyContent: 'flex-start' }}>
                      {[producao.titulo, producao.tipo, producao.ano].filter(Boolean).join(' · ')}
                    </Button>
                  ))}
                </Box>
              </InfoRow>
            )}
          </>
        )}
    </>
  );
}

export default function DetailModal({ open, onClose, item, type = 'stakeholder' }) {
  if (!item) return null;
  const { title, subtitle } = describeDetailHeader(item, type);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
          aria-label="Fechar a ficha"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <DetailBody item={item} type={type} />
      </DialogContent>
    </Dialog>
  );
}
