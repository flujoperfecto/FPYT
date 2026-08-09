import { requireSupabase } from './supabase.js';

const tutorialFields = 'id,title,slug,description,youtube_url,cover_url,cover_storage_path,status,access_mode,chapter_count,resource_count,created_at,updated_at';
const chapterFields = 'id,tutorial_id,position,title,start_seconds,description,created_at,updated_at';
const resourceFields = 'id,chapter_id,position,type,title,description,content,url,storage_path,original_name,created_at,updated_at';
const newsItemFields = 'id,edition_id,position,category,headline,summary,why_it_matters,primary_source_name,primary_source_url,source_published_at,sources';

export const RESOURCE_LABELS = { prompt: 'Prompt', instruction: 'Instrucción', skill: 'Skill', link: 'Enlace', file: 'Archivo' };

function requestError(message, status = 400, data = {}) {
  const error = new Error(message || 'No se pudo completar la solicitud.');
  error.status = status;
  error.data = data;
  return error;
}

// GoTrue devuelve el error crudo de Cloudflare o del proveedor. Traducirlo aquí
// evita perder una tarde averiguando que solo faltaba emparejar dos llaves.
function authErrorMessage(message = '') {
  const raw = message.toLowerCase();
  if (raw.includes('invalid-input-response') || raw.includes('invalid-input-secret')) {
    return 'La verificación de seguridad no coincide: la site key de Turnstile del sitio y el secreto guardado en Supabase pertenecen a widgets distintos. Revisa Authentication → Attack Protection → CAPTCHA protection.';
  }
  if (raw.includes('timeout-or-duplicate')) return 'La verificación de seguridad caducó. Recarga la página e inténtalo otra vez.';
  if (raw.includes('anonymous sign-ins are disabled')) {
    return 'El acceso por email necesita las sesiones anónimas activadas en Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).';
  }
  if (raw.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  return message;
}

function throwIfError(error) {
  if (!error) return;
  const status = Number(error.status || (error.code === 'PGRST116' ? 404 : 400));
  throw requestError(error.message, status, { code: error.code, details: error.details });
}

function tutorialSummary(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    youtubeUrl: row.youtube_url,
    coverUrl: row.cover_url,
    coverStoragePath: row.cover_storage_path || '',
    status: row.status,
    accessMode: row.access_mode,
    chapters: row.chapter_count,
    resources: row.resource_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResource(row) {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    position: row.position,
    type: row.type,
    title: row.title,
    description: row.description,
    content: row.content,
    url: row.url,
    storagePath: row.storage_path,
    originalName: row.original_name,
  };
}

function mapChapter(row, resourceRows = []) {
  return {
    id: row.id,
    tutorialId: row.tutorial_id,
    position: row.position,
    title: row.title,
    startSeconds: row.start_seconds,
    description: row.description,
    resources: resourceRows.filter(item => item.chapter_id === row.id).sort((a, b) => a.position - b.position).map(mapResource),
  };
}

function mapTutorial(row, chapterRows = [], resourceRows = []) {
  return {
    ...tutorialSummary(row),
    chapters: chapterRows.filter(item => item.tutorial_id === row.id).sort((a, b) => a.position - b.position).map(item => mapChapter(item, resourceRows)),
  };
}

function mapNewsItem(row) {
  return {
    id: row.id,
    position: row.position,
    category: row.category,
    headline: row.headline,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    primarySource: {
      name: row.primary_source_name,
      url: row.primary_source_url,
      publishedAt: row.source_published_at,
    },
    sources: Array.isArray(row.sources) ? row.sources.map(source => ({
      name: String(source.name || row.primary_source_name),
      url: String(source.url || row.primary_source_url),
      title: String(source.title || row.headline),
      publishedAt: String(source.published_at || row.source_published_at),
    })) : [],
  };
}

async function latestAiNews() {
  const client = requireSupabase();
  const { data: edition, error: editionError } = await client
    .from('ai_news_editions')
    .select('id,edition_date,published_at,model,candidate_count')
    .not('published_at', 'is', null)
    .order('edition_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(editionError);
  if (!edition) return null;

  const { data: items, error: itemError } = await client
    .from('ai_news_items')
    .select(newsItemFields)
    .eq('edition_id', edition.id)
    .order('position');
  throwIfError(itemError);
  if (items.length !== 4) return null;
  return {
    id: edition.id,
    editionDate: edition.edition_date,
    publishedAt: edition.published_at,
    model: edition.model,
    candidateCount: edition.candidate_count,
    items: items.map(mapNewsItem),
  };
}

async function publishedTutorials() {
  const client = requireSupabase();
  const { data, error } = await client.from('tutorials').select(tutorialFields).eq('status', 'published').order('updated_at', { ascending: false });
  throwIfError(error);
  return data.map(tutorialSummary);
}

async function tutorialBySlug(slug) {
  const client = requireSupabase();
  const { data, error } = await client.from('tutorials').select(tutorialFields).eq('slug', slug).eq('status', 'published').maybeSingle();
  throwIfError(error);
  if (!data) throw requestError('Tutorial no encontrado.', 404);
  return tutorialSummary(data);
}

async function hubTutorial(slug) {
  const client = requireSupabase();
  const { data: tutorialRow, error: tutorialError } = await client.from('tutorials').select(tutorialFields).eq('slug', slug).eq('status', 'published').maybeSingle();
  throwIfError(tutorialError);
  if (!tutorialRow) throw requestError('Tutorial no encontrado.', 404);

  const { data: chapterRows, error: chapterError } = await client.from('chapters').select(chapterFields).eq('tutorial_id', tutorialRow.id).order('position');
  throwIfError(chapterError);

  if (tutorialRow.access_mode === 'email' && tutorialRow.chapter_count > 0 && chapterRows.length === 0) {
    const redirect = `/acceso/${tutorialRow.slug}`;
    throw requestError('Completa el acceso para ver los materiales.', 401, { redirect });
  }

  let resourceRows = [];
  if (chapterRows.length) {
    const result = await client.from('resources').select(resourceFields).in('chapter_id', chapterRows.map(item => item.id)).order('position');
    throwIfError(result.error);
    resourceRows = result.data;
  }
  return mapTutorial(tutorialRow, chapterRows, resourceRows);
}

async function adminPreviewTutorial(slug) {
  const client = requireSupabase();
  const { data: tutorialRow, error: tutorialError } = await client.from('tutorials').select(tutorialFields).eq('slug', slug).maybeSingle();
  throwIfError(tutorialError);
  if (!tutorialRow) throw requestError('Tutorial no encontrado.', 404);

  const { data: chapterRows, error: chapterError } = await client.from('chapters').select(chapterFields).eq('tutorial_id', tutorialRow.id).order('position');
  throwIfError(chapterError);
  let resourceRows = [];
  if (chapterRows.length) {
    const result = await client.from('resources').select(resourceFields).in('chapter_id', chapterRows.map(item => item.id)).order('position');
    throwIfError(result.error);
    resourceRows = result.data;
  }
  return mapTutorial(tutorialRow, chapterRows, resourceRows);
}

async function isAdmin() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwIfError(sessionError);
  if (!sessionData.session || sessionData.session.user.is_anonymous) return false;
  const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', sessionData.session.user.id).maybeSingle();
  throwIfError(error);
  return Boolean(data);
}

async function adminHierarchy() {
  const client = requireSupabase();
  const { data: tutorialRows, error: tutorialError } = await client.from('tutorials').select(tutorialFields).order('updated_at', { ascending: false });
  throwIfError(tutorialError);
  if (!tutorialRows.length) return [];

  const { data: chapterRows, error: chapterError } = await client.from('chapters').select(chapterFields).in('tutorial_id', tutorialRows.map(item => item.id)).order('position');
  throwIfError(chapterError);
  let resourceRows = [];
  if (chapterRows.length) {
    const result = await client.from('resources').select(resourceFields).in('chapter_id', chapterRows.map(item => item.id)).order('position');
    throwIfError(result.error);
    resourceRows = result.data;
  }
  return tutorialRows.map(row => mapTutorial(row, chapterRows, resourceRows));
}

async function adminOverview() {
  const client = requireSupabase();
  const [videoResult, publishedResult, leadResult] = await Promise.all([
    client.from('tutorials').select('id', { count: 'exact', head: true }),
    client.from('tutorials').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    client.from('leads').select('id,name,email,created_at,tutorial_id,tutorials(title)', { count: 'exact' }).order('created_at', { ascending: false }).limit(8),
  ]);
  throwIfError(videoResult.error); throwIfError(publishedResult.error); throwIfError(leadResult.error);
  return {
    videos: videoResult.count || 0,
    published: publishedResult.count || 0,
    leads: leadResult.count || 0,
    recentLeads: leadResult.data.map(item => ({
      id: item.id,
      name: item.name,
      email: item.email,
      createdAt: item.created_at,
      tutorialId: item.tutorial_id,
      videoTitle: item.tutorials?.title || 'Tutorial',
    })),
  };
}

function slugify(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function availableSlug(client, value, excludeId = '') {
  const base = slugify(value) || `tutorial-${Date.now().toString().slice(-6)}`;
  let query = client.from('tutorials').select('id').eq('slug', base);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  throwIfError(error);
  return data ? `${base}-${Date.now().toString().slice(-5)}` : base;
}

async function createTutorial(body) {
  const client = requireSupabase();
  const title = String(body.title || '').trim();
  if (!title) throw requestError('El título es obligatorio.');
  const slug = await availableSlug(client, body.slug || title);
  const { data, error } = await client.from('tutorials').insert({ title, slug }).select(tutorialFields).single();
  throwIfError(error);
  return mapTutorial(data);
}

async function updateTutorial(videoId, body) {
  const client = requireSupabase();
  const slug = slugify(body.slug);
  if (!slug) throw requestError('La URL pública no puede quedar vacía.');
  const title = String(body.title || '').trim();
  if (!title) throw requestError('El título es obligatorio.');
  const payload = {
    title,
    slug,
    description: String(body.description || '').trim(),
    youtube_url: String(body.youtubeUrl || '').trim(),
    cover_url: String(body.coverUrl || '').trim(),
    status: body.status,
    access_mode: body.accessMode,
  };
  const { data, error } = await client.from('tutorials').update(payload).eq('id', videoId).select(tutorialFields).single();
  throwIfError(error);
  return mapTutorial(data);
}

async function nextPosition(table, parentKey, parentId) {
  const client = requireSupabase();
  const { data, error } = await client.from(table).select('position').eq(parentKey, parentId).order('position', { ascending: false }).limit(1).maybeSingle();
  throwIfError(error);
  return (data?.position ?? -1) + 1;
}

async function createChapter(videoId, body) {
  const client = requireSupabase();
  const position = await nextPosition('chapters', 'tutorial_id', videoId);
  const { data, error } = await client.from('chapters').insert({
    tutorial_id: videoId,
    position,
    title: String(body.title || 'Nuevo momento').trim(),
    start_seconds: Math.max(0, Number(body.startSeconds || 0)),
    description: String(body.description || '').trim(),
  }).select(chapterFields).single();
  throwIfError(error);
  return mapChapter(data);
}

async function updateChapter(chapterId, body) {
  const client = requireSupabase();
  const { data, error } = await client.from('chapters').update({
    title: String(body.title || '').trim(),
    start_seconds: Math.max(0, Number(body.startSeconds || 0)),
    description: String(body.description || '').trim(),
  }).eq('id', chapterId).select(chapterFields).single();
  throwIfError(error);
  return mapChapter(data);
}

export function safeFileName(value = 'archivo') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
}

async function cloneResource(client, source, videoId, chapterId, position, copiedPaths) {
  const id = crypto.randomUUID();
  let storagePath = '';
  if (source.storagePath) {
    storagePath = `${videoId}/${chapterId}/${id}/${safeFileName(source.originalName || 'archivo')}`;
    const { error: copyError } = await client.storage.from('tutorial-materials').copy(source.storagePath, storagePath);
    throwIfError(copyError);
    copiedPaths.push(storagePath);
  }
  const { data, error } = await client.from('resources').insert({
    id,
    chapter_id: chapterId,
    position,
    type: source.type,
    title: source.title,
    description: source.description || '',
    content: source.content || '',
    url: source.url || '',
    storage_path: storagePath,
    original_name: source.originalName || '',
  }).select(resourceFields).single();
  throwIfError(error);
  return mapResource(data);
}

async function duplicateChapter(videoId, chapterId) {
  const client = requireSupabase();
  const { data: chapterRow, error: chapterError } = await client.from('chapters').select(chapterFields).eq('id', chapterId).eq('tutorial_id', videoId).single();
  throwIfError(chapterError);
  const { data: resourceRows, error: resourceError } = await client.from('resources').select(resourceFields).eq('chapter_id', chapterId).order('position');
  throwIfError(resourceError);

  const newChapterId = crypto.randomUUID();
  const position = await nextPosition('chapters', 'tutorial_id', videoId);
  const copiedPaths = [];
  try {
    const { error } = await client.from('chapters').insert({
      id: newChapterId,
      tutorial_id: videoId,
      position,
      title: `${chapterRow.title} — copia`,
      start_seconds: chapterRow.start_seconds,
      description: chapterRow.description,
    });
    throwIfError(error);
    for (const [index, resourceRow] of resourceRows.entries()) {
      await cloneResource(client, mapResource(resourceRow), videoId, newChapterId, index, copiedPaths);
    }
    const { data, error: readError } = await client.from('chapters').select(chapterFields).eq('id', newChapterId).single();
    throwIfError(readError);
    return mapChapter(data);
  } catch (error) {
    await client.from('chapters').delete().eq('id', newChapterId);
    if (copiedPaths.length) await client.storage.from('tutorial-materials').remove(copiedPaths);
    throw error;
  }
}

async function duplicateTutorial(videoId) {
  const client = requireSupabase();
  const hierarchy = await adminHierarchy();
  const source = hierarchy.find(item => item.id === videoId);
  if (!source) throw requestError('Tutorial no encontrado.', 404);

  const id = crypto.randomUUID();
  const slug = await availableSlug(client, `${source.slug}-copia`);
  const copiedPaths = [];
  try {
    const { error } = await client.from('tutorials').insert({
      id,
      title: `${source.title} — copia`,
      slug,
      description: source.description,
      youtube_url: source.youtubeUrl,
      cover_url: source.coverUrl,
      cover_storage_path: '',
      status: 'draft',
      access_mode: source.accessMode,
    });
    throwIfError(error);

    for (const sourceChapter of source.chapters) {
      const newChapterId = crypto.randomUUID();
      const { error: chapterError } = await client.from('chapters').insert({
        id: newChapterId,
        tutorial_id: id,
        position: sourceChapter.position,
        title: sourceChapter.title,
        start_seconds: sourceChapter.startSeconds,
        description: sourceChapter.description,
      });
      throwIfError(chapterError);
      for (const [index, sourceResource] of sourceChapter.resources.entries()) {
        await cloneResource(client, sourceResource, id, newChapterId, index, copiedPaths);
      }
    }
    const updatedHierarchy = await adminHierarchy();
    return updatedHierarchy.find(item => item.id === id);
  } catch (error) {
    await client.from('tutorials').delete().eq('id', id);
    if (copiedPaths.length) await client.storage.from('tutorial-materials').remove(copiedPaths);
    throw error;
  }
}

async function reorderChapters(videoId, chapterIds) {
  if (!Array.isArray(chapterIds)) throw requestError('El orden de capítulos no es válido.');
  const { error } = await requireSupabase().rpc('reorder_chapters', { p_tutorial_id: videoId, p_chapter_ids: chapterIds });
  throwIfError(error);
  return { ok: true };
}

async function reorderResources(chapterId, resourceIds) {
  if (!Array.isArray(resourceIds)) throw requestError('El orden de recursos no es válido.');
  const { error } = await requireSupabase().rpc('reorder_resources', { p_chapter_id: chapterId, p_resource_ids: resourceIds });
  throwIfError(error);
  return { ok: true };
}

async function removeChapter(chapterId) {
  const client = requireSupabase();
  const { data: files, error: fileError } = await client.from('resources').select('storage_path').eq('chapter_id', chapterId).neq('storage_path', '');
  throwIfError(fileError);
  const { error } = await client.from('chapters').delete().eq('id', chapterId);
  throwIfError(error);
  const paths = files.map(item => item.storage_path);
  const cleanup = paths.length ? await client.storage.from('tutorial-materials').remove(paths) : { error: null };
  return { ok: true, warning: cleanup.error ? 'El capítulo se eliminó, pero algunos archivos necesitan limpieza manual.' : '' };
}

async function removeTutorial(videoId) {
  const client = requireSupabase();
  const { data: tutorial, error: tutorialError } = await client.from('tutorials').select('cover_storage_path').eq('id', videoId).single();
  throwIfError(tutorialError);
  const { data: chapters, error: chapterError } = await client.from('chapters').select('id').eq('tutorial_id', videoId);
  throwIfError(chapterError);
  let materialPaths = [];
  if (chapters.length) {
    const { data, error } = await client.from('resources').select('storage_path').in('chapter_id', chapters.map(item => item.id)).neq('storage_path', '');
    throwIfError(error);
    materialPaths = data.map(item => item.storage_path);
  }
  const { error } = await client.from('tutorials').delete().eq('id', videoId);
  throwIfError(error);
  const cleanupErrors = [];
  if (materialPaths.length) {
    const result = await client.storage.from('tutorial-materials').remove(materialPaths);
    if (result.error) cleanupErrors.push(result.error);
  }
  if (tutorial.cover_storage_path) {
    const result = await client.storage.from('tutorial-covers').remove([tutorial.cover_storage_path]);
    if (result.error) cleanupErrors.push(result.error);
  }
  return { ok: true, warning: cleanupErrors.length ? 'El tutorial se eliminó, pero algunos archivos necesitan limpieza manual.' : '' };
}

async function uploadTutorialCover(videoId, form) {
  const client = requireSupabase();
  const file = form.get('file');
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
  if (!(file instanceof File) || !file.size) throw requestError('Selecciona una imagen de portada.');
  if (!extensions[file.type]) throw requestError('La portada debe ser JPG, PNG, WebP o AVIF.');
  if (file.size > 8 * 1024 * 1024) throw requestError('La portada supera el máximo de 8 MB.');

  const { data: current, error: currentError } = await client.from('tutorials').select('cover_storage_path').eq('id', videoId).single();
  throwIfError(currentError);
  const storagePath = `${videoId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error: uploadError } = await client.storage.from('tutorial-covers').upload(storagePath, file, {
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type,
  });
  throwIfError(uploadError);
  const { data: publicData } = client.storage.from('tutorial-covers').getPublicUrl(storagePath);
  const { data, error } = await client.from('tutorials').update({
    cover_url: publicData.publicUrl,
    cover_storage_path: storagePath,
  }).eq('id', videoId).select(tutorialFields).single();
  if (error) await client.storage.from('tutorial-covers').remove([storagePath]);
  throwIfError(error);
  if (current.cover_storage_path) await client.storage.from('tutorial-covers').remove([current.cover_storage_path]);
  return mapTutorial(data);
}

async function removeTutorialCover(videoId) {
  const client = requireSupabase();
  const { data: current, error: currentError } = await client.from('tutorials').select('cover_storage_path').eq('id', videoId).single();
  throwIfError(currentError);
  const { data, error } = await client.from('tutorials').update({
    cover_url: '/images/flujo-classroom.webp',
    cover_storage_path: '',
  }).eq('id', videoId).select(tutorialFields).single();
  throwIfError(error);
  if (current.cover_storage_path) await client.storage.from('tutorial-covers').remove([current.cover_storage_path]);
  return mapTutorial(data);
}

async function createResource(videoId, chapterId, form) {
  const client = requireSupabase();
  const id = crypto.randomUUID();
  const type = String(form.get('type') || 'prompt');
  const title = String(form.get('title') || '').trim();
  if (!title) throw requestError('El título del recurso es obligatorio.');
  const position = await nextPosition('resources', 'chapter_id', chapterId);
  const file = form.get('file');
  let storagePath = '';
  let originalName = '';

  if (type === 'file') {
    if (!(file instanceof File) || !file.size) throw requestError('Selecciona un archivo.');
    if (file.size > 25 * 1024 * 1024) throw requestError('El archivo supera el máximo de 25 MB.');
    originalName = file.name;
    storagePath = `${videoId}/${chapterId}/${id}/${safeFileName(file.name)}`;
    const { error: uploadError } = await client.storage.from('tutorial-materials').upload(storagePath, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
    });
    throwIfError(uploadError);
  }

  const content = String(form.get('content') || '').trim();
  const url = String(form.get('url') || '').trim();
  if (['prompt', 'instruction', 'skill'].includes(type) && !content) throw requestError('Agrega el contenido que se podrá copiar.');
  if (type === 'link' && !/^https?:\/\//i.test(url)) throw requestError('Ingresa una URL válida que comience con http:// o https://.');

  const { data, error } = await client.from('resources').insert({
    id,
    chapter_id: chapterId,
    position,
    type,
    title,
    description: String(form.get('description') || '').trim(),
    content,
    url,
    storage_path: storagePath,
    original_name: originalName,
  }).select(resourceFields).single();

  if (error && storagePath) await client.storage.from('tutorial-materials').remove([storagePath]);
  throwIfError(error);
  return mapResource(data);
}

async function removeResource(resourceId) {
  const client = requireSupabase();
  const { data: resource, error: readError } = await client.from('resources').select('storage_path').eq('id', resourceId).single();
  throwIfError(readError);
  if (resource.storage_path) {
    const { error: storageError } = await client.storage.from('tutorial-materials').remove([resource.storage_path]);
    throwIfError(storageError);
  }
  const { error } = await client.from('resources').delete().eq('id', resourceId);
  throwIfError(error);
  return { ok: true };
}

async function removeLead(leadId) {
  const client = requireSupabase();
  const { error } = await client.from('leads').delete().eq('id', leadId);
  throwIfError(error);
  return { ok: true };
}

async function subscriberAccess(body) {
  const client = requireSupabase();
  let { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwIfError(sessionError);
  if (!sessionData.session) {
    if (!body.captchaToken) throw requestError('No se pudo completar la verificación de seguridad.');
    const result = await client.auth.signInAnonymously({ options: { captchaToken: body.captchaToken } });
    if (result.error) throw requestError(authErrorMessage(result.error.message), Number(result.error.status || 400));
    sessionData = result.data;
  }

  const { data, error } = await client.functions.invoke('grant-tutorial-access', {
    body: { slug: body.slug, name: body.name, email: body.email, consent: body.consent, website: body.website },
  });
  if (error) {
    let message = error.message;
    let status = Number(error.context?.status || 400);
    if (error.context instanceof Response) {
      const details = await error.context.json().catch(() => ({}));
      message = details.error || details.message || message;
      status = error.context.status;
    }
    throw requestError(authErrorMessage(message), status);
  }
  return data;
}

async function adminLogin(body) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({
    email: String(body.email || '').trim(),
    password: body.password || '',
    options: body.captchaToken ? { captchaToken: body.captchaToken } : undefined,
  });
  if (error) throw requestError(authErrorMessage(error.message), Number(error.status || 400));
  if (!await isAdmin()) {
    await client.auth.signOut({ scope: 'local' });
    throw requestError('Esta cuenta no tiene permisos de administrador.', 403);
  }
  return { ok: true };
}

export async function getAuthSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  return data.session;
}

export async function downloadResource(item) {
  const client = requireSupabase();
  if (!item.storagePath) throw requestError('Este archivo no está disponible.');
  const { data, error } = await client.storage.from('tutorial-materials').createSignedUrl(item.storagePath, 300, {
    download: item.originalName || true,
  });
  throwIfError(error);
  const anchor = document.createElement('a');
  anchor.href = data.signedUrl;
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadTextFile(filename, text) {
  const url = URL.createObjectURL(new Blob([text ?? ''], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName(filename);
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // El objeto se libera tras el tick para que Safari alcance a iniciar la descarga.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body || {};
  if (method === 'GET' && path === '/api/news') return latestAiNews();
  if (method === 'GET' && path === '/api/videos') return publishedTutorials();
  if (method === 'GET' && /^\/api\/videos\/[^/]+$/.test(path)) return tutorialBySlug(decodeURIComponent(path.split('/').pop()));
  if (method === 'GET' && /^\/api\/hub\/[^/]+$/.test(path)) return hubTutorial(decodeURIComponent(path.split('/').pop()));
  if (method === 'POST' && path === '/api/access') return subscriberAccess(body);
  if (method === 'GET' && path === '/api/admin/status') return { authenticated: await isAdmin() };
  if (method === 'POST' && path === '/api/admin/login') return adminLogin(body);
  if (method === 'POST' && path === '/api/admin/logout') { await requireSupabase().auth.signOut({ scope: 'local' }); return { ok: true }; }
  if (method === 'GET' && path === '/api/admin/videos') return adminHierarchy();
  if (method === 'GET' && path === '/api/admin/overview') return adminOverview();
  if (method === 'GET' && /^\/api\/admin\/preview\/[^/]+$/.test(path)) return adminPreviewTutorial(decodeURIComponent(path.split('/').pop()));
  if (method === 'POST' && path === '/api/admin/videos') return createTutorial(body);

  let match = path.match(/^\/api\/admin\/videos\/([^/]+)$/);
  if (method === 'PUT' && match) return updateTutorial(match[1], body);
  if (method === 'DELETE' && match) return removeTutorial(match[1]);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/duplicate$/);
  if (method === 'POST' && match) return duplicateTutorial(match[1]);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/cover$/);
  if (method === 'POST' && match) return uploadTutorialCover(match[1], body);
  if (method === 'DELETE' && match) return removeTutorialCover(match[1]);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters$/);
  if (method === 'POST' && match) return createChapter(match[1], body);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters\/order$/);
  if (method === 'PUT' && match) return reorderChapters(match[1], body.chapterIds);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters\/([^/]+)\/duplicate$/);
  if (method === 'POST' && match) return duplicateChapter(match[1], match[2]);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters\/([^/]+)$/);
  if (method === 'PUT' && match) return updateChapter(match[2], body);
  if (method === 'DELETE' && match) return removeChapter(match[2]);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters\/([^/]+)\/resources$/);
  if (method === 'POST' && match) return createResource(match[1], match[2], body);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters\/([^/]+)\/resources\/order$/);
  if (method === 'PUT' && match) return reorderResources(match[2], body.resourceIds);
  match = path.match(/^\/api\/admin\/videos\/([^/]+)\/chapters\/([^/]+)\/resources\/([^/]+)$/);
  if (method === 'DELETE' && match) return removeResource(match[3]);
  match = path.match(/^\/api\/admin\/leads\/([^/]+)$/);
  if (method === 'DELETE' && match) return removeLead(match[1]);
  throw requestError(`Operación no soportada: ${method} ${path}`, 404);
}

export function formatTime(seconds = 0) {
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function youtubeId(url = '') {
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/)?.[1] || '';
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}
