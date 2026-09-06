#!/usr/bin/env bash
# 60-cors.sh -- can another origin read these responses?
#
# The check that matters is narrow and often misread. Absent CORS headers are
# the SECURE state: the browser blocks a cross-origin read by default. Finding
# nothing here is a pass, and should be reported as one rather than as
# "CORS not tested".
#
# What is actually dangerous:
#   * Access-Control-Allow-Origin reflecting whatever Origin was sent, together
#     with Allow-Credentials: true -- any site can then read authenticated
#     responses as the victim.
#   * ACAO: * on a route that returns per-user data. (The browser refuses to
#     combine * with credentials, so this leaks only what an anonymous caller
#     could already fetch -- real, but lower.)
#   * A permissive Access-Control-Allow-Headers letting an attacker page attach
#     an Authorization header cross-origin.
#
# Supabase's own PostgREST endpoint answers * by design; that is upstream
# behaviour and not this project's finding. It is why RLS has to be right.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "60-cors -- cross-origin reachability"
guard_target || exit 0
cd "$PROJECT_DIR" || exit 1

if ! net_ready; then
  emit SKIPPED "cors" "offline or curl unavailable"
  exit 0
fi

HOSTILE="https://evil.example.com"

# ---------------------------------------------------------------------------
section "Routes under test"
ROUTES="/ /data/manifest.json /api/track /api/resource/project.test /api/admin/users /api/publish"
printf '  %s\n' "$ROUTES"

# cors_probe <path>
cors_probe() {
  local path="$1"
  local h acao acac acah acam vary status

  h="$(fetch_headers "$TARGET$path" -H "Origin: $HOSTILE")"
  status="$(printf '%s' "$h" | head -1 | sed 's/\r$//')"
  acao="$(printf '%s' "$h" | grep -i '^access-control-allow-origin:'      | head -1 | sed 's/\r$//')"
  acac="$(printf '%s' "$h" | grep -i '^access-control-allow-credentials:' | head -1 | sed 's/\r$//')"
  vary="$(printf '%s' "$h" | grep -i '^vary:'                            | head -1 | sed 's/\r$//')"

  printf '\n  %s\n' "$path"
  printf '    %s\n' "$status"
  printf '    ACAO        : %s\n' "${acao:-(none)}"
  printf '    ACA-Creds   : %s\n' "${acac:-(none)}"
  printf '    Vary        : %s\n' "${vary:-(none)}"

  if [ -z "$acao" ]; then
    emit OK "cors$path" "no Access-Control-Allow-Origin -- cross-origin reads blocked by the browser"
    return 0
  fi

  # Reflection: does the response echo back whatever Origin we sent?
  if printf '%s' "$acao" | grep -qF "$HOSTILE"; then
    if printf '%s' "$acac" | grep -qi 'true'; then
      emit LEAD "cors$path" "REFLECTS a hostile Origin AND allows credentials -- any site can read authenticated responses as the victim"
    else
      emit LEAD "cors$path" "reflects a hostile Origin (no credentials) -- any site can read what an anonymous caller could fetch"
    fi
    if [ -z "$vary" ] || ! printf '%s' "$vary" | grep -qi origin; then
      printf '    and no Vary: Origin, so a shared cache can serve one origin the\n'
      printf '    response computed for another\n'
    fi
  elif printf '%s' "$acao" | grep -q '\*'; then
    if printf '%s' "$acac" | grep -qi 'true'; then
      emit LEAD "cors$path" "ACAO * with Allow-Credentials -- browsers reject this combination, so it is a config error rather than an exploit, but it means the intent was wrong"
    else
      emit LEAD "cors$path" "ACAO * -- confirm this route never returns per-user data"
    fi
  else
    emit OK "cors$path" "ACAO present but does not reflect a hostile Origin"
  fi
}

for r in $ROUTES; do cors_probe "$r"; done

# ---------------------------------------------------------------------------
section "Preflight handling"
#
# A route that answers OPTIONS with a permissive Allow-Headers can be called
# cross-origin with an Authorization header attached.
for path in /api/track /api/admin/users; do
  printf '\n  OPTIONS %s\n' "$path"
  fetch_headers "$TARGET$path" \
    -X OPTIONS \
    -H "Origin: $HOSTILE" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type" |
    grep -iE '^(HTTP|access-control|allow)' | sed 's/^/    /' || true
done
printf '\n  No Access-Control-Allow-* in a preflight response means the browser\n'
printf '  refuses the cross-origin call. That is the intended state here.\n'

# ---------------------------------------------------------------------------
section "Credentialed cross-origin request"
#
# The concrete question: with a hostile Origin and a cookie jar, does anything
# come back that the browser would let evil.example.com read?
printf '  GET / with Origin: %s and credentials:\n' "$HOSTILE"
fetch_headers "$TARGET/" -H "Origin: $HOSTILE" -H "Cookie: session=probe" |
  grep -iE '^(HTTP|access-control|set-cookie|vary)' | sed 's/^/    /' || true

# ---------------------------------------------------------------------------
section "Cookies"
#
# This project authenticates with a bearer token in localStorage rather than a
# cookie, which sidesteps CSRF but exposes the token to any XSS. If a Set-Cookie
# appears here, that assumption has changed and CSRF becomes live again.
sc="$(fetch_headers "$TARGET/" | grep -i '^set-cookie:' || true)"
if [ -n "$sc" ]; then
  emit LEAD "cookies" "the site sets cookies -- check SameSite/Secure/HttpOnly, and reconsider CSRF, which a bearer-token model does not have"
  printf '%s\n' "$sc" | redact | sed 's/^/    /'
else
  emit OK "cookies" "no Set-Cookie on the root response"
  printf '    Session state is therefore not cookie-borne. CSRF is largely moot;\n'
  printf '    XSS is correspondingly worse, because script on the page can read\n'
  printf '    the token directly. Weigh XSS findings with that in mind.\n'
fi

# ---------------------------------------------------------------------------
section "Supabase endpoint CORS (upstream, for context)"
SUPA_URL="$(grep -oE 'https://[a-z0-9]+\.supabase\.co' js/supabase-init.js 2>/dev/null | head -1)"
SUPA_URL="${SUPA_URL:-$DEV_SUPABASE}"
printf '  %s/rest/v1/ with a hostile Origin:\n' "$SUPA_URL"
fetch_headers "$SUPA_URL/rest/v1/" -H "Origin: $HOSTILE" |
  grep -iE '^(HTTP|access-control)' | sed 's/^/    /' || true
printf '\n  Supabase answers * here by design so browsers can call it directly.\n'
printf '  That is upstream behaviour, not a finding against this project -- and\n'
printf '  it is precisely why the RLS policies have to be correct. Anything the\n'
printf '  publishable key can read, any website can read.\n'
