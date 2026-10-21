# Vendored third-party code

Libraries are committed here rather than fetched from a CDN at runtime.

Two reasons. The first is correctness. MapLibre needs a web worker, and a
browser refuses to construct one from a cross-origin script, so the CDN copy
paints a background and then never finishes loading its style — no error, no
tile requests, a blank map. Observed 2026-09-20 as `SecurityError: Failed to
construct 'Worker': Script at 'https://cdn.jsdelivr.net/...' cannot be
accessed from origin`. That error is reproducible and is reason enough on its
own not to load this library from a CDN.

The version is 4.7.1, the line the reference project proved against this
imagery service, loaded as a classic script because that build inlines its
worker. 6.10.0 was tried first and could not be shown to work, but that
attempt was made in an automated browser tab which was backgrounded, where
`requestAnimationFrame` never fires and MapLibre therefore never completes a
style load or requests a tile. No conclusion about 6.10.0 should be drawn from
it; 4.7.1 is chosen because it is the version with prior evidence behind it,
not because a later one was shown to be faulty.

The second is reproducibility. A result recorded against this artifact should
remain reproducible from the repository alone, without depending on a third
party continuing to serve a given version.

| Library | Version | Files | Licence | Retrieved |
|---|---|---|---|---|
| MapLibre GL JS | 4.7.1 | `maplibre-gl.js` (UMD, worker inlined), `maplibre-gl.css` | BSD 3-Clause | 2026-09-20 from `cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/` |
| Three.js | 0.183.0 | `three.module.js`, `three.core.js` | MIT | 2026-09-20 from `cdn.jsdelivr.net/npm/three@0.183.0/build/` |

Changing a version here makes a different build for verification purposes, and
the change belongs in the research change log with its date.


## 2026-09-20 optional exterior tiles

Added `3d-tiles-renderer@0.5.1` from the official npm package, retaining its MIT
LICENSE and five build modules reachable from the Three renderer and core plugin
entry points. Added the `three@0.183.0` GLTF/Draco/KTX2 loader dependency closure,
Draco/Basis decoder assets and MIT LICENSE. Files are vendored verbatim from npm.
The application's import map resolves these modules locally; Google tile content
is requested only after the operator selects 3D with a configured browser key.

## D086 embedded checklist presentation

CheckList/v2/style.css copied unchanged under src/scouting/v2; SHA256
3b4ec224bc942b998cb8055c4df82e901bcf07d9a977dfd3ebd1b8d394750dcc.
Local Inter font subsets (SIL OFL1.1) and Font Awesome Free6 CSS/solid font copied
from CheckList/v2/vendor into src/scouting/v2/vendor with original notices. No
remote asset loading, V2 app/storage scripts or service worker copied.
# Visual interface fonts — 2026-10-08

Geist (Google Fonts CSS v5) and Geist Mono (CSS v6), Latin variable WOFF2,
retrieved from the Google Fonts CSS endpoint for the approved typefaces.
Local files under `fonts/geist/`; SIL Open Font License texts retained alongside.
No runtime third-party font requests. System fallback covers additional glyphs.

| Asset | Source | SHA-256 |
|---|---|---|
| geist-latin.woff2 | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2 | 19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1 |
| geist-mono-latin.woff2 | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2 | 684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc |
