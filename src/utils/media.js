/**
 * Google S2 favicons were used as a historical placeholder for many catalog
 * records. They are not institutional media and frequently return 404s.
 * Keep real, explicitly supplied logos available while avoiding that noisy
 * dependency; cards render their typographic fallback instead.
 */
export function getDisplayLogoUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.hostname === 'google.com' || url.hostname.endsWith('.google.com')) {
      if (url.pathname.startsWith('/s2/favicons')) return '';
    }
    return url.href;
  } catch {
    return '';
  }
}
