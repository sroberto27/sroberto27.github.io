/* ============================================================
   Supabase client init
   ------------------------------------------------------------
   The ONLY account-specific values allowed in a committed file
   (WORKFLOW.md golden rule 3) -- the public project URL + anon
   key, safe to be public by design. Everything else (service
   role key, DB password, access token) lives only in Pages
   secrets / .env, never here.

   Exposes window.DTS_SUPABASE -- app.js reads this, not the raw
   `supabase` UMD global (which is the library's factory
   namespace, not a client instance).
   ============================================================ */
window.DTS_SUPABASE = supabase.createClient(
  "https://wsqvzyfvxjenqvqjpqjv.supabase.co",
  "sb_publishable_EmbbX16ZP3Ezama0_gHO9w_y-2eiQvW"
);
