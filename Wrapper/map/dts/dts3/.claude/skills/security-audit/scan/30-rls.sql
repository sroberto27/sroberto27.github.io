-- 30-rls.sql -- the live-catalog half of the RLS check.
--
-- Run against a real database only. 30-rls.sh applies this automatically when
-- psql and SUPABASE_DB_URL are both available, and falls back to the static
-- migration reader otherwise.
--
--   psql "$SUPABASE_DB_URL" -f 30-rls.sql
--
-- Read-only: every statement here is a SELECT. It is safe against dev. Against
-- production it still counts as touching production and needs the same
-- per-run confirmation as anything else (references/50-pentest.md).
--
-- Where this beats the static reader: it sees the database as it actually is,
-- including anything applied by hand or through the dashboard that never made
-- it into a committed migration. Drift between the two is usually the most
-- interesting thing the supabase scope finds.

\pset pager off
\pset format aligned

\echo ''
\echo '=== 1. Tables in exposed schemas: RLS status ==='
-- A table with rowsecurity = false that the Data API exposes is readable by
-- anyone holding the publishable key. relforcerowsecurity matters because
-- without it the table owner bypasses every policy.
SELECT n.nspname            AS schema,
       c.relname            AS table,
       c.relrowsecurity     AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'storage')
ORDER BY c.relrowsecurity, n.nspname, c.relname;

\echo ''
\echo '=== 2. Tables with RLS enabled but NO policies (deny-all) ==='
-- Not a vulnerability -- the opposite -- but it silently breaks features and
-- is often mistaken for one. Listed so it is not reported as a finding.
SELECT n.nspname AS schema, c.relname AS table
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);

\echo ''
\echo '=== 3. Every policy, in full ==='
-- qual is the USING expression, with_check is WITH CHECK. Read both.
SELECT schemaname AS schema,
       tablename  AS table,
       policyname AS policy,
       permissive,
       roles,
       cmd,
       qual       AS using_expr,
       with_check AS with_check_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, cmd, policyname;

\echo ''
\echo '=== 4. Unconditional predicates ==='
-- USING(true) on SELECT is often a deliberately public table. On a write
-- command it means any caller the policy applies to can write any row.
SELECT schemaname, tablename, policyname, cmd, roles,
       qual AS using_expr, with_check AS with_check_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND (btrim(coalesce(qual, ''))       IN ('true', '(true)')
    OR btrim(coalesce(with_check, '')) IN ('true', '(true)'))
ORDER BY cmd, tablename;

\echo ''
\echo '=== 5. Write policies with no WITH CHECK ==='
-- For INSERT there is no USING clause, so no WITH CHECK means unrestricted
-- insert. For UPDATE, Postgres defaults WITH CHECK to the USING expression,
-- which is safe only if that expression constrains the NEW row too -- this is
-- how a caller who legitimately owns a row rewrites it into one they should
-- not own (flipping org_id, escalating a role column).
SELECT schemaname, tablename, policyname, cmd, roles, qual AS using_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND cmd IN ('INSERT', 'UPDATE', 'ALL')
  AND with_check IS NULL
ORDER BY tablename, cmd;

\echo ''
\echo '=== 6. Table privileges granted to anon / authenticated ==='
-- RLS only constrains a role that has table access at all. A GRANT to anon on
-- a table whose policies assume an authenticated caller is the combination
-- that matters.
SELECT table_schema, table_name, grantee,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'authenticated')
  AND table_schema IN ('public', 'storage')
GROUP BY table_schema, table_name, grantee
ORDER BY grantee, table_schema, table_name;

\echo ''
\echo '=== 7. Sequence and function privileges for anon ==='
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE grantee = 'anon' AND routine_schema = 'public'
ORDER BY routine_name;

\echo ''
\echo '=== 8. SECURITY DEFINER functions and their search_path ==='
-- A SECURITY DEFINER function runs as its owner and bypasses RLS. Without a
-- pinned search_path, a caller able to create objects in an earlier schema on
-- the path can shadow something the body references and have it run with the
-- owner's privileges.
SELECT n.nspname AS schema,
       p.proname AS function,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       coalesce(array_to_string(p.proconfig, ', '), '(none)') AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY (p.proconfig IS NULL) DESC, n.nspname, p.proname;

\echo ''
\echo '=== 9. Views: ownership and security_invoker ==='
-- A view runs with its owner's privileges and does NOT inherit the underlying
-- table's RLS unless declared security_invoker (PG15+). A view over an
-- RLS-protected table is a standard way to publish everything by accident.
SELECT c.relname AS view,
       pg_get_userbyid(c.relowner) AS owner,
       coalesce(
         (SELECT option_value
          FROM pg_options_to_table(c.reloptions)
          WHERE option_name = 'security_invoker'),
         'false') AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm') AND n.nspname = 'public'
ORDER BY security_invoker, c.relname;

\echo ''
\echo '=== 10. Storage buckets ==='
SELECT id, name, public,
       file_size_limit,
       allowed_mime_types,
       created_at
FROM storage.buckets
ORDER BY public DESC, name;

\echo ''
\echo '=== 11. Triggers on tables that carry privilege columns ==='
-- Where a trigger is what stops a user editing their own role or org
-- membership, it is load-bearing authorization. Read its body, and ask what
-- happens on the bootstrap path (the first admin, a NULL old row, a
-- service-role write).
SELECT c.relname AS table, t.tgname AS trigger,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname = 'public'
ORDER BY c.relname, t.tgname;

\echo ''
\echo '=== 12. Extensions installed in public ==='
-- An extension in the public schema is reachable by anon if anon has USAGE.
SELECT e.extname, n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY n.nspname, e.extname;

\echo ''
\echo 'Done. Compare section 1/3 against scan/lib/rls-static.mjs output for the'
\echo 'committed migrations. Any difference is drift between what is committed'
\echo 'and what is deployed, and is usually the most interesting result here.'
