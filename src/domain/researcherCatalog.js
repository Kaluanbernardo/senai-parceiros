function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scholarIdentity(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('scholar.google.')) return '';
    return parsed.searchParams.get('user') || '';
  } catch {
    return '';
  }
}

function orcidIdentity(value) {
  const match = String(value || '').match(/\d{4}-\d{4}-\d{4}-[\dX]{4}/i);
  return match ? match[0].toUpperCase() : '';
}

function profileIdentity(record) {
  const scholar = scholarIdentity(record.scholar);
  if (scholar) return `scholar:${scholar}`;
  const orcid = orcidIdentity(record.orcid || record.identificadores);
  if (orcid) return `orcid:${orcid}`;
  try {
    const parsed = new URL(record.scholar || record.profileUrl || record.url);
    if (!parsed.hostname) return '';
    return `profile:${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return '';
  }
}

function identityKey(record) {
  const profile = profileIdentity(record);
  if (profile) return profile;
  return `name:${fold(record.nome)}|institution:${fold(record.instituicao)}|country:${fold(record.pais)}`;
}

function isVerAbove(record) {
  return fold(record.instituicao) === 'ver acima';
}

function uniqueArticles(records) {
  const seen = new Set();
  return records.flatMap((record) => Array.isArray(record.artigos) ? record.artigos : []).filter((article) => {
    const key = String(article.url || article.titulo || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function longest(records, field) {
  return records.map((record) => record[field]).filter(Boolean).sort((a, b) => String(b).length - String(a).length)[0] || '';
}

function mergeAreas(records) {
  return [...new Set(records.flatMap((record) => Array.isArray(record.areas)
    ? record.areas
    : String(record.areas || '').split(';')).map((area) => area.trim()).filter(Boolean))];
}

function mergeGroup(records) {
  const ordered = [...records].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const first = ordered[0];
  const merged = { ...first };
  const articleKeysByRecord = ordered.map((record) => new Set((record.artigos || []).map((article) => String(article.url || article.titulo || '').trim().toLowerCase()).filter(Boolean)));
  const overlappingArticles = [...new Set(articleKeysByRecord.flatMap((keys) => [...keys]))]
    .filter((key) => articleKeysByRecord.filter((keys) => keys.has(key)).length > 1);
  for (const field of ['nome', 'instituicao', 'pais', 'areas', 'citacoes', 'scholar', 'profileType', 'genero']) {
    if (!merged[field]) merged[field] = ordered.find((record) => record[field])?.[field] || merged[field];
  }
  merged.pesquisa = longest(ordered, 'pesquisa') || merged.pesquisa || '';
  merged.miniBio = longest(ordered, 'miniBio') || merged.miniBio || '';
  merged.areas = mergeAreas(ordered);
  merged.artigos = uniqueArticles(ordered);
  merged.aliases = [...new Set(ordered.flatMap((record) => [record.nome, ...(record.aliases || [])]).filter(Boolean))];
  merged.legacyIds = ordered.map((record) => record.id).filter((id) => id !== merged.id);
  merged.catalogIdentity = identityKey(first);
  merged.mergeEvidence = {
    identity: merged.catalogIdentity,
    overlappingArticleCount: overlappingArticles.length,
    overlappingArticles,
  };
  merged.mergeConfidence = profileIdentity(first) ? 1 : (overlappingArticles.length ? 0.9 : 0.75);
  return merged;
}

export function canonicalizeResearchers(records = []) {
  const profileByName = new Map();
  const baseKeyByName = new Map();
  const articleOwnerByName = new Map();
  for (const record of records) {
    const name = fold(record?.nome);
    if (name && !isVerAbove(record) && !baseKeyByName.has(name)) {
      baseKeyByName.set(name, identityKey(record));
    }
    const profile = profileIdentity(record || {});
    if (!name || !profile) continue;
    const profiles = profileByName.get(name) || new Set();
    profiles.add(profile);
    profileByName.set(name, profiles);
    for (const article of record.artigos || []) {
      const articleKey = String(article.url || article.titulo || '').trim().toLowerCase();
      if (articleKey) articleOwnerByName.set(`${name}|${articleKey}`, profile);
    }
  }
  for (const record of records) {
    const name = fold(record?.nome);
    if (!name || profileIdentity(record || {})) continue;
    for (const article of record.artigos || []) {
      const articleKey = String(article.url || article.titulo || '').trim().toLowerCase();
      if (articleKey && !articleOwnerByName.has(`${name}|${articleKey}`)) {
        articleOwnerByName.set(`${name}|${articleKey}`, identityKey(record));
      }
    }
  }
  const groups = new Map();
  for (const record of records) {
    if (!record || !record.nome) continue;
    const name = fold(record.nome);
    const profile = profileIdentity(record);
    // “Ver acima” is a legacy duplicate marker in the source workbook. It
    // inherits the only known profile identity for that researcher.
    const knownProfiles = profileByName.get(name);
    const articleKeys = (record.artigos || []).map((article) => String(article.url || article.titulo || '').trim().toLowerCase()).filter(Boolean);
    const articleMatch = articleKeys.map((articleKey) => articleOwnerByName.get(`${name}|${articleKey}`)).find(Boolean);
    const key = isVerAbove(record) && knownProfiles?.size === 1
      ? [...knownProfiles][0]
      : isVerAbove(record) && baseKeyByName.has(name)
        ? baseKeyByName.get(name)
        : !profile && articleMatch
          ? articleMatch
      : identityKey(record);
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }
  const canonical = [...groups.values()].map(mergeGroup).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const aliases = canonical.flatMap((record) => record.legacyIds.map((legacyId) => ({
    legacyId,
    canonicalId: record.id,
    reason: record.catalogIdentity,
    confidence: record.mergeConfidence,
    evidence: record.mergeEvidence,
  })));
  return { records: canonical, aliases };
}

export function normalizeResearcherName(value) {
  return fold(value);
}

export function resolveResearcherId(records = [], id) {
  const rawId = String(id);
  const numericId = Number(id);
  return records.find((record) => String(record.id) === rawId || (record.legacyIds || []).some((legacyId) => String(legacyId) === rawId || legacyId === numericId)) || null;
}
