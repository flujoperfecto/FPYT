create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.ai_news_editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null unique,
  model text not null check (length(trim(model)) between 1 and 80),
  candidate_count integer not null check (candidate_count >= 4),
  published_at timestamptz,
  generation_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_news_items (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.ai_news_editions(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  category text not null check (category in (
    'modelos', 'agentes', 'herramientas', 'automatizacion',
    'negocio', 'investigacion', 'seguridad', 'regulacion'
  )),
  headline text not null check (length(trim(headline)) between 12 and 180),
  summary text not null check (length(trim(summary)) between 40 and 700),
  why_it_matters text not null check (length(trim(why_it_matters)) between 30 and 500),
  primary_source_name text not null check (length(trim(primary_source_name)) between 2 and 100),
  primary_source_url text not null check (primary_source_url ~ '^https://[^[:space:]]+$'),
  source_published_at timestamptz not null,
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) >= 1),
  created_at timestamptz not null default now(),
  unique (edition_id, position)
);

create index ai_news_editions_published_idx
on public.ai_news_editions (edition_date desc, published_at desc)
where published_at is not null;

create index ai_news_items_edition_position_idx
on public.ai_news_items (edition_id, position);

create trigger ai_news_editions_set_updated_at
before update on public.ai_news_editions
for each row execute function private.set_updated_at();

create function private.ensure_ai_news_edition_complete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_edition_id uuid;
begin
  target_edition_id := case
    when tg_table_name = 'ai_news_editions' then coalesce(new.id, old.id)
    else coalesce(new.edition_id, old.edition_id)
  end;

  if exists (
    select 1
    from public.ai_news_editions edition
    where edition.id = target_edition_id
      and edition.published_at is not null
      and (
        select count(*)
        from public.ai_news_items item
        where item.edition_id = edition.id
      ) <> 4
  ) then
    raise exception using
      errcode = '23514',
      message = 'Published AI news editions must contain exactly four items';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create constraint trigger ai_news_editions_require_four_items
after insert or update on public.ai_news_editions
deferrable initially deferred
for each row execute function private.ensure_ai_news_edition_complete();

create constraint trigger ai_news_items_require_complete_edition
after insert or update or delete on public.ai_news_items
deferrable initially deferred
for each row execute function private.ensure_ai_news_edition_complete();

create function public.publish_ai_news_edition(
  p_date date,
  p_items jsonb,
  p_model text,
  p_candidate_count integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  edition_id uuid;
  item jsonb;
  item_sources jsonb;
begin
  if p_date is null then
    raise exception using errcode = '22023', message = 'Edition date is required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> 4 then
    raise exception using errcode = '22023', message = 'Exactly four AI news items are required';
  end if;
  if length(trim(coalesce(p_model, ''))) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'A valid model name is required';
  end if;
  if p_candidate_count is null or p_candidate_count < 4 then
    raise exception using errcode = '22023', message = 'Candidate count must be at least four';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_sources := item -> 'sources';
    if jsonb_typeof(item) <> 'object'
      or (item ->> 'position')::integer not between 1 and 4
      or item ->> 'category' not in (
        'modelos', 'agentes', 'herramientas', 'automatizacion',
        'negocio', 'investigacion', 'seguridad', 'regulacion'
      )
      or length(trim(coalesce(item ->> 'headline', ''))) not between 12 and 180
      or length(trim(coalesce(item ->> 'summary', ''))) not between 40 and 700
      or length(trim(coalesce(item ->> 'why_it_matters', ''))) not between 30 and 500
      or length(trim(coalesce(item ->> 'primary_source_name', ''))) not between 2 and 100
      or coalesce(item ->> 'primary_source_url', '') !~ '^https://[^[:space:]]+$'
      or coalesce(item ->> 'source_published_at', '') = ''
      or jsonb_typeof(item_sources) <> 'array'
      or jsonb_array_length(item_sources) < 1
      or exists (
        select 1
        from jsonb_array_elements(item_sources) source
        where jsonb_typeof(source) <> 'object'
          or length(trim(coalesce(source ->> 'name', ''))) < 2
          or coalesce(source ->> 'url', '') !~ '^https://[^[:space:]]+$'
      )
      or not exists (
        select 1
        from jsonb_array_elements(item_sources) source
        where source ->> 'url' = item ->> 'primary_source_url'
      )
    then
      raise exception using errcode = '22023', message = 'Invalid AI news item payload';
    end if;

    perform (item ->> 'source_published_at')::timestamptz;
  end loop;

  if (
    select count(distinct (value ->> 'position')::integer)
    from jsonb_array_elements(p_items)
  ) <> 4 then
    raise exception using errcode = '22023', message = 'AI news positions must be unique from one to four';
  end if;

  insert into public.ai_news_editions (
    edition_date, model, candidate_count, published_at, generation_metadata
  ) values (
    p_date,
    trim(p_model),
    p_candidate_count,
    null,
    jsonb_build_object('item_count', 4, 'generated_at', now())
  )
  on conflict (edition_date) do update
  set model = excluded.model,
      candidate_count = excluded.candidate_count,
      published_at = null,
      generation_metadata = excluded.generation_metadata
  returning id into edition_id;

  delete from public.ai_news_items where ai_news_items.edition_id = edition_id;

  insert into public.ai_news_items (
    edition_id,
    position,
    category,
    headline,
    summary,
    why_it_matters,
    primary_source_name,
    primary_source_url,
    source_published_at,
    sources
  )
  select
    edition_id,
    (value ->> 'position')::smallint,
    value ->> 'category',
    trim(value ->> 'headline'),
    trim(value ->> 'summary'),
    trim(value ->> 'why_it_matters'),
    trim(value ->> 'primary_source_name'),
    value ->> 'primary_source_url',
    (value ->> 'source_published_at')::timestamptz,
    value -> 'sources'
  from jsonb_array_elements(p_items)
  order by (value ->> 'position')::integer;

  update public.ai_news_editions
  set published_at = now()
  where id = edition_id;

  delete from public.ai_news_editions
  where edition_date < current_date - 90;

  return edition_id;
end;
$$;

revoke execute on function private.ensure_ai_news_edition_complete() from public, anon, authenticated;
revoke execute on function public.publish_ai_news_edition(date, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.publish_ai_news_edition(date, jsonb, text, integer) to service_role;

alter table public.ai_news_editions enable row level security;
alter table public.ai_news_items enable row level security;

create policy "Published AI news editions are public"
on public.ai_news_editions for select to anon, authenticated
using (published_at is not null);

create policy "Published AI news items are public"
on public.ai_news_items for select to anon, authenticated
using (exists (
  select 1
  from public.ai_news_editions edition
  where edition.id = ai_news_items.edition_id
    and edition.published_at is not null
));

revoke all on table public.ai_news_editions, public.ai_news_items from anon, authenticated;
grant select on table public.ai_news_editions, public.ai_news_items to anon, authenticated;
grant all on table public.ai_news_editions, public.ai_news_items to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'refresh-ai-news-daily';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'refresh-ai-news-daily',
    '30 11 * * *',
    $cron$
      select net.http_post(
        url := secrets.project_url || '/functions/v1/refresh-ai-news',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', secrets.cron_secret
        ),
        body := jsonb_build_object('scheduled_at', now())
      )
      from (
        select
          max(decrypted_secret) filter (where name = 'ai_news_project_url') as project_url,
          max(decrypted_secret) filter (where name = 'ai_news_cron_secret') as cron_secret
        from vault.decrypted_secrets
      ) secrets
      where secrets.project_url is not null
        and secrets.cron_secret is not null;
    $cron$
  );
end;
$$;
