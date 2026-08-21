import React, { useState } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DetailBody, describeDetailHeader } from '../DetailModal';
import { CountryFlag } from '../../utils/countryCode';
import { formatEntityAddedAt, hasEntityAddedAt } from '../../utils/entityDate';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';

/**
 * Ficha do registro, aberta ao lado da lista.
 *
 * O diálogo anterior tinha 600px de largura para um perfil com bio longa,
 * áreas, links e publicações, e três limitações que só apareciam ao usar:
 *
 * - **Não dava para ir ao próximo.** Avaliar candidatos é comparar, e cada
 *   perfil custava fechar, achar o cartão seguinte na grade e abrir de novo —
 *   perdendo a posição na lista no caminho.
 * - **Não tinha endereço.** Os filtros já viviam na URL; o registro aberto
 *   não. Dava para mandar uma lista filtrada e não dava para mandar uma
 *   pessoa. E o "voltar" do navegador saía da lista em vez de fechar a ficha.
 * - **Cobria a lista inteira.** O painel deixa o contexto visível atrás dele.
 *
 * A procedência do registro entra aqui, no rodapé, e sai dos cartões: é na
 * hora de decidir se a informação ainda vale que a data é consultada.
 */
export default function DetailPanel({ item, type, onClose, position, onPrevious, onNext }) {
  const [copied, setCopied] = useState(false);
  const open = Boolean(item);
  const { title, subtitle, country } = describeDetailHeader(item || {}, type);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Sem permissão de área de transferência o endereço continua na barra do
      // navegador; avisar de um erro que não impede nada só assusta.
    }
  }

  const hasPosition = position && position.total > 1 && position.index >= 0;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520, lg: 620 } } } }}
      >
        {item && (
          <>
            <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1.5, bgcolor: T.surface.raised }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                {hasPosition ? (
                  <Stack direction="row" alignItems="center" gap={.25}>
                    <IconButton size="small" onClick={onPrevious} disabled={position.index === 0} aria-label="Registro anterior">
                      <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="caption" sx={{ color: T.ink.muted, fontWeight: 700, minWidth: 78, textAlign: 'center' }}>
                      {position.index + 1} de {position.total}
                    </Typography>
                    <IconButton size="small" onClick={onNext} disabled={position.index >= position.total - 1} aria-label="Próximo registro">
                      <ChevronRightIcon />
                    </IconButton>
                  </Stack>
                ) : <Box />}
                <IconButton onClick={onClose} aria-label="Fechar a ficha"><CloseIcon /></IconButton>
              </Stack>

              <Typography variant="h4" sx={{ color: T.ink.strong }}>{title}</Typography>
              {subtitle && (
                <Typography variant="body2" sx={{ mt: .25, color: T.ink.base, fontWeight: 500 }}>{subtitle}</Typography>
              )}
              {country && (
                <Stack direction="row" alignItems="center" gap={.75} sx={{ mt: .5 }}>
                  <CountryFlag pais={country} size={16} />
                  <Typography variant="body2" sx={{ color: T.ink.muted }}>{country}</Typography>
                </Stack>
              )}

              <Stack direction="row" gap={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                <Tooltip title="Copia o endereço desta ficha, com os filtros atuais">
                  <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={copyLink}>
                    Copiar link
                  </Button>
                </Tooltip>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5, overflowY: 'auto' }}>
              <DetailBody item={item} type={type} />

              {hasEntityAddedAt(item) && (
                <Box sx={{ mt: 1, pt: 2, borderTop: `1px solid ${T.border.subtle}` }}>
                  <Typography variant="caption" sx={{ color: T.ink.subtle }}>
                    No catálogo desde {formatEntityAddedAt(item)}
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Drawer>

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message="Link desta ficha copiado."
      />
    </>
  );
}
