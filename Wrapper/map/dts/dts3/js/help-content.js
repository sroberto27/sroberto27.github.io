/* In-app documentation content -- static, versioned in the codebase by
   deliberate design (CLAUDE.md's "belongs in /data" rule doesn't apply here:
   this documents how the CODE behaves, which only changes when the code
   does, not something a client would ever edit). Never wired through
   data/manifest.json, buildConfig(), or the Admin Board's draft/publish
   pipeline -- js/help.js (the rendering engine) reads window.DTS_HELP
   directly.

   Each topic: { id, title, keywords: [...], html: "<p>...</p>" }. html is
   static, developer-authored markup -- same trust level as the template
   strings js/app.js's orgAdminOrgPanel() already builds with string
   concatenation, not user input, so no escaping is needed here.

   Four audiences, matching docs/migration/ACCESS-MODEL.md's real role model:
   - admin    -> site_admin, the Admin Board's "Documentation" screen
   - member   -> any signed-in portal session, the portal's Help tab
   - orgAdmin -> appended on top of `member` only for an org_admin session
                 (a superset, not a separate track -- see renderOrgAdminPanel())
   - guest    -> everyone else, reachable via the floating help icon:
                 anonymous visitors AND signed-in users with no org */
window.DTS_HELP = {

  admin: [
    {
      id: "overview",
      title: "The Admin Board",
      keywords: ["admin", "board", "sign in", "site_admin", "overview", "getting started"],
      html:
        "<p>The Admin Board is the content-management system for this site " +
        "-- everything a visitor sees, from homepage copy to which client " +
        "downloads exist, is edited here. It only opens for a " +
        "<strong>site_admin</strong> account; signing in with any other kind " +
        "of account takes you to the ordinary client portal instead, never " +
        "here.</p>" +
        "<div class=\"help-note\"><strong>The single most important thing to " +
        "understand before you touch anything:</strong> almost everything on " +
        "the left-hand nav (SITE, CATEGORY PAGES, PROJECTS, GIS MAPS) edits a " +
        "working <em>draft</em> that lives only in this browser's local " +
        "storage. Nothing you change there is visible to a real visitor " +
        "until you explicitly click <strong>Save draft &amp; preview</strong> " +
        "and then <strong>Publish to site</strong> -- see the next topic for " +
        "exactly what each button does. Organizations, Users, Builds, and " +
        "Access work differently: those write live, immediately, with no " +
        "draft step at all -- each of their own topics below says so.</div>" +
        "<h4>How to get in</h4>" +
        "<ol>" +
        "<li>From any page on the public site, click <strong>ACCESS YOUR " +
        "TWIN</strong> in the top-right corner.</li>" +
        "<li>Sign in with a site_admin account's email and password.</li>" +
        "<li>The board opens automatically and fills the whole screen -- a " +
        "signed-in site_admin never sees the ordinary client portal.</li>" +
        "</ol>" +
        "<h4>Finding your way around</h4>" +
        "<ol>" +
        "<li>The left column is the navigation: <strong>SITE</strong> " +
        "(homepage, contact panel, FAQ, fun facts), <strong>CATEGORY " +
        "PAGES</strong> (one entry per sector, e.g. Education, Hospitality), " +
        "<strong>PROJECTS</strong> (grouped under the category page they " +
        "belong to), <strong>GIS MAPS</strong> (interactive maps and their " +
        "tours), and <strong>ADMIN</strong> (Organizations, Users, Builds, " +
        "Access, Audit).</li>" +
        "<li>Click any item in that list to open its editor in the large " +
        "panel on the right.</li>" +
        "<li>A status line at the top of the screen reads <em>\"Unsaved " +
        "changes -- Save draft &amp; preview to see them on the site\"</em> " +
        "the moment you change anything -- that's your reminder nothing is " +
        "live yet.</li>" +
        "</ol>" +
        "<h4>Leaving the board</h4>" +
        "<ol>" +
        "<li><strong>View site</strong> hides the board and shows you the " +
        "actual site underneath (with your unpublished draft, if you've " +
        "saved one) -- a small floating ⚙ Admin chip stays on screen so " +
        "you can jump straight back in.</li>" +
        "<li><strong>Sign out</strong> ends your session completely.</li>" +
        "</ol>"
    },
    {
      id: "draft-workflow",
      title: "How publishing actually works (draft, preview, publish, discard, export)",
      keywords: ["draft", "preview", "discard", "publish", "export", "zip", "how to publish", "save"],
      html:
        "<p>The six buttons in the top-right toolbar of the board are the " +
        "same everywhere, no matter which screen you're on. Here is exactly " +
        "what each one does, in the order you'd normally use them.</p>" +
        "<h4>The normal way to make a change go live</h4>" +
        "<ol>" +
        "<li>Edit whatever you came here to change (see that item's own " +
        "topic for the exact fields/buttons).</li>" +
        "<li>Click <strong>Save draft &amp; preview</strong>. This writes " +
        "everything you've changed into this browser's local storage (the " +
        "<code>dtsAdminDraft</code> key) and reloads the page.</li>" +
        "<li>After the reload, look at the actual site (click <strong>View " +
        "site</strong> if the board reopened automatically) -- you're now " +
        "looking at your change exactly as a real visitor would see it, " +
        "except <em>only in this browser</em>. No one else can see it yet.</li>" +
        "<li>Happy with it? Reopen the board (the ⚙ Admin chip, or sign " +
        "back in) and click <strong>Publish to site</strong>. This is the " +
        "ONLY button that changes what every visitor sees -- it pushes your " +
        "draft to the live site immediately. There is no separate deploy " +
        "step and no waiting.</li>" +
        "<li>Not happy with the preview, or made a mistake? Click " +
        "<strong>Discard draft</strong> instead of publishing -- this " +
        "throws your local draft away entirely and reloads back to whatever " +
        "is genuinely live right now. There is nothing to undo on the real " +
        "site, because you never published.</li>" +
        "</ol>" +
        "<div class=\"help-note\"><strong>Before you start editing " +
        "anything big:</strong> if you're about to make a lot of changes, " +
        "save a draft and preview it often rather than making everything at " +
        "once and publishing at the end -- it's much easier to spot a " +
        "mistake in one small preview than in fifty changes at once.</div>" +
        "<h4>The other two buttons</h4>" +
        "<ol>" +
        "<li><strong>Export data folder</strong> downloads a zip file " +
        "(<code>data.zip</code>) containing every content document exactly " +
        "as it exists right now, including any GIS layer files that were " +
        "harvested locally. This is a backup, or a way to hand the raw " +
        "content to someone who isn't a site_admin -- it does not affect " +
        "the live site by itself.</li>" +
        "<li><strong>Sign out</strong> ends your session. If you have an " +
        "unpublished draft saved, it's still there in this browser's local " +
        "storage the next time you sign back in -- signing out does not " +
        "discard it.</li>" +
        "</ol>" +
        "<div class=\"help-note\"><strong>What does NOT follow this " +
        "draft/publish model:</strong> Organizations, Users, Builds, and " +
        "the Access screen's entitlement grants all write straight to the " +
        "live database the instant you click their own Save/Create/Delete " +
        "buttons -- there is no draft, no preview, and no Discard for those. " +
        "Their own topics below say so again, but it's worth knowing up " +
        "front.</div>"
    },
    {
      id: "home", title: "Editing the homepage",
      keywords: ["home", "hero", "hexagons", "headline", "twin reveal", "question prompts"],
      html:
        "<p>Click <strong>Home page</strong> under SITE in the left nav. " +
        "The editor is split into six sections, top to bottom on the page.</p>" +
        "<h4>1. Hero -- the main headline and copy</h4>" +
        "<ol>" +
        "<li><strong>Kicker</strong> -- the small line above the headline.</li>" +
        "<li><strong>Headline</strong> -- put a line break exactly where you " +
        "want the text to wrap.</li>" +
        "<li><strong>Body paragraph</strong> -- the paragraph underneath.</li>" +
        "<li><strong>Pills</strong> (Campus / Company / City / Community) " +
        "-- a simple list; use the list's own add/remove controls to change " +
        "how many there are.</li>" +
        "</ol>" +
        "<h4>2. Hexagon media -- the four hexagon tiles next to the headline</h4>" +
        "<ol>" +
        "<li>Each of the four hexagons has its own <strong>Content " +
        "type</strong> dropdown: Image, Video, or 3D model (GLB).</li>" +
        "<li>Changing the type swaps in the right fields underneath -- an " +
        "image needs a site path or external URL, a video needs a file or a " +
        "YouTube/Vimeo link, a 3D model needs a <code>.glb</code> file.</li>" +
        "<li><strong>Before you start with a 3D model:</strong> it must " +
        "already be GLB/glTF format. If you only have FBX, OBJ, or USDZ, " +
        "convert it first in Blender via File → Export → glTF 2.0. " +
        "You can additionally attach a <code>.usdz</code> file for AR on " +
        "Apple devices.</li>" +
        "<li><strong>Border style</strong> is a separate dropdown that " +
        "applies no matter which content type you picked (outline, corner " +
        "brackets, vignette, a small corner badge, or a hover scan-line).</li>" +
        "</ol>" +
        "<h4>3. Primary button</h4>" +
        "<ol>" +
        "<li><strong>Button label</strong> -- the main call-to-action text.</li>" +
        "<li>The arrow-burst graphic behind the button has its own image " +
        "picker if you want to replace it.</li>" +
        "</ol>" +
        "<h4>4. Evidence bar</h4>" +
        "<p>A simple list of short text items shown along the bottom of the " +
        "home view -- add, edit, or remove items directly in the list.</p>" +
        "<h4>5. Info card over the live twin</h4>" +
        "<p>This card appears when a visitor presses the main button and " +
        "the \"Try a Digital Twin\" preview takes over the screen: " +
        "<strong>Kicker</strong>, <strong>Headline</strong>, " +
        "<strong>Body</strong>, and its own <strong>Pills</strong> list.</p>" +
        "<h4>6. Question-bar suggestions</h4>" +
        "<p><strong>Prompts</strong> -- the rotating placeholder questions " +
        "shown (greyed out) inside the \"Ask a Question\" bar before a " +
        "visitor types anything.</p>" +
        "<div class=\"help-note\">Remember: none of this is live until you " +
        "click <strong>Save draft &amp; preview</strong>, check it, then " +
        "<strong>Publish to site</strong> -- see the Save/Publish topic.</div>"
    },
    {
      id: "contact", title: "Editing the contact panel",
      keywords: ["contact", "ready to begin", "cta buttons"],
      html:
        "<p>Click <strong>Contact panel</strong> under SITE. This is the " +
        "\"Ready to begin?\" panel that slides in from the edge of every " +
        "category page.</p>" +
        "<h4>Panel text</h4>" +
        "<ol>" +
        "<li><strong>Kicker</strong>, <strong>Headline</strong>, and " +
        "<strong>Headline accent</strong> (the gold-colored part of the " +
        "headline, edited as a separate field so it can be styled " +
        "differently).</li>" +
        "<li><strong>Body</strong> -- the paragraph underneath.</li>" +
        "<li><strong>Footnote</strong> -- the small print at the bottom.</li>" +
        "</ol>" +
        "<h4>Buttons</h4>" +
        "<p>Each button in the panel (Discovery / Proposal / Pilot) has its " +
        "own card underneath the panel text, with:</p>" +
        "<ol>" +
        "<li><strong>Stage tag</strong> -- the small label above the button " +
        "text (e.g. \"DISCOVER\").</li>" +
        "<li><strong>Label</strong> -- the button's own visible text.</li>" +
        "<li><strong>Primary (gold) button</strong> -- a checkbox; turn it " +
        "on for the one button that should stand out in gold.</li>" +
        "</ol>"
    },
    {
      id: "faq", title: "Adding or editing an FAQ answer",
      keywords: ["faq", "ask a question", "qbar", "add question", "match phrases"],
      html:
        "<p>Click <strong>FAQ answers</strong> under SITE. This list feeds " +
        "the homepage \"Ask a Question\" bar -- when a visitor types " +
        "something, it's checked against every entry's match phrases.</p>" +
        "<h4>To add a new question</h4>" +
        "<ol>" +
        "<li>Scroll to the bottom of the Questions list and click " +
        "<strong>+ Add question</strong>.</li>" +
        "<li>Fill in <strong>Question</strong> -- shown as the heading in " +
        "the popover once matched.</li>" +
        "<li>Fill in <strong>Answer</strong> -- the full response text.</li>" +
        "<li>Fill in <strong>Match phrases</strong> -- a list of lower-case " +
        "words or short phrases the matcher checks for. List every wording " +
        "you can think of a visitor actually typing (e.g. both " +
        "\"treedis\" and \"what is treedis\"). This is a plain substring " +
        "match, not a language model -- if a phrase isn't listed here, that " +
        "wording will never match, no matter how close it is in meaning.</li>" +
        "<li>Save your draft and preview it, then try typing a few of your " +
        "match phrases into the real \"Ask a Question\" bar to confirm they " +
        "actually trigger this answer.</li>" +
        "</ol>" +
        "<h4>To edit or remove an existing one</h4>" +
        "<p>Find it in the list, change its Question/Answer/Match phrases " +
        "directly, or use the list's own remove control to delete the whole " +
        "entry.</p>"
    },
    {
      id: "funfacts", title: "Editing fun facts",
      keywords: ["fun facts", "loader", "typing"],
      html:
        "<p>Click <strong>Fun facts</strong> under SITE. One fact from this " +
        "list is picked at random each time the site loads, and typed out " +
        "under the headline while the site is still loading behind it.</p>" +
        "<h4>To add, edit, or remove a fact</h4>" +
        "<ol>" +
        "<li>Use the Facts list's own add control to add a new line, or " +
        "edit any existing line directly.</li>" +
        "<li><strong>Keep each one short.</strong> The typing animation has " +
        "to finish before the loader hands off to the live site -- a long " +
        "fact may get cut off.</li>" +
        "</ol>"
    },
    {
      id: "sectors", title: "Category pages -- add, edit, delete",
      keywords: ["sector", "category", "add category", "delete category", "cards"],
      html:
        "<p>A category page is one of the top-level sectors (Education, " +
        "Hospitality, etc.) -- click any one of them under <strong>CATEGORY " +
        "PAGES</strong> in the left nav to edit it.</p>" +
        "<h4>To add a new category page</h4>" +
        "<ol>" +
        "<li>Click <strong>+ Add category page</strong> at the bottom of " +
        "the CATEGORY PAGES list.</li>" +
        "<li>A small text prompt appears asking for a short id (letters and " +
        "numbers only, e.g. <code>hospitality</code>) -- type it and " +
        "confirm.</li>" +
        "<li>A new, mostly-empty category page is created and opens " +
        "automatically. Fill in <strong>Menu label</strong>, <strong>Menu " +
        "sublabel</strong>, <strong>Kicker</strong>, <strong>Accent " +
        "color</strong>, <strong>Title</strong>, <strong>Subtitle</strong>, " +
        "<strong>Body</strong>, and the <strong>one-line blurb</strong> " +
        "used in navigation.</li>" +
        "</ol>" +
        "<h4>To add one of the four use-case cards on a category page</h4>" +
        "<ol>" +
        "<li>Scroll to the Cards section and click <strong>+ Add " +
        "card</strong>.</li>" +
        "<li>Pick which project this card should open from the <strong>" +
        "Project this card opens</strong> dropdown.</li>" +
        "<li>Fill in <strong>Card title</strong>, an optional " +
        "<strong>Short title</strong> (used on mobile), and <strong>Card " +
        "text</strong>.</li>" +
        "</ol>" +
        "<h4>To delete a category page</h4>" +
        "<ol>" +
        "<li>Open the category page, scroll to the <strong>Danger " +
        "zone</strong> at the bottom, and click <strong>Delete this " +
        "category page</strong>.</li>" +
        "<li><strong>If any project is still assigned to it, deletion is " +
        "blocked</strong> -- you'll see an alert listing every project " +
        "still pointing at it. Go to each of those projects' own editors, " +
        "change their <strong>Category</strong> dropdown to a different " +
        "page, save, then come back and delete this one.</li>" +
        "</ol>"
    },
    {
      id: "projects", title: "Projects -- add, edit, delete",
      keywords: ["project", "experience", "link", "access level", "tour", "video", "add project", "delete project", "gallery"],
      html:
        "<p>A project is one card inside a category page, with its own " +
        "window (tour/video/map, gallery, links). Find it grouped under its " +
        "category page in the left nav's PROJECTS section.</p>" +
        "<h4>To add a new project</h4>" +
        "<ol>" +
        "<li>Click <strong>+ Add project</strong> at the bottom of the " +
        "PROJECTS list.</li>" +
        "<li>Type a short id (letters/numbers only) at the prompt, e.g. " +
        "<code>museum</code>.</li>" +
        "<li>The new project opens automatically, mostly empty -- work " +
        "through the sections below to fill it in.</li>" +
        "</ol>" +
        "<h4>Basic fields</h4>" +
        "<ol>" +
        "<li><strong>Category</strong> -- which category page this project " +
        "belongs to.</li>" +
        "<li><strong>Title</strong>, <strong>Tagline</strong> (one line " +
        "under the title), <strong>Overview</strong> (the longer " +
        "description).</li>" +
        "<li><strong>Captured with</strong> / <strong>Platform</strong> -- " +
        "short technical credit lines.</li>" +
        "<li><strong>Default access level</strong> -- who can open this " +
        "project's experiences/links by default (see the Access levels " +
        "topic). Anything below set to \"Inherit from project\" uses this " +
        "value; the title/overview/gallery are always public regardless.</li>" +
        "</ol>" +
        "<h4>Featured project block</h4>" +
        "<p><strong>Name</strong>, <strong>Kind</strong> (e.g. \"Active " +
        "project · USDA-commissioned\"), <strong>Blurb</strong>, and an " +
        "<strong>Illustrative placeholder</strong> checkbox (turn this on " +
        "if the project is a placeholder to be swapped for a real one " +
        "later).</p>" +
        "<h4>Main experiences -- the tour/video/map in the big pane</h4>" +
        "<ol>" +
        "<li>Click <strong>+ Add experience</strong>.</li>" +
        "<li>Pick a <strong>Type</strong>: Treedis experience, Vimeo video, " +
        "or GIS map. Each type shows its own fields underneath (a tour URL, " +
        "a Vimeo embed/watch URL, or which GIS map to link to).</li>" +
        "<li>Adding a second experience automatically gives visitors tabs " +
        "to switch between them in the project window. Leave the whole " +
        "list empty to reuse the shared homepage showcase twin instead.</li>" +
        "<li>Each experience has its own access-level control -- see " +
        "Access levels.</li>" +
        "</ol>" +
        "<h4>Related links -- the chips under the experience</h4>" +
        "<ol>" +
        "<li>Click <strong>+ Add link</strong>.</li>" +
        "<li>Fill in <strong>Label</strong> and <strong>URL</strong>, and " +
        "set its own <strong>Access level</strong>.</li>" +
        "<li><strong>Careful when reordering or removing an earlier link</strong> " +
        "-- a link's gated identity is its position in this list " +
        "(link-1, link-2, …), so removing an earlier link shifts every " +
        "link after it, along with any access grant already given to that " +
        "position.</li>" +
        "</ol>" +
        "<h4>Image gallery</h4>" +
        "<p>Click <strong>+ Add image</strong>, then set its site path or " +
        "external link and alt text.</p>" +
        "<h4>To delete a project</h4>" +
        "<p>Scroll to the <strong>Danger zone</strong> at the bottom and " +
        "click <strong>Delete this project</strong> -- its category card " +
        "is removed along with it. This only affects your local draft until " +
        "you publish, same as every other change on this screen.</p>"
    },
    {
      id: "gis", title: "GIS maps &amp; tours -- add, edit, delete",
      keywords: ["gis", "map", "tour", "feature tour", "layer", "add layer", "new map", "arcgis"],
      html:
        "<p>A GIS map is an interactive map (view, basemaps, layers, " +
        "groups, tools, bookmarks, guided tours) -- the most complex editor " +
        "in the board. Find it under <strong>GIS MAPS</strong> in the left " +
        "nav, with its tours listed underneath it.</p>" +
        "<div class=\"help-note\"><strong>Before you start:</strong> a GIS " +
        "map's <strong>Access level</strong> gates the ENTIRE map -- the " +
        "map itself, every tour built on it, and its layer files -- as one " +
        "unit, not field by field like a project. Setting it above " +
        "\"Public\" hides the whole thing from anyone who doesn't meet that " +
        "level.</div>" +
        "<h4>To add a new map</h4>" +
        "<ol>" +
        "<li>Click <strong>+ New map</strong> at the bottom of the GIS MAPS " +
        "list.</li>" +
        "<li>Fill in <strong>Title</strong>, <strong>Subtitle</strong>, " +
        "<strong>Attribution</strong>, and its <strong>Access level</strong>.</li>" +
        "<li>Set the <strong>Default view</strong> (use the live preview " +
        "panel on the right to pan/zoom to where you want it, then capture " +
        "that view), plus min/max zoom and, optionally, bounds to restrict " +
        "panning to.</li>" +
        "</ol>" +
        "<h4>To add a live map layer (the most common task)</h4>" +
        "<ol>" +
        "<li>Scroll to the Layers section and click <strong>+ Add " +
        "layer</strong>.</li>" +
        "<li>Fill in <strong>Title</strong> and a <strong>Short id</strong> " +
        "(letters, numbers, and hyphens only, must be unique on this map).</li>" +
        "<li>Assign it to a <strong>Group</strong> if you've set one up " +
        "(groups control the layer-toggle panel's sections).</li>" +
        "<li>Pick a <strong>Source type</strong> -- most real government/" +
        "ArcGIS layers are Esri Feature, Esri Dynamic, or Esri Image.</li>" +
        "<li>Paste the <strong>Service / file URL</strong> (the ArcGIS " +
        "MapServer/FeatureServer URL, or a local geojson file path).</li>" +
        "<li>For an Esri layer, click <strong>Test connection</strong> " +
        "before saving anything else -- this confirms the URL actually " +
        "resolves before you build the rest of the map around it.</li>" +
        "</ol>" +
        "<h4>To add a guided tour on this map</h4>" +
        "<ol>" +
        "<li>Scroll to the Tours section (further down the same map " +
        "editor) and click <strong>+ New tour</strong>.</li>" +
        "<li>A tour is its own document that opens in the left nav, nested " +
        "under this map -- click it there to add its stops.</li>" +
        "</ol>" +
        "<h4>To delete a map</h4>" +
        "<p>Open it and use its own <strong>Danger zone</strong> at the " +
        "bottom of the editor.</p>"
    },
    {
      id: "organizations", title: "Organizations -- add, edit, disable, delete",
      keywords: ["organization", "org", "client", "delete", "create organization"],
      html:
        "<p>Click <strong>Organizations</strong> under ADMIN. An " +
        "organization is a client company. " +
        "<strong>This screen writes live -- there is no draft/preview/" +
        "publish step here.</strong> Every button takes effect immediately.</p>" +
        "<h4>To create a new organization</h4>" +
        "<ol>" +
        "<li>Scroll to the <strong>New organization</strong> box at the " +
        "bottom.</li>" +
        "<li>Fill in <strong>Organization name</strong> and a " +
        "<strong>url-slug</strong> (a short, unique identifier).</li>" +
        "<li>Click <strong>+ Create organization</strong>. It appears in " +
        "the list above immediately.</li>" +
        "</ol>" +
        "<h4>To rename an organization</h4>" +
        "<ol>" +
        "<li>Find its row in the list. It has its own editable Name and " +
        "Slug fields directly underneath its title.</li>" +
        "<li>Change either field and click that row's own <strong>Save</strong> " +
        "button.</li>" +
        "</ol>" +
        "<h4>To temporarily cut off access (Disable)</h4>" +
        "<ol>" +
        "<li>Click <strong>Disable</strong> on that organization's row.</li>" +
        "<li>Confirm the prompt -- every member of this organization loses " +
        "client-level access immediately. Membership and any entitlement " +
        "grants are kept, not removed.</li>" +
        "<li>Click <strong>Reactivate</strong> on the same row any time to " +
        "restore everything exactly as it was.</li>" +
        "</ol>" +
        "<h4>To permanently remove an organization (Delete)</h4>" +
        "<ol>" +
        "<li>Click <strong>Delete</strong> on that organization's row.</li>" +
        "<li>Confirm the prompt. This is permanent and cannot be undone -- " +
        "it removes every member's access to it and any access grants held " +
        "by the organization itself (its audit/event history is kept, just " +
        "unlinked).</li>" +
        "</ol>" +
        "<div class=\"help-note\"><strong>Use Disable, not Delete, unless " +
        "you're sure.</strong> Disable is fully reversible; Delete is not. " +
        "Reach for Delete only for a genuine mistake or a throwaway test " +
        "organization.</div>"
    },
    {
      id: "users", title: "Users -- add, edit, promote, disable, delete",
      keywords: ["user", "account", "site_admin", "delete", "promote", "create user", "membership"],
      html:
        "<p>Click <strong>Users</strong> under ADMIN. This is every account " +
        "in the system. <strong>This screen writes live -- there is no " +
        "draft/preview/publish step here.</strong></p>" +
        "<h4>To create a new user</h4>" +
        "<div class=\"help-note\"><strong>Before you start:</strong> " +
        "there's no working invite-email delivery yet (that needs custom " +
        "SMTP set up first), so YOU set their password directly here and " +
        "share it with them yourself.</div>" +
        "<ol>" +
        "<li>Scroll to the <strong>New user</strong> box at the bottom.</li>" +
        "<li>Fill in their email address.</li>" +
        "<li>Fill in a <strong>Temporary password</strong> -- at least 8 " +
        "characters.</li>" +
        "<li>Click <strong>+ Create user</strong>. Give the email/password " +
        "to that person through some other channel so they can sign in.</li>" +
        "</ol>" +
        "<h4>To make someone a site_admin (or take it away)</h4>" +
        "<ol>" +
        "<li>Find their row in the list.</li>" +
        "<li>Click <strong>Promote to site_admin</strong> (or <strong>" +
        "Demote to user</strong> if they already are one) and confirm.</li>" +
        "</ol>" +
        "<h4>To temporarily block someone from signing in</h4>" +
        "<ol>" +
        "<li>Click <strong>Disable</strong> on their row and confirm -- " +
        "they can't sign in again until you click <strong>Reactivate</strong> " +
        "on the same row.</li>" +
        "</ol>" +
        "<h4>To add someone to an organization (as a member or org admin)</h4>" +
        "<ol>" +
        "<li>Find their row, and underneath it a field labeled <strong>Add " +
        "to organization -- search by name…</strong></li>" +
        "<li>Type at least 2 characters of the organization's name -- " +
        "matching results appear as buttons below.</li>" +
        "<li>Choose <strong>Member</strong> or <strong>Org admin</strong> " +
        "from the small dropdown next to the search box first.</li>" +
        "<li>Click the matching organization's result button to add them " +
        "with that role.</li>" +
        "</ol>" +
        "<h4>To change or remove an existing membership</h4>" +
        "<p>Each organization a user already belongs to is listed as its " +
        "own row underneath their name, with <strong>Make org_admin</strong> " +
        "/ <strong>Make member</strong> to flip their role there, and " +
        "<strong>Remove</strong> to take them out of that organization " +
        "entirely (their account itself is untouched).</p>" +
        "<h4>To permanently delete an account</h4>" +
        "<ol>" +
        "<li>Click <strong>Delete</strong> on their row and confirm.</li>" +
        "<li>This is permanent: their account, every organization " +
        "membership, and any access grants they personally hold are all " +
        "removed.</li>" +
        "</ol>" +
        "<div class=\"help-note\">Two safety rails you can't override: you " +
        "can never delete your OWN account (avoids locking yourself out " +
        "mid-session), and the system will refuse to delete the LAST " +
        "remaining site_admin, by anyone -- that would lock everyone out of " +
        "this board.</div>"
    },
    {
      id: "builds", title: "Builds -- register, edit, upload, entitle, delete",
      keywords: ["build", "download", "app", "client app", "upload", "entitle", "register build"],
      html:
        "<p>Click <strong>Builds</strong> under ADMIN. A build is a " +
        "downloadable client application (an installer or viewer). " +
        "<strong>This screen writes live -- there is no draft/preview/" +
        "publish step here.</strong></p>" +
        "<h4>To register a new build</h4>" +
        "<div class=\"help-note\"><strong>Before you start:</strong> have " +
        "the actual installer/viewer FILE ready on your computer, plus a " +
        "short key (letters/numbers/hyphens, e.g. <code>acme-viewer-win</code>) " +
        "and the platform it runs on (e.g. <code>windows</code>).</div>" +
        "<ol>" +
        "<li>Scroll to the <strong>New build</strong> box.</li>" +
        "<li>Fill in <strong>key</strong>, <strong>Display name</strong>, " +
        "and <strong>platform</strong>.</li>" +
        "<li>Click <strong>+ Register build</strong>. It's now listed " +
        "above with no file uploaded yet.</li>" +
        "</ol>" +
        "<h4>To upload (or replace) the actual file</h4>" +
        "<ol>" +
        "<li>Find the build's row -- it has its own file picker and an " +
        "<strong>Upload file</strong> button.</li>" +
        "<li>Choose the file, then click <strong>Upload file</strong>. " +
        "Wait for it to finish -- large files take longer.</li>" +
        "<li>Once a file exists, a <strong>Remove file</strong> button also " +
        "appears -- it clears just the file and keeps the build registered, " +
        "so you can upload a replacement later without starting over.</li>" +
        "</ol>" +
        "<h4>To edit its details or access level</h4>" +
        "<ol>" +
        "<li>On the build's row, edit <strong>Name</strong>, " +
        "<strong>version</strong>, and its <strong>Access level</strong> " +
        "dropdown directly, then click that row's own <strong>Save</strong> " +
        "button.</li>" +
        "<li>If you set access to <strong>Restricted</strong>, an " +
        "entitlement picker appears right there on the same row -- see the " +
        "Access levels topic for exactly how to grant it to a specific " +
        "user or organization. Nobody can download a Restricted build " +
        "until you do this.</li>" +
        "</ol>" +
        "<h4>To temporarily turn a build off, or remove it entirely</h4>" +
        "<ol>" +
        "<li><strong>Disable</strong> / <strong>Enable</strong> toggles " +
        "whether it's downloadable at all, reversibly.</li>" +
        "<li><strong>Delete</strong> permanently removes the build, its " +
        "uploaded file, and any access grants for it -- confirm carefully, " +
        "this cannot be undone. Use Disable instead if you might need it " +
        "again.</li>" +
        "</ol>"
    },
    {
      id: "access",
      title: "Access levels &amp; entitlements -- how to grant or revoke access",
      keywords: ["access", "entitlement", "public", "registered", "client", "restricted", "grant", "revoke", "who has access"],
      html:
        "<p>Every gated thing on this site -- a project, one experience " +
        "inside it, a link, a GIS map, a download -- resolves to exactly " +
        "one of four levels:</p>" +
        "<div class=\"help-diagram\" aria-hidden=\"true\">" +
          "<svg viewBox=\"0 0 640 120\" role=\"img\" aria-label=\"Access level ladder: public requires nothing, registered requires sign-in, client requires an active org membership, restricted requires a specific grant.\">" +
            "<defs><marker id=\"helpArrow\" viewBox=\"0 0 10 10\" refX=\"8\" refY=\"5\" markerWidth=\"7\" markerHeight=\"7\" orient=\"auto-start-reverse\"><path d=\"M0 0L10 5L0 10z\" fill=\"currentColor\"/></marker></defs>" +
            "<g font-family=\"sans-serif\" font-size=\"12\" fill=\"currentColor\">" +
              "<rect x=\"6\" y=\"30\" width=\"130\" height=\"56\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"71\" y=\"54\" text-anchor=\"middle\" font-weight=\"700\">public</text>" +
              "<text x=\"71\" y=\"72\" text-anchor=\"middle\" font-size=\"10\">no sign-in</text>" +
              "<line x1=\"136\" y1=\"58\" x2=\"170\" y2=\"58\" stroke=\"currentColor\" marker-end=\"url(#helpArrow)\"/>" +
              "<rect x=\"176\" y=\"30\" width=\"140\" height=\"56\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"246\" y=\"54\" text-anchor=\"middle\" font-weight=\"700\">registered</text>" +
              "<text x=\"246\" y=\"72\" text-anchor=\"middle\" font-size=\"10\">any signed-in user</text>" +
              "<line x1=\"316\" y1=\"58\" x2=\"350\" y2=\"58\" stroke=\"currentColor\" marker-end=\"url(#helpArrow)\"/>" +
              "<rect x=\"356\" y=\"30\" width=\"120\" height=\"56\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"416\" y=\"54\" text-anchor=\"middle\" font-weight=\"700\">client</text>" +
              "<text x=\"416\" y=\"72\" text-anchor=\"middle\" font-size=\"10\">active org member</text>" +
              "<line x1=\"476\" y1=\"58\" x2=\"510\" y2=\"58\" stroke=\"currentColor\" marker-end=\"url(#helpArrow)\"/>" +
              "<rect x=\"516\" y=\"30\" width=\"120\" height=\"56\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"576\" y=\"54\" text-anchor=\"middle\" font-weight=\"700\">restricted</text>" +
              "<text x=\"576\" y=\"72\" text-anchor=\"middle\" font-size=\"10\">named grant only</text>" +
            "</g>" +
          "</svg>" +
        "</div>" +
        "<div class=\"help-note\"><strong>This screen (Access, under " +
        "ADMIN) is a READ-ONLY INDEX -- it cannot change a level.</strong> " +
        "It just lists every gated thing in one place so you don't have to " +
        "hunt through every project/GIS map/build editor to see what's " +
        "gated. To CHANGE a level, go to that item's own editor (Projects, " +
        "GIS maps, or Builds) and use its Access level dropdown there.</div>" +
        "<h4>What you can do on the Access screen itself</h4>" +
        "<p>If an item's level is <strong>Restricted</strong>, this screen " +
        "shows its entitlement picker right there, exactly the same picker " +
        "that also appears on the item's own editor -- both places control " +
        "the same thing.</p>" +
        "<h4>To grant a Restricted item to a specific person or org</h4>" +
        "<ol>" +
        "<li>Find the item in the list, or open it from its own editor -- " +
        "either way, look for the <strong>\"Who has access\"</strong> box.</li>" +
        "<li>Choose <strong>Organization</strong> or <strong>User</strong> " +
        "from the small type dropdown.</li>" +
        "<li>Type at least 2 characters into <strong>\"Search by name or " +
        "email…\"</strong> -- matching results appear as buttons below " +
        "as you type.</li>" +
        "<li>Click the correct result. It's granted immediately -- this " +
        "writes live, there is nothing to save or publish afterward.</li>" +
        "</ol>" +
        "<h4>To revoke access</h4>" +
        "<ol>" +
        "<li>In the same \"Who has access\" list, find the person or " +
        "organization already listed.</li>" +
        "<li>Click <strong>Revoke</strong> next to their name. This also " +
        "takes effect immediately.</li>" +
        "</ol>" +
        "<div class=\"help-note\"><strong>Nothing here ever defaults to " +
        "open.</strong> A Restricted item with no one granted yet is a " +
        "hard \"access denied\" for everyone except a site_admin -- not a " +
        "degraded or partial view. If a client says they can't see " +
        "something you think should be Restricted-and-granted, this is the " +
        "first place to check.</div>"
    },
    {
      id: "audit", title: "Audit -- reading the administrative history",
      keywords: ["audit", "log", "history", "who changed"],
      html:
        "<p>Click <strong>Audit</strong> under ADMIN. This is a " +
        "read-only, most-recent-first log of every administrative action " +
        "taken anywhere in this system -- role changes, membership edits, " +
        "access-level changes, entitlement grants/revokes, organization/" +
        "user disables and reactivations, invites.</p>" +
        "<h4>How to use it</h4>" +
        "<ol>" +
        "<li>The screen simply lists entries as soon as you open it -- " +
        "there's nothing to click to load it.</li>" +
        "<li>Each entry shows what happened, who did it (a real email, not " +
        "a raw account id), and when.</li>" +
        "<li>Use it to answer \"who changed this, and when\" -- for " +
        "example, if a client's access unexpectedly changed, check here " +
        "for the exact grant/revoke entry and who made it.</li>" +
        "</ol>" +
        "<div class=\"help-note\">Nothing on this screen can be edited or " +
        "deleted -- it exists purely as a history, not another editor.</div>"
    }
  ],

  member: [
    {
      id: "portal-overview",
      title: "Your portal",
      keywords: ["portal", "home", "menu", "sign out"],
      html:
        "<p>After signing in, you land here: your organization's home tiles, " +
        "plus HOME / APPS / Manage / Support (and Help) across the top or " +
        "the MENU button on smaller screens. <strong>Sign out</strong> ends " +
        "your session everywhere this browser has it open.</p>"
    },
    {
      id: "apps",
      title: "All Apps",
      keywords: ["apps", "twin", "download", "locked"],
      html:
        "<p>Every twin experience and downloadable app you currently have " +
        "access to. Clicking a twin opens it directly; clicking a download " +
        "fetches the file straight from the server, re-checking your access " +
        "on that exact request -- if something you used to see disappears, " +
        "an access grant was likely changed or revoked, not a bug.</p>"
    },
    {
      id: "activity",
      title: "Activity",
      keywords: ["activity", "chart", "usage"],
      html:
        "<p>Shows your organization's usage over the last 30 days as a " +
        "simple chart. This tab only appears once you belong to at least " +
        "one organization -- there is nothing to show a signed-in account " +
        "with no organization yet.</p>"
    },
    {
      id: "support",
      title: "Support",
      keywords: ["support", "help", "contact"],
      html: "<p>Email the DTS team directly; replies typically arrive within " +
        "one business day.</p>"
    },
    {
      id: "account",
      title: "Your account",
      keywords: ["account", "session", "password", "sign in"],
      html:
        "<p>Signing in on one tab updates every other open tab for this " +
        "site automatically. If you use \"Forgot password?\", note that " +
        "reset emails share a small hourly sending limit with new-account " +
        "confirmation emails -- if one doesn't arrive quickly, wait rather " +
        "than repeatedly re-requesting it.</p>"
    }
  ],

  orgAdmin: [
    {
      id: "team-overview",
      title: "Managing your team",
      keywords: ["team", "org admin", "manage tab"],
      html:
        "<p>Because you're an <strong>org admin</strong> for at least one " +
        "organization, the <strong>Manage</strong> tab also shows a team " +
        "panel -- one section per organization you admin. Anything you do " +
        "here only ever affects that organization; an org admin at one " +
        "organization has no visibility or power at another.</p>"
    },
    {
      id: "invite-member",
      title: "Adding or inviting a member",
      keywords: ["invite", "add member", "email"],
      html:
        "<p>Two ways to bring someone in: <strong>add directly</strong> " +
        "(you set a temporary password they can change later) or " +
        "<strong>invite by email</strong> (they set their own). Either way " +
        "they land in your organization as a plain <code>member</code> -- " +
        "promote them afterward if they need admin rights too.</p>" +
        "<div class=\"help-diagram\" aria-hidden=\"true\">" +
          "<svg viewBox=\"0 0 640 100\" role=\"img\" aria-label=\"Invite flow: org admin sends an invite by email, the new member accepts and gains access, then appears in the team list where their role can be toggled.\">" +
            "<defs><marker id=\"helpArrow2\" viewBox=\"0 0 10 10\" refX=\"8\" refY=\"5\" markerWidth=\"7\" markerHeight=\"7\" orient=\"auto-start-reverse\"><path d=\"M0 0L10 5L0 10z\" fill=\"currentColor\"/></marker></defs>" +
            "<g font-family=\"sans-serif\" font-size=\"11\" fill=\"currentColor\">" +
              "<rect x=\"6\" y=\"24\" width=\"140\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"76\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">1. You invite</text>" +
              "<text x=\"76\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">by email</text>" +
              "<line x1=\"146\" y1=\"50\" x2=\"180\" y2=\"50\" stroke=\"currentColor\" marker-end=\"url(#helpArrow2)\"/>" +
              "<rect x=\"186\" y=\"24\" width=\"150\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"261\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">2. They accept</text>" +
              "<text x=\"261\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">become a member</text>" +
              "<line x1=\"336\" y1=\"50\" x2=\"370\" y2=\"50\" stroke=\"currentColor\" marker-end=\"url(#helpArrow2)\"/>" +
              "<rect x=\"376\" y=\"24\" width=\"150\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"451\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">3. Listed here</text>" +
              "<text x=\"451\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">role can be toggled</text>" +
            "</g>" +
          "</svg>" +
        "</div>"
    },
    {
      id: "remove-member",
      title: "Removing a member",
      keywords: ["remove member"],
      html: "<p>Removes their membership in your organization only -- their " +
        "account itself still exists, they simply lose this organization's " +
        "access.</p>"
    },
    {
      id: "roles",
      title: "Member vs. org admin",
      keywords: ["role", "promote", "demote", "toggle"],
      html:
        "<p>Each member row has a role toggle: <strong>member</strong> can " +
        "browse and download; <strong>org admin</strong> can additionally " +
        "manage the team, exactly like you. Promoting someone gives them " +
        "the same team-management power over this one organization -- " +
        "nothing more, nothing at any other organization.</p>"
    }
  ],

  guest: [
    {
      id: "browsing",
      title: "Browsing the site",
      keywords: ["sector", "browse", "menu", "drawer"],
      html:
        "<p>The top pillars (or the MENU drawer on phones) switch between " +
        "sectors. On a touchscreen you can also swipe left/right between " +
        "sectors directly.</p>"
    },
    {
      id: "twins",
      title: "Opening a digital twin",
      keywords: ["tour", "video", "twin", "try a digital twin", "gis"],
      html:
        "<p>Each project can offer a guided tour, a video, or an interactive " +
        "map -- open one from a project card. On the homepage, " +
        "<strong>Try a Digital Twin</strong> opens a live preview tour " +
        "without leaving the page.</p>"
    },
    {
      id: "locked",
      title: "Locked content",
      keywords: ["locked", "sign in required", "login gate"],
      html:
        "<p>A locked tile means that content needs you to be signed in (or, " +
        "for some content, part of a specific client organization). " +
        "Clicking it prompts you to sign in or create an account -- once " +
        "you do, and if you're actually allowed to see it, it opens " +
        "immediately.</p>"
    },
    {
      id: "signin",
      title: "Creating an account",
      keywords: ["sign up", "sign in", "account", "google", "microsoft", "password"],
      html:
        "<p>Click <strong>ACCESS YOUR TWIN</strong>, then <strong>Create " +
        "one</strong> for a new account -- email + password, or " +
        "<strong>Continue with Google/Microsoft</strong> where available. " +
        "A password sign-up requires confirming your email before you're " +
        "actually signed in; check your inbox for that link.</p>"
    },
    {
      id: "lead-form",
      title: "Requesting a proposal",
      keywords: ["lead form", "contact", "proposal", "get in touch"],
      html:
        "<p>The contact forms across the site (Discovery / Proposal / " +
        "Pilot) go straight to the DTS team, with a spam check that briefly " +
        "runs before the Send button becomes active. If sending ever fails, " +
        "the form falls back to opening your own email app with the message " +
        "pre-filled, so your request still gets through.</p>"
    },
    {
      id: "ask",
      title: "Ask a Question",
      keywords: ["ask a question", "faq"],
      html:
        "<p>The bar at the bottom of the screen matches your question " +
        "against a small set of built-in FAQ answers and shows the best " +
        "match right there -- it isn't a live chat.</p>"
    },
    {
      id: "visionpro",
      title: "Apple Vision Pro",
      keywords: ["vision pro", "spatial", "safari"],
      html:
        "<p>On Safari only, the homepage offers a spatial web version of " +
        "this site for visionOS. It's hidden in every other browser because " +
        "the underlying spatial feature is Safari-specific.</p>"
    },
    {
      id: "cookies",
      title: "Cookies &amp; tracking",
      keywords: ["cookie", "privacy", "tracking"],
      html:
        "<p><strong>Accept</strong> allows anonymous usage analytics that " +
        "help improve the site; <strong>Reject</strong> keeps that off. " +
        "Either choice is remembered for future visits. This is separate " +
        "from your sign-in session, which always works regardless.</p>"
    }
  ]
};

/* Shared install guides -- the APK / .exe instructions below are deliberately
   the SAME document for every audience (guest floating icon, portal Help tab,
   Admin Board Documentation screen), so they're defined once here and appended
   to each track rather than pasted three times. orgAdmin is skipped on purpose:
   it renders as a superset of `member`, so org admins already get these. */
(function () {
  var installTopics = [
    {
      id: "install-vr",
      title: "Install on a Meta Quest headset (APK)",
      keywords: ["apk", "sideload", "sidequest", "quest", "meta", "vr",
        "headset", "developer mode", "unknown sources", "usb debugging",
        "install", "update"],
      html:
        "<p>Some apps are delivered as an <code>.apk</code> file -- a full " +
        "VR application you install directly onto a Meta Quest headset " +
        "(Quest 2, 3, 3S, or Pro). Installing an app this way, without going " +
        "through the Quest store, is called <em>sideloading</em>. It's safe " +
        "and officially supported by Meta; the one-time setup takes about " +
        "ten minutes, and every install or update after that takes about " +
        "one.</p>" +
        "<div class=\"help-diagram\" aria-hidden=\"true\">" +
          "<svg viewBox=\"0 0 640 336\" role=\"img\" aria-label=\"Sideload flow: turn on Developer Mode, install SideQuest on a computer, connect the headset by USB and allow debugging, install the APK, then launch it from Unknown Sources in the Library.\">" +
            "<defs><marker id=\"helpArrowVR\" viewBox=\"0 0 10 10\" refX=\"8\" refY=\"5\" markerWidth=\"7\" markerHeight=\"7\" orient=\"auto-start-reverse\"><path d=\"M0 0L10 5L0 10z\" fill=\"currentColor\"/></marker></defs>" +
            "<g font-family=\"sans-serif\" font-size=\"12\" fill=\"currentColor\">" +
              "<rect x=\"30\" y=\"4\" width=\"580\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"320\" y=\"26\" text-anchor=\"middle\" font-weight=\"700\">1. Turn on Developer Mode</text>" +
              "<text x=\"320\" y=\"44\" text-anchor=\"middle\" font-size=\"10\">in the Meta Horizon phone app -- one time only</text>" +
              "<line x1=\"320\" y1=\"56\" x2=\"320\" y2=\"68\" stroke=\"currentColor\" marker-end=\"url(#helpArrowVR)\"/>" +
              "<rect x=\"30\" y=\"71\" width=\"580\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"320\" y=\"93\" text-anchor=\"middle\" font-weight=\"700\">2. Install SideQuest on a computer</text>" +
              "<text x=\"320\" y=\"111\" text-anchor=\"middle\" font-size=\"10\">free desktop app from sidequestxr.com</text>" +
              "<line x1=\"320\" y1=\"123\" x2=\"320\" y2=\"135\" stroke=\"currentColor\" marker-end=\"url(#helpArrowVR)\"/>" +
              "<rect x=\"30\" y=\"138\" width=\"580\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"320\" y=\"160\" text-anchor=\"middle\" font-weight=\"700\">3. Plug the headset into the computer</text>" +
              "<text x=\"320\" y=\"178\" text-anchor=\"middle\" font-size=\"10\">put it on and choose Allow USB debugging</text>" +
              "<line x1=\"320\" y1=\"190\" x2=\"320\" y2=\"202\" stroke=\"currentColor\" marker-end=\"url(#helpArrowVR)\"/>" +
              "<rect x=\"30\" y=\"205\" width=\"580\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"320\" y=\"227\" text-anchor=\"middle\" font-weight=\"700\">4. Install the APK with SideQuest</text>" +
              "<text x=\"320\" y=\"245\" text-anchor=\"middle\" font-size=\"10\">the install-APK-from-folder button, top right</text>" +
              "<line x1=\"320\" y1=\"257\" x2=\"320\" y2=\"269\" stroke=\"currentColor\" marker-end=\"url(#helpArrowVR)\"/>" +
              "<rect x=\"30\" y=\"272\" width=\"580\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"320\" y=\"294\" text-anchor=\"middle\" font-weight=\"700\">5. Launch it in the headset</text>" +
              "<text x=\"320\" y=\"312\" text-anchor=\"middle\" font-size=\"10\">Library, then the Unknown Sources filter</text>" +
            "</g>" +
          "</svg>" +
        "</div>" +
        "<h4>One-time setup (per headset)</h4>" +
        "<ol>" +
        "<li>On a computer, go to <strong>developer.meta.com</strong> and " +
        "sign in with the <em>same Meta account the headset uses</em>. " +
        "Create a developer \"organization\" (any name works) and follow " +
        "the verification prompts -- it's free, and this is what unlocks " +
        "the Developer Mode switch in the next step.</li>" +
        "<li>On your phone, open the <strong>Meta Horizon</strong> app (the " +
        "one used to set the headset up), go to <strong>Devices</strong>, " +
        "pick your headset, open its settings, and switch " +
        "<strong>Developer Mode</strong> on.</li>" +
        "<li>Restart the headset.</li>" +
        "<li>On the computer, download and install <strong>SideQuest</strong> " +
        "from <strong>sidequestxr.com</strong> -- choose the version called " +
        "<em>Advanced Installer</em> (Windows and Mac available).</li>" +
        "</ol>" +
        "<h4>Installing the app</h4>" +
        "<ol>" +
        "<li>Download the <code>.apk</code> from your portal onto that same " +
        "computer.</li>" +
        "<li>Connect the headset to the computer with a USB-C cable. The " +
        "charging cable usually works -- it just has to be a data cable, " +
        "not a charge-only one.</li>" +
        "<li>Put the headset <em>on</em>: a prompt asks <strong>Allow USB " +
        "debugging?</strong> Tick <em>Always allow from this computer</em> " +
        "and choose <strong>Allow</strong>. (This only appears the first " +
        "time per computer.)</li>" +
        "<li>Open SideQuest -- the dot in the top-left corner turns " +
        "<strong>green</strong> once the headset is connected.</li>" +
        "<li>Click the <strong>Install APK file from folder</strong> button " +
        "in SideQuest's top-right toolbar (a box with a downward arrow), " +
        "pick the downloaded <code>.apk</code>, and wait for the " +
        "\"task completed\" confirmation.</li>" +
        "</ol>" +
        "<h4>Finding and launching it</h4>" +
        "<ol>" +
        "<li>In the headset, open your <strong>Library</strong>.</li>" +
        "<li>Click the category filter at the top (it usually says " +
        "<em>All</em>) and choose <strong>Unknown Sources</strong>.</li>" +
        "<li>Your app is listed there -- launch it. It stays installed; you " +
        "don't need the computer again until an update.</li>" +
        "</ol>" +
        "<div class=\"help-note\"><strong>The app is never on the main " +
        "Library shelf.</strong> Sideloaded apps always live under the " +
        "<strong>Unknown Sources</strong> filter -- if you can't find the " +
        "app, that filter is where it is.</div>" +
        "<h4>Updating to a new version</h4>" +
        "<p>Download the new <code>.apk</code> and install it exactly the " +
        "same way -- it replaces the old version in place, keeping your " +
        "place in the Library. If the install fails with an \"app not " +
        "installed\" error, uninstall the old version first (in Unknown " +
        "Sources, open the app's <strong>…</strong> menu and choose " +
        "Uninstall), then install again.</p>" +
        "<h4>If something doesn't work</h4>" +
        "<ol>" +
        "<li><strong>No \"Allow USB debugging\" prompt:</strong> make sure " +
        "you actually put the headset on to look for it; if it's really " +
        "not there, Developer Mode isn't on (or the headset wasn't " +
        "restarted after enabling it), or the cable is charge-only -- try " +
        "another USB-C cable or port.</li>" +
        "<li><strong>Developer Mode switch missing or greyed out in the " +
        "phone app:</strong> the developer-account verification from " +
        "one-time-setup step 1 isn't finished yet.</li>" +
        "<li><strong>SideQuest's dot stays red or yellow:</strong> click " +
        "the dot itself -- SideQuest explains what it's unhappy about.</li>" +
        "<li><strong>Install fails near the end:</strong> check the " +
        "headset's free storage space.</li>" +
        "</ol>"
    },
    {
      id: "install-pc",
      title: "Run on a Windows PC (.exe)",
      keywords: ["exe", "windows", "pc", "desktop", "zip", "extract",
        "smartscreen", "run anyway", "download", "install", "antivirus"],
      html:
        "<p>Windows apps are delivered as a <code>.zip</code> that contains " +
        "the application (<code>.exe</code>) together with the data folders " +
        "it needs. Nothing gets installed system-wide -- you unzip it and " +
        "run it, and deleting the folder later removes it completely.</p>" +
        "<div class=\"help-diagram\" aria-hidden=\"true\">" +
          "<svg viewBox=\"0 0 640 100\" role=\"img\" aria-label=\"Windows flow: download the zip, right-click and Extract All, run the exe past the SmartScreen warning with More info then Run anyway, and keep the extracted folder together.\">" +
            "<defs><marker id=\"helpArrowPC\" viewBox=\"0 0 10 10\" refX=\"8\" refY=\"5\" markerWidth=\"7\" markerHeight=\"7\" orient=\"auto-start-reverse\"><path d=\"M0 0L10 5L0 10z\" fill=\"currentColor\"/></marker></defs>" +
            "<g font-family=\"sans-serif\" font-size=\"11\" fill=\"currentColor\">" +
              "<rect x=\"6\" y=\"24\" width=\"140\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"76\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">1. Download</text>" +
              "<text x=\"76\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">the .zip from your portal</text>" +
              "<line x1=\"146\" y1=\"50\" x2=\"160\" y2=\"50\" stroke=\"currentColor\" marker-end=\"url(#helpArrowPC)\"/>" +
              "<rect x=\"166\" y=\"24\" width=\"140\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"236\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">2. Extract All</text>" +
              "<text x=\"236\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">right-click the zip</text>" +
              "<line x1=\"306\" y1=\"50\" x2=\"320\" y2=\"50\" stroke=\"currentColor\" marker-end=\"url(#helpArrowPC)\"/>" +
              "<rect x=\"326\" y=\"24\" width=\"140\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"396\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">3. Run the .exe</text>" +
              "<text x=\"396\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">More info, Run anyway</text>" +
              "<line x1=\"466\" y1=\"50\" x2=\"480\" y2=\"50\" stroke=\"currentColor\" marker-end=\"url(#helpArrowPC)\"/>" +
              "<rect x=\"486\" y=\"24\" width=\"140\" height=\"52\" rx=\"8\" fill=\"none\" stroke=\"currentColor\"/>" +
              "<text x=\"556\" y=\"46\" text-anchor=\"middle\" font-weight=\"700\">4. That's it</text>" +
              "<text x=\"556\" y=\"62\" text-anchor=\"middle\" font-size=\"9\">runs straight from the folder</text>" +
            "</g>" +
          "</svg>" +
        "</div>" +
        "<h4>Getting it running</h4>" +
        "<ol>" +
        "<li>Download the <code>.zip</code> from your portal.</li>" +
        "<li>Right-click it and choose <strong>Extract All…</strong> " +
        "Don't double-click the <code>.exe</code> while it's still inside " +
        "the zip window -- it will fail or crash on launch, because the app " +
        "can't see its data folder from in there.</li>" +
        "<li>Open the extracted folder and double-click the " +
        "<code>.exe</code>.</li>" +
        "<li>The first time, Windows usually shows a blue <em>\"Windows " +
        "protected your PC\"</em> box (SmartScreen). Click <strong>More " +
        "info</strong>, then <strong>Run anyway</strong>. This warning is " +
        "expected: it appears because the build isn't signed with a " +
        "commercial certificate, not because anything is wrong with it -- " +
        "and it only applies to builds you downloaded from your own " +
        "portal.</li>" +
        "</ol>" +
        "<div class=\"help-note\"><strong>Keep the folder together.</strong> " +
        "The <code>.exe</code> only works sitting next to the " +
        "<code>_Data</code> folder and the other files it was extracted " +
        "with. Move or copy the <em>whole folder</em>, never the .exe " +
        "alone; for a desktop shortcut, right-click the .exe and choose " +
        "<em>Send to → Desktop (create shortcut)</em> instead of moving " +
        "the file.</div>" +
        "<h4>If something doesn't work</h4>" +
        "<ol>" +
        "<li><strong>Black screen or instant crash on launch:</strong> " +
        "almost always the .exe was separated from its folder, or run from " +
        "inside the zip -- re-extract and run it from the extracted " +
        "folder.</li>" +
        "<li><strong>Antivirus quarantined the file:</strong> unsigned " +
        "apps occasionally trigger a false positive. Restore it and add " +
        "the folder to the exclusions list, or ask your IT team to.</li>" +
        "<li><strong>It won't start at all on an older machine:</strong> " +
        "a 64-bit Windows 10 or 11 PC is required, and a dedicated " +
        "graphics card is recommended.</li>" +
        "<li><strong>Quitting:</strong> if the app has no on-screen quit " +
        "button, <strong>Alt+F4</strong> closes it.</li>" +
        "</ol>"
    }
  ];

  ["admin", "member", "guest"].forEach(function (audience) {
    installTopics.forEach(function (topic) {
      window.DTS_HELP[audience].push(topic);
    });
  });
})();
