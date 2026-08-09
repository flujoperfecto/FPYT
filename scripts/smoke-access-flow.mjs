import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const slug = process.env.TUTORIAL_SLUG || 'idea-a-app-con-ia';

if (!url || !publishableKey || !secretKey) {
  throw new Error('Configura SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY.');
}

const subscriber = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const testEmail = `smoke-${crypto.randomUUID()}@test.local`;
let userId = '';
let tutorialId = '';

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke test fallido: ${message}`);
}

try {
  const { data: tutorial, error: tutorialError } = await subscriber.from('tutorials').select('id,slug,access_mode,chapter_count,resource_count').eq('slug', slug).single();
  if (tutorialError) throw tutorialError;
  tutorialId = tutorial.id;
  assert(tutorial.access_mode === 'email', 'el tutorial de prueba debe solicitar email');

  const { data: authData, error: authError } = await subscriber.auth.signInAnonymously();
  if (authError) throw authError;
  userId = authData.user.id;
  assert(authData.user.is_anonymous === true, 'la sesión creada es anónima');

  const before = await subscriber.from('chapters').select('id').eq('tutorial_id', tutorialId);
  if (before.error) throw before.error;
  assert(before.data.length === 0, 'RLS oculta capítulos antes de conceder acceso');

  const grant = await subscriber.functions.invoke('grant-tutorial-access', {
    // Un slug deliberadamente obsoleto comprueba que el UUID cargado en la
    // landing mantiene la identidad aunque la dirección cambie antes del envío.
    body: { tutorialId, slug: `${slug}-obsoleto-smoke`, name: 'Smoke test', email: testEmail, consent: true, website: '' },
  });
  if (grant.error) throw grant.error;
  assert(grant.data?.redirect === `/hub/${slug}`, 'la Edge Function devuelve el hub correcto');

  const after = await subscriber.from('chapters').select('id').eq('tutorial_id', tutorialId);
  if (after.error) throw after.error;
  assert(after.data.length === tutorial.chapter_count, 'RLS habilita todos los capítulos después del grant');

  const chapterIds = after.data.map(item => item.id);
  const resources = chapterIds.length ? await subscriber.from('resources').select('id').in('chapter_id', chapterIds) : { data: [], error: null };
  if (resources.error) throw resources.error;
  assert(resources.data.length === tutorial.resource_count, 'RLS habilita todos los recursos después del grant');

  console.log(JSON.stringify({
    ok: true,
    anonymousAuth: true,
    edgeFunction: true,
    gatedBeforeGrant: true,
    chaptersAfterGrant: after.data.length,
    resourcesAfterGrant: resources.data.length,
  }, null, 2));
} finally {
  if (tutorialId) {
    try { await admin.from('leads').delete().eq('tutorial_id', tutorialId).eq('email', testEmail); }
    catch (errorValue) { console.error('Cleanup: no se pudo borrar el lead temporal.', errorValue); }
  }

  if (userId) {
    try { await admin.auth.admin.deleteUser(userId); }
    catch (errorValue) { console.error('Cleanup: no se pudo borrar el usuario temporal.', errorValue); }
  }
}
