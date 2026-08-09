-- Phase 8: client_apps needs its own access level, same 4-tier vocabulary as
-- project/gismap documents (ACCESS-MODEL.md §3), so a download can be
-- public/registered/client/restricted like any other resource_key. Phase 3's
-- original schema only ever gave it `enabled` -- the level was never added
-- because nothing exercised anything but the implicit "restricted" case
-- until this phase's own step 5 (a hypothetical public installer) called for
-- real per-app configurability. Defaults every existing row (today: just the
-- dummy seed) to 'restricted', the safe default for gated software.
alter table public.client_apps
  add column access text not null default 'restricted'
    check (access in ('public', 'registered', 'client', 'restricted'));
