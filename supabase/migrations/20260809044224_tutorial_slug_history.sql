-- Cambiar la URL pública de un tutorial rompía todos los enlaces ya entregados.
-- Esta tabla conserva las direcciones anteriores para que el sitio redirija en
-- lugar de responder 404 a un suscriptor que guardó el enlace antiguo.

create table public.tutorial_slug_history (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tutorial_id uuid not null constraint tutorial_slug_history_tutorial_id_fkey
    references public.tutorials(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index tutorial_slug_history_tutorial_idx on public.tutorial_slug_history (tutorial_id);

create function private.record_tutorial_slug_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  reserved_owner uuid;
begin
  if actor_id is not null and not exists (
    select 1
    from public.admin_users admin_item
    where admin_item.user_id = actor_id
  ) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.slug is not distinct from new.slug then
    return new;
  end if;

  -- Un slug histórico sólo puede volver a ser la dirección viva del mismo
  -- tutorial. Reasignarlo a otro contenido secuestraría enlaces ya entregados.
  select history_item.tutorial_id
  into reserved_owner
  from public.tutorial_slug_history history_item
  where history_item.slug = new.slug
  for update;

  if reserved_owner is not null and reserved_owner <> new.id then
    raise exception 'Tutorial slug "%" is reserved by another tutorial', new.slug
      using errcode = '23505', constraint = 'tutorial_slug_history_pkey';
  end if;

  delete from public.tutorial_slug_history history_item
  where history_item.slug = new.slug
    and history_item.tutorial_id = new.id;

  if tg_op = 'UPDATE' and old.slug is distinct from new.slug then
    reserved_owner := null;
    select history_item.tutorial_id
    into reserved_owner
    from public.tutorial_slug_history history_item
    where history_item.slug = old.slug
    for update;

    if reserved_owner is not null and reserved_owner <> new.id then
      raise exception 'Tutorial slug "%" is reserved by another tutorial', old.slug
        using errcode = '23505', constraint = 'tutorial_slug_history_pkey';
    end if;

    insert into public.tutorial_slug_history (slug, tutorial_id)
    values (old.slug, new.id);
  end if;

  return new;
end;
$$;

create trigger tutorials_record_slug_change
after insert or update of slug on public.tutorials
for each row execute function private.record_tutorial_slug_change();

alter table public.tutorial_slug_history enable row level security;

create policy "Admins read slug history"
on public.tutorial_slug_history for select to authenticated
using (exists (
  select 1 from public.admin_users admin_item
  where admin_item.user_id = (select auth.uid())
));

-- La resolución pública es exacta: permite abrir un enlace conocido sin
-- exponer una lista navegable de nombres editoriales antiguos.
create function public.resolve_tutorial_slug(p_slug text)
returns table (slug text, access_mode text)
language sql
stable
security definer
set search_path = ''
as $$
  select tutorial_item.slug, tutorial_item.access_mode
  from public.tutorial_slug_history history_item
  join public.tutorials tutorial_item on tutorial_item.id = history_item.tutorial_id
  where history_item.slug = p_slug
    and tutorial_item.status = 'published'
  limit 1
$$;

revoke execute on function private.record_tutorial_slug_change() from public, anon, authenticated, service_role;
revoke execute on function public.resolve_tutorial_slug(text) from public, anon, authenticated;
grant execute on function public.resolve_tutorial_slug(text) to anon, authenticated, service_role;

revoke all on table public.tutorial_slug_history from anon, authenticated;
grant select on table public.tutorial_slug_history to authenticated;
grant all on table public.tutorial_slug_history to service_role;

-- Los tutoriales existentes no tienen historial: sólo se registra desde el
-- primer cambio de URL posterior a esta migración.
