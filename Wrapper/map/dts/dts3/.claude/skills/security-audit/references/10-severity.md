# Severity — impact × exploitability × reachability

Rank by what an attacker actually gets, how hard it is to get, and whether
the path is live. Not by which OWASP category the bug belongs to.

---

## The three axes

**Impact** — what the attacker ends up holding.

| | |
|---|---|
| Critical | Every user's data, or write access to what every visitor sees. Service-role key disclosure. Raw `/data` published as static assets. Arbitrary content injected into the published site. |
| High | One other user's gated data. Privilege escalation to `org_admin` or `site_admin`. Any authenticated user reading another org's rows. |
| Medium | Data the victim would not choose to share but that is not gated. Bypassing a rate limit. Enumerating users or orgs. |
| Low | Version disclosure, internal paths, a stale allowlist entry, defence-in-depth that is missing but not currently load-bearing. |

**Exploitability** — what it costs to run.

| | |
|---|---|
| Trivial | A URL, or one `curl`. No account. |
| Easy | A free self-registered account, or a crafted link a victim clicks. |
| Moderate | Needs an existing role (org member), a race, or a specific victim state. |
| Hard | Needs `site_admin`, physical access to a developer machine, or an already-compromised credential. |

**Reachability** — is the path live *right now*?

| | |
|---|---|
| Live | The deployed target serves it today. |
| Conditional | Reachable only when a feature is enabled, a provider configured, a flag set. Say which condition. |
| Dead | Code exists, no route reaches it. **Not a finding.** Note it and move on. |

---

## Composing them

Start at impact, move down for exploitability and reachability. A Critical
impact behind a `site_admin`-only path is not Critical — it is a
privilege-escalation consequence and ranks by how hard `site_admin` is to
obtain.

Two rules that override the grid:

1. **Dead code is never a finding.** Report it as cleanup, at most.
2. **A trivially exploitable Medium outranks a hard-to-reach High.** Fix
   order follows real risk, and real risk includes how likely anyone is to
   bother.

---

## The `site_admin` calibration — the one this project gets wrong most

`site_admin` is the maximally trusted role here. It can already publish
arbitrary site content, read every gated resource, and manage every org and
user. That single fact changes how a large class of findings should be ranked.

**An `innerHTML` sink fed by CMS content that only `site_admin` can author is
not guest-facing XSS.** The person who can write the payload can already do
everything the payload would achieve. Its real shape is:

- persistence — script survives in published content and runs in *every*
  visitor's session, long after the authoring session ends
- blast radius on account compromise — one phished `site_admin` becomes
  arbitrary JS for every visitor, rather than one bad publish
- insider and multi-admin risk, once more than one person holds the role

That is a real finding. It is usually **Medium**, occasionally High if the
sink reaches a highly privileged context. It is **not** a P1, and reporting it
as one alongside a genuine unauthenticated hole destroys the ranking's
usefulness. The project's own CSP decisions were made on exactly this
reasoning and were approved on that basis — re-litigating them as Critical
findings will read as not having done the grounding read.

**The genuinely untrusted input is different and ranks higher.** Anything a
stranger authors and a victim opens — a share link's query state, a form
field, a URL parameter — is guest-facing. This project has already had a real
exploited XSS on exactly that path (a crafted share link breaking out of a
`style` attribute). Sinks on that path start at High.

The distinction to hold: **who authors the value**, not which function
receives it.

---

## Recurring cases, pre-ranked

Not a substitute for reasoning — a starting point that stops obvious
mis-rankings.

| Situation | Start at | Because |
|---|---|---|
| Service-role key readable by a browser | Critical | RLS is bypassed entirely; total compromise |
| Raw `/data` served statically, shadowing the access Function | Critical | Every access check on the site bypassed at once, silently |
| An admin route missing its guard, or checking it after a side effect | Critical | Unauthenticated full admin |
| A route taking an id with no ownership check | High | Classic IDOR; trivial once the shape is known |
| Cross-org read through a wrong RLS policy | High | One tenant reads another |
| Gated resource URL returned to an anonymous caller | High | Gating is the product here |
| Stored XSS in `site_admin`-authored content | Medium | See the calibration above |
| XSS from a share link or other stranger-authored input | High | Victim only has to click |
| Missing rate limit on an unauthenticated write endpoint | Medium | Abuse and cost, not disclosure. Higher if it reaches email or money |
| Missing `frame-ancestors` / `X-Frame-Options` | Low–Medium | Depends entirely on whether a clickjack achieves anything here |
| Missing SRI on a CDN script | Medium | Real supply-chain exposure, but needs the CDN or the package to be compromised first |
| Advisory in a dependency that never ships to the browser | Low | Developer-machine and CI risk. Do not rank as visitor exposure |
| A bearer URL that stays valid after issuance | Note it | Often inherent to the third-party product. Say what is controlled and what is not |

---

## Writing the severity line

State the composition, not just the label:

> **High** — impact High (another org's entitlements are readable), exploit
> Easy (any authenticated user, one request), reachability Live (confirmed
> against the dev deploy on 2026-09-06).

A reader who disagrees with your label can then see exactly which axis they
disagree on. A bare "High" gives them nothing to argue with, which is worse,
not better.
