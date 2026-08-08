-- Fix: protect_site_role() as written blocks even a legitimate backend/service
-- connection from setting site_role, because auth.uid() is NULL for such a
-- connection (empirically confirmed — no request.jwt.claims session setting
-- exists outside a PostgREST-mediated request). This makes it impossible to
-- ever bootstrap the first site_admin.
--
-- Safe to allow when auth.uid() is null: an anonymous end-user request via
-- PostgREST also has auth.uid() = null, but profiles_update's own USING clause
-- (user_id = auth.uid() OR is_site_admin()) already evaluates false for every
-- row in that case, so RLS filters the update down to zero rows before this
-- trigger ever fires for them. The only connections that reach this trigger
-- with auth.uid() null AND at least one row selected are backend/service
-- connections that already bypass RLS entirely on every other table — this
-- does not open a new hole, it just stops closing off a path that was already
-- trusted everywhere else.
create or replace function public.protect_site_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.site_role is distinct from old.site_role
     and auth.uid() is not null
     and not public.is_site_admin() then
    raise exception 'Only site_admin may change site_role';
  end if;
  return new;
end;
$$;
