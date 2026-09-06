#!/usr/bin/env bash
# 50-headers.sh -- what the deployed target actually sends.
#
# The point of this script is the comparison, not the checklist. A _headers
# file in the repo proves an intention; only a response proves a header is
# being served. Cloudflare Pages applies _headers to static assets but a
# Functions response builds its own headers in code, so the two halves of the
# site can and do differ -- and the Functions half is the one serving gated
# data.
#
# Before reporting any header as missing or weak, check whether the project
# documented it as deliberate. This repo has a documented, user-approved
# decision to broaden several CSP directives; re-reporting that every run is
# noise and erodes trust in the rest of the output.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "50-headers -- security headers on the deployed target"
guard_target || exit 0
cd "$PROJECT_DIR" || exit 1

if ! net_ready; then
  emit SKIPPED "headers" "offline or curl unavailable -- nothing here can be answered from the repo alone"
  printf '  The repo _headers file states an INTENTION. Only a live response\n'
  printf '  proves what is served. Do not substitute one for the other.\n'
  exit 0
fi

HDRS="$(fetch_headers "$TARGET/")"
if [ -z "$HDRS" ]; then
  emit ERROR "headers" "no response from $TARGET"
  exit 0
fi

# ---------------------------------------------------------------------------
section "Response headers from $TARGET/"
printf '%s\n' "$HDRS" | sed 's/^/  /'

hget() { printf '%s\n' "$HDRS" | grep -i "^$1:" | head -1 | sed 's/\r$//'; }

# ---------------------------------------------------------------------------
section "Header checks"

check_present() {
  local header="$1" why="$2"
  local v
  v="$(hget "$header")"
  if [ -n "$v" ]; then
    emit OK "hdr-$header" "present"
  else
    emit LEAD "hdr-$header" "absent -- $why"
  fi
}

check_present "strict-transport-security" "no HSTS; a first visit over http is downgradeable"
check_present "x-content-type-options"    "no nosniff; the browser may MIME-sniff a response into a script"
check_present "referrer-policy"           "full URLs leak to third parties on outbound navigation"
check_present "content-security-policy"   "no CSP; any injected script executes freely"
check_present "permissions-policy"        "camera/microphone/geolocation are not restricted for the page or its frames"

# Clickjacking. frame-ancestors in CSP supersedes X-Frame-Options; either is
# acceptable, neither is not. Relevant here because the site embeds a
# third-party tour in an iframe, which is the reverse direction and does not
# help.
csp="$(hget content-security-policy)"
xfo="$(hget x-frame-options)"
if printf '%s' "$csp" | grep -qi 'frame-ancestors'; then
  emit OK "clickjacking" "CSP frame-ancestors present"
elif [ -n "$xfo" ]; then
  emit OK "clickjacking" "X-Frame-Options present ($xfo)"
else
  emit LEAD "clickjacking" "neither CSP frame-ancestors nor X-Frame-Options -- the site can be framed by any origin"
fi

if printf '%s' "$csp" | grep -qi 'form-action'; then
  emit OK "csp-form-action" "form-action present"
else
  emit LEAD "csp-form-action" "no form-action -- an injected form can post to any origin"
fi

# ---------------------------------------------------------------------------
section "CSP directive detail"
if [ -n "$csp" ]; then
  printf '%s' "$csp" | sed 's/; */;\n    /g' | sed 's/^/  /'
  printf '\n'
  for weak in "'unsafe-inline'" "'unsafe-eval'" "data:" "*"; do
    if printf '%s' "$csp" | grep -qF "$weak"; then
      printf '  contains %s\n' "$weak"
    fi
  done
  if printf '%s' "$csp" | grep -qE "script-src[^;]*'unsafe-eval'"; then
    emit LEAD "csp-unsafe-eval" "script-src allows 'unsafe-eval'"
  else
    emit OK "csp-unsafe-eval" "script-src does not allow 'unsafe-eval'"
    # Worth knowing in the other direction too: code that needs eval will fail
    # only on the deployed site, never on a local static server.
    ev="$(grep -rn 'new Function\|eval(' js 2>/dev/null | grep -v '// ' | tr '\\' '/' | head -5)"
    if [ -n "$ev" ]; then
      printf '  but the client code contains eval-family calls, which CSP will\n'
      printf '  block on the deployed site while they work fine over a local\n'
      printf '  static server. Live-only breakage, not a vulnerability:\n'
      printf '%s\n' "$ev" | cut -c1-160 | sed 's/^/    /'
    fi
  fi
  if printf '%s' "$csp" | grep -qE "script-src[^;]*'unsafe-inline'"; then
    emit LEAD "csp-unsafe-inline" "script-src allows 'unsafe-inline' -- check whether an inline script in index.html requires it before reporting"
  else
    emit OK "csp-unsafe-inline" "script-src does not allow 'unsafe-inline'"
  fi
fi

# ---------------------------------------------------------------------------
section "Served headers vs the repo _headers file"
#
# A directive in _headers that never appears in a response means the file is
# not being applied the way its author believes.
if [ -f _headers ]; then
  printf '  Directives declared in _headers but ABSENT from the response:\n'
  missing=0
  while read -r name; do
    [ -z "$name" ] && continue
    if [ -z "$(hget "$name")" ]; then
      printf '    %s\n' "$name"
      missing=$((missing + 1))
    fi
  done < <(grep -oE '^[[:space:]]+[A-Za-z-]+:' _headers | tr -d ' :' | sort -u)
  if [ "$missing" -gt 0 ]; then
    emit LEAD "headers-not-applied" "$missing header(s) declared in _headers do not appear in the response -- the file may not be deployed, or the route is served by a Function that builds its own headers"
  else
    emit OK "headers-not-applied" "every header declared in _headers appears in the response"
  fi
else
  emit SKIPPED "headers-not-applied" "no _headers file in the repo"
fi

# ---------------------------------------------------------------------------
section "Caching on data and API routes"
#
# A gated response that is cacheable by a shared cache is a cross-user data
# leak waiting for a cache key collision. These routes serve access-controlled
# content and must be no-store.
for path in /data/manifest.json /api/track /api/resource/test; do
  h="$(fetch_headers "$TARGET$path")"
  cc="$(printf '%s' "$h" | grep -i '^cache-control:' | head -1 | sed 's/\r$//')"
  cfc="$(printf '%s' "$h" | grep -i '^cf-cache-status:' | head -1 | sed 's/\r$//')"
  st="$(printf '%s' "$h" | head -1 | sed 's/\r$//')"
  printf '  %-26s %s\n' "$path" "$st"
  printf '  %-26s %s\n' "" "${cc:-(no cache-control)}"
  [ -n "$cfc" ] && printf '  %-26s %s\n' "" "$cfc"
  if printf '%s' "$cc" | grep -qiE 'no-store|private'; then
    emit OK "cache-$path" "not shared-cacheable"
  elif [ -z "$cc" ]; then
    emit LEAD "cache-$path" "no cache-control at all -- a shared cache may apply its own heuristic"
  else
    emit LEAD "cache-$path" "cacheable ($cc) -- confirm this route never returns per-user content"
  fi
done

# ---------------------------------------------------------------------------
section "TLS and redirect"
printf '  http -> https:\n'
fetch_headers "$(printf '%s' "$TARGET" | sed 's/^https:/http:/')/" | head -12 | sed 's/^/    /'
