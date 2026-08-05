create or replace function public.publish_ai_news_edition(
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
  v_edition_id uuid;
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
  returning id into v_edition_id;

  delete from public.ai_news_items
  where ai_news_items.edition_id = v_edition_id;

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
    v_edition_id,
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
  where id = v_edition_id;

  delete from public.ai_news_editions
  where edition_date < current_date - 90;

  return v_edition_id;
end;
$$;

revoke execute on function public.publish_ai_news_edition(date, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.publish_ai_news_edition(date, jsonb, text, integer) to service_role;
