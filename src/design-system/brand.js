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
 * (cronos-media.sesisenaisp.org.br/.../arq_81_221108_*.pdf) não é alcançável a
 * partir do ambiente onde este código foi escrito: a política de rede recusa a
 * conexão com o domínio. Os valores abaixo, portanto, NÃO foram transcritos do
 * manual — eles reconstroem a identidade institucional a partir do que o
 * próprio produto já havia fixado ("manter azul institucional e vermelho SENAI
 * como marca, com superfícies neutras mais claras", docs/PLANO-ONDAS-2-6.md) e
 * a organizam numa escala completa e acessível.
 *
 * COMO CONFERIR COM O MANUAL
 * --------------------------
 * Quem tiver o PDF em mãos deve trocar apenas as constantes marcadas com
 * `@manual` e rodar `npm test` — `brand.test.js` verifica contraste e
 * integridade da escala, e nenhuma outra parte do código conhece estes hex.
 */

/**
 * Azul institucional. @manual conferir contra a página de cores primárias.
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
  600: '#C8102E',
  500: '#DC2B45',
  400: '#E95F73',
  300: '#F2949F',
  200: '#F8C6CD',
  100: '#FCE4E7',
  50: '#FDF2F4',
});

/**
 * Neutros. Puxados levemente para o azul para não brigarem com a marca — um
 * cinza rigorosamente neutro ao lado do azul institucional parece esverdeado.
 */
export const NEUTRAL = Object.freeze({
  950: '#0A1622',
  900: '#132639',
  800: '#1E3850',
  700: '#3A5169',
  600: '#546C86',
  500: '#7288A0',
  400: '#9AACBF',
  300: '#C2CFDC',
  200: '#DBE4EC',
  100: '#EBF0F5',
  50: '#F5F8FB',
  0: '#FFFFFF',
});

/**
 * Cores de feedback, escolhidas para conviverem com o azul e o vermelho da
 * marca sem serem confundidas com eles.
 */
export const FEEDBACK = Object.freeze({
  success: '#0F6E4C',
  successSoft: '#E4F4ED',
  warning: '#8A5300',
  warningSoft: '#FCF0DC',
  danger: '#96122A',
  dangerSoft: '#FBE9EC',
  info: BLUE[700],
  infoSoft: BLUE[50],
});

/**
 * Tipografia. @manual o manual do SENAI-SP especifica a família institucional;
 * enquanto ela não estiver disponível como webfont neste projeto, a pilha
 * abaixo usa a fonte de sistema, que é rápida e legível em qualquer plataforma.
 *
 * `display` e `text` estão separados de propósito: quando a família do manual
 * entrar, ela normalmente se aplica só aos títulos.
 */
const SYSTEM_STACK = '"Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

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
  product: 'Parceiros',
  full: 'SENAI-SP Parceiros',
  tagline: 'Inteligência em educação profissional e parcerias',
  owner: 'Gerência de Educação',
});

/**
 * Caminho do logotipo oficial, servido da pasta `public/`.
 *
 * O arquivo NÃO acompanha o repositório. Enquanto ele faltar, `Wordmark`
 * detecta a ausência pelo `onError` do `<img>` e desenha o lockup tipográfico
 * de reserva — a interface não quebra, apenas fica sem a marca.
 *
 * PARA ATIVAR: salve o PNG (ou SVG, ajustando a extensão aqui) do logotipo
 * institucional em `public/senai-logo.png`. Nenhuma outra alteração é
 * necessária.
 *
 * Preferir SVG quando houver: o logotipo aparece em 26px de altura no
 * cabeçalho e em 35px na tela de acesso, e um PNG de baixa resolução fica
 * visivelmente serrilhado em tela retina.
 */
export const LOGO_ASSET = '/senai-logo.png';
