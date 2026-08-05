import React from 'react';
import Box from '@mui/material/Box';
import { BRAND_NAME } from './brand';
import { DESIGN_TOKENS as T } from './tokens';

/**
 * Assinatura do produto.
 *
 * Não é o logotipo do SENAI-SP: o arquivo oficial não acompanha este
 * repositório, e desenhar uma aproximação dele seria pior do que não usá-lo.
 * O que existe aqui é um lockup tipográfico — barra vermelha institucional,
 * nome da instituição e nome do produto — que ocupa o lugar certo na hierarquia
 * e pode ser trocado pelo arquivo oficial sem mexer no cabeçalho.
 *
 * Substituir pelo logotipo oficial: troque o conteúdo por um `<img>` ou `<svg>`
 * mantendo a prop `tone` e a altura de 28px em `md`.
 */
export default function Wordmark({ tone = 'inverted', showProduct = true, size = 'md' }) {
  const inverted = tone === 'inverted';
  const scale = size === 'lg' ? 1.35 : size === 'sm' ? 0.85 : 1;

  return (
    <Box
      sx={{ display: 'inline-flex', alignItems: 'center', gap: `${10 * scale}px`, minWidth: 0 }}
      // O leitor de tela recebe o nome inteiro de uma vez; sem isto ele lê
      // "SENAI hífen SP" e "Parceiros" como dois rótulos soltos.
      aria-label={BRAND_NAME.full}
      role="img"
    >
      {/* Barra vermelha: o único uso do vermelho da marca no cabeçalho, o que
          o mantém como acento e não como decoração repetida. */}
      <Box
        aria-hidden
        sx={{
          width: `${4 * scale}px`,
          height: `${26 * scale}px`,
          borderRadius: T.radius.xs,
          bgcolor: T.tools.radar.main,
          flexShrink: 0,
        }}
      />
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: `${7 * scale}px`, minWidth: 0 }}>
        <Box
          component="span"
          sx={{
            fontFamily: T.fontFamily.display,
            fontWeight: 800,
            fontSize: `${1.06 * scale}rem`,
            letterSpacing: '.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            color: inverted ? T.ink.onInverted : T.ink.strong,
          }}
        >
          {BRAND_NAME.institution}
        </Box>
        {showProduct && (
          <Box
            component="span"
            sx={{
              fontFamily: T.fontFamily.display,
              fontWeight: 500,
              fontSize: `${0.97 * scale}rem`,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              // Um degrau de peso e um de cor separam instituição de produto sem
              // precisar de barra vertical entre os dois.
              color: inverted ? T.ink.onInvertedMuted : T.ink.muted,
              display: { xs: 'none', sm: 'inline' },
            }}
          >
            {BRAND_NAME.product}
          </Box>
        )}
      </Box>
    </Box>
  );
}
