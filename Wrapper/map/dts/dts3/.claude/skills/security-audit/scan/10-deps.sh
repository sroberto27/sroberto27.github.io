#!/usr/bin/env bash
# 10-deps.sh -- advisories, install scripts, lockfile integrity.
#
# This is the only scan script that deliberately refetches data on every run.
# references/20-50 are pinned at build time so CVE data is the single moving
# part of the audit.
#
# Order of preference:
#   osv-scanner (real tool)  ->  lib/osv.mjs (OSV.dev batch API, DEGRADED)
#   npm audit --json         ->  always, when npm is present
#
# The reachability note at the bottom of the output matters more than the
# advisory list itself on this project. Read it before ranking anything.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "10-deps -- advisories and lockfile integrity"
cd "$PROJECT_DIR" || exit 1

LOCK="package-lock.json"

if [ ! -f "$LOCK" ]; then
  emit SKIPPED "deps" "no package-lock.json in $PROJECT_DIR"
  exit 0
fi

# ---------------------------------------------------------------------------
section "npm audit"
if ! have npm; then
  emit SKIPPED "npm-audit" "npm not on PATH"
elif [ "$OFFLINE" = "1" ]; then
  emit SKIPPED "npm-audit" "--offline"
else
  audit_json="$(npm audit --json 2>/dev/null)"
  if [ -z "$audit_json" ]; then
    emit ERROR "npm-audit" "npm audit produced no output (network? private registry?)"
  else
    printf '%s' "$audit_json" > "${TMPDIR:-/tmp}/dts-npm-audit.json"
    summary="$(json_query "${TMPDIR:-/tmp}/dts-npm-audit.json" \
      'JSON.stringify(d.metadata && d.metadata.vulnerabilities || {})')"
    printf '  vulnerabilities: %s\n' "$summary"
    totalv="$(json_query "${TMPDIR:-/tmp}/dts-npm-audit.json" \
      'String((d.metadata&&d.metadata.vulnerabilities&&d.metadata.vulnerabilities.total)||0)')"
    if [ "${totalv:-0}" -gt 0 ]; then
      emit LEAD "npm-audit" "$totalv advisory record(s) -- see reachability note below"
      json_query "${TMPDIR:-/tmp}/dts-npm-audit.json" \
        'Object.values(d.vulnerabilities||{}).map(function(v){return "    "+v.name+"  "+v.severity+"  via "+(v.via||[]).map(function(x){return typeof x==="string"?x:x.title;}).join("; ");}).join("\n")'
      printf '\n'
    else
      emit OK "npm-audit" "no advisories reported"
    fi
    rm -f "${TMPDIR:-/tmp}/dts-npm-audit.json"
  fi
fi

# ---------------------------------------------------------------------------
section "OSV advisories + lockfile integrity"
if have osv-scanner; then
  emit OK "osv-tool" "osv-scanner present -- using the real scanner"
  # osv-scanner v2 moved lockfile scanning under `scan source`. The v1
  # top-level --lockfile flag still parses on v2 but is deprecated, so prefer
  # the subcommand when the binary offers it.
  if osv-scanner scan source --help >/dev/null 2>&1; then
    osv-scanner scan source --lockfile "$LOCK" 2>&1 | redact | sed 's/^/  /'
  else
    osv-scanner --lockfile "$LOCK" 2>&1 | redact | sed 's/^/  /'
  fi
  # The real scanner does not cover lockfile-integrity questions, so run the
  # fallback's integrity half regardless.
  node "$LIB_DIR/osv.mjs" "$LOCK" --integrity-only 2>&1 | redact
else
  degraded_because "osv-scan" "osv-scanner" "$(tool_install_hint osv-scanner)" \
    "querying the same upstream database over the public batch API instead"
  if [ "$OFFLINE" = "1" ]; then
    node "$LIB_DIR/osv.mjs" "$LOCK" --offline 2>&1 | redact
  else
    node "$LIB_DIR/osv.mjs" "$LOCK" 2>&1 | redact
  fi
fi

# ---------------------------------------------------------------------------
section "Browser-facing supply chain"
#
# The lockfile is not where this project's visitor-facing third-party code
# comes from. The CDN <script> tags are. 00-inventory.sh enumerates them; this
# repeats the count here so a deps-scope session doesn't miss it.
if [ -f index.html ]; then
  n_ext="$(grep -cE '<script[^>]*src="https://' index.html)"
  n_sri="$(grep -cE '<script[^>]*src="https://[^"]+"[^>]*integrity=' index.html)"
  printf '  external <script> tags in index.html : %s\n' "$n_ext"
  printf '  of those, carrying integrity=        : %s\n' "$n_sri"
  grep -oE 'src="https://[^"]+"' index.html | sort -u | sed 's/^/    /'
  if [ "${n_sri:-0}" -lt "${n_ext:-0}" ]; then
    emit LEAD "cdn-sri" "$((n_ext - n_sri)) browser-facing external script(s) without SRI -- this is the real supply-chain surface here, not the lockfile"
  else
    emit OK "cdn-sri" "all browser-facing external scripts carry SRI"
  fi
fi

# Scripts fetched at runtime from JS rather than declared in index.html --
# these never show up in a page-source review.
printf '\n  CDN URLs fetched from JS at runtime:\n'
grep -rnoE 'https://(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com)[^"'"'"' ]*' \
  js 2>/dev/null | tr '\\' '/' | sed 's/^/    /' | head -20
