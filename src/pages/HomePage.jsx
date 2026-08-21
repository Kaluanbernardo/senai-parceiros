import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { getNavTools } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import PageContainer from '../design-system/primitives/PageContainer';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import { BRAND_NAME } from '../design-system/brand';
import { useAuth } from '../context/AuthContext';

/**
 * Entrada do produto.
 *
 * As ferramentas são alternativas, não etapas: quem abre a home já sabe o que
 * veio fazer, e ordená-las por suposta importância — uma ação em destaque,
 * outras como atalhos secundários — inventa uma sequência que não existe e
 * empurra para baixo justamente quem entrou para usar a última da fila.
 *
 * Elas também não se separam por permissão. Quem não é administrador nunca vê
 * as ferramentas restritas — o registro já filtra por papel —, e rotular um
 * bloco como "só para administradores" para quem *é* administrador só diz o
 * que aquela pessoa já sabe, ao custo de partir a grade em duas.
 *
 * Daí a fileira única. Uma grade de duas colunas põe as ferramentas em ordem
 * de leitura — primeira linha, segunda linha — e deixa a última sozinha num
 * degrau final, o que sugere de novo uma sequência e um resto. Lado a lado,
 * todas na mesma altura e na mesma largura, nenhuma vem antes de outra.
 *
 * As colunas são contadas a partir das ferramentas visíveis, não fixadas em
 * cinco: quem não é administrador vê quatro, e uma sexta coluna vazia deixaria
 * exatamente o buraco que a fileira existe para evitar.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tools = getNavTools(user?.role);

  return (
    <>
      <Box sx={{ bgcolor: T.surface.inverted, color: T.ink.onInverted }}>
        <Box sx={{ maxWidth: T.layout.wide, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
          <Typography variant="overline" sx={{ color: T.ink.onInvertedMuted }}>
            {BRAND_NAME.product}
          </Typography>
          <Typography
            component="h1"
            sx={{
              maxWidth: 920,
              fontFamily: T.fontFamily.display,
              fontSize: T.fontSize.h1,
              fontWeight: 800,
              letterSpacing: '-.03em',
              lineHeight: 1.05,
            }}
          >
            Encontre as conexões certas para cada iniciativa
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: T.layout.prose, color: T.ink.onInvertedMuted }}>
            Encontre pessoas e instituições, pesquise referências ou acompanhe novidades da educação profissional.
          </Typography>
        </Box>
      </Box>

      <PageContainer width="wide">
        <Typography variant="h2">O que você quer fazer?</Typography>

        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gap: 2,
            alignItems: 'stretch',
            // Empilhado onde uma fileira não caberia. Uma coluna só também não
            // tem órfão — cada linha tem exatamente um bloco.
            gridTemplateColumns: { xs: '1fr', lg: `repeat(${tools.length}, minmax(0, 1fr))` },
          }}
        >
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              icon={getToolIcon(tool.iconKey)}
              label={tool.label}
              // Todos os cartões descrevem o que a ferramenta faz e, quando dá
              // para saber, trazem uma ficha com o que há dentro. Trocar a
              // descrição de um deles pela contagem repetiria a ficha e daria
              // àquele cartão um texto diferente dos demais.
              description={tool.description}
              themeKey={tool.themeKey}
              actionLabel={tool.actionLabel}
              onClick={() => navigate(tool.route)}
            />
          ))}
        </Box>

        <Typography variant="body2" sx={{ mt: 4, color: T.ink.subtle, maxWidth: T.layout.prose }}>
          As informações vêm de fontes públicas. Abra um perfil para conhecer o trabalho e acessar a fonte original.
        </Typography>
      </PageContainer>
    </>
  );
}
