begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table tap_results (line text);
grant insert, select on tap_results to anon, authenticated, service_role;
set local role postgres;
grant usage on schema extensions to public;
grant execute on all functions in schema extensions to public;
reset role;
insert into tap_results(line) select extensions.plan(68);
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

-- All exposed application tables must have RLS enabled.
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.admin_users'::regclass), 'admin_users has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.tutorials'::regclass), 'tutorials has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.chapters'::regclass), 'chapters has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.resources'::regclass), 'resources has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.leads'::regclass), 'leads has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.tutorial_access'::regclass), 'tutorial_access has RLS');
insert into tap_results(line) select ok((select relrowsecurity from pg_class where oid = 'public.access_attempts'::regclass), 'access_attempts has RLS');

-- Explicit grants are intentionally narrower than the RLS policies.
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.leads', 'SELECT'), 'anon cannot query leads');
insert into tap_results(line) select ok(not has_table_privilege('anon', 'public.admin_users', 'SELECT'), 'anon cannot query admin_users');
insert into tap_results(line) select ok(not has_table_privilege('authenticated', 'public.access_attempts', 'SELECT'), 'authenticated cannot query rate-limit attempts');
insert into tap_results(line) select ok(has_table_privilege('anon', 'public.tutorials', 'SELECT'), 'anon can query tutorial metadata');
insert into tap_results(line) select ok(has_table_privilege('authenticated', 'public.tutorial_access', 'SELECT'), 'authenticated can query own access');
insert into tap_results(line) select ok(has_table_privilege('anon', 'public.tutorial_access', 'SELECT'), 'anon can evaluate gated-content policies');
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
insert into tap_results(line) select lives_ok($$insert into public.tutorials (title, slug) values ('Nuevo borrador', 'nuevo-borrador')$$, 'admin can create a draft');
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

insert into tap_results(line) select * from finish();
select line from tap_results order by ctid;
rollback;
