# DTS Content Schema Reference (v1.0.0)

Every document carries `_id` (stable, unique, dot-namespaced) and `_type`. These two keys are the contract with any future headless CMS.

## Shared value types

### `source`
A file reference usable everywhere a file lives — local path **or** external link.
```json
{ "kind": "path" | "url", "value": "assets/x.jpg | https://..." }
```

### `image`
```json
{ "_type": "image", "source": <source>, "alt": "string" }
```

### `video`
```json
{
  "_type": "video",
  "provider": "vimeo" | "file" | "url",
  "label": "string",
  "embed": <source>,          // player/embed URL, or a local video file path
  "watch": <source>           // optional: public watch page
}
```

### `treedis`
An interactive Treedis digital-twin experience.
```json
{
  "_type": "treedis",
  "label": "string",
  "tourUrl": "https://spaces.dtsxr.com/tour/xxxx",
  "origin": "https://spaces.dtsxr.com",
  "sweepId": "string | null"
}
```

### `model`
```json
{ "_type": "model", "format": "usdz", "source": <source>, "alt": "string" }
```

### `link`
A related-content chip. `kind` is derived from the URL and drives the icon/behavior.
```json
{ "_type": "link", "label": "string", "url": "string",
  "kind": "vimeo" | "treedis" | "matterport" | "external" }
```

---

## Document types

### `siteSettings` — `site/settings.json`
`brand` (name, short, tagline, motto, brandTag, domain, logo:image, cubeLogo:image), `treedis` defaults (tourUrl, origin, homeSweepId, defaultTransitionTime), `clientPortalUrl`, `visionPro` (spatialBackdrop:model, ctaLabel), `evidenceFilterLabels[]`, `cookie` (title, body, acceptLabel, rejectLabel).

### `leadSettings` — `site/lead.json`
`provider`, `accessKey`, `ownerEmail`, `subjectPrefix`, `notes`.

### `page` — `pages/home.json`
`hero` (kicker, headline — `\n` marks the line break, pills[], body), `hexCluster[]` (slot: hex-1…hex-4, image), `primaryCta` (label, fxImage), `evidenceBar[]`, `twinRevealCard` (same shape as hero), `questionPrompts[]`.

### `page` — `pages/contact.json`
`kicker`, `headline`, `headlineAccent`, `body`, `footnote`, `ctas[]` (id, stage, label, primary, `formId` → a `leadForm` `_id`).

### `sector` — `sectors/*.json`
`id`, `order`, `label`, `navSub`, `blurb`, `active`, `accent` (hex color), `kicker`, `title`, `sub`, `body`, `cards[]` (`projectId` → a `project` id, title, optional short, text). The four cards are what render in the sector slider; `projectId` links each card to its example window.

### `project` — `projects/*.json` (16 documents)
The example window for one sub-vertical.
- `id`, `sectorId` (→ a `sector` id), `title`, `tagline`, `overview`
- `project`: featured project (name, kind, illustrative:boolean — true flags a placeholder to swap later, blurb)
- `capturedWith`, `platform`
- `media` *(optional)*: `treedis` **or** `video` — omit to reuse the shared showcase iframe
- `links[]`: link chips
- `gallery[]`: images
- `sweepId`: optional sweep for the shared-showcase fallback
- `evidence`: object keyed by the labels in `siteSettings.evidenceFilterLabels` ("Case Studies", "Awards", "Client Feedback", "Press & Research", "Project Data")

### `leadForm` — `forms/*.json`
`id`, `title`, `intro`, `submitLabel`, `fields[]` (name, label, type: text|tel|email|select|textarea, required, optional placeholder, `half` pairs a field two-up, `options[]` for selects).

### `faqCollection` — `faq/answers.json`
`items[]` (match[]: case-insensitive substrings tested against the visitor's question, q, a).

### `accessConfig` — `access/access.json`
- `ui`: sign-in copy + brandCube:image + background:image
- `directorySource`: provider (`google-sheet-csv`), sheetCsvUrl, columns[]
- `roles`: map of role → { description, landing: "portal" | "adminBoard", permissions[] }
- `adminUsers[]`: admin accounts (contains **dtsAdmin**; role: "admin" routes to the Admin Board)
- `demoDirectory[]`: fallback client rows (access_id, access_code, role, client, project, twin_url, sweep_id, notes)
- `portal.sections`: Manage / Support panel copy

### `mediaLibrary` — `media/library.json`
`assets[]` of image/model entries. The Admin Board's media picker source of truth: register new uploads (kind: path) or external links (kind: url) here so they're selectable anywhere media is used.

### `contentManifest` — `manifest.json`
`schemaVersion`, `mediaConvention`, and `documents` — the grouped index of every file with its type and `_id`. Loaders, migration scripts, and the Admin Board enumerate content from here.

---

## Sanity mapping cheat-sheet

| Here | In Sanity |
|---|---|
| `_id`, `_type` | Same keys, same meaning |
| `sectorId` / `projectId` / `formId` strings | `reference` fields to the corresponding `_id` |
| `source.kind = "path"` | Uploaded `image`/`file` asset |
| `source.kind = "url"` | External-URL field (or asset upload during migration) |
| `evidence` keyed object | Array of `{label, body}` or object field — keys come from `evidenceFilterLabels` |
| One JSON file | One document (`createOrReplace` on import) |
