const COMMON_ACRONYMS = new Map([
  ['Serviço Nacional de Aprendizagem Industrial', 'SENAI'],
  ['Serviço Nacional de Aprendizagem Comercial', 'SENAC'],
  ['Serviço Social da Indústria', 'SESI'],
  ['Serviço Nacional de Aprendizagem Rural', 'SENAR'],
  ['Centro Estadual de Educação Tecnológica Paula Souza', 'CEETEPS'],
  ['Universidade Tecnológica Federal do Paraná', 'UTFPR'],
  ['Fundação de Apoio à Escola Técnica', 'FAETEC'],
  ['Centro de Integração Empresa-Escola', 'CIEE'],
]);

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function looksLikeAcronym(value) {
  return /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9.-]{1,14}$/.test(value);
}

export function formatInstitutionName(value) {
  const name = clean(value);
  if (!name) return '';

  const knownAcronym = COMMON_ACRONYMS.get(name);
  if (knownAcronym) return `${knownAcronym} (${name})`;

  const leading = name.match(/^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9.-]{1,14})\s*[—–-]\s*(.+)$/);
  if (leading && looksLikeAcronym(leading[1])) return `${leading[1]} (${clean(leading[2])})`;

  const trailing = name.match(/^(.+?)\s*\(([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9.-]{1,14})\)$/);
  if (trailing && looksLikeAcronym(trailing[2])) return `${trailing[2]} (${clean(trailing[1])})`;

  return name;
}
