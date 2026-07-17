/* ============================================================
   Client access directory ("Access Your Twin")
   ------------------------------------------------------------
   Simple sign-in for returning clients. The directory is a
   published Google Sheet read as CSV — no backend, no database.
   Edit the sheet; the site reflects it on the next load.

   Sheet setup:
   1. Create a Google Sheet with this header row (order and case
      don't matter):
        access_id | access_code | client | project | twin_url | sweep_id | notes
      One row per twin. A client with several twins gets one row
      per twin, all sharing the same access_id + access_code and
      an identical client name.
   2. File ▸ Share ▸ Publish to web ▸ pick the tab ▸ CSV ▸ Publish.
   3. Paste the published URL into `sheetCsvUrl` below.

   Security note: a published sheet is publicly readable to anyone
   with the CSV link, so access_code is a light members-only gate,
   not real security. Never put genuinely sensitive data in the
   sheet. To upgrade later, replace authenticate() in js/app.js
   with a real auth provider — nothing else needs to change.

   If sheetCsvUrl is empty or unreachable, the built-in demo
   directory below is used (try demo / 1234).
   ============================================================ */
window.DTS_CLIENTS = {
  /* Published-CSV URL. Leave "" to use the demo directory. */
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGRuZefJU28qXSgyLWSmLWUh2akMcZiV16fCN_89aKpTmpg4GdHZTouhenlt3stjPDCLp99v4_fTVV/pub?gid=602775609&single=true&output=csv",

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

  /* Fallback directory used when the sheet is unset or unreachable. */
  demoDirectory: [
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
  ]
};
