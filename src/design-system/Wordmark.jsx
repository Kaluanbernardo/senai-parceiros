import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { BRAND_NAME, LOGO_ASSET } from './brand';
import { DESIGN_TOKENS as T } from './tokens';

/**
 * Assinatura do produto.
 *
 * Carrega o logotipo oficial de `public/senai-logo.png` (ver `LOGO_ASSET` em
 * `brand.js`). Enquanto esse arquivo não existir — e ele não acompanha o
 * repositório — cai para um lockup tipográfico com a barra vermelha
 * institucional, que ocupa o lugar certo na hierarquia sem fingir ser o
 * logotipo.
 *
 * A queda é em tempo de execução, pelo `onError` do `<img>`: não há como
 * verificar a existência do arquivo em tempo de build sem acoplar o componente
 * ao empacotador, e um import direto quebraria o build inteiro quando o arquivo
 * faltasse. Assim, colocar o PNG na pasta é a única coisa necessária.
 *
 * PARA USAR O LOGOTIPO OFICIAL: salve o arquivo como `public/senai-logo.png`.
 * Nada mais precisa mudar.
 */
export default function Wordmark({ tone = 'inverted', showProduct = true, size = 'md' }) {
  const inverted = tone === 'inverted';
  const scale = size === 'lg' ? 1.35 : size === 'sm' ? 0.85 : 1;
  const [assetFailed, setAssetFailed] = useState(false);

  return (
    <Box
      sx={{ display: 'inline-flex', alignItems: 'center', gap: `${10 * scale}px`, minWidth: 0 }}
      // O leitor de tela recebe o nome inteiro de uma vez; sem isto ele lê
      // "SENAI hífen SP" e "Parceiros" como dois rótulos soltos.
      aria-label={BRAND_NAME.full}
      role="img"
    >
      {assetFailed ? (
        // Barra vermelha: o único uso do vermelho da marca no cabeçalho, o que
        // o mantém como acento e não como decoração repetida.
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
      ) : (
        <Box
          component="img"
          src={LOGO_ASSET}
          alt=""
          aria-hidden
          onError={() => setAssetFailed(true)}
          sx={{
            // O logotipo do SENAI é um bloco vermelho com o texto vazado em
            // branco: ele já se lê sobre fundo claro e sobre fundo escuro, e
            // por isso não precisa de variante por tom. A altura fixa é o que
            // o mantém alinhado com o nome do produto ao lado.
            height: `${26 * scale}px`,
            width: 'auto',
            display: 'block',
            flexShrink: 0,
          }}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: `${7 * scale}px`, minWidth: 0 }}>
        {/* Com o logotipo presente, "SENAI" já está na imagem: repetir a
            palavra ao lado dela seria dizer o nome duas vezes. Sobra o
            qualificador regional, que o logotipo nacional não carrega. */}
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
          {assetFailed ? BRAND_NAME.institution : BRAND_NAME.region}
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
