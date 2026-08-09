-- ensure_ai_news_edition_complete() is shared by two constraint triggers:
-- ai_news_editions_require_four_items (insert/update on ai_news_editions)
-- ai_news_items_require_complete_edition (insert/update/delete on ai_news_items)
--
-- On a DELETE against ai_news_items, NEW is never bound, so the previous
-- `coalesce(new.edition_id, old.edition_id)` failed at runtime with
-- "record \"new\" has no field \"edition_id\"". publish_ai_news_edition()
-- deletes the prior rows for a date before inserting the fresh four items,
-- so every publish attempt hit this path and the edge function reported the
-- failure as an opaque error.
create or replace function private.ensure_ai_news_edition_complete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_edition_id uuid;
begin
  if tg_table_name = 'ai_news_editions' then
    target_edition_id := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    target_edition_id := old.edition_id;
  else
    target_edition_id := new.edition_id;
  end if;

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
