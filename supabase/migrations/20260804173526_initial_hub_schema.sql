create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  youtube_url text not null default '',
  cover_url text not null default '/images/flujo-classroom.webp',
  status text not null default 'draft' check (status in ('draft', 'published')),
  access_mode text not null default 'email' check (access_mode in ('public', 'email')),
  chapter_count integer not null default 0 check (chapter_count >= 0),
  resource_count integer not null default 0 check (resource_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null check (length(trim(title)) > 0),
  start_seconds integer not null default 0 check (start_seconds >= 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tutorial_id, position)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  position integer not null check (position >= 0),
  type text not null check (type in ('prompt', 'instruction', 'skill', 'link', 'file')),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  content text not null default '',
  url text not null default '',
  storage_path text not null default '',
  original_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, position),
  check (
    (type in ('prompt', 'instruction', 'skill') and length(trim(content)) > 0)
    or (type = 'link' and url ~ '^https?://')
    or (type = 'file' and length(trim(storage_path)) > 0)
  )
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  name text not null default '',
  email text not null check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  consent_at timestamptz not null,
  source text not null default 'tutorial-landing',
  created_at timestamptz not null default now(),
  unique (tutorial_id, email),
  unique (id, tutorial_id)
);

create table public.tutorial_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  tutorial_id uuid not null references public.tutorials(id) on delete cascade,
  lead_id uuid not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, tutorial_id),
  foreign key (lead_id, tutorial_id) references public.leads(id, tutorial_id) on delete cascade
);

create table public.access_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index chapters_tutorial_position_idx on public.chapters (tutorial_id, position);
create index resources_chapter_position_idx on public.resources (chapter_id, position);
create index leads_tutorial_created_idx on public.leads (tutorial_id, created_at desc);
create index tutorial_access_tutorial_user_idx on public.tutorial_access (tutorial_id, user_id);
create index tutorial_access_lead_idx on public.tutorial_access (lead_id);
create index access_attempts_user_requested_idx on public.access_attempts (user_id, requested_at desc);
create index tutorials_published_updated_idx on public.tutorials (updated_at desc) where status = 'published';

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tutorials_set_updated_at before update on public.tutorials
for each row execute function private.set_updated_at();
create trigger chapters_set_updated_at before update on public.chapters
for each row execute function private.set_updated_at();
create trigger resources_set_updated_at before update on public.resources
for each row execute function private.set_updated_at();

create function private.refresh_tutorial_counts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_tutorial_id uuid;
begin
  if tg_table_name = 'chapters' then
    if tg_op = 'DELETE' then
      target_tutorial_id := old.tutorial_id;
    else
      target_tutorial_id := new.tutorial_id;
    end if;
  else
    select chapter_item.tutorial_id into target_tutorial_id
    from public.chapters chapter_item
    where chapter_item.id = case when tg_op = 'DELETE' then old.chapter_id else new.chapter_id end;
  end if;

  if target_tutorial_id is not null then
    update public.tutorials tutorial_item
    set chapter_count = (
      select count(*)::integer from public.chapters chapter_item
      where chapter_item.tutorial_id = target_tutorial_id
    ),
    resource_count = (
      select count(*)::integer
      from public.resources resource_item
      join public.chapters chapter_item on chapter_item.id = resource_item.chapter_id
      where chapter_item.tutorial_id = target_tutorial_id
    )
    where tutorial_item.id = target_tutorial_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger chapters_refresh_tutorial_counts
after insert or delete on public.chapters
for each row execute function private.refresh_tutorial_counts();
create trigger resources_refresh_tutorial_counts
after insert or delete on public.resources
for each row execute function private.refresh_tutorial_counts();

revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.refresh_tutorial_counts() from public, anon, authenticated;

create function public.grant_tutorial_access(
  p_user_id uuid,
  p_tutorial_id uuid,
  p_name text,
  p_email text,
  p_consent_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_lead_id uuid;
begin
  insert into public.leads (tutorial_id, name, email, consent_at, source)
  values (p_tutorial_id, p_name, p_email, p_consent_at, 'tutorial-landing')
  on conflict (tutorial_id, email) do update
  set name = excluded.name,
      consent_at = excluded.consent_at,
      source = excluded.source
  returning id into target_lead_id;

  insert into public.tutorial_access (user_id, tutorial_id, lead_id, granted_at)
  values (p_user_id, p_tutorial_id, target_lead_id, now())
  on conflict (user_id, tutorial_id) do update
  set lead_id = excluded.lead_id,
      granted_at = excluded.granted_at;

  return target_lead_id;
end;
$$;

revoke execute on function public.grant_tutorial_access(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_tutorial_access(uuid, uuid, text, text, timestamptz) to service_role;

alter table public.admin_users enable row level security;
alter table public.tutorials enable row level security;
alter table public.chapters enable row level security;
alter table public.resources enable row level security;
alter table public.leads enable row level security;
alter table public.tutorial_access enable row level security;
alter table public.access_attempts enable row level security;

create policy "Users can identify their own admin record"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create policy "Published tutorial metadata is public"
on public.tutorials for select to anon, authenticated
using (status = 'published');

create policy "Admins manage tutorials"
on public.tutorials for all to authenticated
using (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
));

create policy "Accessible chapters are readable"
on public.chapters for select to anon, authenticated
using (exists (
  select 1 from public.tutorials tutorial_item
  where tutorial_item.id = chapters.tutorial_id
    and tutorial_item.status = 'published'
    and (
      tutorial_item.access_mode = 'public'
      or exists (
        select 1 from public.tutorial_access access_item
        where access_item.tutorial_id = tutorial_item.id
          and access_item.user_id = (select auth.uid())
      )
    )
));

create policy "Admins manage chapters"
on public.chapters for all to authenticated
using (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
));

create policy "Accessible resources are readable"
on public.resources for select to anon, authenticated
using (exists (
  select 1
  from public.chapters chapter_item
  join public.tutorials tutorial_item on tutorial_item.id = chapter_item.tutorial_id
  where chapter_item.id = resources.chapter_id
    and tutorial_item.status = 'published'
    and (
      tutorial_item.access_mode = 'public'
      or exists (
        select 1 from public.tutorial_access access_item
        where access_item.tutorial_id = tutorial_item.id
          and access_item.user_id = (select auth.uid())
      )
    )
));

create policy "Admins manage resources"
on public.resources for all to authenticated
using (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
));

create policy "Admins manage leads"
on public.leads for all to authenticated
using (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
));

create policy "Users read their own tutorial access"
on public.tutorial_access for select to authenticated
using (user_id = (select auth.uid()));

create policy "Admins manage tutorial access"
on public.tutorial_access for all to authenticated
using (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
));

revoke all on table public.admin_users, public.tutorials, public.chapters, public.resources, public.leads, public.tutorial_access, public.access_attempts from anon, authenticated;
grant select on table public.tutorials, public.chapters, public.resources to anon;
grant select on table public.admin_users, public.tutorials, public.chapters, public.resources, public.leads, public.tutorial_access to authenticated;
grant insert, update, delete on table public.tutorials, public.chapters, public.resources, public.leads, public.tutorial_access to authenticated;
grant all on table public.admin_users, public.tutorials, public.chapters, public.resources, public.leads, public.tutorial_access, public.access_attempts to service_role;
grant usage, select on sequence public.access_attempts_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('tutorial-materials', 'tutorial-materials', false, 26214400)
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy "Accessible tutorial files are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'tutorial-materials'
  and exists (
    select 1
    from public.resources resource_item
    join public.chapters chapter_item on chapter_item.id = resource_item.chapter_id
    join public.tutorials tutorial_item on tutorial_item.id = chapter_item.tutorial_id
    where resource_item.storage_path = storage.objects.name
      and tutorial_item.status = 'published'
      and (
        tutorial_item.access_mode = 'public'
        or exists (
          select 1 from public.tutorial_access access_item
          where access_item.tutorial_id = tutorial_item.id
            and access_item.user_id = (select auth.uid())
        )
      )
  )
);

create policy "Admins read tutorial files"
on storage.objects for select to authenticated
using (
  bucket_id = 'tutorial-materials'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);

create policy "Admins upload tutorial files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tutorial-materials'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);

create policy "Admins update tutorial files"
on storage.objects for update to authenticated
using (
  bucket_id = 'tutorial-materials'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'tutorial-materials'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);

create policy "Admins delete tutorial files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tutorial-materials'
  and exists (
    select 1 from public.admin_users admin_item
    where admin_item.user_id = (select auth.uid())
  )
);
