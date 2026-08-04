import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const dataFile = path.resolve(process.env.DATA_FILE || path.join(workspaceRoot, 'data', 'hub.json'));
const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || path.join(workspaceRoot, 'storage', 'uploads'));
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!supabaseUrl || !secretKey) {
  throw new Error('Configura SUPABASE_URL y SUPABASE_SECRET_KEY antes de ejecutar la migración.');
}

const client = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function ensure(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

function safeFileName(value = 'archivo') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archivo';
}

async function uploadLegacyFile(video, chapter, resource) {
  if (resource.type !== 'file') return { storagePath: '', originalName: '' };
  const legacyName = path.basename(String(resource.fileName || ''));
  if (!legacyName) throw new Error(`El recurso "${resource.title}" no tiene fileName.`);
  const sourcePath = path.resolve(uploadsRoot, legacyName);
  if (!sourcePath.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error(`Ruta de archivo inválida: ${legacyName}`);
  const bytes = await readFile(sourcePath);
  const originalName = String(resource.originalName || legacyName);
  const storagePath = `${video.id}/${chapter.id}/${resource.id}/${safeFileName(originalName)}`;
  ensure(await client.storage.from('tutorial-materials').upload(storagePath, bytes, {
    upsert: true,
    contentType: 'application/octet-stream',
    cacheControl: '3600',
  }), `No se pudo subir ${originalName}`);
  return { storagePath, originalName };
}

const legacy = JSON.parse(await readFile(dataFile, 'utf8'));
const videos = Array.isArray(legacy.videos) ? legacy.videos : [];
const leads = Array.isArray(legacy.leads) ? legacy.leads : [];

for (const video of videos) {
  const chapters = Array.isArray(video.chapters) ? video.chapters : [];
  const resourceCount = chapters.reduce((total, chapter) => total + (Array.isArray(chapter.resources) ? chapter.resources.length : 0), 0);
  ensure(await client.from('tutorials').upsert({
    id: video.id,
    title: video.title,
    slug: video.slug,
    description: video.description || '',
    youtube_url: video.youtubeUrl || '',
    cover_url: video.coverUrl || '/images/flujo-classroom.webp',
    status: video.status === 'published' ? 'published' : 'draft',
    access_mode: video.accessMode === 'public' ? 'public' : 'email',
    chapter_count: chapters.length,
    resource_count: resourceCount,
    created_at: video.createdAt || new Date().toISOString(),
    updated_at: video.updatedAt || video.createdAt || new Date().toISOString(),
  }, { onConflict: 'id' }), `No se pudo importar el tutorial ${video.title}`);

  for (const [chapterPosition, chapter] of chapters.entries()) {
    ensure(await client.from('chapters').upsert({
      id: chapter.id,
      tutorial_id: video.id,
      position: chapterPosition,
      title: chapter.title,
      start_seconds: Math.max(0, Number(chapter.startSeconds || 0)),
      description: chapter.description || '',
    }, { onConflict: 'id' }), `No se pudo importar el capítulo ${chapter.title}`);

    for (const [resourcePosition, resource] of (chapter.resources || []).entries()) {
      const file = await uploadLegacyFile(video, chapter, resource);
      ensure(await client.from('resources').upsert({
        id: resource.id,
        chapter_id: chapter.id,
        position: resourcePosition,
        type: resource.type,
        title: resource.title,
        description: resource.description || '',
        content: resource.content || '',
        url: resource.url || '',
        storage_path: file.storagePath,
        original_name: file.originalName,
      }, { onConflict: 'id' }), `No se pudo importar el recurso ${resource.title}`);
    }
  }
}

for (const lead of leads) {
  ensure(await client.from('leads').upsert({
    id: lead.id,
    tutorial_id: lead.videoId,
    name: lead.name || '',
    email: String(lead.email || '').trim().toLowerCase(),
    consent_at: lead.createdAt || new Date().toISOString(),
    source: lead.source || 'legacy-import',
    created_at: lead.createdAt || new Date().toISOString(),
  }, { onConflict: 'tutorial_id,email' }), `No se pudo importar el suscriptor ${lead.email}`);
}

const [tutorialCount, chapterCount, resourceCount, leadCount] = await Promise.all([
  client.from('tutorials').select('id', { count: 'exact', head: true }),
  client.from('chapters').select('id', { count: 'exact', head: true }),
  client.from('resources').select('id', { count: 'exact', head: true }),
  client.from('leads').select('id', { count: 'exact', head: true }),
]);
[tutorialCount, chapterCount, resourceCount, leadCount].forEach((result, index) => ensure(result, `No se pudo verificar el conteo ${index + 1}`));

console.log(JSON.stringify({
  ok: true,
  remote: {
    tutorials: tutorialCount.count || 0,
    chapters: chapterCount.count || 0,
    resources: resourceCount.count || 0,
    leads: leadCount.count || 0,
  },
}, null, 2));
