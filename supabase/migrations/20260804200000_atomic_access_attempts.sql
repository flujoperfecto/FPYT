create function public.check_and_record_access_attempt(
  p_user_id uuid,
  p_max_attempts int default 10,
  p_window interval default interval '1 hour'
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attempt_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from public.access_attempts
  where user_id = p_user_id
    and requested_at < now() - p_window;

  select count(*) into attempt_count
  from public.access_attempts
  where user_id = p_user_id;

  if attempt_count >= p_max_attempts then
    return false;
  end if;

  insert into public.access_attempts (user_id) values (p_user_id);
  return true;
end;
$$;

revoke execute on function public.check_and_record_access_attempt(uuid, int, interval) from public, anon, authenticated;
grant execute on function public.check_and_record_access_attempt(uuid, int, interval) to service_role;
