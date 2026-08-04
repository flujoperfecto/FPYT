import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !publishableKey || !secretKey) {
  throw new Error('Configura SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY.');
}

const suiteId = crypto.randomUUID();
const email = `admin-smoke-${suiteId}@test.local`;
const password = `Fp!${suiteId}aA1`;
const slug = `admin-smoke-${suiteId}`;
const storagePath = `smoke/${suiteId}/private.txt`;
const service = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
let userId = '';
let tutorialId = '';

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke admin fallido: ${message}`);
}

try {
  const createdUser = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (createdUser.error) throw createdUser.error;
  userId = createdUser.data.user.id;

  const adminRecord = await service.from('admin_users').insert({ user_id: userId, display_name: 'Smoke admin' });
  if (adminRecord.error) throw adminRecord.error;

  const login = await admin.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  assert(login.data.user.id === userId, 'Supabase Auth inicia la cuenta administrativa');

  const tutorial = await admin.from('tutorials').insert({ title: 'Tutorial temporal', slug }).select('id').single();
  if (tutorial.error) throw tutorial.error;
  tutorialId = tutorial.data.id;

  const chapter = await admin.from('chapters').insert({ tutorial_id: tutorialId, position: 0, title: 'Capítulo temporal' }).select('id').single();
  if (chapter.error) throw chapter.error;

  const prompt = await admin.from('resources').insert({
    chapter_id: chapter.data.id,
    position: 0,
    type: 'prompt',
    title: 'Prompt temporal',
    content: 'Contenido temporal',
  });
  if (prompt.error) throw prompt.error;

  const upload = await admin.storage.from('tutorial-materials').upload(storagePath, new TextEncoder().encode('archivo privado'), {
    contentType: 'text/plain',
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const fileResource = await admin.from('resources').insert({
    chapter_id: chapter.data.id,
    position: 1,
    type: 'file',
    title: 'Archivo temporal',
    storage_path: storagePath,
    original_name: 'private.txt',
  });
  if (fileResource.error) throw fileResource.error;

  const signed = await admin.storage.from('tutorial-materials').createSignedUrl(storagePath, 60);
  if (signed.error) throw signed.error;
  assert(signed.data.signedUrl.includes('/storage/v1/object/sign/'), 'administrador obtiene URL firmada privada');

  const counters = await admin.from('tutorials').select('chapter_count,resource_count').eq('id', tutorialId).single();
  if (counters.error) throw counters.error;
  assert(counters.data.chapter_count === 1, 'trigger cuenta capítulos');
  assert(counters.data.resource_count === 2, 'trigger cuenta recursos');

  const leads = await admin.from('leads').select('id');
  if (leads.error) throw leads.error;
  assert(Array.isArray(leads.data), 'administrador puede consultar suscriptores');

  console.log(JSON.stringify({
    ok: true,
    adminAuth: true,
    databaseCrud: true,
    triggerCounters: true,
    privateUpload: true,
    signedDownload: true,
  }, null, 2));
} finally {
  try { await service.storage.from('tutorial-materials').remove([storagePath]); }
  catch (errorValue) { console.error('Cleanup: no se pudo borrar el archivo temporal.', errorValue); }

  if (tutorialId) {
    try { await service.from('tutorials').delete().eq('id', tutorialId); }
    catch (errorValue) { console.error('Cleanup: no se pudo borrar el tutorial temporal.', errorValue); }
  }

  try { await admin.auth.signOut({ scope: 'local' }); }
  catch (errorValue) { console.error('Cleanup: no se pudo cerrar la sesión temporal.', errorValue); }

  if (userId) {
    try { await service.from('admin_users').delete().eq('user_id', userId); }
    catch (errorValue) { console.error('Cleanup: no se pudo borrar la fila admin_users temporal.', errorValue); }

    try { await service.auth.admin.deleteUser(userId); }
    catch (errorValue) { console.error('Cleanup: no se pudo borrar el usuario temporal.', errorValue); }
  }
}
