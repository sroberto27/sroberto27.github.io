#!/usr/bin/env bash
# 20-secrets.sh -- credentials in history, in the working tree, and in the
# files the browser can actually fetch.
#
# gitleaks is the real tool and is absent here; the fallback is git + grep with
# a pattern set tuned to THIS project's credential formats. That tuning is the
# point: a stock scanner keyed on `eyJ`-prefixed JWTs misses Supabase's newer
# `sb_publishable_` / `sb_secret_` key format entirely, and flags this repo's
# three public-by-design keys as findings every single run.
#
# Allowlisting is done by PREFIX and by FILE LOCATION, never by pasting a key
# value into this skill. Public or not, credentials do not get copied into
# audit tooling.
#
# This script never prints the contents of .env. It only proves .env is
# ignored and untracked.

. "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

banner "20-secrets -- history, working tree, and browser-fetchable assets"
cd "$PROJECT_DIR" || exit 1

# ---------------------------------------------------------------------------
# Two classes, because conflating them is what makes secret scanners useless.
#
# DANGER_VALUE -- shapes that ARE a credential. Any occurrence is worth a look.
DANGER_VALUE='sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{30,}'
#
# DANGER_ASSIGN -- variable NAMES that only matter when assigned a real value.
# This repo documents its own credential handling in prose and in a blank
# .env.example, so matching the bare name produces pages of noise and trains
# you to skim past the one line that matters.
DANGER_ASSIGN='(SUPABASE_DB_PASSWORD|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|CLOUDFLARE_API_TOKEN|TURNSTILE_SECRET_KEY|WEB3FORMS[A-Z_]*)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9_.-]{8,}'
#
# Combined, for the greps that want both.
DANGER="$DANGER_VALUE|$DANGER_ASSIGN"
#
# service_role is handled separately: in browser-fetchable files any mention is
# worth reading, but in docs and server code it is ordinary vocabulary.
SERVICE_ROLE_TOKEN='service_role'

# Public-by-design prefixes. Each is documented in the repo as intentionally
# shipped to the browser; flagging them is noise, not signal. Confirm each is
# still documented as public before trusting this list.
PUBLIC_PREFIXES='sb_publishable_|0x4AAAAAA'

# Files whose committed key is a documented, owner-accepted risk. The audit
# should say so once and move on rather than re-report it every run. Verify
# against WEBSITE-STATE.md before treating as accepted.
ACCEPTED_KEY_FILES='data/site/lead.json|js/config.js'

# Summarise a gitleaks JSON report via lib/gitleaks-summary.mjs.
#
# The exit-code handling below is deliberate and was a real bug once: when the
# summariser itself failed, an earlier version of this function still emitted
# OK -- announcing a clean pass while gitleaks had reported leaks nobody read.
# Only 0 is a pass. Anything unexpected is an ERROR, never silence.
summarise_gitleaks() {
  local report="$1" label="$2"
  if [ ! -s "$report" ]; then
    emit OK "gitleaks-$label" "no leaks reported"
    return 0
  fi
  node "$LIB_DIR/gitleaks-summary.mjs" "$report" "$ACCEPTED_KEY_FILES"
  local rc=$?
  case "$rc" in
    0) emit OK   "gitleaks-$label" "nothing outside the accepted-risk files" ;;
    3) emit LEAD "gitleaks-$label" "hits outside the accepted-risk files -- open each and confirm before reporting" ;;
    *) emit ERROR "gitleaks-$label" "summariser failed (exit $rc); gitleaks output above is UNSUMMARISED and must be read manually -- do not record this as a pass" ;;
  esac
}

# Paths the browser can fetch. A secret here is exposed to the world; a secret
# in scripts/ or supabase/ is exposed only if the deploy staging goes wrong
# (which 55-deploy-exposure.sh checks separately).
CLIENT_PATHS="index.html js css data models vendor"

# ---------------------------------------------------------------------------
section ".env hygiene"
if [ -f .env ]; then
  if pgit check-ignore -q "$PROJECT_REL/.env" 2>/dev/null; then
    emit OK "env-ignored" ".env exists and is git-ignored (contents deliberately not read)"
  else
    emit LEAD "env-ignored" ".env exists and is NOT git-ignored"
  fi
  if pgit ls-files --error-unmatch "$PROJECT_REL/.env" >/dev/null 2>&1; then
    emit LEAD "env-tracked" ".env is TRACKED by git -- it is in the repository, not just on disk"
  else
    emit OK "env-tracked" ".env is not tracked by git"
  fi
else
  emit OK "env-ignored" "no .env on disk"
fi

if [ -f .env.example ]; then
  filled="$(grep -cE '^[A-Z_]+=.+' .env.example 2>/dev/null)"
  if [ "${filled:-0}" -gt 0 ]; then
    emit LEAD "env-example" "$filled line(s) in .env.example carry a value rather than a blank placeholder"
    grep -nE '^[A-Z_]+=.+' .env.example | sed -E 's/=.*/=<value present>/' | sed 's/^/    /'
  else
    emit OK "env-example" ".env.example placeholders are all blank"
  fi
fi

# ---------------------------------------------------------------------------
section "Working tree -- browser-fetchable files"
#
# Anything matching here is served to every visitor. This is the highest-signal
# grep in the script.
hits="$(grep -rnE "$DANGER|$SERVICE_ROLE_TOKEN" $CLIENT_PATHS 2>/dev/null |
        grep -vE '^\.?/?\.env' |
        grep -vE "$PUBLIC_PREFIXES" |
        grep -vE '^[^:]*(\.min\.js|vendor/)' |
        tr '\\' '/')"
if [ -n "$hits" ]; then
  emit LEAD "client-secrets" "credential-shaped strings in browser-fetchable files"
  printf '%s\n' "$hits" | redact | cut -c1-200 | sed 's/^/    /' | head -30
  printf '\n    Re-verify each by reading the file. A comment mentioning\n'
  printf '    "service_role" is not a leaked service_role key.\n'
else
  emit OK "client-secrets" "no credential-shaped strings in $CLIENT_PATHS"
fi

# ---------------------------------------------------------------------------
section "Working tree -- everything else in the project"
# .env is excluded from this grep on purpose and it is not an oversight.
# Its whole job is to hold live credentials; reading it would print them into
# scan/results/, which is exactly what this skill promises never to do. The
# .env hygiene block above establishes what the audit actually needs to know
# about it -- that it exists, is ignored, and is untracked.
hits2="$(grep -rnE "$DANGER" . 2>/dev/null |
         grep -vE '^\./\.env(\.|:)' |
         grep -vE '/(node_modules|\.git|\.build|\.wrangler|\.claude)/' |
         grep -vE "$PUBLIC_PREFIXES" |
         grep -vE '^\./(docs|README\.md|CLAUDE\.md)' |
         tr '\\' '/')"
if [ -n "$hits2" ]; then
  emit LEAD "repo-secrets" "credential-shaped strings elsewhere in the project"
  printf '%s\n' "$hits2" | redact | cut -c1-200 | sed 's/^/    /' | head -30
else
  emit OK "repo-secrets" "no credential-shaped strings outside docs/ and excluded dirs"
fi
printf '\n  docs/ is excluded above on purpose: this project documents its own\n'
printf '  credential handling extensively, and prose about a key is not a key.\n'
printf '  Scan docs/ manually if a specific concern points there.\n'

# ---------------------------------------------------------------------------
section "Git history"
if have gitleaks; then
  emit OK "history-tool" "gitleaks $(gitleaks version 2>/dev/null | tr -d '\r') -- using the real scanner"
  #
  # Two things here are easy to get wrong, and both did get written wrong first:
  #
  #   * gitleaks 8.19+ replaced `detect --source` with the `git` and `dir`
  #     subcommands. The old form is deprecated and behaves differently.
  #   * without --log-opts, `gitleaks git` walks the ENTIRE outer repository --
  #     which here is a large unrelated personal site. Path-scope it, or the
  #     run is slow, noisy, and mostly about files this audit does not own.
  #
  # --redact keeps secret values out of the report, so nothing written to
  # scan/results/ ever carries one. The grep -v filters git textconv noise
  # from .docx files in docs/, which is harmless and drowns the real output.
  gl_hist="${TMPDIR:-/tmp}/dts-gitleaks-hist-$$.json"
  gitleaks git "$GIT_ROOT" \
    --log-opts="--all --full-history -- $PROJECT_REL" \
    --no-banner --redact --exit-code 0 \
    --report-format json --report-path "$gl_hist" 2>&1 |
    grep -viE 'astextplain|docx2txt|stderr is not empty' | sed 's/^/  /'
  summarise_gitleaks "$gl_hist" "history"
  rm -f "$gl_hist"

  printf '\n  Working tree, entropy-based (additive to the greps above):\n'
  gl_tree="${TMPDIR:-/tmp}/dts-gitleaks-tree-$$.json"
  # lib/gitleaks.toml allowlists .env, .build/, node_modules/ and friends.
  # Read its header before adding to that list -- an allowlist entry that
  # is not justified there is how a scanner quietly stops finding things.
  gitleaks dir "$PROJECT_DIR" \
    --config "$LIB_DIR/gitleaks.toml" \
    --no-banner --redact --exit-code 0 \
    --report-format json --report-path "$gl_tree" 2>&1 |
    grep -viE 'astextplain|docx2txt|stderr is not empty' | sed 's/^/  /'
  summarise_gitleaks "$gl_tree" "working-tree"
  rm -f "$gl_tree"
else
  degraded_because "history-scan" "gitleaks" "$(tool_install_hint gitleaks)" \
    "using git log -p + a project-tuned pattern set instead"
  printf '  Scanning commits touching %s only (the git root is a much larger repo).\n' "$PROJECT_REL"
  hist="$(pgit log -p --all --full-history -- "$PROJECT_REL" 2>/dev/null |
          grep -nE "^\+.*($DANGER)" |
          grep -vE "$PUBLIC_PREFIXES" |
          head -40)"
  if [ -n "$hist" ]; then
    emit LEAD "history-secrets" "added lines in history match a credential shape"
    printf '%s\n' "$hist" | redact | cut -c1-200 | sed 's/^/    /'
    printf '\n    A hit here means the value is in the repository forever, even if\n'
    printf '    a later commit removed it. Rotation, not deletion, is the fix --\n'
    printf '    and rotation is a human-action item, never something to auto-fix.\n'
  else
    emit OK "history-secrets" "no credential-shaped additions in commits touching this project"
  fi
  printf '\n  NOTE: this fallback greps added lines only, has no entropy detector,\n'
  printf '  and cannot see a secret committed in a binary or a rewritten branch.\n'
  printf '  It is weaker than gitleaks. Do not report its silence as "clean".\n'
fi

# ---------------------------------------------------------------------------
section "Accepted-risk keys (report once, do not re-litigate)"
for f in $(printf '%s' "$ACCEPTED_KEY_FILES" | tr '|' ' '); do
  [ -f "$f" ] || continue
  n="$(grep -cEi 'accesskey|apikey|api_key' "$f" 2>/dev/null)"
  [ "${n:-0}" -gt 0 ] && printf '  %-24s %s key-shaped field(s)\n' "$f" "$n"
done
printf '\n  These are documented as deliberate. Before reporting one as a finding,\n'
printf '  read WEBSITE-STATE.md and the file own notes. If the risk was accepted\n'
printf '  by the owner, it belongs in the report accepted-risk section, not the\n'
printf '  findings table -- but the SECOND-ORDER consequence of that decision\n'
printf '  (e.g. a server-side verification that was removed along with a proxy)\n'
printf '  is fair game and is not covered by the original acceptance.\n'

# ---------------------------------------------------------------------------
section "js/config.js leak check"
#
# js/config.js is the fallback config, injected dynamically by content-loader.
# It never appears in a normal network trace, so it is easy to forget -- and
# the repo copy holds every real tour URL. The DEPLOYED copy must be the
# stripped one.
#
# Counting distinct tour ids, not raw line matches: a correctly stripped build
# still contains the public homepage tour on two lines (tourUrl and origin),
# so a raw line count produces a false alarm against a correct build.
# expect_stripped=1 -> more than one distinct tour id is a LEAD.
# expect_stripped=0 -> the file is the pre-strip source; report the count as
#                      context only. The repo copy is SUPPOSED to be full; it
#                      is the input the build strips. Flagging it every run
#                      trains you to ignore this check.
check_config_leak() {
  local label="$1" file="$2" expect_stripped="${3:-1}"
  [ -f "$file" ] || return 0
  local ids
  ids="$(grep -oE 'spaces\.dtsxr\.com/tour/[A-Za-z0-9-]+' "$file" 2>/dev/null |
         sed 's#.*/tour/##' | sort -u)"
  local n
  n="$(printf '%s' "$ids" | grep -c . )"
  printf '  %-28s distinct tour ids: %s\n' "$label" "${n:-0}"
  [ "${n:-0}" -gt 0 ] && printf '%s\n' "$ids" | sed 's/^/      /'
  if [ "$expect_stripped" != "1" ]; then
    printf '    (pre-strip source -- a full list here is expected, not a finding)
'
    return 0
  fi
  if [ "${n:-0}" -gt 1 ]; then
    emit LEAD "config-leak-$label" "$n distinct tour ids present -- a stripped build should carry only the public one"
  else
    emit OK "config-leak-$label" "at most one distinct tour id"
  fi
}
check_config_leak "repo-source" "js/config.js" 0
check_config_leak "built" ".build/js/config.js" 1
printf '\n  The repo copy is EXPECTED to be unstripped -- that is what the build\n'
printf '  strips. The one that matters is the deployed copy; 55-deploy-exposure.sh\n'
printf '  fetches it from the live target and runs the same check.\n'
