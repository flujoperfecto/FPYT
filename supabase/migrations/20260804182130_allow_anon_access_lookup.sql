-- RLS policies on chapters/resources consult this table for gated access.
-- anon needs relation-level SELECT so Postgres can evaluate the policy; with
-- no anon policy on tutorial_access, RLS still returns zero rows.
grant select on table public.tutorial_access to anon;
