/**
 * Estado da última coleta, em uma frase.
 *
 * Um radar vive de uma pergunta: isto está atualizado? A resposta já vinha do
 * servidor em toda leitura — data da coleta, quantidade de itens e situação de
 * cada fonte — e só aparecia na interface depois de um administrador clicar em
 * "Coletar agora", dentro de um alerta, num bloco de JSON cru. Quem apenas lê o
 * Radar nunca via a data. Este módulo transforma o mesmo dado em algo que cabe
 * numa barra acima da lista.
 */

export function formatCollectedAt(value, now = new Date()) {
  if (!value) return 'sem coleta registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem coleta registrada';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 0) return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  if (minutes < 2) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return date.toLocaleDateString('pt-BR', { dateStyle: 'medium' });
}

/**
 * Uma fonte só conta como produtiva quando respondeu **e** trouxe item. Contar
 * apenas `status === 'ok'` deixava de fora os coletores que reportam o
 * vocabulário do próprio provedor, e uma coleta podia parecer saudável sem ter
 * trazido nada.
 */
function isProductive(entry) {
  return entry?.status === 'ok' && Number(entry?.count) > 0;
}

export function describeRadarSnapshot(meta, { now = new Date() } = {}) {
  const lastRun = meta?.lastRun || null;
  const sources = Object.values(meta?.sourceStatus || lastRun?.sourceStatus || {});
  const productive = sources.filter(isProductive);
  const failures = sources.filter((entry) => !isProductive(entry)).map((entry) => ({
    name: entry?.name || 'Fonte não identificada',
    reason: entry?.error || (Array.isArray(entry?.errors) && entry.errors[0]) || entry?.status || 'sem itens',
    httpStatus: entry?.httpStatus ?? null,
  }));

  const collectedAt = meta?.fetchedAt || lastRun?.fetchedAt || null;
  const itemCount = Number.isFinite(Number(lastRun?.itemCount)) ? Number(lastRun.itemCount) : null;
  const never = !collectedAt && !sources.length;

  return {
    never,
    collectedAt,
    collectedAtLabel: formatCollectedAt(collectedAt, now),
    itemCount,
    sourcesOk: productive.length,
    sourcesTotal: sources.length,
    failures,
    stale: Boolean(meta?.stale),
    // Memória significa que o snapshot morre na próxima requisição: é um
    // problema de configuração, não uma falha de coleta, e precisa ser dito
    // com outras palavras.
    volatile: (meta?.store?.driver || '') === 'memory',
    severity: never || meta?.stale ? 'warning' : failures.length ? 'info' : 'success',
  };
}

/**
 * Termos que levam do item do Radar para quem trabalha com aquele assunto.
 *
 * É o elo que faltava entre as duas metades do produto: o Radar diz o que
 * mudou e o catálogo diz com quem falar, e as duas conviviam sem se tocar.
 */
export function radarCatalogQuery(item) {
  const topics = Array.isArray(item?.topics) ? item.topics.filter(Boolean) : [];
  if (topics.length) return topics.slice(0, 2).join(' ');
  return '';
}
