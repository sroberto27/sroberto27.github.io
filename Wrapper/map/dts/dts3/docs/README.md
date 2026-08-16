# DTS Website — documentation index

Start here. Nothing in `docs/` is ever deployed — the whole folder is excluded
from the static site build.

## Read first

| Document | What it's for |
|---|---|
| **[DTS-Documentation-Guide.docx](DTS-Documentation-Guide.docx)** | **How to use everything in this folder**, plus ready-to-paste prompt templates for the ten kinds of work you're most likely to do next (fresh session, test pass, bug report, deploy, audit, handoff…). Word format, for reading away from the repo. |
| **[WEBSITE-STATE.md](WEBSITE-STATE.md)** | **The cold-read reference.** How the site actually works today: stack, deploy model, identity/access, content pipeline, every subsystem, the do-not-break list, known gaps, and current deployment status. If you read one file, read this one. |
| [migration/ACCESS-MODEL.md](migration/ACCESS-MODEL.md) | The **normative** spec for identity, organizations, memberships, the four access levels, `resource_key` format, and entitlements. Wins over any other document on these topics. |
| [migration/DEPLOY-STAGING.md](migration/DEPLOY-STAGING.md) | The **only** correct deploy procedure. Three real bugs have shipped from improvising this step. Don't reconstruct it from memory. |
| [migration/FULL-SYSTEM-TESTING.md](migration/FULL-SYSTEM-TESTING.md) | The consolidated manual test pass over the whole site, 135 tests. Supersedes the individual phase-testing docs. |
| [../CLAUDE.md](../CLAUDE.md) | Working rules: do-not-break list, commit conventions, the "three places every time" rule, verification approach. |

## History and reference

| Document | What it's for |
|---|---|
| [migration/PROGRESS.md](migration/PROGRESS.md) | The authoritative session log — every phase, every bug, every fix, newest first. Long, but it's the record of *why*. |
| [CHANGES.md](CHANGES.md) | Changelog. |
| [migration/README.md](migration/README.md) | The migration kit's front door — what the kit is and what's in it. |
| [migration/WORKFLOW.md](migration/WORKFLOW.md) | Master process and the golden rules every phase follows. |
| [migration/00-VERIFY-FIRST.md](migration/00-VERIFY-FIRST.md) | The two gating questions answered before any migration work started (account portability, cost). |
| [migration/AUTOMATION-AND-CREDENTIALS.md](migration/AUTOMATION-AND-CREDENTIALS.md) | How the DB/content/deploy work is automated, and the one-time credential setup behind it. |
| [migration/ACCOUNT-SETUP-AND-HANDOFF.md](migration/ACCOUNT-SETUP-AND-HANDOFF.md) | Every external account, when it's needed, and how the site ends up on the client's own accounts. |
| [migration/archive/](migration/archive/) | Superseded phase-testing documents, kept for their real recorded results. |
| [plans/gis/09-BUILD-PLAN.md](plans/gis/09-BUILD-PLAN.md) | Phase order for the GIS build package. |
| [DTS-Developer-Onboarding.docx](DTS-Developer-Onboarding.docx) | Developer onboarding handout (predates the migration). |

## Current status, in one line

Migration phases 0–9 are **done** and live at
<https://dts-website-4cu.pages.dev>, still running on the **developer's
personal** Cloudflare and Supabase accounts. **Handoff to the client's accounts
has not happened.** See [WEBSITE-STATE.md §10](WEBSITE-STATE.md#10-current-deployment-status).
