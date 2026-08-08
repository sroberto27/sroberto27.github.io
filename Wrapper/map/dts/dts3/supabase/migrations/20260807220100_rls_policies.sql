-- DTS access model — RLS helper functions and policies.
-- Deny-by-default: every table gets RLS enabled and explicit policies here.
-- See docs/migration/ACCESS-MODEL.md §2-3 and .claude/commands/migrate-phase3.md.

create or replace function public.is_site_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and site_role = 'site_admin'
  );
$$;

create or replace function public.is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = check_org_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_org_admin(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = check_org_id and user_id = auth.uid()
      and org_role = 'org_admin' and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.resource_entitlements enable row level security;
alter table public.client_apps enable row level security;
alter table public.events enable row level security;
alter table public.admin_audit enable row level security;

-- profiles: a user reads/updates their own row; site_admin reads/updates any row.
-- site_role itself stays admin-only via a trigger, not RLS, since RLS is row-level
-- and this needs to be column-level (a user may update display_name on their own
-- row but never their own site_role).
create policy "profiles_select"
  on public.profiles for select
  using (user_id = auth.uid() or public.is_site_admin());

create policy "profiles_update"
  on public.profiles for update
  using (user_id = auth.uid() or public.is_site_admin())
  with check (user_id = auth.uid() or public.is_site_admin());

create function public.protect_site_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.site_role is distinct from old.site_role and not public.is_site_admin() then
    raise exception 'Only site_admin may change site_role';
  end if;
  return new;
end;
$$;

create trigger protect_site_role_trigger
  before update on public.profiles
  for each row execute function public.protect_site_role();

-- organizations: readable by members of that org and site_admin; writable only by site_admin.
create policy "organizations_select"
  on public.organizations for select
  using (public.is_org_member(id) or public.is_site_admin());

create policy "organizations_insert"
  on public.organizations for insert
  with check (public.is_site_admin());

create policy "organizations_update"
  on public.organizations for update
  using (public.is_site_admin())
  with check (public.is_site_admin());

create policy "organizations_delete"
  on public.organizations for delete
  using (public.is_site_admin());

-- organization_members: readable by members of that org and site_admin;
-- insert/update/delete by site_admin OR by org_admin of that same org_id
-- (re-derived server-side via is_org_admin(org_id), never trusted from a client).
create policy "organization_members_select"
  on public.organization_members for select
  using (public.is_org_member(org_id) or public.is_site_admin());

create policy "organization_members_insert"
  on public.organization_members for insert
  with check (public.is_site_admin() or public.is_org_admin(org_id));

create policy "organization_members_update"
  on public.organization_members for update
  using (public.is_site_admin() or public.is_org_admin(org_id))
  with check (public.is_site_admin() or public.is_org_admin(org_id));

create policy "organization_members_delete"
  on public.organization_members for delete
  using (public.is_site_admin() or public.is_org_admin(org_id));

-- resource_entitlements: readable by the entitled subject (user, or a member of
-- the entitled org) and site_admin; writable only by site_admin.
create policy "resource_entitlements_select"
  on public.resource_entitlements for select
  using (
    public.is_site_admin()
    or (subject_type = 'user' and subject_id = auth.uid())
    or (subject_type = 'org' and public.is_org_member(subject_id))
  );

create policy "resource_entitlements_insert"
  on public.resource_entitlements for insert
  with check (public.is_site_admin());

create policy "resource_entitlements_update"
  on public.resource_entitlements for update
  using (public.is_site_admin())
  with check (public.is_site_admin());

create policy "resource_entitlements_delete"
  on public.resource_entitlements for delete
  using (public.is_site_admin());

-- client_apps: readable by any authenticated user (only enabled=true rows unless
-- site_admin); writable only by site_admin.
create policy "client_apps_select"
  on public.client_apps for select
  using (auth.uid() is not null and (enabled = true or public.is_site_admin()));

create policy "client_apps_insert"
  on public.client_apps for insert
  with check (public.is_site_admin());

create policy "client_apps_update"
  on public.client_apps for update
  using (public.is_site_admin())
  with check (public.is_site_admin());

create policy "client_apps_delete"
  on public.client_apps for delete
  using (public.is_site_admin());

-- events: insert allowed for any caller (product analytics, write-only, no
-- sensitive read-back); select scoped to your own org, or site_admin sees all.
create policy "events_insert"
  on public.events for insert
  to anon, authenticated
  with check (true);

create policy "events_select"
  on public.events for select
  using (
    public.is_site_admin()
    or (org_id is not null and public.is_org_member(org_id))
  );

-- admin_audit: no client insert policy at all — only the service role (which
-- bypasses RLS) writes here, via Functions. Select only by site_admin.
create policy "admin_audit_select"
  on public.admin_audit for select
  using (public.is_site_admin());
