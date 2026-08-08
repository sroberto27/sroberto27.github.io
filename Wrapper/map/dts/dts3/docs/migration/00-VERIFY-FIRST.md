# Step 0 — Verify Before Building

Two questions must be answered before any migration work starts, because they
determine whether the whole approach is viable on your accounts. Claude must
work through these FIRST, in plan mode, and report findings before touching code.

---

## Question 1 — Can I build on my PERSONAL accounts now, then hand the exact same
## files to the CLIENT's accounts for production?

**Short answer: Yes. This is the intended workflow. The code is portable; only
account-specific values move.**

The rule the migration must follow to keep this true:

> **Nothing account-specific is ever hardcoded in committed files.**
> Every URL, key, project ref, and account ID lives in ONE place:
> `js/supabase-init.js` for the public Supabase URL + anon key, and Cloudflare
> Pages **environment variables / secrets** for everything server-side. Swapping
> from your accounts to the client's = editing that one file + resetting those
> secrets. No code changes.

What transfers cleanly (just re-point config):
- All site code (HTML/CSS/JS) — untouched by the account swap.
- All `/data` content — same files, uploaded to the client's R2 bucket.
- Cloudflare Pages Functions — same code, new secrets.
- Database schema (`profiles`, `organizations`, `organization_members`,
  `resource_entitlements`, `client_apps`, `events`, `admin_audit` tables — see
  `docs/migration/ACCESS-MODEL.md`) — same SQL, re-run on the client's
  Supabase project.

What does NOT transfer (and shouldn't):
- **Supabase Auth users / client passwords.** These are created fresh on the
  production project. That's correct — at go-live you send real invite emails
  to real clients anyway, so dev-phase test users were never meant to move.
- **Secrets** (Cloudflare API token, Web3Forms key, Supabase service key) —
  regenerated on the client's accounts. Never copy secrets between accounts.

Recommended account model (matches Supabase's own guidance — the free tier's
2-project allowance is explicitly meant for a dev + prod split):
- **Dev/build phase:** everything on YOUR personal Cloudflare + Supabase.
- **Handoff:** create the production Supabase project inside the CLIENT's org,
  create the production Pages project + R2 in the CLIENT's Cloudflare, upload
  the same files, re-point `supabase-init.js`, reset the secrets, migrate the
  domain. Supabase Team/Pro billing then sits on the client's account, not yours.

Claude's task in plan mode: confirm this portability holds against the ACTUAL
code (grep for any hardcoded project URL, account id, or key outside the
designated config spots) and flag anything that would break the clean handoff.

---

## Question 2 — Is the DEVELOPMENT phase free on my account? If not, how much?

**Short answer: Yes — development is $0 as long as you stay on free tiers and
don't put a live client on it. Confirm the live numbers (they shift), but as of
the last check:**

| Service | Dev-phase cost | Why it's free during dev | When it starts costing |
|---|---|---|---|
| Cloudflare Pages (Direct Upload) | **$0** | Free plan: unlimited static requests, 500 builds/mo (Direct Upload doesn't even use builds) | Only Pro ($20/mo) if you ever need advanced WAF — not during dev |
| Cloudflare R2 storage | **$0** | Free tier: 10 GB storage, 1M Class-A + 10M Class-B ops/mo, **zero egress fees always** | Only if content+builds exceed 10 GB stored |
| Cloudflare Pages Functions | **$0** | Free plan: 100k requests/day | Far beyond dev traffic |
| Supabase | **$0** | Free tier: 500 MB DB, 1 GB storage, 50k MAUs, 2 projects. Seven tables (`profiles`, `organizations`, `organization_members`, `resource_entitlements`, `client_apps`, `events`, `admin_audit` — see `ACCESS-MODEL.md`) plus dummy rows and RLS policies stay far under 500 MB. | See the pause note below; also confirm free-tier auth email volume covers org-admin invites at real scale before handoff, since Phase 5b's org-admin invite flow sends through Supabase Auth email |
| Domain | **~$1–1.50/mo** ($12–18/yr) | Not free — but you may already own one, or use a `*.pages.dev` subdomain for dev and buy the domain only at go-live | Always a small real cost |
| Web3Forms | **$0** | Free tier covers dev testing | High volume only |
| Clarity / GA4 | **$0** | Free products | Never (Plausible is the paid alt at $9) |
| Code-signing cert | **$0 during dev** | Not needed until you distribute a real signed .exe (step 8) | ~$10/mo equivalent at builds stage |

**Net development cost: effectively $0** (or ~$1.50/mo if you buy the domain
now instead of using a free `*.pages.dev` URL during dev).

### The one caveat that isn't a dollar cost: the Supabase pause
Free Supabase projects **pause after 7 days of no database activity**. During
active development this never triggers. It only matters once a live client might
log in during a quiet week and hit a paused project. So:
- **Dev phase: stay on free.** The pause is harmless while you're building.
- **Go-live: budget $25/mo Pro** — on the CLIENT's account, not yours. This is
  the only line item that becomes mandatory, and it lands on their bill.

### Cost guardrail for the whole dev phase
> You should not spend more than the price of a domain (~$12–18 one-time/yr)
> to complete the entire build and handoff. If any step in this plan would
> require a paid upgrade DURING development, Claude must stop and flag it rather
> than proceed.

Claude's task in plan mode: verify nothing in the planned build steps 1–7
crosses a free-tier limit (DB size, R2 storage, function invocations), and
confirm the dev phase can complete at $0 + domain. Report any step that would
force an early upgrade.

---

## Output required from Step 0
Before proceeding to Step 1, Claude produces a short written verification:
1. Portability confirmed / issues found (with file:line for any hardcoded values).
2. Dev-phase cost confirmed $0 + domain / any step that would force a paid upgrade.
3. A recommended account setup (what to create on personal now, what to defer to
   the client's account at handoff).
Only after the user reviews this does work move to Step 1.
