# Editing the Death Valley Experience content

For LSU/DTS staff who need to change what the site says without touching
application code.

There is no admin login and no content management system yet. Content lives in
plain text files in the repository, and editing one is a normal file edit
followed by a commit. That sounds more technical than it is — the files are
readable, and this page tells you which one to open for each kind of change.

> **Everything you edit here becomes public the moment it is pushed.** The site
> is served by GitHub Pages, so anyone with the address can read every file, and
> the version history keeps a copy forever. Never put a recruit's name, a
> personal mobile number, or an email address in any of these files. There is a
> full explanation in [`DATA-SCHEMA.md`](DATA-SCHEMA.md).

---

## Which file do I open?

| I want to change… | Open |
|---|---|
| A stop's description, "what happens here" chips, or address | `data/locations.json` |
| A stop's name, its position on the map, or the tour order | `data/tours.geojson` |
| Arrival times, per-stop instructions, kickoff, staff contacts | `data/gamedays/<gameday>.json` |
| Which gamedays exist | `data/gamedays/index.json` |
| The immersive tour links, once a Treedis capture exists | `data/treedis-sweeps.json` |
| Map colours, camera angles, timings, feature on/off switches | `config.js` — **developer territory** |

Rule of thumb: **words go in `data/`, wiring goes in `config.js`.** If you find
yourself wanting to edit `config.js` to change a piece of text, ask a developer
first — it usually means the text is in the wrong place and should be moved.

---

## Changing what a stop says

Open `data/locations.json` and find the block with the stop's name. Change the
text between the quotation marks:

```json
{
  "id": "stop-07",
  "key": "lawton room",
  "name": "Lawton Room",
  "category": "FACILITY",
  "description": "Northwest corner of Tiger Stadium at Gate 7. …",
  "image": ""
}
```

- Edit `description` freely.
- **Do not change `key`.** It is how this text finds its stop on the map. If the
  name changes, the key must change to exactly the same words in lower case —
  and a developer should make that change, because the map file needs updating
  at the same time.
- `happensHere` is the row of small chips under the description. It is a list:
  `["Locker Room", "Weight Room"]`.

---

## Setting up a gameday

One file per visit, in `data/gamedays/`. Copy `sample-gameday.json`, rename it,
and edit. The filename (without `.json`) is the gameday's id, and it appears in
the link you send:

```
https://sroberto27.github.io/Wrapper/map/LSU3D/?g=2026-09-05-alabama
```

Then add it to `data/gamedays/index.json` so the tooling knows it exists.

Inside the file:

- `timezone` must stay `America/Chicago`. Times are written as they appear on
  the gameday logistics graphic — `"14:15"` means 2:15 PM in Baton Rouge, no
  matter where the recruit's phone thinks it is.
- `kickoff` needs the `-05:00` (or `-06:00` in winter) on the end. That is what
  makes the countdown correct.
- Each entry in `stops` needs a `stopKey`. The valid keys are listed in
  [`DATA-SCHEMA.md`](DATA-SCHEMA.md) — copy them exactly. A misspelled key is
  silently ignored by the site, which is why you should run the checker below.
- `instruction` is the line the family reads when they open that stop. Write it
  as directions, not description: "Park in Lot 414 and look for the gold flags"
  beats "This is the arrival lot."

### Contacts

```json
{ "role": "Recruiting Operations", "phone": "", "note": "Your first call during the visit" }
```

`role`, not a person's name. A **published department line**, not somebody's
mobile. The checker will refuse a file that carries a `name` or an `email`, and
that refusal is deliberate — this file is public.

### Personalising a link

Adding `&n=Jordan` to the link greets the recruit by first name. It is used once
for the greeting, is never saved, and is removed from the address bar as soon as
the page opens, so it will not appear in a screenshot or in browser history.
Nothing else in the itinerary is personal, so a link is only as private as the
person you send it to keeps it.

---

## Link formats you can put on a QR code or NFC tag

| Link | Opens |
|---|---|
| `?stop=lawton-room` | The map focused on that stop, details open |
| `?stop=tiger-walk-victory-hill&src=qr` | Same, and records that it came from a QR code |
| `?g=2026-09-05-alabama` | The full itinerary for that gameday |
| `?g=2026-09-05-alabama&stop=registration` | That itinerary, opened at one stop |
| `?mode=live` | The walking view, for use during the visit |
| `?mode=kiosk&autoplay=1` | Full-screen looping display for an office monitor |

Stop keys are listed in [`DATA-SCHEMA.md`](DATA-SCHEMA.md). **Once a QR code is
printed, its stop key can never change** — so if a stop is renamed later, tell a
developer that printed codes exist and the key must be frozen.

A link pointing at something that no longer exists does not break the site: it
shows a brief message and opens the full map instead.

---

## Check your work before pushing

From the `Wrapper/map/LSU3D` folder:

```bash
node scripts/validate-data.mjs
```

It reads every file in `data/` and reports anything wrong: a misspelled stop
key, a time written as `2:15pm` instead of `14:15`, a missing timezone, a
contact carrying a personal name. `0 error(s)` means you are good to push.

It is worth running even for a one-word change. The site is deliberately
forgiving at runtime — it skips content it cannot understand rather than showing
an error — so a typo tends to look like "that bit just didn't appear" rather
than anything obviously broken. The checker is where you find out.

---

## Publishing, and undoing

Committing and pushing to `main` publishes. GitHub Pages picks the change up
within a minute or two; a hard refresh shows it.

There is no draft state and no preview environment. What you push is live. For a
substantial rewrite, ask a developer to put it on a branch first.

**Undo is `git revert`** — every version of every file is kept, and any change
can be rolled back exactly. Git is the version history until there is a real CMS
with drafts and roles.

---

## What does not exist yet

Worth knowing so you don't go looking:

- No admin login, no editor UI, no roles or permissions.
- No drafts, no scheduled publishing, no preview.
- No image uploads — `image` fields are empty everywhere and every stop shows a
  placeholder frame.
- No immersive tour — the Treedis fields are empty on purpose, so the "Explore"
  button is hidden on every stop until a real capture exists.

All of these need a backend and user accounts, which is a later phase of work.
