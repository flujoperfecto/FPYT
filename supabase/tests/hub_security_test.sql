begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table tap_results (line text);
grant insert, select on tap_results to anon, authenticated, service_role;
set local role postgres;
grant usage on schema extensions to public;
grant execute on all functions in schema extensions to public;
reset role;
insert into tap_results(line) select extensions.plan(133);
set local role postgres;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'subscriber1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'subscriber2@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'admin@test.local');

insert into public.admin_users (user_id, display_name)
values ('00000000-0000-0000-0000-000000000003', 'Admin');

insert into public.tutorials (id, title, slug, status, access_mode) values
  ('10000000-0000-0000-0000-000000000001', 'Tutorial privado', 'test-privado', 'published', 'email'),
  ('10000000-0000-0000-0000-000000000002', 'Tutorial público', 'test-publico', 'published', 'public'),
  ('10000000-0000-0000-0000-000000000003', 'Tutorial borrador', 'test-borrador', 'draft', 'public');

insert into public.chapters (id, tutorial_id, position, title) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 0, 'Capítulo privado'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 0, 'Capítulo público'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 0, 'Capítulo borrador');

insert into public.resources (id, chapter_id, position, type, title, content) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 0, 'prompt', 'Prompt privado', 'Contenido privado'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 0, 'prompt', 'Prompt público', 'Contenido público'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 0, 'prompt', 'Prompt borrador', 'Contenido borrador');

insert into public.leads (id, tutorial_id, name, email, consent_at) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Subscriber 1', 'subscriber1@test.local', now());

insert into public.tutorial_access (user_id, tutorial_id, lead_id) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');

create temporary table ai_news_test_payloads (version integer primary key, payload jsonb not null);
grant select on ai_news_test_payloads to service_role;
insert into ai_news_test_payloads (version, payload) values
(1, '[
  {"position":1,"category":"herramientas","headline":"Primera herramienta práctica para creadores","summary":"Una síntesis suficientemente extensa para explicar la primera noticia de prueba con claridad.","why_it_matters":"Permite a los creadores decidir con contexto y actuar de forma práctica.","primary_source_name":"Fuente Uno","primary_source_url":"https://example.com/news-one","source_published_at":"2099-01-01T08:00:00Z","sources":[{"name":"Fuente Uno","url":"https://example.com/news-one"}]},
  {"position":2,"category":"agentes","headline":"Segundo avance relevante para construir agentes","summary":"Una síntesis suficientemente extensa para explicar la segunda noticia de prueba con claridad.","why_it_matters":"Ayuda a los builders a evaluar una mejora concreta antes de implementarla.","primary_source_name":"Fuente Dos","primary_source_url":"https://example.com/news-two","source_published_at":"2099-01-01T09:00:00Z","sources":[{"name":"Fuente Dos","url":"https://example.com/news-two"}]},
  {"position":3,"category":"modelos","headline":"Tercer modelo útil para automatizaciones reales","summary":"Una síntesis suficientemente extensa para explicar la tercera noticia de prueba con claridad.","why_it_matters":"Reduce incertidumbre al elegir modelos para un flujo de trabajo verificable.","primary_source_name":"Fuente Tres","primary_source_url":"https://example.com/news-three","source_published_at":"2099-01-01T10:00:00Z","sources":[{"name":"Fuente Tres","url":"https://example.com/news-three"}]},
  {"position":4,"category":"negocio","headline":"Cuarta señal de negocio para productos con inteligencia artificial","summary":"Una síntesis suficientemente extensa para explicar la cuarta noticia de prueba con claridad.","why_it_matters":"Conecta el cambio técnico con una oportunidad real de producto y negocio.","primary_source_name":"Fuente Cuatro","primary_source_url":"https://example.com/news-four","source_published_at":"2099-01-01T11:00:00Z","sources":[{"name":"Fuente Cuatro","url":"https://example.com/news-four"}]}
]'::jsonb),
(2, '[
  {"position":1,"category":"herramientas","headline":"Edición reemplazada con una herramienta más práctica","summary":"Una síntesis suficientemente extensa para verificar el reemplazo idempotente de la edición diaria.","why_it_matters":"Demuestra que la automatización puede corregir una edición sin crear duplicados.","primary_source_name":"Fuente Uno","primary_source_url":"https://example.com/news-one-updated","source_published_at":"2099-01-01T12:00:00Z","sources":[{"name":"Fuente Uno","url":"https://example.com/news-one-updated"}]},
  {"position":2,"category":"agentes","headline":"Segundo avance actualizado para construir agentes","summary":"Una síntesis suficientemente extensa para explicar la segunda noticia actualizada con claridad.","why_it_matters":"Ayuda a los builders a evaluar una mejora concreta antes de implementarla.","primary_source_name":"Fuente Dos","primary_source_url":"https://example.com/news-two-updated","source_published_at":"2099-01-01T13:00:00Z","sources":[{"name":"Fuente Dos","url":"https://example.com/news-two-updated"}]},
  {"position":3,"category":"modelos","headline":"Tercer modelo actualizado para automatizaciones reales","summary":"Una síntesis suficientemente extensa para explicar la tercera noticia actualizada con claridad.","why_it_matters":"Reduce incertidumbre al elegir modelos para un flujo de trabajo verificable.","primary_source_name":"Fuente Tres","primary_source_url":"https://example.com/news-three-updated","source_published_at":"2099-01-01T14:00:00Z","sources":[{"name":"Fuente Tres","url":"https://example.com/news-three-updated"}]},
  {"position":4,"category":"negocio","headline":"Cuarta señal actualizada para productos con inteligencia artificial","summary":"Una síntesis suficientemente extensa para explicar la cuarta noticia actualizada con claridad.","why_it_matters":"Conecta el cambio técnico con una oportunidad real de producto y negocio.","primary_source_name":"Fuente Cuatro","primary_source_url":"https://example.com/news-four-updated","source_published_at":"2099-01-01T15:00:00Z","sources":[{"name":"Fuente Cuatro","url":"https://example.com/news-four-updated"}]}
]'::jsonb);

insert into public.ai_news_editions (edition_date, model, candidate_count)
values (date '2099-01-02', 'draft-model', 4), (current_date - 91, 'expired-model', 4);

-- All exposed application tables must have RLS enabled.
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.admin_users'::regclass), 'admin_users has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.tutorials'::regclass), 'tutorials has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.chapters'::regclass), 'chapters has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.resources'::regclass), 'resources has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.leads'::regclass), 'leads has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.tutorial_access'::regclass), 'tutorial_access has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.access_attempts'::regclass), 'access_attempts has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.ai_news_editions'::regclass), 'ai_news_editions has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.ai_news_items'::regclass), 'ai_news_items has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.tutorial_slug_history'::regclass), 'tutorial_slug_history has RLS');

-- Explicit grants are intentionally narrower than the RLS policies.
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.leads', 'SELECT'), 'anon cannot query leads');
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.admin_users', 'SELECT'), 'anon cannot query admin_users');
insert into tap_results(line) select ok(not has_table_privilege('authenticated', 'public.access_attempts', 'SELECT'), 'authenticated cannot query rate-limit attempts');
insert into tap_results(line) select ok(has_table_privilege('anon', 'public.tutorials', 'SELECT'), 'anon can query tutorial metadata');
insert into tap_results(line) select ok(has_table_privilege('authenticated', 'public.tutorial_access', 'SELECT'), 'authenticated can query own access');
insert into tap_results(line) select ok(has_table_privilege('anon', 'public.tutorial_access', 'SELECT'), 'anon can evaluate gated-content policies');
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.tutorial_slug_history', 'SELECT'), 'anon cannot enumerate historical tutorial slugs');
insert into tap_results(line) select ok(has_table_privilege('authenticated', 'public.tutorial_slug_history', 'SELECT'), 'authenticated role can reach admin-only slug history reads');
insert into tap_results(line) select ok(not has_table_privilege('authenticated', 'public.tutorial_slug_history', 'INSERT'), 'authenticated cannot write slug history directly');
insert into tap_results(line) select ok(has_function_privilege('anon', 'public.resolve_tutorial_slug(text)', 'EXECUTE'), 'anon can resolve one known historical slug');
insert into tap_results(line) select ok(has_function_privilege('authenticated', 'public.resolve_tutorial_slug(text)', 'EXECUTE'), 'authenticated can resolve one known historical slug');
insert into tap_results(line) select ok(not has_function_privilege('anon', 'private.record_tutorial_slug_change()', 'EXECUTE'), 'anon cannot execute slug history trigger function');
insert into tap_results(line) select ok(not has_function_privilege('authenticated', 'private.record_tutorial_slug_change()', 'EXECUTE'), 'authenticated cannot execute slug history trigger function');
insert into tap_results(line) select ok((select prosecdef from pg_proc where oid = 'private.record_tutorial_slug_change()'::regprocedure), 'slug history trigger owns its private writes');
insert into tap_results(line) select ok((select prosecdef from pg_proc where oid = 'public.resolve_tutorial_slug(text)'::regprocedure), 'exact public slug resolver is security definer');
insert into tap_results(line) select ok(not has_function_privilege('anon', 'public.grant_tutorial_access(uuid,uuid,text,text,timestamptz)', 'EXECUTE'), 'anon cannot execute access RPC');
insert into tap_results(line) select ok(not has_function_privilege('authenticated', 'public.grant_tutorial_access(uuid,uuid,text,text,timestamptz)', 'EXECUTE'), 'authenticated cannot execute access RPC');
insert into tap_results(line) select ok(has_function_privilege('service_role', 'public.grant_tutorial_access(uuid,uuid,text,text,timestamptz)', 'EXECUTE'), 'service role can execute access RPC');
insert into tap_results(line) select ok((select not prosecdef from pg_proc where oid = 'public.grant_tutorial_access(uuid,uuid,text,text,timestamptz)'::regprocedure), 'access RPC is security invoker');
insert into tap_results(line) select ok((select not public from storage.buckets where id = 'tutorial-materials'), 'materials bucket is private');
insert into tap_results(line) select ok(exists (
  select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tutorials' and column_name = 'cover_storage_path'
), 'tutorials tracks managed cover paths');
insert into tap_results(line) select ok((select not prosecdef from pg_proc where oid = 'public.reorder_chapters(uuid,uuid[])'::regprocedure), 'chapter reorder RPC is security invoker');
insert into tap_results(line) select ok((select not prosecdef from pg_proc where oid = 'public.reorder_resources(uuid,uuid[])'::regprocedure), 'resource reorder RPC is security invoker');
insert into tap_results(line) select ok(not has_function_privilege('anon', 'public.reorder_chapters(uuid,uuid[])', 'EXECUTE'), 'anon cannot execute chapter reorder RPC');
insert into tap_results(line) select ok(not has_function_privilege('anon', 'public.reorder_resources(uuid,uuid[])', 'EXECUTE'), 'anon cannot execute resource reorder RPC');
insert into tap_results(line) select ok(has_function_privilege('authenticated', 'public.reorder_chapters(uuid,uuid[])', 'EXECUTE'), 'authenticated role can reach guarded chapter reorder RPC');
insert into tap_results(line) select ok(has_function_privilege('authenticated', 'public.reorder_resources(uuid,uuid[])', 'EXECUTE'), 'authenticated role can reach guarded resource reorder RPC');
insert into tap_results(line) select ok((select public from storage.buckets where id = 'tutorial-covers'), 'cover bucket is public');
insert into tap_results(line) select is((select file_size_limit::bigint from storage.buckets where id = 'tutorial-covers'), 8388608::bigint, 'cover bucket enforces 8 MB limit');
insert into tap_results(line) select is((select array_length(allowed_mime_types, 1) from storage.buckets where id = 'tutorial-covers'), 4, 'cover bucket allows only four image MIME types');
insert into tap_results(line) select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in (
  'Admins read tutorial covers', 'Admins upload tutorial covers', 'Admins update tutorial covers', 'Admins delete tutorial covers'
)), 4, 'all expected cover storage policies exist');
insert into tap_results(line) select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in (
  'Accessible tutorial files are readable', 'Admins read tutorial files', 'Admins upload tutorial files', 'Admins update tutorial files', 'Admins delete tutorial files'
)), 5, 'all expected private storage policies exist');
insert into tap_results(line) select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'access_attempts'), 0, 'rate-limit table has no client policies');
insert into tap_results(line) select is((select sum(chapter_count)::integer from public.tutorials where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'
)), 3, 'chapter counters are refreshed by triggers');
insert into tap_results(line) select is((select sum(resource_count)::integer from public.tutorials where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'
)), 3, 'resource counters are refreshed by triggers');

insert into tap_results(line) select ok(has_table_privilege('anon', 'public.ai_news_editions', 'SELECT'), 'anon can read published AI news editions');
insert into tap_results(line) select ok(has_table_privilege('anon', 'public.ai_news_items', 'SELECT'), 'anon can read published AI news items');
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.ai_news_editions', 'INSERT'), 'anon cannot create AI news editions');
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.ai_news_items', 'INSERT'), 'anon cannot create AI news items');
insert into tap_results(line) select ok(not has_table_privilege('authenticated', 'public.ai_news_editions', 'INSERT'), 'authenticated cannot create AI news editions');
insert into tap_results(line) select ok(not has_function_privilege('anon', 'public.publish_ai_news_edition(date,jsonb,text,integer)', 'EXECUTE'), 'anon cannot execute AI news publisher');
insert into tap_results(line) select ok(not has_function_privilege('authenticated', 'public.publish_ai_news_edition(date,jsonb,text,integer)', 'EXECUTE'), 'authenticated cannot execute AI news publisher');
insert into tap_results(line) select ok(has_function_privilege('service_role', 'public.publish_ai_news_edition(date,jsonb,text,integer)', 'EXECUTE'), 'service role can execute AI news publisher');
insert into tap_results(line) select ok((select not prosecdef from pg_proc where oid = 'public.publish_ai_news_edition(date,jsonb,text,integer)'::regprocedure), 'AI news publisher is security invoker');

set local role service_role;
insert into tap_results(line) select lives_ok(
  $$select public.publish_ai_news_edition(date '2099-01-01', (select payload from ai_news_test_payloads where version = 1), 'deepseek-v4-pro', 12)$$,
  'service role publishes a complete AI news edition'
);
reset role;
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_editions where edition_date = date '2099-01-01'), 1, 'one edition is stored for its date');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01')), 4, 'published edition contains exactly four items');
insert into tap_results(line) select is((select array_agg(position order by position)::text from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01')), '{1,2,3,4}', 'published positions are one through four');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_editions where edition_date = current_date - 91), 0, 'publishing prunes editions older than ninety days');

set local role service_role;
insert into tap_results(line) select throws_ok(
  $$select public.publish_ai_news_edition(date '2099-01-03', (select payload - 3 from ai_news_test_payloads where version = 1), 'deepseek-v4-pro', 12)$$,
  '22023', 'Exactly four AI news items are required', 'publisher rejects fewer than four items'
);
insert into tap_results(line) select throws_ok(
  $$select public.publish_ai_news_edition(date '2099-01-03', jsonb_set((select payload from ai_news_test_payloads where version = 1), '{0,primary_source_url}', '"http://unsafe.test/news"'::jsonb), 'deepseek-v4-pro', 12)$$,
  '22023', 'Invalid AI news item payload', 'publisher rejects non-HTTPS source URLs'
);
reset role;

-- Unauthenticated visitors see metadata and only public published material.
set local role anon;
insert into tap_results(line) select is((select count(*)::integer from public.tutorials where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'
)), 2, 'anon sees published tutorial metadata only');
insert into tap_results(line) select is((select count(*)::integer from public.chapters where id in (
  '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'
)), 1, 'anon sees only public published chapters');
insert into tap_results(line) select is((select count(*)::integer from public.resources where id in (
  '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'
)), 1, 'anon sees only public published resources');
insert into tap_results(line) select is((select count(*)::integer from public.tutorial_access), 0, 'RLS exposes no access rows to anon');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_editions where edition_date in (date '2099-01-01', date '2099-01-02')), 1, 'anon sees only published AI news editions');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01')), 4, 'anon sees four published AI news items');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_editions where edition_date = date '2099-01-02'), 0, 'anon cannot see an unpublished edition');
reset role;
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.tutorials', 'INSERT'), 'anon cannot create tutorials');

-- Subscriber 1 owns a permanent grant to the gated tutorial.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into tap_results(line) select is((select count(*)::integer from public.tutorials where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'
)), 2, 'subscriber sees published metadata');
insert into tap_results(line) select is((select count(*)::integer from public.chapters where id in (
  '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'
)), 2, 'granted subscriber sees public and gated chapters');
insert into tap_results(line) select is((select count(*)::integer from public.resources where id in (
  '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'
)), 2, 'granted subscriber sees public and gated resources');
insert into tap_results(line) select is((select count(*)::integer from public.tutorial_access), 1, 'subscriber sees only own access row');
insert into tap_results(line) select is((select count(*)::integer from public.leads), 0, 'subscriber cannot read leads');
insert into tap_results(line) select is((select count(*)::integer from public.admin_users), 0, 'subscriber cannot impersonate an admin');
insert into tap_results(line) select is_empty($$update public.tutorials set title = 'Ataque' where id = '10000000-0000-0000-0000-000000000001' returning id$$, 'subscriber cannot update tutorials');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_editions where edition_date = date '2099-01-01'), 1, 'authenticated subscriber sees the published AI news edition');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01')), 4, 'authenticated subscriber sees four AI news items');
insert into tap_results(line) select throws_ok(
  $$select public.reorder_chapters('10000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000001']::uuid[])$$,
  '42501', 'Administrator permission required', 'subscriber cannot reorder chapters'
);
insert into tap_results(line) select throws_ok(
  $$select public.reorder_resources('20000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001']::uuid[])$$,
  '42501', 'Administrator permission required', 'subscriber cannot reorder resources'
);

-- Subscriber 2 has no grant yet.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into tap_results(line) select is((select count(*)::integer from public.chapters where id in (
  '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'
)), 1, 'ungranted subscriber sees public chapters only');
insert into tap_results(line) select is((select count(*)::integer from public.resources where id in (
  '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'
)), 1, 'ungranted subscriber sees public resources only');
insert into tap_results(line) select is((select count(*)::integer from public.tutorial_access), 0, 'ungranted subscriber sees no access rows');
insert into tap_results(line) select is((select count(*)::integer from public.leads), 0, 'ungranted subscriber cannot read leads');
reset role;

-- Only the service role (used by the Edge Function) can grant access atomically.
set local role service_role;
insert into tap_results(line) select lives_ok($$select public.grant_tutorial_access(
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Subscriber 2',
  'subscriber2@test.local',
  now()
)$$, 'service role grants tutorial access');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into tap_results(line) select is((select count(*)::integer from public.chapters where id in (
  '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'
)), 2, 'newly granted subscriber sees gated chapters');
insert into tap_results(line) select is((select count(*)::integer from public.tutorial_access), 1, 'newly granted subscriber sees own access');
insert into tap_results(line) select is((select count(*)::integer from public.tutorial_access where user_id <> auth.uid()), 0, 'subscriber cannot see another subscriber access');

-- A real admin record unlocks complete content management.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
insert into tap_results(line) select is((select count(*)::integer from public.tutorials where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'
)), 3, 'admin sees drafts and published tutorials');
insert into tap_results(line) select is((select count(*)::integer from public.chapters where id in (
  '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'
)), 3, 'admin sees every chapter');
insert into tap_results(line) select is((select count(*)::integer from public.resources where id in (
  '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'
)), 3, 'admin sees every resource');
insert into tap_results(line) select is((select count(*)::integer from public.leads where tutorial_id = '10000000-0000-0000-0000-000000000001' and email in (
  'subscriber1@test.local', 'subscriber2@test.local'
)), 2, 'admin sees all fixture leads');
insert into tap_results(line) select is((select count(*)::integer from public.admin_users), 1, 'admin sees own admin record');
insert into tap_results(line) select lives_ok($$update public.tutorials set title = 'Tutorial privado editado' where id = '10000000-0000-0000-0000-000000000001'$$, 'admin can update tutorials');
insert into tap_results(line) select is((select title from public.tutorials where id = '10000000-0000-0000-0000-000000000001'), 'Tutorial privado editado', 'admin update is persisted');
insert into tap_results(line) select lives_ok(
  $$update public.tutorials set slug = 'test-publico-v2' where id = '10000000-0000-0000-0000-000000000002'$$,
  'admin can rename a published tutorial'
);
insert into tap_results(line) select is(
  (select tutorial_id::text from public.tutorial_slug_history where slug = 'test-publico'),
  '10000000-0000-0000-0000-000000000002',
  'rename records the previous slug against the same tutorial'
);
insert into tap_results(line) select lives_ok(
  $$update public.tutorials set slug = 'test-publico-v3' where id = '10000000-0000-0000-0000-000000000002'$$,
  'admin can rename the same tutorial a second time'
);
insert into tap_results(line) select is(
  (select array_agg(slug order by slug)::text from public.tutorial_slug_history where tutorial_id = '10000000-0000-0000-0000-000000000002'),
  '{test-publico,test-publico-v2}',
  'multiple historical slugs remain attached to one tutorial'
);
insert into tap_results(line) select lives_ok(
  $$update public.tutorials set slug = 'test-borrador-v2' where id = '10000000-0000-0000-0000-000000000003'$$,
  'admin can rename a draft without publishing its alias'
);
insert into tap_results(line) select is(
  (select count(*)::integer from public.tutorial_slug_history),
  3,
  'admin can inspect published and draft slug history'
);
insert into tap_results(line) select throws_ok(
  $$update public.tutorials set slug = 'test-publico' where id = '10000000-0000-0000-0000-000000000001'$$,
  '23505',
  'Tutorial slug "test-publico" is reserved by another tutorial',
  'another tutorial cannot claim a reserved historical slug'
);
insert into tap_results(line) select is(
  (select tutorial_id::text from public.tutorial_slug_history where slug = 'test-publico'),
  '10000000-0000-0000-0000-000000000002',
  'a rejected claim leaves the historical owner unchanged'
);
insert into tap_results(line) select throws_ok(
  $$insert into public.tutorials (id, title, slug) values ('10000000-0000-0000-0000-000000000009', 'Reclamo inválido', 'test-publico')$$,
  '23505',
  'Tutorial slug "test-publico" is reserved by another tutorial',
  'a new tutorial cannot claim a reserved historical slug'
);
insert into tap_results(line) select is(
  (select count(*)::integer from public.tutorials where id = '10000000-0000-0000-0000-000000000009'),
  0,
  'a rejected insert leaves no tutorial behind'
);
insert into tap_results(line) select is(
  (select tutorial_id::text from public.tutorial_slug_history where slug = 'test-publico'),
  '10000000-0000-0000-0000-000000000002',
  'a rejected insert leaves the historical owner unchanged'
);
insert into tap_results(line) select lives_ok(
  $$update public.tutorials set slug = 'test-publico' where id = '10000000-0000-0000-0000-000000000002'$$,
  'a tutorial can return to one of its own historical slugs'
);
insert into tap_results(line) select is(
  (select count(*)::integer from public.tutorial_slug_history history_item join public.tutorials tutorial_item on tutorial_item.slug = history_item.slug),
  0,
  'no live tutorial slug remains in historical aliases'
);
insert into tap_results(line) select is(
  (select array_agg(slug order by slug)::text from public.tutorial_slug_history where tutorial_id = '10000000-0000-0000-0000-000000000002'),
  '{test-publico-v2,test-publico-v3}',
  'rename-back replaces the live alias without creating a loop'
);
insert into tap_results(line) select lives_ok(
  $$update public.tutorials set slug = 'test-privado-v2' where id = '10000000-0000-0000-0000-000000000001'$$,
  'admin can rename a gated published tutorial'
);
insert into tap_results(line) select lives_ok($$insert into public.tutorials (title, slug) values ('Nuevo borrador', 'nuevo-borrador')$$, 'admin can create a draft');
insert into tap_results(line) select is((select access_mode from public.tutorials where slug = 'nuevo-borrador'), 'public', 'new tutorials default to public materials');
insert into tap_results(line) select lives_ok(
  $$update public.tutorials set slug = 'nuevo-borrador-v2' where slug = 'nuevo-borrador'$$,
  'renaming a temporary tutorial creates a cascade test alias'
);
insert into tap_results(line) select is(
  (select count(*)::integer from public.tutorial_slug_history where slug = 'nuevo-borrador'),
  1,
  'temporary tutorial alias is recorded before deletion'
);
insert into tap_results(line) select lives_ok($$delete from public.tutorials where slug = 'nuevo-borrador-v2'$$, 'admin can delete the temporary tutorial');
insert into tap_results(line) select is(
  (select count(*)::integer from public.tutorial_slug_history where slug = 'nuevo-borrador'),
  0,
  'deleting a tutorial cascades through its historical slugs'
);
insert into tap_results(line) select lives_ok($$delete from public.leads where id = '40000000-0000-0000-0000-000000000001'$$, 'admin can revoke a subscriber lead');
insert into tap_results(line) select lives_ok(
  $$select public.reorder_chapters('10000000-0000-0000-0000-000000000001', array['20000000-0000-0000-0000-000000000001']::uuid[])$$,
  'admin can reorder chapters atomically'
);
insert into tap_results(line) select is((select position from public.chapters where id = '20000000-0000-0000-0000-000000000001'), 0, 'chapter reorder persists the requested position');
insert into tap_results(line) select lives_ok(
  $$select public.reorder_resources('20000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001']::uuid[])$$,
  'admin can reorder resources atomically'
);
insert into tap_results(line) select is((select position from public.resources where id = '30000000-0000-0000-0000-000000000001'), 0, 'resource reorder persists the requested position');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into tap_results(line) select is(
  (select count(*)::integer from public.tutorial_slug_history),
  0,
  'a non-admin subscriber cannot read historical slug rows'
);
reset role;

-- Public resolution reveals only exact aliases whose current tutorial is published.
set local role anon;
insert into tap_results(line) select is(
  (select slug || ':' || access_mode from public.resolve_tutorial_slug('test-publico-v2')),
  'test-publico:public',
  'an old public slug resolves directly to the current public route'
);
insert into tap_results(line) select is(
  (select slug || ':' || access_mode from public.resolve_tutorial_slug('test-publico-v3')),
  'test-publico:public',
  'every alias in a rename chain resolves in one hop'
);
insert into tap_results(line) select is(
  (select slug || ':' || access_mode from public.resolve_tutorial_slug('test-privado')),
  'test-privado-v2:email',
  'a gated tutorial alias preserves its current access mode'
);
insert into tap_results(line) select is_empty(
  $$select * from public.resolve_tutorial_slug('test-borrador')$$,
  'draft tutorial aliases are not publicly resolved'
);
insert into tap_results(line) select is_empty(
  $$select * from public.resolve_tutorial_slug('slug-inexistente')$$,
  'unknown slugs reveal no target'
);
reset role;

set local role service_role;
insert into tap_results(line) select lives_ok(
  $$select public.publish_ai_news_edition(date '2099-01-01', (select payload from ai_news_test_payloads where version = 2), 'deepseek-v4-pro', 16)$$,
  'publisher replaces the same date idempotently'
);
reset role;
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_editions where edition_date = date '2099-01-01'), 1, 'idempotent replacement keeps one edition row');
insert into tap_results(line) select is((select count(*)::integer from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01')), 4, 'idempotent replacement keeps four item rows');
insert into tap_results(line) select is((select headline from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01') and position = 1), 'Edición reemplazada con una herramienta más práctica', 'idempotent replacement persists the new content');

set local role service_role;
insert into tap_results(line) select throws_ok(
  $$select public.publish_ai_news_edition(date '2099-01-01', (select payload - 3 from ai_news_test_payloads where version = 2), 'deepseek-v4-pro', 16)$$,
  '22023', 'Exactly four AI news items are required', 'invalid replacement aborts before mutating the edition'
);
reset role;
insert into tap_results(line) select is((select headline from public.ai_news_items where edition_id = (select id from public.ai_news_editions where edition_date = date '2099-01-01') and position = 1), 'Edición reemplazada con una herramienta más práctica', 'failed replacement preserves the previous valid edition');

insert into tap_results(line) select * from finish();
select line from tap_results order by ctid;
rollback;
