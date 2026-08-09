/* ============================================================
   Turnstile widget init
   ------------------------------------------------------------
   The ONLY account-specific value allowed in a committed file
   for Turnstile (WORKFLOW.md golden rule 3) -- a widget's site
   key is public by design (it's embedded in every page that
   renders the widget); the SECRET key that verifies a token
   server-side lives only in the TURNSTILE_SECRET_KEY Pages
   secret, read by functions/api/lead.js, never here.

   Exposes window.DTS_TURNSTILE_SITE_KEY -- app.js reads this
   when calling turnstile.render().
   ============================================================ */
window.DTS_TURNSTILE_SITE_KEY = "0x4AAAAAAELMgm4dHxFB4W_L";
