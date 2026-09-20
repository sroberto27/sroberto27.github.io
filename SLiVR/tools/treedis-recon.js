/**
 * Treedis reconnaissance harness.
 *
 * A diagnostic instrument, not part of the application. It loads each supplied
 * entry through the same adapter the product uses and records what the viewer
 * actually does: whether it renders in a frame, whether the message bridge
 * answers, whether the sweep list arrives, whether a sweep change happens
 * without a reload, and whether any pose is reported.
 *
 * It answers tests 28 and 29 and produces the provider capability matrix. The
 * adapter is used unmodified so the findings describe the code that ships, not
 * a more forgiving copy of it.
 *
 * Nothing is assumed. Every capability starts unknown and moves only on an
 * observation, and message contents are recorded as shapes rather than values,
 * because a payload could carry identifiers from a private experience.
 */

import { createTreedisAdapter } from "slivr/immersive/treedis-adapter.js";
import { describeCapabilities } from "slivr/immersive/capability.js";

const state = {
  region: null,
  entries: [],
  active: null,
  adapter: null,
  reports: new Map(),
  log: [],
};

const elements = {
  entries: document.getElementById("entries"),
  entryCount: document.getElementById("entry-count"),
  current: document.getElementById("current"),
  controls: document.getElementById("controls"),
  capabilities: document.getElementById("capabilities"),
  log: document.getElementById("log"),
  viewer: document.getElementById("viewer"),
  scope: document.getElementById("scope"),
  download: document.getElementById("download"),
};

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

async function load() {
  const [region, captures, locations] = await Promise.all(
    ["region/lafayette.region.json", "catalog/captures.v1.json", "catalog/locations.v1.json"].map((path) =>
      fetch(`../data/${path}`).then((response) => response.json()),
    ),
  );

  state.region = region.immersive;
  const byId = new Map(locations.locations.map((location) => [location.id, location]));
  state.entries = captures.captures
    .filter((capture) => capture.state === "current")
    .map((capture) => ({
      captureId: capture.id,
      locationId: capture.locationId,
      locationName: byId.get(capture.locationId)?.name ?? capture.workbookLocationName,
      experienceId: capture.experienceId,
      sweepId: capture.sweepId,
      grouping: capture.grouping,
      url: capture.url,
    }));

  elements.entryCount.textContent = String(state.entries.length);
  elements.scope.textContent = `${state.entries.length} entries · origin ${state.region.origin}`;
  renderEntries();
}

function renderEntries() {
  const shared = sharedExperienceId();
  elements.entries.replaceChildren(
    el(
      "ul",
      { class: "record-list" },
      state.entries.map((entry) => {
        const report = state.reports.get(entry.captureId);
        const verdict = report ? report.state : "not tried";
        return el("li", {}, [
          el(
            "button",
            {
              type: "button",
              class: `record-row${state.active?.captureId === entry.captureId ? " is-selected" : ""}`,
              onClick: () => loadEntry(entry),
            },
            [
              el("span", { class: "record-id", text: entry.captureId }),
              el("span", { class: "record-name", text: entry.locationName }),
              el("span", { class: `chip verdict-${verdict.replace(/\s/g, "-")}`, text: verdict }),
            ],
          ),
          el("p", {
            class: "record-meta",
            text: `${entry.experienceId}${entry.experienceId === shared ? " (shared)" : ""} · ${entry.sweepId.slice(0, 10)}…`,
          }),
        ]);
      }),
    ),
  );
}

/** The experience more than one catalog record points at. */
function sharedExperienceId() {
  const counts = new Map();
  for (const entry of state.entries) {
    counts.set(entry.experienceId, (counts.get(entry.experienceId) ?? 0) + 1);
  }
  return [...counts.entries()].find(([, count]) => count > 1)?.[0] ?? null;
}

function loadEntry(entry) {
  state.adapter?.dispose();
  state.log = [];
  state.active = entry;

  elements.current.textContent = `${entry.captureId} · ${entry.locationName} · experience ${entry.experienceId}`;

  state.adapter = createTreedisAdapter({
    region: state.region,
    win: window,
    onEvent: (event) => {
      if (event.type === "observation") {
        appendLog(event.kind, event.detail);
      } else {
        appendLog(event.type, { state: event.state });
      }
      state.reports.set(entry.captureId, state.adapter.report());
      renderCapabilities();
      renderEntries();
    },
  });

  state.adapter.attach(elements.viewer, entry);
  renderControls();
  renderCapabilities();
}

/**
 * Sweep targets inside the entry currently loaded.
 *
 * Test 29 asks that the shared downtown experience proves distinct entry
 * navigation, so the targets are the other catalog records pointing at the
 * same experience. Each one keeps its own identifier and name here, which is
 * the point being demonstrated.
 */
function siblingTargets() {
  if (!state.active) return [];
  return state.entries.filter(
    (entry) =>
      entry.experienceId === state.active.experienceId && entry.captureId !== state.active.captureId,
  );
}

function renderControls() {
  const siblings = siblingTargets();
  elements.controls.replaceChildren(
    ...[
      el("button", {
        type: "button",
        text: "Reload entry",
        onClick: () => loadEntry(state.active),
      }),
      el("button", {
        type: "button",
        text: "Open entry URL in a tab",
        onClick: () => window.open(state.active.url, "_blank", "noopener"),
      }),
      ...siblings.map((sibling) =>
        el("button", {
          type: "button",
          text: `Navigate to ${sibling.locationId}`,
          title: `${sibling.locationName} · sweep ${sibling.sweepId}`,
          onClick: () => {
            const result = state.adapter.goToSweep(sibling.sweepId);
            appendLog("navigate-requested", {
              target: sibling.locationId,
              sweepId: sibling.sweepId,
              accepted: result.ok,
              reason: result.reason ?? null,
            });
          },
        }),
      ),
    ],
  );
}

function renderCapabilities() {
  const report = state.active ? state.reports.get(state.active.captureId) : null;
  const described = report ? describeCapabilities(report.capabilities) : null;

  elements.capabilities.replaceChildren(
    ...Object.entries({
      State: report?.state ?? "—",
      "Entry by URL": described?.entryByUrl ?? "—",
      Embedding: described?.embedding ?? "—",
      Messaging: described?.messaging ?? "—",
      "Sweep switch without reload": described?.sweepSwitchWithoutReload ?? "—",
      "Pose reporting": described?.poseReporting ?? "—",
      "Bookmark restore": described?.bookmarkRestore ?? "—",
    }).flatMap(([term, value]) => [
      el("dt", { text: term }),
      el("dd", { class: `verdict-${String(value).replace(/\s/g, "-")}`, text: String(value) }),
    ]),
  );
}

function appendLog(kind, detail) {
  const entry = { at: new Date().toISOString(), kind, detail };
  state.log.push(entry);
  elements.log.prepend(
    el("li", {}, [
      el("span", { class: "log-kind", text: kind }),
      el("span", { class: "log-detail", text: summarise(detail) }),
    ]),
  );
  while (elements.log.children.length > 200) elements.log.lastChild.remove();
}

function summarise(detail) {
  if (!detail || typeof detail !== "object") return String(detail ?? "");
  return Object.entries(detail)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : JSON.stringify(value)}`)
    .join("  ");
}

elements.download.addEventListener("click", () => {
  const report = {
    harness: "treedis-recon",
    runAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    origin: state.region.origin,
    scope:
      "Observed runtime behaviour per supplied entry. A capability reads unknown unless it was seen.",
    entries: state.entries.map((entry) => ({
      ...entry,
      report: state.reports.get(entry.captureId) ?? null,
    })),
  };
  const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { href: url, download: `SLiVR_treedis-recon_${report.runAt.slice(0, 10)}.json` });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

await load();
