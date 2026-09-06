#!/usr/bin/env bash
# 00-inventory.sh -- what this thing actually is, right now.
#
# Nothing here is a security check. It exists because the audit's single
# biggest failure mode on this repo is auditing the site CLAUDE.md describes
# (static, no backend, GitHub Pages) instead of the site that is deployed
# (Cloudflare Pages + Functions routes + Supabase RLS + R2). Read this output
# before forming any hypothesis.
#
# The route/guard matrix at the end is the one part that feeds directly into
# reasoning: it is a mechanical grep, so it tells you which guard each route
# *imports and calls*. It cannot tell you whether the guard's return value is
# checked before the side effect. That question is yours -- see
# references/40-appsec.md.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "00-inventory -- stack, entry points, deploy targets, route guards"
tool_matrix

cd "$PROJECT_DIR" || exit 1

# ---------------------------------------------------------------------------
section "Repo geometry"
printf '  git root      : %s\n' "$GIT_ROOT"
printf '  project (rel) : %s\n' "$PROJECT_REL"
if [ "$PROJECT_REL" != "." ]; then
  emit OK "git-scope" "project is a subdirectory of a larger repo; git calls are path-scoped"
else
  emit LEAD "git-scope" "project appears to BE the git root -- verify path-scoping assumptions"
fi

dirty="$(pgit status --porcelain -- "$PROJECT_REL" 2>/dev/null | wc -l | tr -d ' ')"
printf '  uncommitted files in project: %s\n' "$dirty"
if [ "${dirty:-0}" -gt 0 ]; then
  emit LEAD "working-tree" "$dirty uncommitted file(s) -- deployed site and working tree WILL disagree; read that as drift, not as a finding"
  pgit status --porcelain -- "$PROJECT_REL" 2>/dev/null | head -40 | sed 's/^/    /'
else
  emit OK "working-tree" "clean"
fi
printf '\n  HEAD: '
pgit log -1 --format='%h %ad %s' --date=short -- "$PROJECT_REL" 2>/dev/null

# ---------------------------------------------------------------------------
section "Recent history (cross-check against docs/migration/PROGRESS.md)"
pgit log -10 --format='  %h %ad  %s' --date=short -- "$PROJECT_REL" 2>/dev/null

# ---------------------------------------------------------------------------
section "Stack"
for f in package.json package-lock.json wrangler.toml _headers _redirects \
         supabase/config.toml .env .env.example .dev.vars index.html; do
  if [ -e "$f" ]; then
    printf '  present  %-24s %s bytes\n' "$f" "$(wc -c <"$f" | tr -d ' ')"
  else
    printf '  absent   %s\n' "$f"
  fi
done

if [ -f package.json ]; then
  printf '\n  dependencies:\n'
  json_query package.json 'Object.entries(d.dependencies||{}).map(function(e){return "    "+e[0]+" "+e[1];}).join("\n")'
  printf '\n\n  NOTE: read package.json own description before ranking any advisory.\n'
  printf '        If it says the deps are build/migration tooling never shipped to\n'
  printf '        the browser, a lockfile CVE is a developer-machine risk, not a\n'
  printf '        visitor risk. See references/40-appsec.md, "deps reachability".\n'
fi

if [ -f wrangler.toml ]; then
  printf '\n  wrangler.toml:\n'
  grep -v '^[[:space:]]*#' wrangler.toml | grep -v '^[[:space:]]*$' | sed 's/^/    /'
  if grep -q 'pages_build_output_dir' wrangler.toml && grep -q 'pages_build_output_dir[^=]*= *"\."' wrangler.toml; then
    emit LEAD "deploy-root" 'pages_build_output_dir is "." -- taken literally this publishes .env, scripts/, supabase/, docs/, tools/ and RAW data/. Only a manual staging procedure prevents it. See 55-deploy-exposure.sh'
  fi
  if grep -qE '^[[:space:]]*account_id' wrangler.toml; then
    emit LEAD "account-hardcode" "account_id is hardcoded in wrangler.toml (check whether project convention forbids this)"
  else
    emit OK "account-hardcode" "no account_id in wrangler.toml"
  fi
fi

# ---------------------------------------------------------------------------
section "Client entry points (load order is on the do-not-break list -- never reorder)"
if [ -f index.html ]; then
  grep -noE '<script[^>]*src="[^"]+"' index.html | sed 's/^/  /' | head -40

  printf '\n  Externally hosted scripts (supply-chain surface):\n'
  ext="$(grep -oE 'src="https://[^"]+"' index.html | sort -u)"
  if [ -n "$ext" ]; then
    printf '%s\n' "$ext" | sed 's/^/    /'
    noint="$(grep -cE '<script[^>]*src="https://[^"]+"' index.html)"
    withint="$(grep -cE '<script[^>]*src="https://[^"]+"[^>]*integrity=' index.html)"
    printf '    external script tags: %s   with integrity=: %s\n' "$noint" "$withint"
    if [ "${withint:-0}" -lt "${noint:-0}" ]; then
      emit LEAD "sri" "$((noint - withint)) external script tag(s) carry no integrity= attribute -- verify each against references/40-appsec.md before calling it a finding"
    else
      emit OK "sri" "every external script tag carries integrity="
    fi
    # A CDN URL pinned only to a major version silently accepts new code.
    loose="$(printf '%s\n' "$ext" | grep -cE '@[0-9]+"|@latest|/latest/')"
    if [ "${loose:-0}" -gt 0 ]; then
      emit LEAD "cdn-pin" "$loose external script URL(s) pinned no tighter than a major version or 'latest'"
    fi
  fi

  printf '\n  Dynamically injected scripts (invisible in a plain page-source read):\n'
  grep -noE 'createElement\("script"\)|\.src *= *"[^"]*\.js"' js/content-loader.js 2>/dev/null |
    sed 's/^/    content-loader.js:/' | head -20
fi

# ---------------------------------------------------------------------------
section "js/ inventory"
find js -name '*.js' -type f 2>/dev/null | tr '\\' '/' | sort | while read -r f; do
  printf '  %-36s %9s bytes  %6s lines\n' "$f" "$(wc -c <"$f" | tr -d ' ')" "$(wc -l <"$f" | tr -d ' ')"
done

# ---------------------------------------------------------------------------
section "/data inventory vs manifest"
if [ -f data/manifest.json ]; then
  ondisk="$(find data -name '*.json' -not -name 'manifest.json' -type f 2>/dev/null | wc -l | tr -d ' ')"
  printf '  json documents on disk (excl. manifest): %s\n' "$ondisk"
  printf '\n  On disk but NOT referenced anywhere in the manifest:\n'
  orphan=0
  while read -r f; do
    rel="${f#data/}"
    base="$(basename "$f")"
    if ! grep -qF "$rel" data/manifest.json && ! grep -qF "$base" data/manifest.json; then
      printf '    %s\n' "$f"
      orphan=$((orphan + 1))
    fi
  done < <(find data -name '*.json' -not -name 'manifest.json' -type f 2>/dev/null | tr '\\' '/' | sort)
  if [ "$orphan" -gt 0 ]; then
    emit LEAD "manifest-orphans" "$orphan /data document(s) exist on disk but are unreferenced by the manifest -- check WEBSITE-STATE.md known gaps first; at least one of these is already documented as known"
  else
    emit OK "manifest-orphans" "every /data document is referenced"
  fi

  printf '\n  Non-manifest data fetched directly at runtime (geojson etc.):\n'
  find data -name '*.geojson' -type f 2>/dev/null | tr '\\' '/' | sed 's/^/    /'
  printf '  (these bypass the manifest; confirm each has a server-side access check)\n'
fi

# ---------------------------------------------------------------------------
section "Supabase migrations"
if [ -d supabase/migrations ]; then
  ls -1 supabase/migrations | sed 's/^/  /'
  all="$(cat supabase/migrations/*.sql 2>/dev/null)"
  printf '\n  create table              : %s\n' "$(printf '%s' "$all" | grep -ciE 'create table')"
  printf '  enable row level security : %s\n' "$(printf '%s' "$all" | grep -ciE 'enable row level security')"
  printf '  create policy             : %s\n' "$(printf '%s' "$all" | grep -ciE 'create policy')"
  printf '  security definer          : %s\n' "$(printf '%s' "$all" | grep -ciE 'security definer')"
  printf '\n  Detail is 30-rls.sh work, not this script.\n'
fi

# ---------------------------------------------------------------------------
section "Function routes and their guards"
#
# Pages Functions routing: the path IS the route, and a leading underscore
# excludes a path from routing. So functions/_lib/* are helpers; everything
# else in functions/ is reachable over HTTP by anyone.
#
if [ -d functions ]; then
  printf '  %-56s %s\n' "ROUTE FILE" "GUARD(S) CALLED"
  printf '  %-56s %s\n' "----------" "---------------"
  unguarded=0
  routes=0
  while read -r f; do
    case "$f" in
      */_lib/*) continue ;;
      functions/_*) continue ;;
    esac
    routes=$((routes + 1))
    guards=""
    grep -q 'requireSiteAdmin(' "$f" && guards="$guards requireSiteAdmin"
    grep -q 'requireOrgAdminOf(' "$f" && guards="$guards requireOrgAdminOf"
    grep -q 'verifyUser(' "$f" && guards="$guards verifyUser"
    grep -q 'checkAccess(' "$f" && guards="$guards checkAccess"
    if [ -z "$guards" ]; then
      guards=" (NONE)"
      unguarded=$((unguarded + 1))
    fi
    printf '  %-56s %s\n' "$f" "$guards"
  done < <(find functions -name '*.js' -type f 2>/dev/null | tr '\\' '/' | sort)

  printf '\n  %s route file(s) reachable over HTTP.\n' "$routes"
  if [ "$unguarded" -gt 0 ]; then
    emit LEAD "route-guards" "$unguarded route file(s) call no guard -- some are public by design (WEBSITE-STATE.md 5.10). Confirm each against the documented exception list before reporting."
  else
    emit OK "route-guards" "every route file calls at least one guard"
  fi
  printf '\n  This grep proves a guard is CALLED. It does NOT prove the return value\n'
  printf '  is checked before the first side effect, nor that the right guard was\n'
  printf '  chosen for the route. Both are reasoning work -- references/40-appsec.md.\n'

  printf '\n  Env bindings referenced by Functions:\n'
  grep -rhoE 'env\.[A-Z_][A-Z0-9_]*' functions 2>/dev/null | sort | uniq -c | sort -rn | sed 's/^/   /'
  printf '\n  A binding referenced by fewer routes than it is scoped to is a\n'
  printf '  least-privilege question for the cloudflare scope.\n'
fi

# ---------------------------------------------------------------------------
section "Deploy targets"
printf '  audit target (this run): %s\n' "$TARGET"
printf '  known dev preview      : %s\n' "$DEV_TARGET"
printf '  known dev supabase     : %s\n' "$DEV_SUPABASE"
printf '\n  pages.dev hosts referenced in docs (cross-check the target above):\n'
grep -rhoE '[a-z0-9-]+\.pages\.dev' docs 2>/dev/null | sort -u | sed 's/^/    /' | head -10

emit OK "inventory" "complete"
