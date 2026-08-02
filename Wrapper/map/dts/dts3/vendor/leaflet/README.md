# Vendored: Leaflet + esri-leaflet

Per `docs/plans/gis/04-SPEC-gis-engine.md §2` — vendored rather than loaded from a CDN,
confirmed with the human before Phase 3 (`docs/plans/gis/09-BUILD-PLAN.md` Phase 3).
Injected lazily by `js/gis/gis-loader.js`; nothing here loads until a GIS experience is
actually opened.

| File | Source | Version | SHA-256 (base64) |
|---|---|---|---|
| `leaflet.js` | `leaflet@1.9.4/dist/leaflet.js` | 1.9.4 | `20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=` |
| `leaflet.css` | `leaflet@1.9.4/dist/leaflet.css` | 1.9.4 | `p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=` |
| `images/*.png` | `leaflet@1.9.4/dist/images/` | 1.9.4 | see jsdelivr package metadata |
| `esri-leaflet.js` | `esri-leaflet@3.0.19/dist/esri-leaflet.js` | 3.0.19 (latest 3.x) | `aONI5+UKxpAPe9ERZ51xCMhNXfIAWCskwUKerF6nJRQ=` |

Hashes were checked against `https://data.jsdelivr.com/v1/packages/npm/<pkg>@<version>`
at fetch time (2026-08-01). `LICENSE-leaflet.txt` (BSD-2-Clause) and
`LICENSE-esri-leaflet.txt` (Apache-2.0) are included for attribution.

Source maps were intentionally not vendored — DevTools will 404 on them harmlessly if a
developer opens Sources with maps enabled; not worth the ~1 MB in the repo.

To update: bump the version in the URLs above, re-fetch, and diff the new SHA-256 against
jsdelivr's package metadata before committing.
