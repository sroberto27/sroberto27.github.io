/* ============================================================
   DTS — Client Access ("Access Your Twin")
   ------------------------------------------------------------
   A deliberately SIMPLE, low-maintenance sign-in for returning
   clients who already have a digital twin. It reads a published
   Google Sheet (as CSV) — no backend, no database server, no
   build step. The owner edits the sheet; the site reflects it
   on the next load.

   >>> HOW TO SET UP THE SHEET (one time, ~5 minutes) <<<

   1. Make a Google Sheet with a header row, exactly these columns
      (order does not matter, names are matched case-insensitively):

        access_id | access_code | client | project | twin_url | sweep_id | notes

      One row per client. Example row:

        acme-hotel | 4821 | Acme Hotels | Lobby & Event Twin |
        https://spaces.dtsxr.com/tour/4fb22059 | <sweep-id-or-blank> |
        Renewal due Q3

   2. File ▸ Share ▸ Publish to web ▸ choose the sheet/tab ▸
      "Comma-separated values (.csv)" ▸ Publish.
      Copy the URL it gives you (it ends in &output=csv or
      /pub?output=csv).

   3. Paste that URL into `sheetCsvUrl` below.

   That's it. To add or remove a client, edit the sheet. To rotate
   a code, change the cell. No code change, no redeploy.

   >>> A CLIENT WITH MULTIPLE TWINS <<<
   Give them ONE login and add one row per twin, all sharing the
   same access_id + access_code. Example:

        acme-hotel | 4821 | Acme Hotels | Downtown Lobby | …/aaa | s1 |
        acme-hotel | 4821 | Acme Hotels | Airport        | …/bbb | s2 |
        acme-hotel | 4821 | Acme Hotels | Rooftop Venue  | …/ccc |    |

   On sign-in, all of that client's twins appear on the dashboard,
   each with its own "Open" button. A client with a single row just
   sees one twin. Keep the `client` name identical across their rows.

   >>> AN HONEST NOTE ON SECURITY (read this) <<<
   A published sheet is PUBLICLY READABLE by anyone who has the
   CSV link. The access_code column is therefore NOT a secret and
   NOT real security — treat it as a light "members-only" gate,
   exactly matching the brief's note that the twin data is meant to
   be publicly accessible anyway. Do NOT put anything genuinely
   sensitive (real passwords reused elsewhere, personal data,
   payment info) in this sheet. If the stakes ever rise, the
   `authenticate()` function below is the single place to swap in a
   real auth provider (e.g. a serverless function, Firebase Auth,
   Auth0) without touching the rest of the app.

   The whole thing degrades gracefully: if no sheet URL is set, a
   small built-in DEMO directory (below) is used so the flow is
   fully testable offline.
   ============================================================ */
window.DTS_CLIENTS = {
  /* Paste your published-CSV URL here. Leave "" to use the demo
     directory below (useful for local testing / first demo). */
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGRuZefJU28qXSgyLWSmLWUh2akMcZiV16fCN_89aKpTmpg4GdHZTouhenlt3stjPDCLp99v4_fTVV/pub?gid=602775609&single=true&output=csv",

  /* Shown on the sign-in window. */
  ui: {
    title: "Access Your Twin",
    intro: "Returning client? Sign in with the access ID and code from your DTS welcome email to jump straight into your live digital twin.",
    idLabel: "Access ID",
    codeLabel: "Access code",
    submit: "Open my twin",
    error: "We couldn't find a twin for that ID and code. Check your welcome email, or contact the DTS team.",
    offlineNote: "Demo directory in use — connect a Google Sheet in dts-clients.js to manage real clients."
  },

  /* Built-in fallback directory used ONLY when sheetCsvUrl is "".
     Lets you demo the entire returning-client flow with no setup.
     These map onto the same real Treedis showcase the demo uses.

     A client with MORE THAN ONE twin is just several rows that share
     the same access_id + access_code (see "acme-hotel" below). On
     sign-in they all appear on the dashboard, each with its own Open
     button. A single-twin client (one row) opens straight in. */
  demoDirectory: []
};
