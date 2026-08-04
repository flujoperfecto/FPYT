import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const dataFile = path.resolve(process.env.DATA_FILE || path.join(workspaceRoot, 'data', 'hub.json'));
const url = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !publishableKey || !secretKey) {
  throw new Error('Configura SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY.');
}

const publicClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const adminClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const legacy = JSON.parse(await readFile(dataFile, 'utf8'));
const videos = Array.isArray(legacy.videos) ? legacy.videos : [];
const chapters = videos.flatMap(video => (video.chapters || []).map(chapter => ({ ...chapter, video })));
const resources = chapters.flatMap(chapter => (chapter.resources || []).map(resource => ({ ...resource, chapter })));
const leads = Array.isArray(legacy.leads) ? legacy.leads : [];

function assert(condition, message) {
  if (!condition) throw new Error(`Verificación fallida: ${message}`);
}

function ensure(result, message) {
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  return result.data || [];
}

async function rowsByIds(client, table, ids, columns = 'id') {
  if (!ids.length) return [];
  return ensure(await client.from(table).select(columns).in('id', ids), `No se pudo consultar ${table}`);
}

const importedTutorials = await rowsByIds(adminClient, 'tutorials', videos.map(item => item.id), 'id,status,access_mode,chapter_count,resource_count');
const importedChapters = await rowsByIds(adminClient, 'chapters', chapters.map(item => item.id));
const importedResources = await rowsByIds(adminClient, 'resources', resources.map(item => item.id));
const importedLeads = await rowsByIds(adminClient, 'leads', leads.map(item => item.id));

assert(importedTutorials.length === videos.length, 'todos los tutoriales fueron importados');
assert(importedChapters.length === chapters.length, 'todos los capítulos fueron importados');
assert(importedResources.length === resources.length, 'todos los recursos fueron importados');
assert(importedLeads.length === leads.length, 'todos los suscriptores fueron importados');

for (const tutorial of importedTutorials) {
  const source = videos.find(item => item.id === tutorial.id);
  const expectedChapters = source.chapters?.length || 0;
  const expectedResources = (source.chapters || []).reduce((total, chapter) => total + (chapter.resources?.length || 0), 0);
  assert(tutorial.chapter_count === expectedChapters, `contador de capítulos de ${source.slug}`);
  assert(tutorial.resource_count === expectedResources, `contador de recursos de ${source.slug}`);
}

const publicTutorials = ensure(await publicClient.from('tutorials').select('id,status,access_mode').in('id', videos.map(item => item.id)), 'No se pudo comprobar la vista pública');
const expectedPublished = videos.filter(item => item.status === 'published');
assert(publicTutorials.length === expectedPublished.length, 'el público solo ve tutoriales publicados');
assert(publicTutorials.every(item => item.status === 'published'), 'ningún borrador es público');

for (const video of expectedPublished) {
  const result = await publicClient.from('chapters').select('id').eq('tutorial_id', video.id);
  const rows = ensure(result, `No se pudo probar RLS para ${video.slug}`);
  const expected = video.accessMode === 'public' ? (video.chapters?.length || 0) : 0;
  assert(rows.length === expected, `${video.slug} respeta su modo de acceso`);
}

const publicLeadResult = await publicClient.from('leads').select('id').limit(1);
assert(Boolean(publicLeadResult.error), 'anon no puede consultar leads');
const publicAdminResult = await publicClient.from('admin_users').select('user_id').limit(1);
assert(Boolean(publicAdminResult.error), 'anon no puede consultar administradores');

const bucket = ensure(await adminClient.storage.getBucket('tutorial-materials'), 'No se pudo consultar el bucket');
assert(bucket.public === false, 'el bucket de materiales es privado');
assert(Number(bucket.file_size_limit) === 25 * 1024 * 1024, 'el bucket limita archivos a 25 MB');

console.log(JSON.stringify({
  ok: true,
  verified: {
    tutorials: importedTutorials.length,
    chapters: importedChapters.length,
    resources: importedResources.length,
    leads: importedLeads.length,
    privateBucket: true,
    publicRls: true,
  },
}, null, 2));
