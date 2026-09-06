#!/usr/bin/env bash
# 30-rls.sh -- RLS posture.
#
# Live catalog when it can reach one, committed migrations otherwise:
#
#   psql + SUPABASE_DB_URL present  ->  30-rls.sql against the real database
#   otherwise                       ->  lib/rls-static.mjs over the migrations,
#                                       reported as DEGRADED
#
# When both are available it runs both, because the difference between them is
# drift between what is committed and what is deployed, and that gap is where
# this class of bug actually lives.
#
# Whatever this prints, remember what it is: an inventory of what the policies
# ARE. Whether a policy's logic is CORRECT is the reasoning half of the
# supabase scope -- references/20-supabase.md.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "30-rls -- row level security posture"
cd "$PROJECT_DIR" || exit 1

MIGRATIONS="supabase/migrations"
ran_live=0

# ---------------------------------------------------------------------------
section "Live catalog"
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  emit SKIPPED "rls-live" "SUPABASE_DB_URL not set -- no live database to read"
  printf '  To enable: export SUPABASE_DB_URL="postgresql://...".\n'
  printf '  Use the DEV project connection string. Production needs the same\n'
  printf '  explicit per-run confirmation as any other production access.\n'
elif ! have psql; then
  degraded_because "rls-live" "psql" "$(tool_install_hint psql)" \
    "SUPABASE_DB_URL is set but there is no client to use it with"
elif [ "$OFFLINE" = "1" ]; then
  emit SKIPPED "rls-live" "--offline"
else
  emit OK "rls-live" "psql + SUPABASE_DB_URL present -- reading the real catalog"
  # The URL carries a password. Never echo it; never let psql's own error
  # output carry it into the results file unredacted.
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=0 -f "$SCAN_DIR/30-rls.sql" 2>&1 |
    redact | sed 's/^/  /'
  ran_live=1
fi

# ---------------------------------------------------------------------------
section "Committed migrations"
if [ ! -d "$MIGRATIONS" ]; then
  emit SKIPPED "rls-static" "no $MIGRATIONS directory"
  exit 0
fi

if [ "$ran_live" = "1" ]; then
  emit OK "rls-static" "running alongside the live read so the two can be compared"
else
  degraded_because "rls-static" "psql/SUPABASE_DB_URL" \
    "$(tool_install_hint psql)  + export SUPABASE_DB_URL=..." \
    "reading the committed migrations instead of the live catalog"
fi

node "$LIB_DIR/rls-static.mjs" "$MIGRATIONS" 2>&1 | redact

# ---------------------------------------------------------------------------
section "Client-side direct table access"
#
# Anything the browser reads with the publishable key goes straight to
# PostgREST, where RLS is the ONLY thing standing between a visitor and the
# table. Every one of these call sites is a place where a wrong policy is
# immediately exploitable, so they are the priority list for policy review.
#
# Contrast with the Functions, which use the service role and bypass RLS
# entirely -- those are audited under the app scope, not here.
printf '  supabase-js .from() / .rpc() calls in client code:\n'
found=0
while read -r hit; do
  printf '    %s\n' "$hit"
  found=1
done < <(grep -rnoE '\.(from|rpc)\("[^"]+"' js 2>/dev/null | tr '\\' '/')
if [ "$found" = "0" ]; then
  printf '    (none found)\n'
  emit OK "client-direct-tables" "no direct .from()/.rpc() calls in js/"
else
  emit LEAD "client-direct-tables" "client reads tables directly -- RLS is the only control on these; review their policies first"
fi

printf '\n  auth calls in client code (the identity these policies trust):\n'
grep -rnoE 'auth\.[a-zA-Z]+\(' js 2>/dev/null | tr '\\' '/' | sed 's/^/    /' | head -20
