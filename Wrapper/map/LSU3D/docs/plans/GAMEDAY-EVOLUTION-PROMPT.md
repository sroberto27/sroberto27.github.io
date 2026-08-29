# Gameday Evolution — Planning Prompt

**How to use:** from `Wrapper/map/LSU3D/`, enter Plan Mode and either run
`/gameday-plan` or paste everything below the line as your message. The output
is a plan only — no code changes on this pass. Save the approved result as
`GAMEDAY-EVOLUTION-PLAN.md` in this folder.

Context this prompt depends on (already in the repo): `../../CLAUDE.md`,
`../WEBSITE-STATE.md`, `../../README.md`, `../LSU_Mobile_4G_Audit_Prompt.md`.

---

You are working inside the existing **LSU3D / Death Valley Experience website project**.

Start in **Plan Mode only**. **Do not implement, edit, delete, rename, or refactor any files yet.** Your job is to thoroughly inspect the current project and produce a safe, implementation-ready plan.

## 1. Understand the existing project first

Before planning anything:

1. Read `CLAUDE.md` completely if it exists.
2. Read `docs/WEBSITE-STATE.md` completely if it exists.
3. Read any architecture, migration, testing, deployment, CMS, map, tour, Treedis, VR/WebXR, or access-control documentation that already exists.
4. Inspect the complete folder structure.
5. Inspect the current HTML, CSS, JavaScript, JSON/GeoJSON, configuration, map logic, tour logic, Treedis integration, Google 3D integration, mobile behavior, VR behavior, and loading flow.
6. Inspect `git status`, current branch, recent relevant commits, and the current deployed/GitHub-Pages architecture.
7. Identify all existing features that must not break.
8. Identify reusable systems already present rather than proposing duplicate implementations.

Treat the **current working GitHub Pages version as the behavioral baseline**.

Do not redesign working systems unless there is a clear reason.

---

# PROJECT GOAL

The website is evolving from a static 3D campus/tour experience into a more useful **LSU Football recruiting gameday digital experience**.

The work should be planned in three major stages:

1. **Phase 1 — Make It Useful**
2. **Phase 2 — Make It Fast**
3. **Future Migration — GitHub Pages → Cloudflare + Supabase**

The migration happens **after Phase 1 and Phase 2 are working correctly**, but architecture decisions made now must avoid making that migration unnecessarily difficult.

---

# PHASE 1 — MAKE IT USEFUL

Plan the following features.

## 1. My Gameday

Create a personalized gameday itinerary experience.

Possible information includes:

* recruit/family name if appropriate
* arrival time
* current stop
* next stop
* upcoming stops
* countdown/timing
* instructions
* staff/contact information
* overall journey progress
* completed stops
* relevant content for the current stop

Determine how this should integrate with the existing 10-stop tour instead of creating an unrelated second navigation system.

Plan desktop and mobile UX.

Also plan how personalization should work initially while the site is still static and how it should later transition to Supabase-backed data.

---

## 2. Live Visit Mode

Create a mode specifically for use **during the real physical LSU visit**.

The interface should prioritize information such as:

* You are here
* Current stop
* Next destination
* walking direction
* approximate distance/time
* next scheduled activity
* progress through the visit
* quick access to important contact information
* ability to return to the full map/tour

Determine how Live Visit Mode relates to My Gameday and whether they should share a single state/data model.

Do not create duplicate systems unnecessarily.

---

## 3. GPS / You Are Here

Plan optional browser geolocation.

Requirements:

* explicit permission
* graceful behavior when permission is denied
* visible "You Are Here" location on the existing campus map
* appropriate accuracy indication
* highlighting of the next destination where useful
* distance to the next stop
* no requirement for permanent location tracking
* mobile-first design
* battery-conscious behavior
* privacy-conscious behavior

Determine whether geolocation needs continuous watch mode or whether periodic/on-demand updates would be more appropriate.

Plan fallback behavior when GPS accuracy is poor.

---

## 4. QR / NFC Deep Links

Each major physical stop should be able to link directly into the corresponding digital stop.

Examples:

* Lawton Room
* Tiger Walk
* Stadium
* Operations Facility
* Field Level
* other tour stops

Plan a URL/deep-link system such as a route/query parameter/hash structure that can open:

* a specific stop
* the map focused on that stop
* relevant media/content
* optionally Live Visit Mode

The system should work when accessed through:

* QR codes
* NFC tags
* ordinary shared links
* browser bookmarks

Do not require a separate native app.

Plan how invalid or outdated deep links are handled.

---

# 5. Staff Analytics Dashboard

Plan an analytics system capable of eventually showing authorized LSU/DTS staff information such as:

* visits
* return visits
* unique sessions/users where legally and technically appropriate
* tour starts
* tour completions
* stops opened
* most revisited stops
* time spent
* video engagement
* immersive experience launches
* Treedis usage
* Google 3D usage
* QR/NFC entry points
* Live Visit Mode usage
* My Gameday engagement
* device category
* approximate performance/network information
* errors/failures
* conversion through the journey where appropriate

Do not build invasive tracking.

Clearly separate:

* anonymous aggregate analytics
* session analytics
* authenticated/personalized analytics

Plan consent/privacy considerations where applicable.

For the current static site, determine what can reasonably exist before Supabase.

For the future system, design how Supabase could store required analytics without tightly coupling every frontend component directly to the database.

---

# 6. Presentation / Kiosk Mode

Plan a full-screen guided mode for environments such as:

* recruiting offices
* Lawton Room displays
* large monitors
* touchscreens
* presentations

Possible behavior:

* full-screen presentation
* auto-start option
* guided progression through stops
* automatic camera transitions
* looping mode
* idle timeout/reset
* large touch targets
* hidden unnecessary UI
* manual previous/next controls
* optional autoplay
* mute/unmute
* escape/admin exit mechanism

Kiosk mode should reuse the existing tour/story system rather than becoming an entirely separate application.

---

# 7. Content Management Layer

Plan a content-management architecture so authorized staff can eventually update content without changing source code.

Editable content may include:

* tour stop titles
* descriptions
* stop order
* arrival/departure times
* gameday itinerary information
* contact information
* images
* videos
* links
* route information
* instructions
* avatar scripts
* Treedis links/IDs
* seasonal/game-specific content
* kiosk content
* My Gameday content
* Learn/content sections

For the current GitHub Pages phase, determine whether content should first be normalized into clean JSON/configuration structures.

For the future Supabase version, propose a database/content model.

Do not immediately move all static configuration into Supabase without evaluating whether it belongs there.

Plan:

* roles
* permissions
* validation
* drafts
* publishing
* rollback/version history if appropriate
* media handling
* safe editing of routes/IDs
* separation between global content and game-specific content

---

# PHASE 2 — MAKE IT FAST

The website needs to work acceptably on slow mobile networks.

Inspect the existing loading architecture first and identify actual bottlenecks before recommending changes.

Plan the following.

---

## 1. Service Worker / PWA Caching

Plan a service worker strategy for appropriate first-party assets.

Potentially cache:

* application shell
* HTML
* CSS
* JavaScript
* icons
* JSON
* GeoJSON
* local content
* previously viewed content

Do not assume third-party map tiles, Google content, Matterport/Treedis assets, or other externally hosted resources may be permanently cached. Respect provider restrictions.

Define cache:

* versioning
* invalidation
* updates
* stale content behavior
* offline fallback
* rollback behavior

---

## 2. Data Saver Mode

Plan automatic and manual low-bandwidth behavior.

Investigate browser capabilities such as:

* `navigator.connection`
* `effectiveType`
* `saveData`

but provide fallbacks because support differs across browsers.

Possible operating modes:

### Lite

* lightweight 2D map
* essential content
* reduced imagery
* no automatic immersive loading

### Standard

* current normal site experience

### Full / Immersive

* Google Photorealistic 3D
* Treedis
* high-resolution assets
* richer media

Users should always have a manual override.

---

## 3. Lazy Treedis Loading

Inspect the existing Treedis preload behavior.

The intended architecture should be:

**Main site first → immersive Treedis experience only when requested**

Do not allow a hidden Treedis iframe or heavy immersive experience to delay normal map usage on slow networks unless there is a justified optimized preload strategy.

Plan appropriate:

* lazy loading
* idle loading
* preconnect
* preload conditions
* teardown
* memory handling
* mobile behavior

---

## 4. Image Optimization / Lazy Loading

Plan:

* modern formats where appropriate
* responsive image sizes
* thumbnails
* hero assets
* lazy loading
* progressive loading
* first-stop/next-stop prefetching
* avoiding loading all 10 stops immediately

Because the tour sequence is known, evaluate a strategy such as:

**Current stop loaded → next stop prefetched → later stops remain unloaded**

---

## 5. JSON / GeoJSON Caching and Versioning

Inspect current fetching behavior.

Plan:

* long-lived caching for versioned assets
* hashed/versioned filenames where appropriate
* cache invalidation
* removal of unnecessary `cache: "no-cache"` behavior where inappropriate
* elimination of missing/unused requests
* reduced duplicate requests

---

## 6. Lightweight Basemap Behavior

Inspect the current basemap/aerial imagery architecture.

Plan graceful degradation such as:

**Slow network → lightweight basemap first**

with aerial/satellite/high-resolution imagery loaded only when appropriate or requested.

Do not remove the existing LSU visual experience.

---

## 7. Google 3D Optimization

Keep heavy 3D libraries/content lazy.

Plan adaptive behavior based on:

* mobile vs desktop
* GPU/device capability where practical
* network conditions
* user request
* memory
* reduced-data mode

Preserve the ability for users to manually enter the 3D experience.

---

## 8. JavaScript / CSS Loading

Inspect the actual dependency graph.

Plan:

* minification
* bundling only where useful
* code splitting
* lazy immersive modules
* removal of unused code
* deferred/non-blocking loading
* font optimization
* external dependency handling

Do not blindly bundle everything into one large initial JavaScript file.

---

# FUTURE MIGRATION — GITHUB PAGES → CLOUDFLARE + SUPABASE

This migration will happen **after Phase 1 and Phase 2 are implemented and validated**.

The migration must preserve the working website.

## Core migration requirement

The current GitHub Pages deployment must be treated as the **known-good baseline**.

Before migration, plan a baseline/tag/commit strategy so we can always compare or roll back to the exact working GitHub Pages version.

The migrated application should preserve all functionality unless a change is explicitly intentional.

---

# Cloudflare

Evaluate which Cloudflare architecture is appropriate for this project based on the actual codebase.

Do not assume the answer before inspecting the project.

Consider where applicable:

* Cloudflare Pages
* Workers
* custom domain
* redirects
* headers
* security headers
* caching/CDN
* environment variables
* API routes
* deployment previews
* production/staging environments

Explain what Cloudflare should be responsible for versus Supabase.

---

# Supabase

Evaluate Supabase for services such as:

* database
* authentication
* authorization
* CMS data
* My Gameday personalization
* staff dashboard
* analytics data
* content administration
* Storage for appropriate media
* server-side/Edge Function logic where justified

Do not expose privileged Supabase credentials in frontend code.

Plan:

* Row Level Security
* roles
* admin/staff access
* recruit/public access
* anonymous access where appropriate
* schema migrations
* backups
* environment configuration
* local/staging/production environments

---

# PRESERVE STATIC-SITE COMPATIBILITY DURING DEVELOPMENT

Phase 1 and Phase 2 should preferably continue to work on GitHub Pages while they are being developed.

Avoid prematurely making the entire frontend dependent on Supabase.

Where possible, create abstraction boundaries so something such as:

`data provider → local JSON today → Supabase later`

can be changed without rewriting the UI.

Similarly, features should avoid embedding deployment-specific URLs throughout application logic.

Centralize configuration.

---

# MIGRATION PARITY REQUIREMENT

Create a plan for verifying that Cloudflare/Supabase behaves like the final GitHub Pages build.

Include parity testing for at least:

* main page
* map
* all 10 stops
* tour progression
* routes
* deep links
* My Gameday
* Live Visit Mode
* GPS
* QR links
* kiosk mode
* Learn/content
* media
* Treedis
* Google 3D
* VR/WebXR where currently supported
* mobile layouts
* desktop layouts
* browser back/forward navigation
* direct URLs
* authentication
* staff dashboard
* CMS
* analytics
* service worker
* cache invalidation
* slow network behavior
* offline/failure behavior
* refresh/deep-link behavior
* security rules

Include a rollback procedure.

Do not shut down or modify the existing GitHub Pages production deployment until parity has been confirmed.

---

# ARCHITECTURE REQUIREMENTS

While creating the plan:

1. Reuse existing architecture wherever practical.
2. Avoid duplicate state systems.
3. Keep map/tour state centralized.
4. Separate UI from data sources.
5. Separate content from hard-coded presentation logic.
6. Keep external platform integrations behind clear adapters/configuration.
7. Preserve progressive enhancement.
8. Design mobile-first for Live Visit Mode.
9. Preserve desktop functionality.
10. Avoid making heavy immersive features part of initial page load.
11. Avoid unnecessary framework migrations.
12. Do not introduce React/Vue/etc. simply because the application is growing unless inspection shows a compelling reason.
13. Prefer incremental changes over a complete rewrite.
14. Preserve existing working URLs whenever possible.
15. Document any URL change that migration would require.

---

# SECURITY / PRIVACY REVIEW

Specifically identify security/privacy considerations involving:

* GPS/geolocation
* recruit personalization
* analytics
* staff authentication
* CMS
* QR links
* expiring/shared links
* Supabase RLS
* personally identifiable data
* media uploads
* avatar content
* public vs private recruiting content

Do not store sensitive data merely because the platform makes it possible.

---

# REQUIRED PLAN OUTPUT

After fully inspecting the repository, produce an implementation plan containing:

## A. Current-State Audit

Document:

* current architecture
* important files
* map architecture
* tour architecture
* state management
* content/data architecture
* loading sequence
* Treedis integration
* Google 3D integration
* VR/WebXR integration
* mobile architecture
* current deployment
* known technical debt relevant to these changes

Cite exact file paths and important functions.

---

## B. Dependency Map

Show relationships such as:

`Tour State`
→ `My Gameday`
→ `Live Visit Mode`
→ `GPS`
→ `QR Deep Links`
→ `Analytics`

and identify which shared foundations should be implemented first.

---

## C. Recommended Architecture

Describe the architecture before writing code.

Include proposed modules/services such as, if justified by the existing code:

* tour state
* gameday state
* geolocation service
* router/deep-link parser
* analytics adapter
* content provider
* CMS provider
* immersive loader
* network/data-saver manager
* service-worker strategy
* kiosk controller

Use the project's existing naming/style where possible rather than inventing an entirely new architecture.

---

## D. Data Models

Propose data structures for:

* gameday itinerary
* stops
* visit progress
* contacts
* QR/deep links
* content
* analytics events
* CMS content
* users/roles
* game-specific information

Show:

**current static representation**

and

**future Supabase representation**

where appropriate.

---

## E. Implementation Phases

Break implementation into small safe stages.

For every stage include:

* objective
* exact files likely to change
* files likely to be created
* dependencies
* risks
* tests
* estimated difficulty: `Low / Medium / High`
* whether it changes current behavior
* rollback considerations

Order work based on dependencies, not simply the feature list above.

---

## F. Performance Plan

Identify current bottlenecks from the actual code.

Create measurable targets where reasonable for:

* initial application shell
* time until map is usable
* first useful content
* immersive load
* image load
* repeated visits
* Slow 4G
* mobile device behavior

Include a testing methodology using appropriate browser/network throttling tools.

Do not invent current performance numbers if they have not been measured.

---

## G. Cloudflare/Supabase Migration Plan

Create a separate migration section covering:

1. preparation
2. configuration abstraction
3. Supabase schema
4. authentication/RLS
5. Cloudflare staging
6. environment variables
7. data migration
8. routing
9. service worker implications
10. custom domain/DNS when eventually needed
11. staging validation
12. parity testing
13. production cutover
14. rollback

Clearly identify changes that should be made **now** because they make the later migration easier without prematurely migrating the application.

---

## H. Test Matrix

Create a concrete testing matrix including:

### Devices

* desktop
* Android
* iPhone
* tablets
* supported VR headset/browser where applicable

### Browsers

* Chrome
* Safari
* Firefox
* Edge
* relevant WebXR browser

### Networks

* normal broadband
* Fast 3G/Slow 4G equivalent
* high latency
* intermittent connection
* offline/reconnect

### Modes

* normal
* Data Saver
* kiosk
* My Gameday
* Live Visit
* immersive/Treedis
* Google 3D
* VR

---

## I. Git Strategy

Recommend a safe development strategy including:

* baseline commit/tag
* feature branches or staged branches
* atomic commits
* checkpoints
* migration branch
* Cloudflare staging
* production cutover
* rollback to known-good GitHub Pages build

Do not run destructive Git commands.

---

# IMPORTANT: DO NOT IMPLEMENT YET

For this Plan Mode pass:

* do not modify production code
* do not install dependencies
* do not modify configuration
* do not create database tables
* do not create Supabase resources
* do not change DNS
* do not migrate hosting
* do not delete anything
* do not rewrite the application
* do not make commits
* do not push

You may inspect files and Git history as needed.

If something in my requested architecture conflicts with the current implementation, identify the conflict and recommend the safest approach rather than silently changing the requirement.

If information cannot be determined from the repository, explicitly mark it as **NEEDS CONFIRMATION** instead of guessing.

---

# FINAL PLAN SUMMARY

End the Plan Mode response with:

1. **Recommended implementation order**
2. **Critical shared foundations**
3. **Quick wins**
4. **Highest-risk changes**
5. **Things that should wait until Supabase**
6. **Things that should be designed now for Supabase but remain static for the moment**
7. **Performance fixes that should happen before new immersive features**
8. **Exact proposed migration sequence**
9. **Open questions / NEEDS CONFIRMATION**
10. **The first implementation batch you recommend after I approve the plan**

The goal is to leave Plan Mode with a detailed enough plan that I can approve it and then switch Claude CLI to implementation mode without Claude having to rediscover or redesign the architecture.
