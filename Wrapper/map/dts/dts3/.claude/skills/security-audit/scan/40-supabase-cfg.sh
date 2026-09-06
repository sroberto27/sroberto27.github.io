#!/usr/bin/env bash
# 40-supabase-cfg.sh -- auth settings, storage buckets, redirect allowlist,
# edge functions.
#
# Two sources, and they answer different questions:
#
#   supabase/config.toml  -- what the LOCAL dev stack would be configured as.
#                            On a project that runs against a hosted Supabase
#                            and seeds through a script rather than
#                            `supabase start`, this file can be almost entirely
#                            defaults and tell you nothing about production.
#                            Read it, but do not trust it as the live config.
#   the live project      -- GoTrue publishes its own settings unauthenticated
#                            at /auth/v1/settings. That is the real answer for
#                            providers, signup, and confirmation.
#
# Storage buckets and the redirect allowlist need credentials this script
# deliberately does not want. It says so rather than guessing.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "40-supabase-cfg -- auth settings, storage, redirects"
cd "$PROJECT_DIR" || exit 1

# Resolve the project URL from the client init file rather than hardcoding it,
# so this keeps working after handoff moves the project.
SUPA_URL="${SUPABASE_URL:-}"
if [ -z "$SUPA_URL" ] && [ -f js/supabase-init.js ]; then
  SUPA_URL="$(grep -oE 'https://[a-z0-9]+\.supabase\.co' js/supabase-init.js | head -1)"
fi
SUPA_URL="${SUPA_URL:-$DEV_SUPABASE}"

PUB_KEY="$(grep -oE '(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]{40,})' js/supabase-init.js 2>/dev/null | head -1)"

printf '  project url : %s\n' "$SUPA_URL"
printf '  client key  : %s\n' "$([ -n "$PUB_KEY" ] && printf 'found in js/supabase-init.js (publishable, not printed)' || printf 'NOT FOUND')"

# ---------------------------------------------------------------------------
section "config.toml"
if [ ! -f supabase/config.toml ]; then
  emit SKIPPED "config-toml" "no supabase/config.toml"
else
  show() {
    local key="$1"
    grep -nE "^[[:space:]]*$key[[:space:]]*=" supabase/config.toml 2>/dev/null |
      head -3 | sed 's/^/    /'
  }
  printf '  Selected keys (local dev stack config -- see the header note):\n'
  for k in enable_signup enable_confirmations enable_anonymous_sign_ins \
           jwt_expiry enable_refresh_token_rotation refresh_token_reuse_interval \
           minimum_password_length site_url max_frequency; do
    out="$(show "$k")"
    [ -n "$out" ] && printf '  %s:\n%s\n' "$k" "$out"
  done

  printf '\n  additional_redirect_urls:\n'
  grep -nA6 'additional_redirect_urls' supabase/config.toml 2>/dev/null | sed 's/^/    /' | head -12

  printf '\n  enabled external auth providers in config.toml:\n'
  awk '/^\[auth\.external\./{p=$0} /^[[:space:]]*enabled[[:space:]]*=[[:space:]]*true/{if(p)print "    "p}' \
    supabase/config.toml 2>/dev/null

  emit OK "config-toml" "parsed (describes the LOCAL stack; the live project is authoritative)"
fi

# ---------------------------------------------------------------------------
section "Live auth settings"
#
# GoTrue exposes this unauthenticated. It is the ground truth for which
# providers are actually on, whether signup is open, and whether email
# confirmation is required.
if ! net_ready; then
  emit SKIPPED "auth-settings" "offline or curl unavailable"
else
  settings="$(fetch_body "$SUPA_URL/auth/v1/settings" -H "apikey: ${PUB_KEY:-none}")"
  if printf '%s' "$settings" | grep -q 'external'; then
    printf '%s\n' "$settings" > "${TMPDIR:-/tmp}/dts-auth-settings.json"

    printf '  external providers reported ENABLED by the live project:\n'
    json_query "${TMPDIR:-/tmp}/dts-auth-settings.json" \
      'Object.entries(d.external||{}).filter(function(e){return e[1];}).map(function(e){return "    "+e[0];}).join("\n") || "    (none)"'
    printf '\n\n  disabled providers:\n'
    json_query "${TMPDIR:-/tmp}/dts-auth-settings.json" \
      'Object.entries(d.external||{}).filter(function(e){return !e[1];}).map(function(e){return "    "+e[0];}).join("\n") || "    (none)"'

    printf '\n\n  signup / confirmation:\n'
    json_query "${TMPDIR:-/tmp}/dts-auth-settings.json" \
      '["disable_signup","mailer_autoconfirm","phone_autoconfirm","saml_enabled"].map(function(k){return "    "+k+" = "+JSON.stringify(d[k]);}).join("\n")'
    printf '\n'

    autoconf="$(json_query "${TMPDIR:-/tmp}/dts-auth-settings.json" 'String(!!d.mailer_autoconfirm)')"
    if [ "$autoconf" = "true" ]; then
      emit LEAD "mailer-autoconfirm" "email addresses are auto-confirmed -- anyone can register as any address without proving they control it"
    else
      emit OK "mailer-autoconfirm" "email confirmation is required"
    fi

    nosignup="$(json_query "${TMPDIR:-/tmp}/dts-auth-settings.json" 'String(!!d.disable_signup)')"
    printf '  open signup: %s\n' "$([ "$nosignup" = "true" ] && printf 'no (disabled)' || printf 'YES -- anyone can create an account')"
    printf '  Whether open signup is correct depends on the access model. Read it\n'
    printf '  before deciding: on this project a self-registered account is meant\n'
    printf '  to reach "registered" content and nothing more, so open signup is\n'
    printf '  only a finding if a self-registered user can reach further.\n'

    # A provider enabled in the live project but not wired in the UI (or the
    # reverse) is a drift signal worth catching.
    printf '\n  providers referenced in client code:\n'
    grep -rhoE "signInWithOAuth\([^)]*provider: *['\"][a-z]+['\"]" js 2>/dev/null |
      grep -oE "['\"][a-z]+['\"]$" | tr -d "\"'" | sort -u | sed 's/^/    /'
    printf '  Compare against the enabled list above. A button for a disabled\n'
    printf '  provider is a broken feature, not a vulnerability -- report it as\n'
    printf '  such, and check WEBSITE-STATE.md, which may already record it.\n'

    rm -f "${TMPDIR:-/tmp}/dts-auth-settings.json"
    emit OK "auth-settings" "read from the live project"
  else
    emit ERROR "auth-settings" "unexpected response from $SUPA_URL/auth/v1/settings"
  fi
fi

# ---------------------------------------------------------------------------
section "Anonymous PostgREST reachability"
#
# The single most direct question in the supabase scope: with nothing but the
# publishable key that ships to every browser, what can be read?
if ! net_ready || [ -z "$PUB_KEY" ]; then
  emit SKIPPED "anon-postgrest" "offline, or no publishable key found in js/supabase-init.js"
else
  printf '  Probing each table named in the migrations with the publishable key\n'
  printf '  and no session. HTTP 200 with rows means anon can read it.\n\n'
  tables="$(grep -hoiE 'create table (if not exists )?(public\.)?[a-z0-9_]+' supabase/migrations/*.sql 2>/dev/null |
            sed -E 's/.*[[:space:]]//; s/^public\.//' | sort -u)"
  readable=0
  for t in $tables; do
    code_size="$(fetch_status_size "$SUPA_URL/rest/v1/$t?select=*&limit=1" \
      -H "apikey: $PUB_KEY")"
    code="${code_size%% *}"
    size="${code_size##* }"
    printf '    %-32s HTTP %s  %s bytes\n' "$t" "$code" "$size"
    if [ "$code" = "200" ] && [ "${size:-0}" -gt 2 ]; then
      readable=$((readable + 1))
    fi
  done
  if [ "$readable" -gt 0 ]; then
    emit LEAD "anon-postgrest" "$readable table(s) returned rows to an unauthenticated caller -- read each policy before judging; some tables are meant to be public"
  else
    emit OK "anon-postgrest" "no table returned rows to an unauthenticated caller"
  fi
  printf '\n  A 200 with an empty array is RLS working correctly, not a finding.\n'
  printf '  A 401/404 usually means the table is not exposed through the API.\n'
fi

# ---------------------------------------------------------------------------
section "Storage buckets"
#
# Listing buckets needs the service role, which this script will not take. The
# public-bucket question is answerable without it: a public bucket serves
# objects to anyone who knows the path.
if ! net_ready; then
  emit SKIPPED "storage" "offline"
else
  code_size="$(fetch_status_size "$SUPA_URL/storage/v1/bucket" -H "apikey: ${PUB_KEY:-none}")"
  printf '  GET /storage/v1/bucket (anon): HTTP %s\n' "${code_size%% *}"
  case "${code_size%% *}" in
    200) emit LEAD "storage-bucket-list" "an unauthenticated caller can enumerate storage buckets" ;;
    400|401|403) emit OK "storage-bucket-list" "bucket listing requires credentials" ;;
    404) emit OK "storage-bucket-list" "storage API not reachable / not in use" ;;
    *)   emit SKIPPED "storage-bucket-list" "unexpected HTTP ${code_size%% *}" ;;
  esac
  printf '\n  Per-bucket visibility and signed-URL TTLs need the service role.\n'
  printf '  This script does not take a service-role key. Get them from section 10\n'
  printf '  of 30-rls.sql against the live database, or from the dashboard, and\n'
  printf '  record the answer in the report rather than leaving it unstated.\n'
fi

# ---------------------------------------------------------------------------
section "Edge functions"
if [ -d supabase/functions ]; then
  ls -1 supabase/functions | sed 's/^/    /'
  printf '\n  Check verify_jwt for each in config.toml. A function with\n'
  printf '  verify_jwt = false is an unauthenticated public endpoint.\n'
  grep -nB2 -A2 'verify_jwt' supabase/config.toml 2>/dev/null | sed 's/^/    /'
  emit LEAD "edge-functions" "edge functions exist -- confirm each one's verify_jwt setting"
else
  emit OK "edge-functions" "no supabase/functions directory -- no edge functions to audit"
  printf '  Server-side logic on this project lives in Cloudflare Pages Functions\n'
  printf '  instead. That is the app scope, not this one.\n'
fi
