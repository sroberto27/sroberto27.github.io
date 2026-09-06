-- Security audit 2026-09-06, finding F-S01.
--
-- is_org_member() and is_org_admin() filtered on the MEMBERSHIP row's status
-- and never on the ORGANIZATION's own status. Every org-scoped RLS policy
-- leans on these two functions, so disabling an organization revoked nothing
-- on the browser -> Supabase direct path: its members kept reading the
-- organizations row, the full member roster, the org's resource_entitlements
-- and every events row attributed to it, and an org_admin kept the ability to
-- insert, update and delete membership rows.
--
-- The Functions path already got this right. functions/_lib/access.js's
-- activeOrgIdsFor() joins organizations and filters organizations.status,
-- and its comment records that the join was added during Phase 5b precisely
-- because "a disabled org's still-'active' membership rows previously kept
-- granting client-level access with zero enforcement, making 'disable' purely
-- cosmetic." That fix was never mirrored into the RLS helpers, so the same
-- bug survived on the path where RLS is the only control.
--
-- What this does NOT change: checkAccess() -> hasActiveOrgMembership() ->
-- activeOrgIdsFor() already denied client-level resources for a disabled org,
-- so gated projects, experiences, GIS maps and downloads behaved correctly
-- before and behave identically after. This closes the direct-PostgREST half.
--
-- Both functions are create-or-replace, so no policy is dropped or recreated
-- and no policy text changes -- the 25 existing policies keep working, they
-- just get a correct answer from these two helpers.
--
-- Reactivating an organization restores everything, exactly as the Admin
-- Board's own confirm dialog promises: nothing here deletes a membership or
-- an entitlement row.

create or replace function public.is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.org_id = check_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
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
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.org_id = check_org_id
      and m.user_id = auth.uid()
      and m.org_role = 'org_admin'
      and m.status = 'active'
      and o.status = 'active'
  );
$$;
