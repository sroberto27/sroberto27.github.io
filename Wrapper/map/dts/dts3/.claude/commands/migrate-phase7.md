---
description: Phase 7 — Lead form behind a Function + Turnstile, rotate Web3Forms key
---

Phase 7 of the DTS migration. Prerequisite: Phase 6 done.
Re-read golden rules. **Plan first, execute after approval.**

Goal: take the Web3Forms key out of the public site and add bot protection.

Plan, then do:
1. **`functions/api/lead.js`** (~30 lines): verifies a Cloudflare Turnstile token, then
   forwards the lead to Web3Forms using the key from a Pages secret.
2. **`js/app.js sendLead()`**: change the one URL from `api.web3forms.com/submit` to
   `/api/lead`; drop `access_key` from the payload. KEEP the mailto fallback logic exactly
   as-is (do-not-break).
3. **Turnstile widget** added to the lead forms; add its script to the CSP.
4. **`data/site/lead.json`**: remove `accessKey`; set `ownerEmail` to a domain address.
5. **Rotate** the old Web3Forms key (the old one is public + in history) — register new,
   put it in the Pages secret, retire the old.
6. Test: lead send works through the Function; the mailto fallback still works when the
   Function is unreachable; Turnstile blocks an obviously scripted submit. Update
   `PROGRESS.md`. Stop. Next: `/migrate-phase8`.
