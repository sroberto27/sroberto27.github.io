-- Email-domain auto org-assignment.
-- New table lets a site_admin configure one or more email domains per
-- organization (Admin Board, functions/api/admin/organizations/[id]/domains*).
-- handle_new_user() is extended to match a brand-new auth.users row's email
-- domain against this table and, on a match against an ACTIVE org, add the
-- user as a 'member' -- the only way to observe EVERY account-creation path
-- uniformly (self-registration email+password, OAuth, Admin Board
-- create-user, and org invite), since OAuth account creation happens
-- entirely inside Supabase's hosted flow with no DTS server-side request at
-- all. See docs/migration/ACCESS-MODEL.md §1 and §10 for the full rationale
-- -- this is a deliberate, documented exception to "nothing is ever derived
-- from an email address or its domain."

create table public.organization_email_domains (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  domain     text not null,
  created_at timestamptz not null default now()
);

-- Global uniqueness (not per-org) is the enforcement for "a domain may
-- belong to at most one organization" -- there is no existing conflict
-- resolution mechanism to defer to, so this is a hard DB constraint, same
-- as organizations.slug.
create unique index org_email_domains_domain_uidx
  on public.organization_email_domains (lower(domain));

create index org_email_domains_org_id_idx
  on public.organization_email_domains (org_id);

alter table public.organization_email_domains enable row level security;

-- site_admin only, both read and write -- this table isn't surfaced to
-- org_admins anywhere (the Admin Board's Organizations screen is
-- site_admin-only), so there's no case yet for a broader select policy.
create policy "org_email_domains_select"
  on public.organization_email_domains for select
  using (public.is_site_admin());

create policy "org_email_domains_insert"
  on public.organization_email_domains for insert
  with check (public.is_site_admin());

create policy "org_email_domains_update"
  on public.organization_email_domains for update
  using (public.is_site_admin())
  with check (public.is_site_admin());

create policy "org_email_domains_delete"
  on public.organization_email_domains for delete
  using (public.is_site_admin());

-- handle_new_user() -- extended, not replaced. The domain-match/insert logic
-- is wrapped in its own begin/exception block: this function runs inside the
-- SAME transaction as the auth.users insert (security definer, after insert
-- trigger), so an unhandled error here would roll back account creation
-- entirely, on every path, not just fail to auto-assign. The inner block
-- isolates that -- a failure here is logged (raise warning) and swallowed,
-- never allowed to abort the auth.users insert.
--
-- status is 'active', not 'invited': every access decision
-- (functions/_lib/access.js's activeOrgIdsFor(), and is_org_member()/
-- is_org_admin() above) filters on status='active'. An 'invited' row would
-- pass "membership exists" while granting zero real access, silently
-- defeating this feature.
--
-- The organizations.status='active' join matters for the same reason
-- activeOrgIdsFor() itself joins on it (see that function's own comment): a
-- disabled org must not keep silently gaining members.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_org_id uuid;
begin
  insert into public.profiles (user_id, site_role) values (new.id, 'user');

  begin
    select oed.org_id into matched_org_id
    from public.organization_email_domains oed
    join public.organizations o on o.id = oed.org_id
    where lower(oed.domain) = lower(split_part(new.email, '@', 2))
      and o.status = 'active'
    limit 1;

    if matched_org_id is not null then
      insert into public.organization_members (org_id, user_id, org_role, status)
      values (matched_org_id, new.id, 'member', 'active')
      on conflict (org_id, user_id) do nothing;
    end if;
  exception when others then
    raise warning 'handle_new_user: domain auto-assign failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
