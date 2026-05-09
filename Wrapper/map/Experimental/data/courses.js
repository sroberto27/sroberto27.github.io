/* ============================================================
   SCSU METAVERSITY — Course catalog (Learn mode)
   ------------------------------------------------------------
   Loaded via <script>, just like data/buildings.js — assigns
   into the global SCSU_DATA namespace so app.js can read it
   without a fetch (works over file:// as well as http://).

   Shape of one course entry:
     {
       id:          "nrm-342",          // stable slug, used as DOM key
       code:        "NRM 342",          // course code shown above the title
       title:       "Agronomy & Soils", // shown in the list & detail header
       credits:     "X Course Credits", // string so "TBD" / "3 Credits" both work
       lastUpdated: "1 OCTOBER, 2026",  // free-form; rendered verbatim
       lede:        "Lorem ipsum…",     // 1–2 sentence dek under the title
       overview:    "Sed ut perspici…", // long-form paragraph
       curriculum:  [ "Sed ut…", … ],   // bullets in the right column
       immersive: {                     // omit / null if not VR-enabled
         vrUrl: "https://www.#",
         note:  "In your headset, navigate to [ … ] and lorem ipsum…"
       }
     }

   Placeholder text mirrors the Figma "Learn Tab" board exactly
   so the layout can be QA'd against the design before real
   course copy is wired in.
   ============================================================ */
window.SCSU_DATA = window.SCSU_DATA || {};

window.SCSU_DATA.courses = [
  {
    id:          "nrm-342",
    code:        "NRM 342",
    title:       "Agronomy & Soils",
    credits:     "X Course Credits",
    lastUpdated: "1 OCTOBER, 2026",
    lede:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, " +
      "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    overview:
      "Sed ut perspiciatis unde omnis iste natus error sit voluptatem " +
      "accusantium doloremque laudantium, totam rem aperiam, eaque ipsa " +
      "quae ab illo inventore veritatis et quasi architecto beatae vitae " +
      "dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit " +
      "aspernatur aut odit aut fugit, sed quia consequuntur magni dolores " +
      "eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam " +
      "est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci " +
      "velit, sed quia non numquam eius modi tempora incidunt ut labore " +
      "et dolore magnam aliquam quaerat voluptatem.",
    curriculum: [
      "Sed ut perspiciatis unde omnis",
      "Iste natus error sit voluptatem accusantium doloremque laudantium",
      "Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis " +
        "et quasi architecto beatae vitae dicta sunt explicabo",
      "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit " +
        "aut fugit",
      "Sed quia consequuntur magni dolores eos qui ratione voluptatem " +
        "sequi nesciunt",
      "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet"
    ],
    immersive: {
      vrUrl: "https://www.#",
      note:
        "In your headset, navigate to [ https://www.# ] and lorem ipsum " +
        "dolor set amet consequat."
    }
  },

  {
    id:          "nrm-431",
    code:        "NRM 431",
    title:       "Soil Fertility",
    credits:     "X Course Credits",
    lastUpdated: "1 OCTOBER, 2026",
    lede:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, " +
      "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    overview:
      "Sed ut perspiciatis unde omnis iste natus error sit voluptatem " +
      "accusantium doloremque laudantium, totam rem aperiam, eaque ipsa " +
      "quae ab illo inventore veritatis et quasi architecto beatae vitae " +
      "dicta sunt explicabo.",
    curriculum: [
      "Sed ut perspiciatis unde omnis",
      "Iste natus error sit voluptatem",
      "Totam rem aperiam, eaque ipsa quae ab illo inventore",
      "Nemo enim ipsam voluptatem quia voluptas",
      "Sed quia consequuntur magni dolores"
    ],
    immersive: null
  }
];
