import React from 'react';

const countryToISO = {
  'Brasil': 'br',
  'EUA': 'us',
  'Alemanha': 'de',
  'Franca': 'fr',
  'França': 'fr',
  'Reino Unido': 'gb',
  'Japao': 'jp',
  'Japão': 'jp',
  'Coreia do Sul': 'kr',
  'China': 'cn',
  'India': 'in',
  'Índia': 'in',
  'Australia': 'au',
  'Austrália': 'au',
  'Canada': 'ca',
  'Canadá': 'ca',
  'Italia': 'it',
  'Itália': 'it',
  'Singapura': 'sg',
  'Holanda': 'nl',
  'Paises Baixos': 'nl',
  'Países Baixos': 'nl',
  'Suica': 'ch',
  'Suíça': 'ch',
  'Mexico': 'mx',
  'México': 'mx',
  'Colombia': 'co',
  'Colômbia': 'co',
  'Argentina': 'ar',
  'Chile': 'cl',
  'Peru': 'pe',
  'Uruguai': 'uy',
  'Indonesia': 'id',
  'Indonésia': 'id',
  'Turquia': 'tr',
  'Grecia': 'gr',
  'Grécia': 'gr',
  'Espanha': 'es',
  'Finlandia': 'fi',
  'Finlândia': 'fi',
  'Dinamarca': 'dk',
  'Austria': 'at',
  'Áustria': 'at',
  'Africa do Sul': 'za',
  'África do Sul': 'za',
  'Arabia Saudita': 'sa',
  'Arábia Saudita': 'sa',
  'Russia': 'ru',
  'Rússia': 'ru',
  'Venezuela': 've',
  'Equador': 'ec',
  'Bolivia': 'bo',
  'Bolívia': 'bo',
  'Paraguai': 'py',
  'Costa Rica': 'cr',
  'Panama': 'pa',
  'Panamá': 'pa',
  'Guatemala': 'gt',
  'Honduras': 'hn',
  'El Salvador': 'sv',
  'Nicaragua': 'ni',
  'Nicarágua': 'ni',
  'Rep. Dominicana': 'do',
  'Cuba': 'cu',
  'Haiti': 'ht',
  'Jamaica': 'jm',
  'Trinidad e Tobago': 'tt',
  'Barbados': 'bb',
  'Bahamas': 'bs',
  'Guiana': 'gy',
  'Belize': 'bz',
  'Malasia': 'my',
  'Malásia': 'my',
  'Hong Kong': 'hk',
  'Hong Kong/China': 'hk',
  'Brunei': 'bn',
  'Brunei (Regional)': 'bn',
  // International/multi-country
  'Internacional': null,
  'Uniao Africana': null,
  'União Africana': null,
  'Uniao Europeia': 'eu',
  'União Europeia': 'eu',
  'Bruxelas (Comissao Europeia)': 'eu',
  'Bruxelas (Comissão Europeia)': 'eu',
  'Global (Franca)': 'fr',
  'Global (França)': 'fr',
  'Global (Suica)': 'ch',
  'Global (Suíça)': 'ch',
};

export function getCountryCode(pais) {
  if (!pais) return null;
  return countryToISO[pais] || null;
}

export function CountryFlag({ pais, size = 16, style = {} }) {
  const code = getCountryCode(pais);
  if (!code) {
    return <span style={{ fontSize: size, ...style }}>🌍</span>;
  }
  return (
    <span
      className={`fi fi-${code}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
}

export default countryToISO;
