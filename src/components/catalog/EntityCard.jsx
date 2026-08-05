import React from 'react';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { CountryFlag } from '../../utils/countryCode';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';

/**
 * Cartão único do catálogo, nos modos grade e lista.
 *
 * Antes eram dois componentes com a mesma estrutura e detalhes divergentes:
 * faixa superior de 6px em cores diferentes, `boxShadow: 2` num e borda no
 * outro, `elevation` num e `variant` no outro, e — o que mais atrapalha — o
 * mesmo tipo de informação em posições diferentes conforme a categoria, o que
 * obriga a reaprender o cartão a cada aba.
 *
 * Ficou uma anatomia só: rótulo da categoria e sinal de destaque em cima, nome,
 * origem, resumo, e no rodapé as fichas de área com o link externo à direita.
 *
 * A faixa colorida saiu. Ela pintava 6px do acento em cada um dos 322 cartões,
 * o que transforma a cor de marca em textura de fundo — quando tudo está
 * marcado, nada está. O acento passou para o rótulo da categoria e para a borda
 * no hover, onde ele responde a uma pergunta ("o que é isto?") em vez de
 * decorar.
 */
function ExternalLink({ link, tone }) {
  return (
    <Tooltip title={link.label}>
      <IconButton
        size="small"
        component="a"
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.label} — abre em nova aba`}
        // Sem isto, clicar no link externo também abriria o modal de detalhe
        // atrás dele: os dois alvos se sobrepõem.
        onClick={(event) => event.stopPropagation()}
        sx={{ color: tone.main, flexShrink: 0 }}
      >
        <OpenInNewIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}

export default function EntityCard({
  item,
  onClick,
  view = 'grid',
  eyebrow,
  accent = 'catalog',
  title,
  subtitle,
  summary,
  tags = [],
  badge,
  link,
  flags = [],
}) {
  const tone = T.tools[accent] || T.tools.catalog;
  const compact = view === 'list';
  // Três fichas cabem numa coluna da grade sem quebrar em duas linhas; o
  // excedente vira um "+N" para o cartão não crescer com o registro.
  const visibleTags = tags.slice(0, 3);
  const hiddenTags = tags.length - visibleTags.length;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        transition: `border-color ${T.motion.fast}, box-shadow ${T.motion.fast}`,
        '&:hover': { borderColor: tone.main, boxShadow: T.shadow.soft },
        // Sem isto, focar o cartão pelo teclado não mostra nada: o anel fica
        // atrás da área clicável que ocupa o cartão inteiro.
        '&:focus-within': { borderColor: tone.main, boxShadow: T.focus.ring },
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'stretch',
          gap: compact ? 2 : 0,
          p: compact ? 1.5 : 2,
          '&:focus-visible': { outline: 'none' },
        }}
      >
        {/* No modo compacto os blocos correm lado a lado em colunas de largura
            proporcional — é isso que torna a lista escaneável, com a mesma
            informação começando na mesma coluna em todas as linhas. Empilhados,
            como estavam antes, cada item ocupava a altura de um cartão e a
            lista "compacta" não economizava tela nenhuma. */}
        <Box
          sx={
            compact
              ? { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 2 }
              : { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }
          }
        >
          {!compact && (
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography variant="overline" sx={{ color: tone.dark, fontSize: T.fontSize.overline }}>
                {eyebrow}
              </Typography>
              <Stack direction="row" alignItems="center" gap={.75} sx={{ flexShrink: 0 }}>
                {badge && (
                  <Chip
                    size="small"
                    label={badge}
                    sx={{ bgcolor: tone.soft, color: tone.dark, fontWeight: 700, height: 22, fontSize: T.fontSize.overline }}
                  />
                )}
                {flags.includes('partnership') && (
                  <Tooltip title="Já tem relação de parceria com o SENAI">
                    <HandshakeOutlinedIcon sx={{ fontSize: 18, color: T.feedback.success }} />
                  </Tooltip>
                )}
              </Stack>
            </Stack>
          )}

          <Box sx={compact ? { flex: '2 1 0', minWidth: 0 } : undefined}>
            <Typography
              variant={compact ? 'subtitle1' : 'h5'}
              sx={{
                mt: compact ? 0 : .5,
                color: T.ink.strong,
                // Nomes longos de instituição quebram; sem limite eles empurram
                // o resumo para fora do cartão e desalinham a grade inteira.
                display: '-webkit-box',
                WebkitLineClamp: compact ? 1 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </Typography>

            <Stack direction="row" alignItems="center" gap={.75} sx={{ mt: .35, minWidth: 0 }}>
              {item?.pais && <CountryFlag pais={item.pais} size={13} />}
              <Typography
                variant="caption"
                sx={{ color: T.ink.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {[subtitle, item?.pais].filter(Boolean).join(' · ')}
              </Typography>
            </Stack>
          </Box>

          {compact && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="flex-end"
              gap={.75}
              // Some nas telas estreitas: três colunas em 390px de largura
              // deixariam cada uma ilegível.
              sx={{ flex: '1 1 0', minWidth: 0, display: { xs: 'none', md: 'flex' } }}
            >
              {tags.slice(0, 2).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ height: 21, fontSize: T.fontSize.overline, color: T.ink.muted, maxWidth: 170 }}
                />
              ))}
              {badge && (
                <Chip
                  size="small"
                  label={badge}
                  sx={{ bgcolor: tone.soft, color: tone.dark, fontWeight: 700, height: 21, fontSize: T.fontSize.overline }}
                />
              )}
              {flags.includes('partnership') && (
                <Tooltip title="Já tem relação de parceria com o SENAI">
                  <HandshakeOutlinedIcon sx={{ fontSize: 17, color: T.feedback.success }} />
                </Tooltip>
              )}
            </Stack>
          )}

          {!compact && summary && (
            <Typography
              variant="body2"
              sx={{
                mt: 1.25,
                flex: 1,
                color: T.ink.muted,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {summary}
            </Typography>
          )}

          {/* Rodapé: as fichas de área ocupam o que sobra e o link externo
              fica encostado à direita. `mt: auto` prende o rodapé embaixo,
              o que mantém a linha de base alinhada entre cartões de alturas
              diferentes na mesma fileira da grade. */}
          {!compact && (visibleTags.length > 0 || link) && (
            <Stack direction="row" alignItems="flex-end" gap={1} sx={{ mt: 'auto', pt: 1.5 }}>
              <Stack direction="row" gap={.5} flexWrap="wrap" sx={{ flex: 1, minWidth: 0 }}>
                {visibleTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ height: 21, fontSize: T.fontSize.overline, color: T.ink.muted }}
                  />
                ))}
                {hiddenTags > 0 && (
                  <Chip
                    label={`+${hiddenTags}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 21, fontSize: T.fontSize.overline, color: T.ink.subtle }}
                  />
                )}
              </Stack>
              {link && !compact && <ExternalLink link={link} tone={tone} />}
            </Stack>
          )}
        </Box>

        {link && compact && <ExternalLink link={link} tone={tone} />}
      </CardActionArea>
    </Card>
  );
}
