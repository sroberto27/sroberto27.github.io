/* ============================================================
   Client access directory ("Access Your Twin")
   ------------------------------------------------------------
   The Google-Sheet-backed directory was retired in the migration's
   Phase 2 (docs/migration/): the published sheet leaked every
   client's access_id/access_code in plaintext to anyone with the
   CSV link. Real auth is rebuilt on Supabase in Phase 4
   (js/app.js authenticate()) — until then, sign-in only works via
   the demo directory below, and only on localhost, so production
   never exposes even the demo credentials.
   ============================================================ */
window.DTS_CLIENTS = {
  /* Sign-in window copy. */
  ui: {
    title: "Welcome Back!",
    intro: "",
    idLabel: "Email",
    codeLabel: "Password",
    submit: "Login In",
    error: "We couldn't find a twin for that email and password. Check your welcome email, or contact the DTS team.",
    offlineNote: "Demo directory in use — connect a Google Sheet in js/clients.js to manage real clients."
  },

  /* Dev-only fallback directory — never active outside localhost. */
  demoDirectory: (typeof location !== "undefined" && location.hostname === "localhost") ? [
    { access_id: "demo", access_code: "1234",
      client: "Demo Client", project: "Showcase Twin",
      twin_url: "https://spaces.dtsxr.com/tour/4fb22059", sweep_id: "",
      notes: "Sample twin for demonstrations." },
    { access_id: "acme-hotel", access_code: "4821",
      client: "Acme Hotels", project: "Downtown Lobby",
      twin_url: "https://spaces.dtsxr.com/tour/4fb22059", sweep_id: "",
      notes: "Lobby & event-space twin." },
    { access_id: "acme-hotel", access_code: "4821",
      client: "Acme Hotels", project: "Rooftop Venue",
      twin_url: "https://spaces.dtsxr.com/tour/4fb22059", sweep_id: "",
      notes: "Rooftop capture." }
  ] : []
};
