---
description: Kick off the DTS website migration — plan mode + Step 0 verification
---

You are migrating the Digital Twin Studios website off GitHub Pages and its
Google-Sheet-based login onto a GitHub-free Cloudflare + Supabase stack. The full
plan lives in `docs/migration/` — read these four files first, in order:

1. `docs/migration/WORKFLOW.md` — the master process and golden rules.
2. `docs/migration/ACCESS-MODEL.md` — the normative identity/access spec
   (site roles, organizations, memberships, org roles, access levels,
   entitlements) that Phases 3 onward implement. Not needed to complete Step
   0 itself, but read it now so later phases aren't a surprise.
3. `docs/migration/00-VERIFY-FIRST.md` — the two questions you must answer before
   any code changes.
4. `docs/migration/AUTOMATION-AND-CREDENTIALS.md` — how the DB/content work is
   automated (Supabase CLI migrations, scripted Wrangler, dummy dev data) and the
   one-time credential setup that enables it.
5. `README.md` — the real architecture, the do-not-break list, and the file map.

**Do NOT edit any code yet. Enter plan mode.**

Your job in this first session is Step 0 (verification) only:

1. **Confirm the project.** Confirm you're in the DTS site root (you should see
   `index.html`, `js/`, `css/`, `data/`, `README.md`). List what you found.

2. **Answer Question 1 — account portability.** Grep the actual codebase for any
   hardcoded account-specific values (Supabase project URLs, account IDs, API
   keys, the Google Sheet CSV URL, the Web3Forms key) so we know exactly what has
   to move at handoff. Report each with file:line. Confirm whether the
   "build on my personal accounts, hand the same files to the client's accounts"
   workflow holds, and flag anything that would break a clean config-only swap.

3. **Answer Question 2 — dev-phase cost.** Cross-check the planned build (phases
   1–7) against the free-tier limits listed in `00-VERIFY-FIRST.md`. Confirm the
   development phase can be completed at $0 + the cost of a domain, and flag any
   single step that would force a paid upgrade during development. If any pricing
   number looks like it may have changed, say so and note it should be re-checked
   at supabase.com/pricing and cloudflare.com — don't assume.

4. **Produce the Step 0 output** exactly as specified at the bottom of
   `00-VERIFY-FIRST.md`: portability finding, cost finding, and a recommended
   account setup (what to create on personal accounts now vs. defer to the
   client's accounts at handoff).

5. **Scaffold credentials for automation.** Create `.env.example` listing the vars
   the later phases need (SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_URL,
   SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY,
   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) with placeholder values and a
   comment on where each comes from. Ensure `.gitignore` excludes `.env` and
   `.env.prod`. Do NOT create a real
   `.env` or ask for secret values yet — that happens at Phase 3. Just lay the
   scaffolding and confirm secrets can never enter git.

6. **Write a migration plan.** Using plan mode, lay out the full phased plan
   (phases 1–9 + handoff, per WORKFLOW.md) as the proposed path, but present ONLY
   phase 1 in detail as the immediate next step. Initialize
   `docs/migration/PROGRESS.md` with all phases marked "not started" and Step 0
   marked "in progress".

Then STOP and present the verification + plan for approval. Do not begin Phase 1
until the user explicitly approves. When approved, the next command to run is
`/migrate-phase1`.

Remember the golden rules: plan before code, preserve the do-not-break list, keep
all code account-agnostic, and never let a dev-phase step require a paid upgrade.
