// Funciones puras del dominio tutorial. Viven separadas del cliente Supabase
// para poder probar normalización, enlaces y validación sin un navegador.
export const TUTORIAL_CHANGE_FIELDS = [
  { field: 'title', label: 'Título' },
  { field: 'slug', label: 'URL pública' },
  { field: 'status', label: 'Estado' },
  { field: 'accessMode', label: 'Acceso' },
  { field: 'youtubeUrl', label: 'URL de YouTube' },
  { field: 'coverUrl', label: 'Portada' },
  { field: 'description', label: 'Descripción' },
];

export function slugify(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function describeTutorialChanges(before, after) {
  if (!before || !after) return [];
  return TUTORIAL_CHANGE_FIELDS
    .filter(item => String(before[item.field] ?? '') !== String(after[item.field] ?? ''))
    .map(item => ({ ...item, from: String(before[item.field] ?? ''), to: String(after[item.field] ?? '') }));
}

export function tutorialPublicPath(tutorial) {
  const slug = slugify(tutorial?.slug || '');
  if (!slug) return '/';
  return tutorial.accessMode === 'public' ? `/hub/${slug}` : `/acceso/${slug}`;
}

export function tutorialAccessPayload(body = {}) {
  return {
    tutorialId: body.tutorialId,
    slug: body.slug,
    name: body.name,
    email: body.email,
    consent: body.consent,
    website: body.website,
  };
}

export function youtubeId(url = '') {
  let parsed;
  try { parsed = new URL(String(url).trim()); }
  catch { return ''; }
  if (parsed.protocol !== 'https:') return '';

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  let id = '';
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/').filter(Boolean)[0] || '';
  } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v') || '';
    else id = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}
