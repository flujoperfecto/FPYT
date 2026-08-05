import { createClient } from '@supabase/supabase-js';

const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AI_NEWS_CRON_SECRET'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Faltan variables para el smoke test: ${missing.join(', ')}`);
  process.exit(1);
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
const response = await fetch(`${baseUrl}/functions/v1/refresh-ai-news`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-cron-secret': process.env.AI_NEWS_CRON_SECRET,
  },
  body: JSON.stringify({ source: 'manual-smoke-test' }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error('La actualización de Pulso IA falló.', result);
  process.exit(1);
}

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: edition, error: editionError } = await client
  .from('ai_news_editions')
  .select('id,edition_date,published_at')
  .not('published_at', 'is', null)
  .order('edition_date', { ascending: false })
  .limit(1)
  .single();
if (editionError) throw editionError;

const { data: items, error: itemError } = await client
  .from('ai_news_items')
  .select('id,position,primary_source_url')
  .eq('edition_id', edition.id)
  .order('position');
if (itemError) throw itemError;
if (items.length !== 4 || items.some((item, index) => item.position !== index + 1 || !item.primary_source_url.startsWith('https://'))) {
  throw new Error('La edición pública no contiene cuatro noticias válidas.');
}

console.log(JSON.stringify({ ok: true, editionDate: edition.edition_date, items: items.length }));
