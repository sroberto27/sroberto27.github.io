# DTS Content Layer (`/data`)

Every piece of copy, imagery, video, Treedis experience, form, and setting on the website now lives in this folder as JSON documents. This is the single source of truth the site will render from, and the exact surface the future **Admin Board (mini CMS)** — reached by signing in as `dtsAdmin` under **Access Your Twin** — will read and write.

The structure is deliberately shaped like a headless CMS (Sanity-style documents with `_id` and `_type`), so it can later be lifted into Sanity, Strapi, Contentful, or a database with minimal reshaping. See `SCHEMA.md` for the full field reference.

## Folder map

```
data/
  manifest.json        Index of every document — loaders and the Admin Board start here
  README.md            This file
  SCHEMA.md            Full schema reference for every document type
  site/
    settings.json      Brand, logos, Treedis defaults, Vision Pro backdrop, cookie banner
    lead.json          Web3Forms delivery (access key, owner email, subject prefix)
  pages/
    home.json          Hero copy, pills, hexagon imagery, CTA, evidence bar, question prompts
    contact.json       "Ready to begin?" panel + the three CTA → form mappings
  sectors/             One document per pillar (education, industry, government, community)
  projects/            One document per sub-vertical example window (16 files)
  forms/               One document per lead form (discovery, proposal, pilot)
  faq/
    answers.json       Question-bar answers with their match keywords
  access/
    access.json        Access Your Twin: UI copy, roles, dtsAdmin user, demo directory
  media/
    library.json       Registry of all media assets (the Admin Board's media picker)
```

## The media convention (paths OR links)

Every image, video, or model reference is an object, never a bare string. The `source` is always:

```json
{ "kind": "path", "value": "assets/portfolio/scsu-virtual-campus.jpg" }
{ "kind": "url",  "value": "https://cdn.example.com/hero.jpg" }
```

- `kind: "path"` — a file inside the website folder structure, relative to the site root.
- `kind: "url"` — any external link (a CDN, Vimeo, another host).

So swapping a local image for a hosted one (or the reverse) is a one-field edit, and the Admin Board only ever needs one picker that offers "choose a file" or "paste a link". Treedis experiences are their own type (`_type: "treedis"`) with `tourUrl`, `origin`, and optional `sweepId`.

## The dtsAdmin user

`access/access.json` defines a `roles` map and an `adminUsers` list containing `dtsAdmin`. The sign-in flow should check `adminUsers` (and any directory row with `role: "admin"`) before the client directory; an admin match routes to the Admin Board (`landing: "adminBoard"`) instead of the client portal.

> **Security note:** on a static host, everything in `/data` is publicly readable — including `access_code` values. Like the client directory today, this is a members-only gate, not real security. Change `CHANGE_ME_BEFORE_DEPLOY`, and before the Admin Board can actually write content in production, put admin auth and writes behind a real backend (see below).

## How this scales to a real CMS later

- Each file is one **document** with a stable `_id` (`project.campus`, `sector.education`, …) and a `_type` matching a schema in `SCHEMA.md`. In Sanity these become documents of the same type; `sectorId`/`projectId`/`formId` string fields become `reference` fields pointing at the same `_id`s.
- The media `{kind, value}` objects map to Sanity `image`/`file` assets (`kind: "path"` → uploaded asset, `kind: "url"` → external URL field).
- `manifest.json` is the enumeration a loader or migration script walks — a Sanity import is essentially "for each entry in the manifest, `createOrReplace` the document".

## Next steps (not done yet, by design)

1. A small `js/content-loader.js` that fetches `manifest.json` + documents and exposes them where `window.DTS_CONFIG` is used today (so `config.js` becomes generated/legacy).
2. The Admin Board overlay behind the `dtsAdmin` login: forms generated from `SCHEMA.md` types, media picker over `media/library.json`, save via download/commit for the static site or via a tiny API later.
3. Real auth + write API when the site outgrows static hosting.
