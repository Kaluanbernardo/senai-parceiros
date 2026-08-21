import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { getNavTools } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import PageContainer from '../design-system/primitives/PageContainer';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import { BRAND_NAME } from '../design-system/brand';
import { buildLegalEntityCatalog } from '../domain/legalEntityCatalog';
import { filterRadarItems } from '../domain/radar';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

/**
 * O que cada ferramenta tem dentro, quando isso é sabível sem sair da home.
 *
 * Um menu que só repete o próprio nome obriga a entrar para descobrir se vale
 * a visita. A ficha responde "tem algo aqui?" — é informação sobre o conteúdo,
 * não uma classificação de importância.
 */
function useToolMeta() {
  const { pesquisadores, stakeholders, escolas } = useData();
  const [radarCount, setRadarCount] = useState(null);

  const legalEntities = useMemo(
    () => buildLegalEntityCatalog({ schools: escolas || [], stakeholders: stakeholders || [] }),
    [escolas, stakeholders],
  );

  useEffect(() => {
    let alive = true;
    // Falhar aqui não pode custar a home: sem a contagem, o cartão do Radar
    // apenas volta a ser o que era.
    fetch('/api/radar/items', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!alive || !body) return;
        setRadarCount(filterRadarItems(body.items || [], { period: '30d' }).length);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  return {
    // Fichas curtas: o cartão tem uma coluna estreita, e uma frase inteira
    // dentro dela sai pela borda em vez de informar.
    catalog: `${(pesquisadores?.length || 0) + legalEntities.length} registros`,
    radar: radarCount === null
      ? undefined
      : radarCount === 0 ? 'nada em 30 dias' : `${radarCount} em 30 dias`,
  };
}

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
 * Uma grade só, cartões do mesmo tamanho e do mesmo peso.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = useToolMeta();
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

        <Grid container spacing={2} alignItems="stretch" sx={{ mt: 2.5 }}>
          {tools.map((tool) => (
            <Grid size={{ xs: 12, md: 6 }} key={tool.id}>
              <ToolCard
                icon={getToolIcon(tool.iconKey)}
                label={tool.label}
                // Todos os cartões descrevem o que a ferramenta faz e, quando
                // dá para saber, trazem uma ficha com o que há dentro. Trocar a
                // descrição de um deles pela contagem repetiria a ficha e daria
                // àquele cartão um texto diferente dos demais.
                description={tool.description}
                themeKey={tool.themeKey}
                actionLabel={tool.actionLabel}
                meta={meta[tool.id]}
                onClick={() => navigate(tool.route)}
              />
            </Grid>
          ))}
        </Grid>

        <Typography variant="body2" sx={{ mt: 4, color: T.ink.subtle, maxWidth: T.layout.prose }}>
          As informações vêm de fontes públicas. Abra um perfil para conhecer o trabalho e acessar a fonte original.
        </Typography>
      </PageContainer>
    </>
  );
}
