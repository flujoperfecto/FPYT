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

export function audienceLabel(subscribers = 0) {
  return subscribers === 1 ? '1 suscriptor' : `${subscribers} suscriptores`;
}

export function changeValueLabel(field, value) {
  if (field === 'status') return value === 'published' ? 'Publicado' : 'Borrador';
  if (field === 'accessMode') return value === 'public' ? 'Público, sin email' : 'Solicita email';
  if (!value) return 'sin definir';
  if (field === 'slug') return `«${value}»`;
  if (field === 'coverUrl') return value.startsWith('/images/') ? 'imagen predeterminada' : value.split('/').pop().split('?')[0];
  return value.length > 64 ? `${value.slice(0, 61)}…` : value;
}

// Cada consecuencia se redacta para 0, 1 y varios suscriptores. Una frase mal
// concordada en la pantalla que promete explicar el impacto la vuelve ruido.
export function changeImpact(change, { subscribers = 0, replacesManagedCover = false } = {}) {
  if (change.field === 'title') return 'El título nuevo reemplaza al anterior en la biblioteca, en el aula y en la pestaña del navegador.';

  if (change.field === 'slug') {
    const carriers = subscribers === 1
      ? ', incluido el suscriptor que ya la recibió'
      : subscribers ? `, incluidos los ${subscribers} suscriptores que ya la recibieron` : '';
    return `El enlace público cambia de dirección. La anterior seguirá funcionando: quien la abra será redirigido automáticamente${carriers}.`;
  }

  if (change.field === 'status') {
    if (change.to === 'published') return 'El tutorial aparecerá en la biblioteca pública y su enlace quedará abierto.';
    if (!subscribers) return 'Desaparecerá de la biblioteca y su enlace responderá “no encontrado” a cualquier visitante hasta que vuelvas a publicarlo.';
    const losing = subscribers === 1 ? 'el suscriptor que ya tiene acceso dejará' : `los ${subscribers} suscriptores que ya tienen acceso dejarán`;
    return `Desaparecerá de la biblioteca y ${losing} de abrir el aula hasta que vuelvas a publicarlo.`;
  }

  if (change.field === 'accessMode') {
    if (change.to === 'public') return 'Cualquiera abrirá los materiales sin dejar su correo: dejarás de capturar suscriptores nuevos en este tutorial.';
    const kept = subscribers === 1
      ? ' El suscriptor con acceso concedido lo conserva.'
      : subscribers ? ` Los ${subscribers} suscriptores con acceso concedido lo conservan.` : '';
    return `El enlace directo al aula pedirá correo antes de mostrar los materiales.${kept}`;
  }

  if (change.field === 'youtubeUrl') return 'Cambia el video del aula. Los momentos conservan sus marcas de tiempo y pueden quedar desalineados con el video nuevo: revísalos antes de publicar.';

  if (change.field === 'coverUrl') {
    return replacesManagedCover
      ? 'La portada nueva sustituye a la imagen que subiste, y esa imagen se eliminará de Storage.'
      : 'Cambia la imagen en la biblioteca y en la portada de la página de acceso.';
  }

  return 'Cambia el resumen visible en la biblioteca y en la página de acceso.';
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

// El hub, los materiales y YouTube hablan en mm:ss. El panel acepta lo mismo
// para no obligar al editor a convertir minutos a segundos a mano; un número
// suelto se sigue leyendo como segundos por compatibilidad con lo ya guardado.
export function formatTime(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function parseTimecode(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  const raw = String(value ?? '').trim();
  if (!raw || !/^\d+(:\d{1,2}){0,2}$/.test(raw)) return null;
  const parts = raw.split(':').map(Number);
  if (parts.length === 1) return parts[0];
  if (parts.slice(1).some(part => part > 59)) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
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
