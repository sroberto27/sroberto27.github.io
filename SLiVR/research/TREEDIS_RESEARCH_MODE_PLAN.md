# Treedis Research Mode plan

Status: Approved post-prototype pipeline phase. No proxy, telemetry collector or participant logging is implemented by this document.

Primary design input: `docs/TreedisResearch mode information.txt` (2,401 lines, reviewed September 19, 2026).

## Purpose and boundary

After SLiVR Phases 0–5 are complete, Phase 6 may add a controlled research environment for studying interaction inside Treedis/WebXR experiences. It should make it possible to align participant movement and input with Treedis location/capture context, task/condition assignment and SLiVR interaction events for HCI and VR analysis.

The research service is not part of the public prototype path. It does not replace IndexedDB for normal SLiVR project data and must remain unreachable during ordinary use, consent decline, invalid/expired study launch or configuration rollback.

## Assessment of the supplied material

The supplied text contains:

- a proposed Cloudflare Worker reverse proxy and private R2 batch store;
- a passive injected WebXR probe that wraps `requestSession` and the session frame callback;
- capture ideas for viewer/head pose, controller grip/target-ray pose, buttons, axes, optional hand joints and lifecycle/input events;
- a one-origin URL resolver and consent gate;
- an NDJSON batch/concatenation workflow;
- non-interference, fail-silent, performance kill-switch and rollback tests;
- a second, more invasive controller concept for inventorying and manipulating Treedis/DOM objects under experimental conditions.

It is useful architecture research, but its produced code targets an SCSU project with different files, locations, Treedis models and assumptions. It has not been tested against SLiVR, the eleven supplied Treedis entries, a current Treedis build, a Meta Quest runtime, current provider terms or an institutional security review. It must be treated as reference/prototype material rather than production-ready code.

The proposed ingestion endpoint also needs controls beyond the supplied draft: authenticated/signed study launches, trusted-origin policy, schema and content-type validation, request/body and batch limits, abuse/rate controls, upstream host allowlisting, storage-failure visibility, non-colliding object identifiers and auditable retention/deletion. Wildcard ingestion and accepting arbitrary client-supplied session paths are not acceptable defaults for a deployed study service.

## Capability preference

At Phase 6 start, choose the least invasive authorized method that satisfies the approved protocol:

1. Provider-supported Treedis SDK, events, plugin or export.
2. Safe-listed parent/iframe messages and SLiVR-side events.
3. Authorized passive proxy injection for signals unavailable through supported interfaces.
4. Authorized active manipulation only when the study requires controlled stimuli and both provider/content-owner permission and study approval cover it.

Failure to obtain authorization prevents proxy/manipulation deployment. It does not block normal SLiVR or invalidate Phases 0–5.

## Modes and gates

| Mode | Recording | Content modification | Activation |
|---|---|---|---|
| `off` | None | None | Default public mode; direct Treedis URL |
| `record-only` | Protocol-approved passive signals | None | Valid signed launch + current consent + configured research service |
| `inventory` | Passive signals plus bounded authorized handle metadata | None | Separate operator/researcher capability; never a participant default |
| `condition` | Passive signals plus condition/operation results | Only named, versioned operations | Record-only gate + manipulation approval + condition assignment + disclosure |

Configuration alone is insufficient. A URL parameter by itself must not authorize recording. Use a short-lived signed launch carrying protocol ID, study build, allowed mode/condition, expiry and a nonce or equivalent replay control. Consent is scoped to that study/session and must not silently persist across unrelated studies.

## Proposed components

### SLiVR study launcher

- Verifies an authorized study launch before offering consent.
- Shows protocol-specific disclosure, study contact, data categories, duration/retention, withdrawal and manipulation notice where applicable.
- Creates the research iframe URL only after consent.
- Provides a visible study-state/stop control outside the Treedis content.
- Stops new sampling on withdrawal and follows the protocol's partial-data retention/deletion rule.
- Keeps direct Treedis navigation for normal and declined sessions.

### Research proxy

- Runs on a dedicated HTTPS research origin separate from the public application.
- Proxies only allowlisted Treedis hosts and expected paths/methods; it must never operate as an open proxy.
- Injects exactly one versioned research bundle into eligible authorized HTML.
- Changes security/framing headers only when documented and authorized for the study path.
- Preserves navigation, WebSocket/resource behavior and the SLiVR Treedis adapter contract.
- Emits a manifest containing proxy/probe/schema versions and a hash/identifier for the injected bundle.

Cloudflare Worker plus a private R2 bucket is the initial deployment candidate because the public site is static. Phase 6 must re-check platform capabilities, deployment policy and cost before implementation. A hosted Node/Express fallback is a separate deployment option, not a second simultaneous collection path.

### Passive probe

- Wraps and forwards original WebXR calls with unchanged arguments, results and error behavior.
- Uses the existing XR session frame callback rather than creating a second render loop.
- Samples only fields approved in the protocol and records explicit missing/unsupported capability.
- Uses one session-relative monotonic timeline plus a minimal time anchor and clock metadata.
- Records sampling configuration, sequence number, dropped/buffered count and shutdown reason.
- Batches asynchronously; collector failure cannot block or crash Treedis.
- Measures its own cost against a device/protocol baseline and disables high-rate sampling when the approved threshold is exceeded while preserving minimal lifecycle diagnostics.
- Never labels viewer/head direction as eye tracking.

### Collector and private storage

- Accepts only authorized study sessions and allowed origins/content types.
- Validates schema version, event types, numeric bounds, session/protocol claims, batch order/sequence and body size before storage.
- Applies request/rate/total-session limits and abuse monitoring.
- Uses immutable, collision-resistant object keys and records ingest acknowledgements/failures.
- Keeps storage private with least-privilege access, lifecycle deletion and an audit trail.
- Separates launch/consent records, raw events, derived metrics and recruitment identity; the application event stream contains no direct identity.
- Documents infrastructure/provider logs that may contain network metadata even when the application does not store IP addresses.

### Analysis pipeline

- Validates and concatenates batches by session/sequence with duplicates, gaps and clock anomalies reported.
- Never silently discards malformed or late rows.
- Transforms raw coordinates only with the recorded WebXR reference space and any versioned Treedis/location calibration.
- Generates declared derived measures from versioned scripts/configuration.
- Preserves raw immutable input, transformation version, exclusions and output checksum.
- Supports protocol-controlled deletion by a participant/session lookup process defined before collection.

## Passive event families

Only protocol-approved fields are active for a given study:

| Family | Candidate content | Required context |
|---|---|---|
| Session | start/end, visibility, XR mode, frame rate/capabilities, stop reason | protocol, consent, artifact/probe/schema/runtime versions |
| Viewer | head/HMD position and orientation in declared reference space | sample rate, sequence, coordinate units/reference space |
| Controller | grip and target-ray pose, handedness/profile | reference space and sample rate |
| Input | select/squeeze, buttons, touched/value, axes | input profile and mapping/version |
| Hand | approved joint positions when available | joint set/runtime capability and explicit opt-in |
| Treedis | safe-listed readiness, sweep/pose/navigation lifecycle | experience, entry, sweep/capture and adapter versions |
| SLiVR study | task/condition markers, consent/withdrawal, mode transitions | protocol/task/condition version |
| Quality | probe cost, dropped/gap counts, send/ingest result, self-disable | thresholds and sampling configuration |

Do not capture audio, video, screenshots, DOM text, credentials, private project content or unrestricted `postMessage` payloads. High-frequency movement trajectories may be identifying or sensitive even when keyed only by a random session ID.

## Conditional manipulation

Manipulation is a separate research capability, not an automatic extension of recording. Start with a no-change inventory pass in a controlled researcher session because object names, runtime scene access and stable selectors cannot be known from the supplied text.

Conditions must be predefined and versioned. Each operation declares target kind/reference, action, trigger, parameters, expected state, one-shot/sticky behavior and rollback. Candidate triggers include ready, elapsed time, authorized spatial zone, head-direction dwell or input count. The same session timeline records condition assignment, trigger firing, operation attempt/result, failure and rollback.

Do not rely on broad global-object scans, arbitrary CSS selectors, unrestricted `postMessage("*")` commands or monkey-patching undocumented renderer internals in a participant study without a bounded compatibility/authorization review. Newly injected questionnaires or overlays require their own accessibility, consent and measurement validation.

## Phase 6 work packages

1. **Authorization and protocol feasibility:** verify Treedis/content-owner permission, institutional security/ethics path, study purpose, minimum signals, retention/deletion and provider-supported alternatives.
2. **Threat model and data contract:** define trust boundaries, launch authorization, consent state machine, event allowlist/schema, sampling/budget, storage/retention and analysis provenance.
3. **Proxy proof:** dedicated research origin, upstream allowlist, one-bundle injection, capability manifest and automatic/direct fallback. Use test fixtures before a live tour.
4. **Passive probe proof:** WebXR fixture/harness, unchanged-call contract, sampling, sequencing, failure and performance tests.
5. **Collector/storage proof:** signed launch validation, bounded ingest, immutable storage, private access, retention and deletion/retrieval tests.
6. **SLiVR integration:** route through the research service only after valid launch and consent; preserve multi-experience identity and Treedis adapter behavior.
7. **Quest/live compatibility pilot:** researcher-only test against approved Treedis entries and defined device/browser/runtime versions.
8. **Analysis reproducibility:** batch validation, gap report, derived-measure scripts, manifest/checksum and a synthetic public test dataset with no participant data.
9. **Optional manipulation gate:** inventory, named conditions, separate disclosure, compatibility freeze, non-interference and rollback.
10. **Study readiness review:** complete protocol-specific materials, dry run, incident/stop process and approvals before recruitment.

## Acceptance evidence

- Direct/public, declined, expired and invalid-launch sessions use the original Treedis origin and create no research requests.
- Proxied HTML/resource behavior is compared against direct behavior; intentional differences are declared and bounded.
- Collector blocked, storage unavailable, malformed data and slow network do not prevent tour navigation or XR session use.
- Call forwarding and event order are verified in a WebXR test harness before live Treedis testing.
- Frame cadence, probe overhead, dropped events and self-disable behavior are measured on each approved device/runtime; thresholds are protocol-defined rather than assumed.
- Raw batches validate; gaps/duplicates remain visible; concatenation and derived results are repeatable from a frozen manifest.
- Consent, pause/withdrawal, retention expiry and study-controlled deletion are tested end to end.
- Record-only mode installs no manipulation hooks.
- Inventory mode changes no visible stimulus.
- Condition mode changes only declared targets, logs all attempts/results and rolls back or disables cleanly.
- A Treedis update or capability mismatch fails closed for research collection/manipulation and leaves normal SLiVR usable.

## Research opportunities after readiness

Potential studies include wayfinding and landmark support, remote spatial understanding, visual search, spatial memory, information-density effects, guidance strategies, accessibility variants and shot-planning handoff. Each requires its own research question, condition design, task/rubric, counterbalancing, analysis plan and approval. Head-motion or dwell measures are behavioral proxies and must not be reported as eye tracking, attention or cognitive state without appropriate validation.

