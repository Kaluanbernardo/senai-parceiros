/**
 * Camada de marca do SENAI-SP.
 *
 * Este é o único arquivo do produto que carrega valores literais da identidade
 * visual. Todo o resto — tokens, tema, componentes — deriva daqui, de modo que
 * substituir a paleta ou a família tipográfica é uma edição em um lugar só.
 *
 * PROCEDÊNCIA DOS VALORES
 * -----------------------
 * O manual de identidade indicado para esta implementação
 * (cronos-media.sesisenaisp.org.br/.../arq_81_221108_*.pdf) define o vermelho
 * SENAI como cor primária, com branco, preto e cinza como base. A escala abaixo
 * preserva esse núcleo e cria apenas os tons de interface necessários para
 * estados, foco e leitura na web.
 *
 * COMO CONFERIR COM O MANUAL
 * --------------------------
 * Quem tiver o PDF em mãos deve trocar apenas as constantes marcadas com
 * `@manual` e rodar `npm test` — `brand.test.js` verifica contraste e
 * integridade da escala, e nenhuma outra parte do código conhece estes hex.
 */

/**
 * Azul de apoio. Não é uma cor de ação: mantém uma temperatura discreta nos
 * neutros técnicos sem competir com o vermelho institucional.
 *
 * A escala vai do 900 (superfícies escuras, rodapé, cabeçalho) ao 50 (fundos de
 * destaque). O 700 é o tom de ação: é ele que aparece em botões, links e ícones
 * ativos, e é o único que precisa passar em contraste sobre branco.
 */
export const BLUE = Object.freeze({
  900: '#052440',
  800: '#08324F',
  700: '#0B4570',
  600: '#0F5C93',
  500: '#1573B5',
  400: '#3E92CE',
  300: '#7FB6DF',
  200: '#B7D6EE',
  100: '#DCEAF7',
  50: '#EFF6FC',
});

/**
 * Vermelho SENAI. @manual conferir contra a página de cores primárias.
 *
 * Usado como acento institucional — nunca como cor de superfície larga e nunca
 * como sinal de erro. O vermelho da marca e o vermelho de "algo deu errado"
 * precisam ser distinguíveis, por isso o feedback de erro usa `FEEDBACK.danger`,
 * que é deliberadamente mais escuro e menos saturado.
 */
export const RED = Object.freeze({
  900: '#6E0715',
  800: '#8E0C1E',
  700: '#B01228',
  600: '#E30613',
  500: '#DC2B45',
  400: '#E95F73',
  300: '#F2949F',
  200: '#F8C6CD',
  100: '#FCE4E7',
  50: '#FDF2F4',
});

export const GREEN = Object.freeze({
  800: '#07533A',
  700: '#0F6E4C',
});

export const AMBER = Object.freeze({
  800: '#603800',
  700: '#8A5300',
});

/**
 * Neutros. Puxados levemente para o azul para não brigarem com a marca — um
 * cinza rigorosamente neutro ao lado do azul institucional parece esverdeado.
 */
export const NEUTRAL = Object.freeze({
  950: '#111214',
  900: '#1C1E21',
  800: '#2C2F33',
  700: '#45494F',
  600: '#5E636B',
  500: '#777D86',
  400: '#9A9FA7',
  300: '#C4C7CC',
  200: '#DADCE0',
  100: '#ECEDEF',
  50: '#F5F5F6',
  0: '#FFFFFF',
});

/**
 * Cores de feedback, escolhidas para conviverem com o azul e o vermelho da
 * marca sem serem confundidas com eles.
 */
export const FEEDBACK = Object.freeze({
  success: GREEN[700],
  successSoft: '#E4F4ED',
  warning: AMBER[700],
  warningSoft: '#FCF0DC',
  danger: '#96122A',
  dangerSoft: '#FBE9EC',
  info: BLUE[700],
  infoSoft: BLUE[50],
});

/**
 * Tipografia. Montserrat é a família indicada pelo manual e é servida localmente
 * pelo pacote do projeto, evitando dependência de uma fonte remota no primeiro
 * carregamento.
 */
const SYSTEM_STACK = '"Montserrat", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif';

export const TYPE = Object.freeze({
  display: SYSTEM_STACK,
  text: SYSTEM_STACK,
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
});

/**
 * Identidade verbal fixada em um lugar só, para o nome do produto não divergir
 * entre cabeçalho, título da aba, rodapé e tela de acesso.
 */
export const BRAND_NAME = Object.freeze({
  institution: 'SENAI-SP',
  /** Usado ao lado do logotipo, que já traz "SENAI" desenhado. */
  region: 'São Paulo',
  product: 'Farol de Parcerias',
  full: 'SENAI-SP Farol de Parcerias',
  tagline: 'Conexões para transformar ideias em ação',
});

/**
 * Caminho do logotipo oficial, servido da pasta `public/`.
 *
 * O SVG oficial fica no repositório. `Wordmark` mantém um fallback tipográfico
 * caso o arquivo deixe de carregar, sem bloquear a navegação.
 */
export const LOGO_ASSET = '/senai-logo.svg';
