-- Security audit 2026-09-06, finding F-S03.
--
-- client_apps_select permits any authenticated caller to read enabled rows.
-- RLS is row-level, not column-level, so permitting the row permitted every
-- column of it -- including r2_object_key, the private R2 object path for each
-- build. js/app.js's computeAccessibleDownloads() asks for four columns, but
-- nothing stopped a caller asking for select=* and getting the rest.
--
-- Impact is genuinely low: dts-builds is a private R2 bucket reached through a
-- Worker binding, so knowing an object key grants no access to the object, and
-- downloads stay gated by /api/download/<key>. This is internal-path
-- disclosure and defence in depth, not a live hole -- it is fixed because it
-- costs nothing, not because it was dangerous.
--
-- Column-level privileges have one trap worth spelling out: a table-level
-- SELECT grant covers every column, and a column-level REVOKE does NOT carve
-- an exception out of it. The only thing that works is to drop the table-level
-- grant and re-grant the columns that should stay readable. Hence the shape
-- below rather than a single REVOKE.
--
-- Not affected:
--   * service_role -- functions/api/admin/apps*.js and
--     functions/api/download/[key].js read r2_object_key through the service
--     role, which is untouched here. The Admin Board reaches them via
--     adminFetch("/api/admin/apps"), never a direct client-side Supabase read.
--   * js/app.js:2214 -- selects key, name, platform, version explicitly, all
--     of which remain granted.
--
-- The consequence to know about: `select=*` on client_apps now fails for an
-- anon/authenticated caller instead of silently returning everything. That is
-- the intended behaviour, and it is why the columns are listed explicitly --
-- a column added later is NOT readable by the browser until someone adds it
-- here on purpose.

revoke select on public.client_apps from anon, authenticated;

grant select (
  id,
  key,
  name,
  platform,
  version,
  enabled,
  created_at,
  updated_at
) on public.client_apps to anon, authenticated;
