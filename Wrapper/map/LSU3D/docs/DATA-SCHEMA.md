# LSU3D — Data file schemas

Every file under `data/` is hand-editable JSON or GeoJSON, fetched at runtime
through `js/00-data-adapter.js`. There is no build step and no validation at
load time — the app is defensive and skips anything malformed rather than
failing. That makes a written contract the only thing keeping these files
honest, which is what this document is.

Run `node scripts/validate-data.mjs` after editing anything here.

> **Everything in `data/` is public.** GitHub Pages serves it to anyone, and git
> keeps it forever. Never put a recruit's name, a personal phone number, or a
> private staff mobile number in these files. See §Privacy at the bottom.

---

## `data/tours.geojson`

The 10 guided-tour stops. A GeoJSON `FeatureCollection` of `Polygon` features.

| Property | Type | Required | Notes |
|---|---|---|---|
| `fid` | number | yes | Stable numeric id. |
| `name` | string | yes | Display name. Also the join key to `locations.json` when lowercased. |
| `stop_key` | string | *added in Phase 1* | Stable lowercase slug (`lawton-room`). The preferred join key and the value used in `?stop=` deep links and analytics. Never change one once a QR code is printed. |
| `tour_group` | string | yes | Always `"mainTour"` today. |
| `order_num` | integer | yes | 1–10. Drives tour order and pin numbering. |
| `description` | string \| null | yes | Always `null` here — real copy lives in `locations.json`. |
| `off_campus` | boolean | no | Renders a directional indicator instead of flying the camera. |
| `cam3d` | object | no | `{ bearing, pitch, zoom }` — per-stop 3D camera preset. Only stop 9 has one. |

Notes:

- Coordinates are `[lng, lat]` (MapLibre order), EPSG:4326.
- Stops 3/4/5 and 8/9 deliberately share identical footprints; `buildTourPins()`
  collapses co-located stops into one expandable cluster pin.
- Source coordinates come from `docs/death_valley_stops*.csv`. Several are
  flagged `derived` / `pending`, not `verified`.

### Slug rules for `stop_key`

Lowercase; ASCII letters, digits and hyphens only; derived from the display
name with `·` and punctuation dropped and spaces collapsed to hyphens.

| `name` | `stop_key` |
|---|---|
| `Lot 414 · River Road Arrival` | `lot-414-river-road-arrival` |
| `Board the Charter Bus` | `board-the-charter-bus` |
| `Football Operations Facility` | `football-operations-facility` |
| `Tiger Tailgate · Indoors` | `tiger-tailgate-indoors` |
| `Registration` | `registration` |
| `Tiger Walk · Victory Hill` | `tiger-walk-victory-hill` |
| `Lawton Room` | `lawton-room` |
| `Field Level Warmups` | `field-level-warmups` |
| `Kickoff · Death Valley` | `kickoff-death-valley` |
| `Postgame · Nicholson Gateway` | `postgame-nicholson-gateway` |

---

## `data/buildings.geojson`

Campus building footprints. `Polygon` features used for the hover/click layer
and the 3D extrusion. Only `name` is read; `__height` and `__styleVariant` are
baked on at load time by `prepGeoJSON()` and must not be authored by hand.

---

## `data/locations.json`

Per-stop editorial content. `$schema: "lsu-locations-v1"`.

```json
{
  "$schema": "lsu-locations-v1",
  "generatedAt": "2026-08-23",
  "locations": [ { … } ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `stop-01` … `stop-10`. |
| `key` | string | yes | **Lowercased `name` from `tours.geojson`.** This is the join. Rename a stop and you must rename this too. |
| `name` | string | yes | Display name, should match the GeoJSON. |
| `category` | `"ROUTE"` \| `"FACILITY"` | yes | Drives pin colour (gold vs purple) and the filter chips. |
| `description` | string | yes | The details-panel body copy. |
| `happensHere` | string[] | no | Chip row in the details panel. |
| `address` | string | no | Shows the address block and the Google / Apple / `geo:` links. |
| `image` | string | yes | Path or URL. Empty string today for every stop — the panel shows a placeholder frame. |
| `explorable` | array | no | Sub-locations inside a stop. |
| `departments` | string[] | no | Used by the rail's department sort. |

Each field becomes one entry in a flat lookup map on `window.CAMPUS_CONFIG`
(`descriptionMap`, `imageMap`, …) — see `applyLocationsJSON()`.

---

## `data/treedis-sweeps.json`

One entry per stop mapping it to a sweep inside the single shared Treedis model.
`$schema: "lsu-treedis-sweeps-v1"`.

| Field | Type | Notes |
|---|---|---|
| `key` | string | Lowercased stop name, same join as `locations.json`. |
| `parentName` | string | Applied to both profiles at load. |
| `desktop` / `vr` | object | `{ sweepId, rotation?, transitionTime? }`. |

`sweepId` is `null` for every stop today. Null is meaningful — it means "no
capture exists", which hides the Explore CTA and the VR row. That is the correct
state until a real LSU Treedis model is built; see `docs/WEBSITE-STATE.md` §7.

---

## `data/gamedays/index.json` — *added in Phase 1*

The list of itineraries that exist. `$schema: "lsu-gamedays-v1"`.

```json
{
  "$schema": "lsu-gamedays-v1",
  "gamedays": [
    { "id": "2026-09-05-alabama", "label": "vs Alabama · Sep 5, 2026", "active": true }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Filename stem. Must match `data/gamedays/<id>.json`. Appears in the `?g=` link, so treat it as permanent once shared. |
| `label` | string | Human-readable, staff-facing. |
| `active` | boolean | Informational; the app does not gate on it today. |

---

## `data/gamedays/<id>.json` — *added in Phase 1*

One recruiting visit's itinerary. `$schema: "lsu-gameday-v1"`.

```json
{
  "$schema": "lsu-gameday-v1",
  "id": "2026-09-05-alabama",
  "opponent": "Alabama",
  "kickoff": "2026-09-05T18:30:00-05:00",
  "timezone": "America/Chicago",
  "notes": "Wear closed-toe shoes for field level.",
  "contacts": [
    { "role": "Recruiting Operations", "phone": "", "note": "Call for anything during the visit" }
  ],
  "stops": [
    {
      "stopKey": "lot-414-river-road-arrival",
      "arrive": "13:30",
      "depart": "13:45",
      "durationMin": 15,
      "instruction": "Park in Lot 414 and look for the gold LSU flags."
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must equal the filename stem and the `index.json` entry. |
| `opponent` | string | no | Display only. |
| `kickoff` | ISO 8601 with offset | no | Drives the countdown. Include the offset — do not write a bare local time. |
| `timezone` | IANA zone | yes | `America/Chicago`. Makes wall-clock `arrive` / `depart` unambiguous for a phone in another zone. |
| `notes` | string | no | Shown once at the top of My Gameday. |
| `contacts[]` | array | no | See the privacy rule below. |
| `contacts[].role` | string | yes | e.g. `Recruiting Operations`. **Role, not a person.** |
| `contacts[].phone` | string | no | **Published department line only.** |
| `contacts[].note` | string | no | When to use this contact. |
| `stops[]` | array | yes | Order in the array is ignored — `tours.geojson`'s `order_num` is the tour order. This file only layers times onto it. |
| `stops[].stopKey` | string | yes | Must match a `stop_key` in `tours.geojson`. An unmatched key is skipped with a console warning. |
| `stops[].arrive` / `.depart` | `HH:MM` 24h | no | Wall-clock in `timezone`. |
| `stops[].durationMin` | integer | no | Used when `depart` is absent. |
| `stops[].instruction` | string | no | Per-stop instruction shown in My Gameday and Live Visit. |

Not in this file, deliberately: recruit name, family details, any per-person
data. The recruit's first name arrives at runtime via `&n=` and is never
persisted.

---

## Privacy rules for everything in `data/`

1. **Public and permanent.** Served by GitHub Pages, kept in git history. There
   is no access control on a static site.
2. **No personal data.** No recruit or family names. No individual staff mobile
   numbers. No email addresses. Contacts are role + published department line.
3. **`?g=` ids are guessable.** Anyone can try `?g=2026-09-05-alabama`. A random
   suffix raises the bar but is not security. Write every itinerary as though a
   stranger will read it — because they can.
4. Per-recruit private content needs authentication, which this build does not
   have. That is a later phase, not a Phase 1 workaround.

---

## Editing workflow today

There is no CMS. Editing is: change the JSON, run the validator, commit, push.
Git is the version history — a bad edit is undone with `git revert`, and
`git log -p data/` is the audit trail. Roles, drafts, publishing and rollback UI
all require a backend and are explicitly out of scope for Phase 1.
