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
      keywords: ["admin", "board", "sign in", "site_admin", "overview"],
      html:
        "<p>The Admin Board is the CMS for this site. It only opens for a " +
        "<strong>site_admin</strong> session -- signing in with any other " +
        "role takes you to the client portal instead, never here.</p>" +
        "<p>Everything on the left nav edits a working <em>draft</em>, kept " +
        "in your browser's local storage. Nothing you change here is visible " +
        "on the live site until you explicitly <strong>Save draft &amp; " +
        "preview</strong>, and even then only your own browser sees the " +
        "preview -- publishing to every visitor is a separate, explicit step.</p>"
    },
    {
      id: "draft-workflow",
      title: "Save draft, preview, discard, publish",
      keywords: ["draft", "preview", "discard", "publish", "export", "zip"],
      html:
        "<p><strong>Save draft &amp; preview</strong> writes your changes to " +
        "the <code>dtsAdminDraft</code> browser storage key and reloads the " +
        "page so you can see them as a real visitor would, in this browser " +
        "only.</p>" +
        "<p><strong>Discard draft</strong> throws that local draft away and " +
        "reloads back to whatever is genuinely published -- use it any time " +
        "a preview goes wrong, there is nothing to undo on the live site.</p>" +
        "<p><strong>Publish</strong> (from the top toolbar) is the only " +
        "action that changes what every visitor sees. It pushes the current " +
        "draft's content to the live data store instantly.</p>" +
        "<p><strong>Export</strong> downloads a zip of every content document, " +
        "including any locally-harvested GIS layer files -- useful as a " +
        "backup or to hand content to someone outside the board.</p>"
    },
    { id: "home", title: "Home page", keywords: ["home", "hero", "hexagons"],
      html: "<p>Edits the homepage hero: headline, hexagon tiles, and the " +
        "\"Try a Digital Twin\" reveal's video/tour settings.</p>" },
    { id: "contact", title: "Contact panel", keywords: ["contact"],
      html: "<p>Edits the sliding contact panel content reachable from the " +
        "category view's edge tab.</p>" },
    { id: "faq", title: "FAQ answers", keywords: ["faq", "ask a question", "qbar"],
      html: "<p>Edits the question/answer pairs the homepage \"Ask a " +
        "Question\" bar matches against. Each entry needs enough keyword " +
        "overlap with how a real visitor would phrase the question -- the " +
        "matcher is a plain keyword match, not a language model.</p>" },
    { id: "funfacts", title: "Fun facts", keywords: ["fun facts"],
      html: "<p>Edits the rotating fun-fact strip.</p>" },
    {
      id: "sectors", title: "Category pages (sectors)",
      keywords: ["sector", "category", "add category", "delete category"],
      html:
        "<p>A category page groups a set of projects (Education, Hospitality, " +
        "etc). <strong>+ Add category page</strong> creates a new one; " +
        "delete is blocked while any project still points at it -- reassign " +
        "each project's own Category dropdown first, deleting a sector out " +
        "from under a live project would silently break that project's " +
        "sector-view lookup on the real site.</p>"
    },
    {
      id: "projects", title: "Projects",
      keywords: ["project", "experience", "link", "access level", "tour", "video"],
      html:
        "<p>Each project document holds its descriptive content (title, " +
        "tagline, overview, gallery) plus a list of <strong>experiences</strong> " +
        "(a Treedis tour, a video, a GIS map) and <strong>links</strong>. " +
        "Descriptive content always ships publicly -- only the navigable " +
        "target (the tour URL, the video URL, a link's URL) is withheld " +
        "above whatever access level you set.</p>" +
        "<p>Every project and experience/link has its own " +
        "<strong>Access level</strong> dropdown -- see the Access topic for " +
        "what each level actually requires.</p>"
    },
    {
      id: "gis", title: "GIS maps &amp; tours",
      keywords: ["gis", "map", "tour", "feature tour", "layer"],
      html:
        "<p>A GIS map is a whole document -- view, basemaps, layers, groups, " +
        "bookmarks, tours -- not a single field. Gating a map (setting it " +
        "above <code>public</code>) withholds the ENTIRE map document plus " +
        "every tour/feature-tour that references it, not just one field.</p>" +
        "<p>Tours and feature tours are guided walkthroughs of a map's " +
        "content; they live under the map that owns them in the left nav.</p>"
    },
    {
      id: "organizations", title: "Organizations",
      keywords: ["organization", "org", "client", "delete"],
      html:
        "<p>An organization is a client company. Deleting one removes its " +
        "memberships and entitlement grants but keeps audit/event history " +
        "(just unlinked) -- use <strong>Disable</strong> instead if you " +
        "might need the organization again; Delete is for genuine " +
        "mistakes or throwaway test orgs.</p>"
    },
    {
      id: "users", title: "Users",
      keywords: ["user", "account", "site_admin", "delete", "promote"],
      html:
        "<p>Manages every account: promote/demote <code>site_admin</code>, " +
        "disable, or permanently delete. Two safety rails: you can never " +
        "delete your own account (avoids a mid-session lockout), and the " +
        "system will never let the LAST remaining site_admin be deleted by " +
        "anyone -- that would lock everyone out of this board.</p>"
    },
    {
      id: "builds", title: "Builds",
      keywords: ["build", "download", "app", "client app", "upload", "entitle"],
      html:
        "<p>Registers downloadable client applications (installers, viewers). " +
        "Register the build's metadata, upload its file, then set an " +
        "<strong>Access level</strong> the same way a project does. A " +
        "<code>restricted</code> build needs an explicit entitlement grant " +
        "(see Access) before anyone can download it.</p>" +
        "<p><strong>Remove file</strong> clears just the uploaded file and " +
        "keeps the build registered; <strong>Delete</strong> removes the " +
        "whole build, its file, and any entitlement grants pointing at it.</p>"
    },
    {
      id: "access",
      title: "Access levels &amp; entitlements",
      keywords: ["access", "entitlement", "public", "registered", "client", "restricted", "grant"],
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
        "<p>A level is set on the content item itself (Projects/Builds/GIS " +
        "editors) and is CMS content, edited here. <strong>Who</strong> holds " +
        "a <code>restricted</code> grant is different -- that lives only in " +
        "the live database, granted here on this Access screen with the " +
        "entitlement picker, to either a specific user or a whole " +
        "organization. Nothing ever defaults to open: an ungranted " +
        "<code>restricted</code> item is a hard deny, not a degraded view.</p>"
    },
    {
      id: "audit", title: "Audit",
      keywords: ["audit", "log", "history"],
      html:
        "<p>A read-only, most-recent-first log of every administrative " +
        "action -- role changes, membership edits, access changes, " +
        "entitlement grants/revokes, disables, invites. Nothing here can be " +
        "edited or deleted from the board; it exists to answer \"who changed " +
        "what, and when.\"</p>"
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
