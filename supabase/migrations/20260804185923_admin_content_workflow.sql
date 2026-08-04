alter table public.tutorials
add column cover_storage_path text not null default '';

create or replace function public.reorder_chapters(
  p_tutorial_id uuid,
  p_chapter_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  supplied_count integer;
begin
  if not exists (
    select 1
    from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  ) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select count(*)::integer
  into expected_count
  from public.chapters
  where tutorial_id = p_tutorial_id;

  select count(distinct chapter_id)::integer
  into supplied_count
  from unnest(coalesce(p_chapter_ids, array[]::uuid[])) as supplied(chapter_id);

  if expected_count <> coalesce(cardinality(p_chapter_ids), 0)
     or supplied_count <> expected_count
     or exists (
       select 1
       from unnest(coalesce(p_chapter_ids, array[]::uuid[])) as supplied(chapter_id)
       where not exists (
         select 1
         from public.chapters chapter_item
         where chapter_item.id = supplied.chapter_id
           and chapter_item.tutorial_id = p_tutorial_id
       )
     ) then
    raise exception 'Chapter order must contain every chapter exactly once' using errcode = '22023';
  end if;

  update public.chapters
  set position = position + 1000000
  where tutorial_id = p_tutorial_id;

  update public.chapters chapter_item
  set position = supplied.ordinality - 1
  from unnest(coalesce(p_chapter_ids, array[]::uuid[])) with ordinality as supplied(chapter_id, ordinality)
  where chapter_item.id = supplied.chapter_id
    and chapter_item.tutorial_id = p_tutorial_id;
end;
$$;

create or replace function public.reorder_resources(
  p_chapter_id uuid,
  p_resource_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  supplied_count integer;
begin
  if not exists (
    select 1
    from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  ) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  select count(*)::integer
  into expected_count
  from public.resources
  where chapter_id = p_chapter_id;

  select count(distinct resource_id)::integer
  into supplied_count
  from unnest(coalesce(p_resource_ids, array[]::uuid[])) as supplied(resource_id);

  if expected_count <> coalesce(cardinality(p_resource_ids), 0)
     or supplied_count <> expected_count
     or exists (
       select 1
       from unnest(coalesce(p_resource_ids, array[]::uuid[])) as supplied(resource_id)
       where not exists (
         select 1
         from public.resources resource_item
         where resource_item.id = supplied.resource_id
           and resource_item.chapter_id = p_chapter_id
       )
     ) then
    raise exception 'Resource order must contain every resource exactly once' using errcode = '22023';
  end if;

  update public.resources
  set position = position + 1000000
  where chapter_id = p_chapter_id;

  update public.resources resource_item
  set position = supplied.ordinality - 1
  from unnest(coalesce(p_resource_ids, array[]::uuid[])) with ordinality as supplied(resource_id, ordinality)
  where resource_item.id = supplied.resource_id
    and resource_item.chapter_id = p_chapter_id;
end;
$$;

revoke execute on function public.reorder_chapters(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_resources(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_chapters(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_resources(uuid, uuid[]) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutorial-covers',
  'tutorial-covers',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins read tutorial covers"
on storage.objects for select to authenticated
using (
  bucket_id = 'tutorial-covers'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);

create policy "Admins upload tutorial covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tutorial-covers'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);

create policy "Admins update tutorial covers"
on storage.objects for update to authenticated
using (
  bucket_id = 'tutorial-covers'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'tutorial-covers'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);

create policy "Admins delete tutorial covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tutorial-covers'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);
