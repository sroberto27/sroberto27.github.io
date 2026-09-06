-- F-S01 live exploit, run against the dev database.
--
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "$(head -1 supabase/.temp/pooler-url)" \
--     -f tests/security/probe-fs01-disabled-org-rls.sql
--
-- PASS means: once an organization's status is 'disabled', its still-'active'
-- members can no longer resolve as members through the RLS helpers, so every
-- org-scoped policy that leans on them (organizations_select,
-- organization_members_select, resource_entitlements_select, events_select and
-- the member insert/update/delete policies) closes.
--
-- NON-DESTRUCTIVE BY CONSTRUCTION. The disable happens inside a transaction
-- that ends in ROLLBACK, so the organization is never really disabled and no
-- row survives the run. Do not add a COMMIT.
--
-- Read the two result rows:
--   phase 'ACTIVE  (companion)' -- both booleans MUST be t, before and after
--                                  the fix. This is what stops "deny
--                                  everything" passing as a security fix.
--   phase 'DISABLED (exploit)' -- both booleans MUST be f after the fix.
--                                  Before the fix they were t, which is the
--                                  bug: membership survived the org being
--                                  disabled.
--
-- The counts on the last row show what those booleans actually unlock through
-- the real policies: the org row, the member roster, and every analytics event
-- attributed to the org. After the fix they must all read 0.

\set ON_ERROR_STOP on
\pset pager off

-- Pick a real, populated, currently-active org and one of its org_admins.
-- Captured into psql variables rather than a temp table: after `set role
-- authenticated` a temp table owned by the superuser is not readable, which
-- would fail the probe for a reason that has nothing to do with the finding.
select m.org_id as fix_org, m.user_id as fix_user
from organization_members m
join organizations o on o.id = m.org_id
where o.status = 'active' and m.status = 'active' and m.org_role = 'org_admin'
limit 1
\gset

\echo 'fixture org/user selected (ids not printed)'

begin;

-- ---------- companion: while the org is ACTIVE, access must work ----------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fix_user')::text, true);

select 'ACTIVE  (companion -- both must be t)' as phase,
       public.is_org_member(:'fix_org'::uuid) as is_org_member,
       public.is_org_admin(:'fix_org'::uuid)  as is_org_admin;

reset role;

-- ---------- the exploit: disable the org, membership rows untouched ----------
update organizations set status = 'disabled' where id = :'fix_org'::uuid;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fix_user')::text, true);

select 'DISABLED (exploit -- both must be f)' as phase,
       public.is_org_member(:'fix_org'::uuid) as is_org_member,
       public.is_org_admin(:'fix_org'::uuid)  as is_org_admin;

-- What those booleans unlock, read through the real policies as that user.
select 'rows still readable after disable (all must be 0)' as phase,
       (select count(*) from organizations        where id     = :'fix_org'::uuid) as orgs_visible,
       (select count(*) from organization_members where org_id = :'fix_org'::uuid) as roster_visible,
       (select count(*) from events               where org_id = :'fix_org'::uuid) as events_visible;

reset role;

rollback;

\echo 'rolled back -- the organization was never actually disabled'
