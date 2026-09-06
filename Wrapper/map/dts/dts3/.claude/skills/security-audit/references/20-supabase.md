# Supabase scope — RLS logic, auth, storage

Loaded for the `supabase` scope. Pinned at build time; nothing here needs
refetching.

**Scan input:** `30-rls.sh` (+ `30-rls.sql` when a live DB is reachable),
`40-supabase-cfg.sh`.

---

## 1. What this scope is and is not responsible for

RLS protects **one** of the two paths into the database:

| | Browser → Supabase direct | Browser → Pages Function |
|---|---|---|
| Credential | the publishable key that ships to every visitor | the user's JWT, verified server-side |
| Enforcement | **RLS policies** | **service role — RLS bypassed entirely** |
| Audited by | this scope | the `app` scope |

Every `.from()` / `.rpc()` call in `js/` is on the left. Every `pgrst()` call
in `functions/` is on the right, and RLS gives it nothing at all.

So: a perfect set of RLS policies does not make the Functions safe, and a
missing policy only matters if something on the left actually touches that
table. `30-rls.sh` prints the client-side `.from()` call sites for this
reason — those tables are the priority list.

---

## 2. The policy questions a scanner cannot answer

A scan proves a policy **exists** and prints its text. Whether the logic is
**right** is this scope's actual work.

### Does `USING` constrain the row the caller is allowed to touch, or a row they can reach *through* something they control?

The failure looks like a policy that checks membership of a value taken from
the row rather than from the caller:

```sql
-- reachable: is_org_member(org_id) is evaluated against the row's own org_id
using ( public.is_org_member(org_id) )
```

That is correct *if* `is_org_member()` resolves the caller from `auth.uid()`
and cannot be influenced by the row. Open the function and confirm. A helper
that takes a caller-supplied argument and trusts it is the whole bug.

### Is `WITH CHECK` present on every write, and does it constrain the *new* row?

`USING` says which rows you may act on. `WITH CHECK` says what the row may
look like afterwards. They are different questions and the second is the one
people forget.

- **INSERT** has no `USING` at all. No `WITH CHECK` means unrestricted insert.
- **UPDATE** defaults `WITH CHECK` to the `USING` expression — safe *only* if
  that expression constrains the new row too. `using (org_id = my_org())`
  without an explicit `WITH CHECK` lets a caller update their own row and
  change `org_id` to someone else's, moving the row out of their own reach and
  into another tenant.
- **ALL** covers every verb, including the write ones. Same requirement.

### Can `auth.uid()` be satisfied by a row the caller shouldn't reach?

`auth.uid()` is the authenticated user id, which is trustworthy. The question
is what the policy *joins* it to. A policy resolving the caller's org through
a membership table is only as strong as that table's own policies — if a user
can insert their own membership row, every org-scoped policy in the schema
falls at once. Trace the chain to its root.

Related: does the membership check require the **organization** to be active,
not just the membership? A disabled org whose memberships stay active makes
"disable this organization" cosmetic. That exact bug has occurred here.

### Is the identity column itself protected?

If a user can `UPDATE` their own `profiles` row and that row carries the role
column, the whole role system is advisory. Look for the trigger or column
grant that prevents it — then read the trigger's **bootstrap path**: the first
admin, a NULL old row, a service-role write. That path has already needed a
fix in this schema, and there is a migration named after it.

### Does a `SECURITY DEFINER` helper pin `search_path`?

These run as their owner and bypass RLS. Without `SET search_path`, a caller
who can create objects in an earlier schema on the path can shadow something
the body references and have it execute with the owner's privileges. The
static reader checks this mechanically; what it cannot check is whether the
body itself is safe to run with elevated rights.

### Do views leak past RLS?

A view runs with its owner's privileges and does **not** inherit the
underlying table's RLS unless declared `security_invoker` (PG15+). A view over
an RLS-protected table is a standard way to publish everything by accident.
Check whether it is exposed through the Data API.

---

## 3. RLS pitfalls worth checking every time

- **RLS enabled with no policies = deny-all.** Correct, not a vulnerability —
  but it silently breaks features and gets misreported. Note it as a
  functional risk.
- **RLS is meaningless without a grant, and grants are invisible in the
  migrations.** Supabase grants `anon`/`authenticated` at project setup. A
  migration file that contains no `GRANT` does not mean the roles lack access.
  Only the live catalog answers this — one of the specific things
  `30-rls.sql` gets that the static reader cannot.
- **No `FORCE ROW LEVEL SECURITY` means the table owner bypasses every
  policy.** Usually fine, since the app connects as `anon`/`authenticated`.
  Worth knowing before you assert a table is protected.
- **`USING (true)` on SELECT is often deliberate** (a genuinely public table).
  On a write verb it means any caller the policy applies to can write any row.
  Read each one; do not pattern-match.
- **Policies without `TO` apply to `PUBLIC`** — every role, including `anon`.
  A policy whose predicate assumes an authenticated caller but which is not
  restricted `TO authenticated` relies entirely on that predicate returning
  false for anonymous callers. Verify it does.
- **`auth.uid()` returns NULL for anonymous callers.** `user_id = auth.uid()`
  is then `NULL = NULL` → NULL → not true, which denies. Safe. But
  `coalesce(auth.uid(), something)` or a `NOT IN` against a NULL is a
  different story: three-valued logic is where these go wrong.
- **Realtime subscriptions honour RLS on the *table*, but a broadcast or
  presence channel is a separate surface.** If Realtime is in use, check it
  separately.

---

## 4. Auth configuration

`40-supabase-cfg.sh` reads GoTrue's own published settings, which is ground
truth — `supabase/config.toml` describes the *local* stack and on a project
that runs against a hosted instance may be near-entirely defaults.

What matters, and why:

- **Email autoconfirm.** If on, anyone can register as any address without
  proving control of it. Combined with any email-domain-based access grant,
  that is direct privilege escalation: register as `anyone@clientdomain.com`,
  receive the client's access. **Check for a domain-to-org mapping feature
  before ranking this** — if one exists, autoconfirm is Critical, not Medium.
- **Open signup.** Usually correct for a site with a public "registered" tier.
  It is only a finding if a self-registered account reaches further than the
  lowest tier. Read `ACCESS-MODEL.md` and test it rather than assuming.
- **Redirect allowlist.** An unlisted `redirectTo` breaks confirmation,
  OAuth return, and password reset. Over-permissive entries (wildcards, an
  attacker-controllable host) turn the reset flow into token theft. Both
  directions matter; this project has an open question recorded about it.
- **JWT expiry and refresh-token rotation.** A long expiry widens the window on
  a stolen token — which matters more here because the token lives in
  `localStorage`, readable by any XSS.
- **Rate limits on email.** A tight project-wide cap shared across signup
  confirmation and password reset is a denial-of-service on account recovery,
  and it is trivially triggered by anyone. Worth reporting as availability
  even though it is not a disclosure.
- **Providers enabled in the project vs offered in the UI.** A button for a
  disabled provider is a broken feature, not a vulnerability. Check
  `WEBSITE-STATE.md` before reporting — it may already be recorded.

---

## 5. Storage

- A **public bucket** serves every object to anyone who knows the path. Object
  names are frequently guessable.
- A **signed URL** is a bearer token for its lifetime. Long TTLs are the
  common mistake; so is generating one before checking whether the caller was
  entitled to it.
- Storage has its own RLS on `storage.objects`. A private bucket with a
  permissive policy is not private.
- Where files are served through a Function and an object store rather than
  Supabase Storage, the same questions apply to that route — that is the `app`
  scope's problem, but the reasoning transfers unchanged.

---

## 6. Exploit tests worth writing for this scope

Only after a finding is approved, and always failing-first. See
`50-pentest.md`.

- **Cross-user sweep.** User A's session against user B's rows, every table,
  every verb. The single highest-value probe; catches whole classes at once.
- **Unauthenticated PostgREST read** of every table with only the publishable
  key. `40-supabase-cfg.sh` does a first pass; a real probe checks rows, not
  just status codes.
- **Forged tokens.** Expired, `alg:none`, signed by a different project,
  tampered `sub`. Each must be rejected — and rejected at the *authorization*
  step, not merely treated as anonymous, if the route also serves anonymous
  callers.
- **The write-path escalation.** Update a row you own, changing the column
  that determines ownership or tenancy. This is the `WITH CHECK` question,
  executed.
- **Membership self-grant.** Insert yourself into an org you do not belong to.
- **Role self-promotion.** Update your own profile's role column directly
  through PostgREST, bypassing whatever the UI does.
