#!/usr/bin/env bash
# 55-deploy-exposure.sh -- is anything published that should not be?
#
# Why this script exists, and why it is not in the generic scan set:
#
# wrangler.toml sets pages_build_output_dir to the repo root. Taken literally
# that publishes .env, scripts/, supabase/, docs/, tools/ and -- worst -- raw
# data/. Nothing in the tooling prevents it. The only control is a human
# following the manual staging procedure in docs/migration/DEPLOY-STAGING.md
# on every deploy.
#
# That control has already failed in production on this project: a harvest
# script under tools/ was served live because a checklist step was skipped.
#
# The raw-data case is the severe one. Cloudflare Pages serves a static file
# in preference to a Function at the same path, so a static /data/<path> would
# shadow functions/data/[[path]].js and bypass every access check on the site
# in one move -- silently, with no error anywhere.
#
# METHOD. A single-page app answers unknown paths with its index.html fallback
# at HTTP 200, so status codes prove nothing. This script fetches the fallback
# first, records its byte count, and then treats "same size as the fallback" as
# absent and "different size" as PUBLISHED. Content-type is checked too, since
# a fallback is always text/html.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "55-deploy-exposure -- files published that should not be"
guard_target || exit 0
cd "$PROJECT_DIR" || exit 1

if ! net_ready; then
  emit SKIPPED "deploy-exposure" "offline or curl unavailable"
  printf '  This check has NO offline equivalent. What is on disk says nothing\n'
  printf '  about what was uploaded. Leaving it unrun means leaving the highest\n'
  printf '  severity question on this project unanswered -- say so in the report\n'
  printf '  rather than omitting it.\n'
  exit 0
fi

# ---------------------------------------------------------------------------
section "Calibrating against the SPA fallback"
FALLBACK="$(fetch_status_size "$TARGET/definitely-not-a-real-path-$$")"
FB_CODE="${FALLBACK%% *}"
FB_SIZE="${FALLBACK##* }"
printf '  GET /definitely-not-a-real-path -> HTTP %s, %s bytes\n' "$FB_CODE" "$FB_SIZE"
if [ "${FB_SIZE:-0}" -lt 100 ]; then
  printf '  Small fallback: this target may return a real 404 rather than an SPA\n'
  printf '  shell. Size comparison still works; treat any 200 below as published.\n'
fi

# probe <path> <severity-note>
probe() {
  local path="$1" note="$2"
  local cs code size ctype
  cs="$(fetch_status_size "$TARGET$path")"
  code="${cs%% *}"
  size="${cs##* }"
  ctype="$(fetch_headers "$TARGET$path" | grep -i '^content-type:' | head -1 |
           sed 's/\r$//' | cut -d' ' -f2- | cut -d';' -f1)"

  if [ "$code" != "200" ]; then
    printf '  [absent   ] %-42s HTTP %s\n' "$path" "$code"
    return 0
  fi
  if [ "$size" = "$FB_SIZE" ]; then
    printf '  [fallback ] %-42s HTTP 200, %s bytes (= SPA shell)\n' "$path" "$size"
    return 0
  fi
  printf '  [PUBLISHED] %-42s HTTP 200, %s bytes, %s\n' "$path" "$size" "${ctype:-unknown}"
  emit LEAD "published:$path" "$note"
  return 1
}

# ---------------------------------------------------------------------------
section "Paths that must never be published"
exposed=0

probe "/.env"                         "environment file with live credentials is being served" || exposed=$((exposed+1))
probe "/.env.example"                 "example env file served (low severity; confirms the deploy root is unstaged)" || exposed=$((exposed+1))
probe "/package.json"                 "build metadata served -- confirms the whole repo root was uploaded" || exposed=$((exposed+1))
probe "/package-lock.json"            "lockfile served -- exact dependency versions disclosed" || exposed=$((exposed+1))
probe "/wrangler.toml"                "deploy config served -- bindings and bucket names disclosed" || exposed=$((exposed+1))
probe "/CLAUDE.md"                    "internal working notes served" || exposed=$((exposed+1))
probe "/README.md"                    "internal README served" || exposed=$((exposed+1))
probe "/supabase/config.toml"         "Supabase config served" || exposed=$((exposed+1))
probe "/supabase/migrations/"         "migration directory served -- full schema and every RLS policy disclosed" || exposed=$((exposed+1))
probe "/scripts/seed-dev.mjs"         "seeding script served -- may disclose fixture accounts and schema" || exposed=$((exposed+1))
probe "/scripts/upload-content.mjs"   "content tooling served" || exposed=$((exposed+1))
probe "/docs/WEBSITE-STATE.md"        "internal architecture documentation served" || exposed=$((exposed+1))
probe "/docs/migration/PROGRESS.md"   "internal progress log served -- may disclose account names and unfixed issues" || exposed=$((exposed+1))
probe "/.git/config"                  "git metadata served -- the whole repository may be reconstructable" || exposed=$((exposed+1))
probe "/.gitignore"                   "gitignore served (low severity; another deploy-root signal)" || exposed=$((exposed+1))

printf '\n  Also probing tools/, which is the directory that has already leaked here:\n'
if [ -d tools ]; then
  for f in tools/*.mjs tools/*.js; do
    [ -e "$f" ] || continue
    probe "/$f" "tool script served -- this exact class of exposure has happened on this project before" || exposed=$((exposed+1))
  done
fi

if [ "$exposed" -eq 0 ]; then
  emit OK "deploy-exposure" "no excluded path is published"
else
  emit LEAD "deploy-exposure" "$exposed excluded path(s) are published -- re-verify each by fetching it and reading what comes back"
fi

# ---------------------------------------------------------------------------
section "Raw /data shadowing the access-checking Function"
#
# THE severe case. Cloudflare Pages prefers a static asset over a Function at
# the same path. A published static /data/** therefore bypasses every access
# check without erroring.
#
# Distinguishing the two is not about status -- both return 200 with JSON. The
# tell is the response headers: the Function sets its own (no-store, and
# whatever else it adds), while a static asset gets the platform's asset
# headers plus whatever _headers applies. A static asset also serves paths the
# Function does not route.
printf '  Fetching /data/manifest.json and reading its headers:\n'
mh="$(fetch_headers "$TARGET/data/manifest.json")"
printf '%s\n' "$mh" | sed 's/^/    /' | head -20

if printf '%s' "$mh" | grep -qi '^cf-cache-status:.*HIT'; then
  printf '\n    cf-cache-status HIT -- served from cache. Cannot distinguish a\n'
  printf '    Function response from a static asset on this request alone.\n'
fi

printf '\n  Probing a /data path that exists on disk but is NOT in the manifest.\n'
printf '  The Function routes by manifest; a static upload does not know about\n'
printf '  the manifest, so a 200 here is strong evidence raw data/ was published:\n'
orphan=""
while read -r f; do
  rel="${f#data/}"
  base="$(basename "$f")"
  if ! grep -qF "$rel" data/manifest.json 2>/dev/null && ! grep -qF "$base" data/manifest.json 2>/dev/null; then
    orphan="$rel"
    break
  fi
done < <(find data -name '*.json' -not -name 'manifest.json' -type f 2>/dev/null | tr '\\' '/' | sort)

if [ -n "$orphan" ]; then
  probe "/data/$orphan" "a /data document absent from the manifest is being served -- strong evidence raw data/ was published as static assets, which shadows the access-checking Function entirely" ||
    emit LEAD "raw-data-published" "treat as CRITICAL until disproved: verify by comparing this response's headers against a manifest-listed document"
else
  printf '    (no unmanifested /data document on disk to use as a probe)\n'
fi

printf '\n  Probing the GeoJSON layers, which are fetched directly rather than\n'
printf '  through the manifest and have their own access-checking route:\n'
for g in $(find data -name '*.geojson' -type f 2>/dev/null | tr '\\' '/' | head -3); do
  probe "/$g" "a GIS layer file is served as a static asset, bypassing its access-checking route" || exposed=$((exposed+1))
done

# ---------------------------------------------------------------------------
section "Deployed js/config.js"
#
# The fallback config is injected dynamically, so it never appears in a normal
# network trace -- but it is fetchable, and the repo copy holds every real tour
# URL. Counting distinct tour ids rather than raw matches: a correctly stripped
# build still mentions the public tour twice (tourUrl and origin), so a line
# count produces a false alarm against a correct build.
cfg="$(fetch_body "$TARGET/js/config.js")"
if printf '%s' "$cfg" | grep -q 'DTS_CONFIG\|window\.'; then
  ids="$(printf '%s' "$cfg" | grep -oE 'spaces\.dtsxr\.com/tour/[A-Za-z0-9-]+' |
         sed 's#.*/tour/##' | sort -u)"
  n="$(printf '%s' "$ids" | grep -c .)"
  printf '  distinct tour ids in the DEPLOYED js/config.js: %s\n' "${n:-0}"
  [ "${n:-0}" -gt 0 ] && printf '%s\n' "$ids" | sed 's/^/    /'
  if [ "${n:-0}" -gt 1 ]; then
    emit LEAD "config-leak-deployed" "$n distinct tour ids in the deployed fallback config -- gated tour URLs are being served to every visitor"
  else
    emit OK "config-leak-deployed" "deployed fallback config carries at most one tour id"
  fi
else
  emit SKIPPED "config-leak-deployed" "could not fetch a recognisable js/config.js from $TARGET"
fi

# ---------------------------------------------------------------------------
section "Gated resources without a session"
#
# A resource route must not hand out a real target URL to an anonymous caller
# except for genuinely public resources.
for r in /api/resource/project.test /api/download/test; do
  cs="$(fetch_status_size "$TARGET$r")"
  printf '  %-34s HTTP %s, %s bytes\n' "$r (anon)" "${cs%% *}" "${cs##* }"
done
printf '\n  A 401/403 is correct. A 404 for a nonexistent key is correct.\n'
printf '  A 200 carrying a URL would be the finding -- and proving that needs a\n'
printf '  real resource key from the content, not this placeholder. That is\n'
printf '  exploit-test work: tests/security/, against dev, per references/50-pentest.md.\n'
