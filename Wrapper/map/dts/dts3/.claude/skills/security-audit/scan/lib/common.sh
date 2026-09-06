#!/usr/bin/env bash
# Shared helpers for every scan/*.sh in the security-audit skill.
#
# Source it, don't run it:   . "$(dirname "$0")/lib/common.sh"
#
# Two things in here are load-bearing for THIS repo and easy to get wrong:
#
#   1. The git root is E:/sroberto27.github.io -- the whole personal GitHub
#      Pages site. This project is a subdirectory of it. Every git invocation
#      must path-scope to $PROJECT_REL or it scans thousands of unrelated files
#      (Blog/, Viz/, XRlist/, loose media) and returns garbage.
#   2. Nothing written to scan/results/ may contain a live secret. Every helper
#      that writes to disk pipes through redact().

set -uo pipefail

# ---------------------------------------------------------------- geometry ---

SCAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$(cd "$SCAN_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"
LIB_DIR="$SCAN_DIR/lib"

# rev-parse returns a native (E:/...) path under Git Bash while $PROJECT_DIR is
# in MSYS form (/e/...). Round-tripping through cd/pwd normalises both to the
# same form so the prefix strip below actually works.
_git_root_raw="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null)"
if [ -n "$_git_root_raw" ] && [ -d "$_git_root_raw" ]; then
  GIT_ROOT="$(cd "$_git_root_raw" && pwd)"
else
  GIT_ROOT="$PROJECT_DIR"
fi
unset _git_root_raw
if [ "$GIT_ROOT" != "$PROJECT_DIR" ]; then
  PROJECT_REL="${PROJECT_DIR#"$GIT_ROOT"/}"
else
  PROJECT_REL="."
fi
export SCAN_DIR SKILL_DIR PROJECT_DIR LIB_DIR GIT_ROOT PROJECT_REL

# Path-scoped git. Use this everywhere instead of bare `git`.
pgit() { git -C "$GIT_ROOT" "$@"; }

# ------------------------------------------------------------------ target ---

# Precedence: --target flag (parsed by the caller into DTS_AUDIT_TARGET)
#             -> environment -> the dev preview. Production is NEVER a default.
DEV_TARGET="https://dts-website-4cu.pages.dev"
DEV_SUPABASE="https://wsqvzyfvxjenqvqjpqjv.supabase.co"
TARGET="${DTS_AUDIT_TARGET:-$DEV_TARGET}"
OFFLINE="${DTS_AUDIT_OFFLINE:-0}"
export DEV_TARGET DEV_SUPABASE TARGET OFFLINE

# Refuse a production target unless the operator said so for THIS run.
# Rules of engagement, references/50-pentest.md: prod needs explicit per-run
# confirmation and it is never inherited from an earlier approval.
guard_target() {
  case "$TARGET" in
    *dtsxr.com*|*"://dts."*)
      if [ "${DTS_ALLOW_PROD:-0}" != "1" ]; then
        emit SKIPPED "target-guard" "refusing production target $TARGET without DTS_ALLOW_PROD=1"
        return 1
      fi
      emit LEAD "target-guard" "running against PRODUCTION $TARGET (DTS_ALLOW_PROD=1 set)"
      ;;
  esac
  return 0
}

# ------------------------------------------------------------------ status ---
#
# Exactly five statuses. The distinction that matters most:
#
#   OK       the check ran and found nothing
#   LEAD     the check ran and found something worth a human/model look.
#            deliberately NOT called FINDING -- per references/00-conventions.md
#            a scan hit is a lead until re-verified by reading the real code.
#   DEGRADED the check ran via a fallback because the real tool is absent.
#            The result is weaker than a full verification and must never be
#            reported as one.
#   SKIPPED  the check did not run (offline, missing input, guarded target)
#   ERROR    the check broke

emit() {
  local status="$1" name="$2" detail="${3:-}"
  printf '[%-8s] %-34s %s\n' "$status" "$name" "$detail"
}

section() { printf '\n=== %s ===\n' "$1"; }

# Note a degraded check together with the one-line install that would upgrade it.
degraded_because() {
  local name="$1" missing="$2" install="$3" detail="${4:-}"
  emit DEGRADED "$name" "$missing absent; using fallback. ${detail}"
  printf '           upgrade: %s\n' "$install"
}

# ------------------------------------------------------------------- tools ---

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- PATH ------
#
# On Windows a PATH edit made by an installer only reaches shells started
# afterwards. A tool installed during this session is therefore invisible to a
# scan run in the same session, which surfaces as a spurious DEGRADED -- the
# scan quietly using a weaker fallback when the real tool is sitting right
# there. Add the standard user-scope install locations when they exist.
#
# No-op on other platforms, and harmless when a directory is absent.
_to_posix() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$1" 2>/dev/null
  else
    printf '%s' "$1"
  fi
}

_path_add() {
  local d="$1"
  [ -n "$d" ] || return 0
  [ -d "$d" ] || return 0
  case ":$PATH:" in
    *":$d:"*) ;;
    *) PATH="$PATH:$d" ;;
  esac
}

augment_path() {
  local lad ad d
  lad="$(_to_posix "${LOCALAPPDATA:-}")"
  ad="$(_to_posix "${APPDATA:-}")"

  _path_add "$lad/Microsoft/WinGet/Links"
  _path_add "$lad/Programs/psql/bin"
  _path_add "$ad/npm"

  # winget installs portable packages into a directory per package rather than
  # a single Links dir, so each one has to go on PATH individually.
  for d in "$lad"/Microsoft/WinGet/Packages/*/; do
    [ -d "$d" ] || continue
    _path_add "${d%/}"
  done
  export PATH
}
augment_path

TOOL_INSTALL_gitleaks="winget install gitleaks  |  brew install gitleaks"
TOOL_INSTALL_osv_scanner="winget install Google.OSVScanner  |  brew install osv-scanner"
TOOL_INSTALL_psql="portable client: extract psql.exe + libpq DLLs from EDB binaries zip to %LOCALAPPDATA%/Programs/psql/bin  |  brew install libpq  (winget only ships the full server, which this audit does not need)"
TOOL_INSTALL_supabase="npm i -g supabase"
TOOL_INSTALL_jq="winget install jqlang.jq  |  brew install jq"
TOOL_INSTALL_semgrep="pipx install semgrep"
TOOL_INSTALL_rg="winget install BurntSushi.ripgrep.MSVC  |  brew install ripgrep"
# rg may exist as a shell function in an interactive profile and still be
# absent from a non-interactive script's PATH. Every scan script therefore
# uses grep, never rg.

tool_install_hint() {
  local var="TOOL_INSTALL_${1//-/_}"
  printf '%s' "${!var:-(no install hint recorded)}"
}

# Prints the availability matrix. run-all.sh emits this FIRST, before any
# result, so whoever reads the output knows which checks were degraded before
# they read a single status line.
tool_matrix() {
  section "Tool availability"
  local t present
  for t in git rg node npm npx curl gitleaks osv-scanner psql supabase jq semgrep; do
    if have "$t"; then present="present"; else present="ABSENT"; fi
    printf '  %-14s %-8s %s\n' "$t" "$present" \
      "$([ "$present" = "ABSENT" ] && tool_install_hint "$t" || true)"
  done
  printf '
  node, curl and git carry the fallback paths and are required.
'
  printf '  rg and semgrep are listed for reference only -- no check uses them,
'
  printf '  so ABSENT there costs nothing. Any OTHER absent row is why a
'
  printf '  check below reports DEGRADED rather than OK.
'
}

# ----------------------------------------------------------------- redact -----
#
# Everything written to scan/results/ goes through this. Masks credential
# shapes, not the public-by-design keys (those are allowlisted in 20-secrets.sh
# and masking them would make the output unreadable for no gain).
redact() {
  sed -E \
    -e 's/(sb_secret_)[A-Za-z0-9_-]+/\1<REDACTED>/g' \
    -e 's/(service_role[^A-Za-z0-9]{0,4})[A-Za-z0-9._-]{20,}/\1<REDACTED>/g' \
    -e 's/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/<REDACTED-JWT>/g' \
    -e 's/(postgres(ql)?:\/\/[^:]+:)[^@]+@/\1<REDACTED>@/g' \
    -e 's/([A-Za-z_]*(PASSWORD|SECRET|TOKEN|API_KEY|ACCOUNT_ID|ACCESS_KEY)[A-Za-z_]*[[:space:]]*[=:][[:space:]]*)[^[:space:]"'"'"']+/\1<REDACTED>/g'
}

# ------------------------------------------------------------------ fetch -----

CURL_OPTS=(--silent --show-error --location --max-time 20 --connect-timeout 8
           --user-agent "dts-security-audit/1.0")

net_ready() {
  if [ "$OFFLINE" = "1" ]; then return 1; fi
  have curl || return 1
  return 0
}

# fetch_headers <url> [extra curl args...]
fetch_headers() {
  local url="$1"; shift
  curl "${CURL_OPTS[@]}" --head "$@" "$url" 2>&1 | redact
}

# fetch_body <url> [extra curl args...]
fetch_body() {
  local url="$1"; shift
  curl "${CURL_OPTS[@]}" "$@" "$url" 2>&1 | redact
}

# fetch_status_size <url> -> "<http_code> <bytes>"
fetch_status_size() {
  local url="$1"; shift
  curl "${CURL_OPTS[@]}" --output /dev/null \
       --write-out '%{http_code} %{size_download}' "$@" "$url" 2>/dev/null
}

# ------------------------------------------------------------------- json -----
# jq is absent on this machine; node is not. Every JSON read goes through node.
json_query() {
  # json_query <file> <js-expression-over-`d`>
  node -e '
    const fs = require("fs");
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const out = eval(process.argv[2]);
    process.stdout.write(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  ' "$1" "$2" 2>/dev/null
}

banner() {
  printf '########################################################################\n'
  printf '# %s\n' "$1"
  printf '# project : %s\n' "$PROJECT_DIR"
  printf '# git      : %s  (scoped to %s)\n' "$GIT_ROOT" "$PROJECT_REL"
  printf '# target   : %s%s\n' "$TARGET" "$([ "$OFFLINE" = "1" ] && printf '  [OFFLINE]' || true)"
  printf '# utc      : %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '########################################################################\n'
}
