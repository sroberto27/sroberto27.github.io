# VR/XR Log

A single-file page for tracking which VR, AR and XR headsets you have tried and which you
haven't. No build step, no server, no database — just `index.html` on GitHub Pages.

## Using it

Open the page. Visitors get a read-only view: the grid, the filters, the search and the
side-by-side comparison. Nothing is editable for them.

To edit, click **Unlock to edit** and enter your password. You then get:

- a **tried** checkbox on every card
- a full editor behind **Details** (name, brand, year, category, notes, image, specs)
- **Add device** and delete
- **Fetch missing images**, which pulls product photos from the Wikipedia API
- **Change password**
- **Export / Import JSON** for backups

## Saving

The page is static, so nothing writes back to the server. Your edits are held in your
browser and marked as unsaved. When you're done:

1. Click **Save & download index.html**
2. Replace `index.html` in this repository with the downloaded file
3. Commit and push

Whatever is committed is what the public sees. Editing on the live page cannot change what
anyone else sees, which is why the password gate is safe to be as simple as it is.

## Making your own copy

Fork or clone this repo, then open the page and click **reset this page and make it yours**
in the footer — or add `?setup` to the URL. You'll be asked for:

- the page name, headline and sub-line
- what to start from:
  - **Fresh start, keep the catalogue** — keeps all the devices, their specs and their
    images, but clears every tried mark and note. This is the one most people want.
  - **Keep everything as it is** — only changes the password and wording.
  - **Empty list** — removes every device so you start from scratch.
- your own password

It downloads a new `index.html` with your password baked in. Drop that into your repo,
enable GitHub Pages, and it's yours. You never need the previous owner's password to do
this, and doing it cannot affect their published page.

## About the password

It's stored as a salted SHA-256 hash, so the plain text isn't sitting in the file. It is
**not** security — anyone can read the source and remove the check. It exists to stop
casual fiddling. It's sufficient because the only way to change the published list is to
commit a new `index.html` to this repository.

If you forget it, run the reset above.

## Where the data lives

Two JSON blocks near the top of `index.html`:

- `<script id="device-data">` — the device list
- `<script id="site-config">` — page wording and the password hash

You can hand-edit either one if you prefer working in a text editor. Saving from the page
rewrites exactly these two blocks and nothing else.

## Specs

The specifications shipped with the catalogue are a best-effort starting point and are not
guaranteed accurate — particularly for recent hardware. Every card links out to
[VRcompare](https://vr-compare.com/) for the authoritative numbers. VRcompare has no public
API and blocks cross-origin requests, so specs cannot be pulled in automatically; they're
editable by hand.

## Images

Google has no free image API and blocks hotlinking, so images can't be pulled from Google
automatically. **Fetch missing images** uses the Wikipedia API instead, which does allow
cross-origin requests. For anything it can't find, each card's editor has a **Search Google
Images** link so you can grab a URL manually. Devices with no image get a placeholder.
