-- F-S03 live check, run against the dev database. READ-ONLY: no writes, no
-- transaction state left behind.
--
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "$(head -1 supabase/.temp/pooler-url)" \
--     -f tests/security/probe-fs03-client-apps-columns.sql
--
-- PASS means: an authenticated caller can still read the four columns the
-- client portal actually uses, and can NOT read r2_object_key.
--
-- Before the fix the r2_object_key select succeeded and printed real R2 object
-- paths. After it, that select must fail with "permission denied for column
-- r2_object_key", while the four-column select must still return rows -- the
-- companion half, without which revoking everything would look like a pass.
--
-- ON_ERROR_STOP is deliberately OFF: the expected post-fix outcome is an
-- error, and the script needs to continue past it to run the companion.

\set ON_ERROR_STOP off
\pset pager off

-- Any real signed-in user. Which one does not matter: client_apps_select's
-- predicate is only `auth.uid() is not null`, which is the point of F-S03.
select user_id as fix_user from profiles limit 1
\gset

-- Two separate transactions on purpose. The expected post-fix result of the
-- first is an ERROR, which aborts its transaction -- anything sharing that
-- transaction would then fail with "current transaction is aborted" and the
-- companion would look broken when it is actually fine.

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fix_user')::text, true);
\echo '--- EXPLOIT: reading r2_object_key as a plain authenticated user (must fail after the fix) ---'
select id, r2_object_key from public.client_apps limit 5;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fix_user')::text, true);
\echo '--- COMPANION: the columns the portal actually uses (must still return rows) ---'
select key, name, platform, version from public.client_apps where enabled = true limit 5;
rollback;
