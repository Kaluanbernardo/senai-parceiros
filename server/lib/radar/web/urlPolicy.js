const DEFAULT_OFFICIAL_DOMAINS = Object.freeze([
  'in.gov.br',
  'gov.br',
  'sp.gov.br',
  'unesco.org',
  'ilo.org',
  'oecd.org',
  'worldbank.org',
  'iadb.org',
]);

export const OFFICIAL_DOMAINS = DEFAULT_OFFICIAL_DOMAINS;

export function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function normalizeDomain(value) {
  const source = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  return normalizeHostname(source.split(':')[0]);
}

export function hostnameMatchesDomain(hostname, domain) {
  const host = normalizeHostname(hostname);
  const allowed = normalizeDomain(domain);
  return Boolean(host && allowed && (host === allowed || host.endsWith(`.${allowed}`)));
}

export function isAllowedOfficialHostname(hostname, domains = DEFAULT_OFFICIAL_DOMAINS) {
  const candidates = Array.isArray(domains) && domains.length ? domains : DEFAULT_OFFICIAL_DOMAINS;
  return candidates.some((domain) => hostnameMatchesDomain(hostname, domain));
}

export function normalizeHttpsUrl(value, { domains = DEFAULT_OFFICIAL_DOMAINS, allowQuery = true } = {}) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!isAllowedOfficialHostname(url.hostname, domains)) return null;
    if (!allowQuery) url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function validateOfficialUrl(value, options = {}) {
  const url = normalizeHttpsUrl(value, options);
  if (!url) return { ok: false, url: '', reason: 'url_not_allowed' };
  return { ok: true, url, hostname: normalizeHostname(new URL(url).hostname), reason: '' };
}

export function assertOfficialUrl(value, options = {}) {
  const result = validateOfficialUrl(value, options);
  if (!result.ok) {
    const error = new Error(result.reason);
    error.code = result.reason;
    throw error;
  }
  return result.url;
}

export function isDouUrl(value, { article = false } = {}) {
  const url = normalizeHttpsUrl(value, { domains: ['in.gov.br'] });
  if (!url) return false;
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();
  if (path.includes('leiturajornal')) return true;
  if (article && (path.includes('/web/dou/') || path.includes('/web/guest/dou/'))) return true;
  return false;
}

export function formatBrazilDate(value) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return null;
  // Date-only values must not move a day because of the machine timezone.
  const iso = String(value || '').match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.day}-${map.month}-${map.year}`;
}

export function isoDate(value) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function dateRange(startDate, endDate, { maxDays = 7 } = {}) {
  const brazilDate = (value) => {
    const text = String(value || '');
    if (/^20\d{2}-\d{2}-\d{2}$/.test(text)) return text;
    const date = value instanceof Date ? value : new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  };
  const start = brazilDate(startDate);
  const end = brazilDate(endDate || startDate);
  if (!start || !end) return [];
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (to < from) return [];
  const values = [];
  for (let cursor = from; cursor <= to && values.length < maxDays; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    values.push(cursor.toISOString().slice(0, 10));
  }
  return values;
}

export function buildDouEditionUrls({ startDate, endDate, sections = ['DO1', 'DO3'], baseUrl = 'https://www.in.gov.br/leiturajornal', maxDays = 3 } = {}) {
  const safeSections = (Array.isArray(sections) ? sections : [sections])
    .map((section) => String(section || '').trim().toUpperCase())
    .filter((section) => ['DO1', 'DO3'].includes(section));
  const dates = dateRange(startDate || new Date(), endDate || startDate || new Date(), { maxDays });
  const normalizedBase = normalizeHttpsUrl(baseUrl, { domains: ['in.gov.br'] });
  if (!normalizedBase) return [];
  return dates.flatMap((date) => safeSections.map((section) => {
    const params = new URLSearchParams({ data: formatBrazilDate(date), secao: section });
    return `${normalizedBase}?${params.toString()}`;
  }));
}
