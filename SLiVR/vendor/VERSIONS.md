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
