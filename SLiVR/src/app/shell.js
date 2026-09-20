/**
 * Application shell: the persistent frame every mode is rendered inside.
 *
 * The frame is fixed and the regions inside it scroll: a top bar holding the
 * four approved modes, the active context and the save status; a left rail of
 * records; a central work surface; and a right rail describing whatever is
 * selected. Switching modes re-fills the rails, so the controls never move
 * underneath the pointer.
 *
 * The centre belongs to the evidence. In Explore that is the map, which fills
 * the region completely, because judging whether a street has room for a unit
 * is done at the largest size the window allows.
 *
 * The mode contents here are the Phase 0 foundation. Each one shows what the
 * foundation can honestly show — that the route resolved, and what the catalog
 * holds for the named record — and says which phase delivers the real surface.
 * Presenting an empty panel as a finished feature would misreport the build.
 *
 * Each region subscribes to the slice of state it draws, so a save-status
 * change does not redraw the rails and a route change does not redraw the
 * status chip.
 */

import { MODES } from "./router.js";
import { describeCapabilities } from "./capabilities.js";
import { formatAddress, openValidationItems } from "../domain/location.js";
import { createFocusTrap } from "../ui/a11y.js";
import { createViewerHost } from "../immersive/viewer-host.js";

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function replaceChildren(node, children) {
  node.replaceChildren(...[].concat(children).filter(Boolean));
}

/** Label and value pairs, used wherever a record is described. */
function fieldList(pairs, className = "fields") {
  return el(
    "dl",
    { class: className },
    pairs.flatMap(([term, value]) => [
      el("dt", { text: term }),
      el("dd", {
        text: value === undefined || value === null || value === "" ? "—" : String(value),
      }),
    ]),
  );
}

function railHead(title, count = null) {
  return el("div", { class: "rail-head" }, [
    el("h2", { text: title }),
    count === null ? null : el("span", { class: "rail-count", text: String(count) }),
  ]);
}

function section(title, children) {
  return el("section", { class: "rail-section" }, [
    title ? el("h3", { text: title }) : null,
    ...[].concat(children),
  ]);
}

function phaseNote(text) {
  return el("p", { class: "phase-note", text });
}

/** Offers a generated file to the browser without leaving the application. */
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next turn so the browser has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {object} options.store
 * @param {object} options.actions
 * @param {object} [options.win] Window, for timers and for opening a provider URL.
 */
export function createShell({ root, store, actions, win = globalThis }) {
  const modeNav = el("nav", { class: "modes", "aria-label": "Workspace modes" });
  const breadcrumb = el("p", { class: "breadcrumb", id: "breadcrumb" });
  const saveChip = el("p", { class: "save-chip", role: "status", "aria-live": "polite" });
  const statusStrip = el("div", { class: "status-strip", role: "status", "aria-live": "polite" });
  const railLeft = el("aside", { class: "rail rail-left", "aria-label": "Records" });
  const surface = el("section", { class: "surface", id: "workspace", tabindex: "-1" });
  const railRight = el("aside", { class: "rail rail-right", "aria-label": "Details" });
  const workspace = el("main", { class: "workspace" }, [railLeft, surface, railRight]);
  const dialogRegion = el("div", { class: "dialog-region" });
  /*
   * The map host is created once and never leaves the surface. Detaching a
   * live WebGL canvas from the document stops it rendering, so re-rendering
   * replaces the content beside the map rather than the map itself.
   */
  const mapHost = el("div", { class: "map-host", id: "map" });
  /*
   * Within an experience the viewer frame is persistent, and
   * stronger one: re-inserting an iframe reloads the document inside it, so a
   * frame rebuilt on every render would restart the model download on every
   * keystroke elsewhere in the interface.
   */
  const viewerHost = createViewerHost({
    doc: document,
    win,
    onCancel: () => {
      const locationId = store.getState().routeResolution?.locationId;
      actions.navigate(locationId ? { name: "location", params: { locationId } } : { name: "explore" });
    },
  });
  const surfaceContent = el("div", { class: "surface-content" });
  surface.append(mapHost, viewerHost.element, surfaceContent);

  const modeButtons = new Map();
  for (const mode of MODES) {
    const button = el("button", {
      type: "button",
      class: "mode-button",
      "data-mode": mode.id,
      text: mode.label,
      onClick: () => actions.navigate(mode.route),
    });
    modeButtons.set(mode.id, button);
    modeNav.append(button);
  }

  root.append(
    el("header", { class: "topbar" }, [
      el("div", { class: "brand" }, [
        el("span", { class: "brand-name", text: "SLiVR" }),
        el("span", { class: "brand-sub", text: "Location scouting and shot design" }),
      ]),
      modeNav,
      el("div", { class: "topbar-context" }, [breadcrumb, saveChip]),
    ]),
    statusStrip,
    workspace,
    dialogRegion,
  );

  // ---- Persistent regions ------------------------------------------------

  function renderModes(mode) {
    for (const [id, button] of modeButtons) {
      const active = id === mode;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  /**
   * The context beyond the mode.
   *
   * The active mode is already marked in the switcher, so repeating its name
   * here would spend the only line of context on something already on screen.
   */
  function renderBreadcrumb(state) {
    const resolution = state.routeResolution;
    if (resolution?.status === "ok" && resolution.view) {
      breadcrumb.textContent = `${resolution.view.location.id} · ${resolution.view.location.name}`;
      return;
    }
    const project = state.projects.find((candidate) => candidate.id === state.openProjectId);
    breadcrumb.textContent = project ? project.name : "";
  }

  function renderSave(save) {
    saveChip.className = `save-chip is-${save.state}`;
    replaceChildren(saveChip, [
      el("span", { text: save.label }),
      save.canRetry
        ? el("button", {
            type: "button",
            class: "link-button",
            text: "Retry",
            onClick: () => actions.retrySave(),
          })
        : null,
      save.state === "failed"
        ? el("button", {
            type: "button",
            class: "link-button",
            text: "Export emergency JSON",
            onClick: emergencyExport,
          })
        : null,
    ]);
  }

  /** Storage warnings, notices and recoverable errors, in one band. */
  function renderStatusStrip() {
    const state = store.getState();
    const lines = [];

    if (state.storage.available === false) {
      lines.push(
        el("div", { class: "status-line is-warning" }, [
          el("strong", { text: "Running without local saving." }),
          el("span", { text: "Work stays in this tab only and is lost when it closes. Export it before you leave." }),
          el("button", {
            type: "button",
            class: "link-button spacer",
            text: "Export emergency JSON",
            onClick: emergencyExport,
          }),
        ]),
      );
    }

    if (state.notice) {
      lines.push(
        el("div", { class: "status-line is-notice" }, [
          el("span", { text: state.notice }),
          el("button", {
            type: "button",
            class: "link-button spacer",
            text: "Dismiss",
            onClick: () => actions.notice(null),
          }),
        ]),
      );
    }

    if (state.error) {
      lines.push(
        el("div", { class: "status-line is-danger" }, [
          el("strong", { text: state.error.title }),
          el("span", { text: state.error.advice }),
          el("button", {
            type: "button",
            class: "link-button spacer",
            text: "Dismiss",
            onClick: () => actions.dismissError(),
          }),
        ]),
      );
    }

    replaceChildren(statusStrip, lines);
  }

  let dialogTrap = null;

  function renderDialog(pendingImport) {
    if (!pendingImport) {
      dialogTrap?.release();
      dialogTrap = null;
      replaceChildren(dialogRegion, []);
      return;
    }
    const { summary, catalogNote } = pendingImport;
    const dialog = el(
      "div",
      { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "conflict-title" },
      [
        el("h2", { id: "conflict-title", text: "This project already exists here" }),
        el("p", {
          text: `The file contains ${summary.projectName ?? "a project"}, identifier ${summary.projectId}, which is already in this browser profile.`,
        }),
        catalogNote ? el("p", { class: "catalog-note", text: catalogNote }) : null,
        fieldList([
          ["Exported", summary.exportedAt],
          ["Written by build", summary.appVersion],
          ["Catalog version", summary.catalogVersion],
          ["Records", Object.entries(summary.counts).map(([k, v]) => `${k} ${v}`).join(", ")],
        ]),
        el("div", { class: "actions" }, [
          el("button", {
            type: "button",
            class: "primary",
            text: "Cancel, change nothing",
            onClick: () => actions.cancelImport(),
          }),
          el("button", { type: "button", text: "Add as a copy", onClick: () => actions.resolveImport("copy") }),
          el("button", {
            type: "button",
            class: "destructive",
            text: "Replace the existing project",
            onClick: () => actions.resolveImport("replace"),
          }),
        ]),
      ],
    );
    replaceChildren(dialogRegion, dialog);
    /*
     * The dialog claims `aria-modal`, so the rest of the page has to actually
     * be unreachable. Escape cancels, which is the outcome that changes
     * nothing; the destructive choice is never the one a stray key reaches.
     */
    dialogTrap?.release();
    dialogTrap = createFocusTrap({
      container: dialog,
      onEscape: () => actions.cancelImport(),
    });
  }

  // ---- Shared surfaces ---------------------------------------------------

  function notFoundSurface(state) {
    const reason = state.routeResolution?.reason ?? "The address is not one this build recognises.";
    return {
      className: "surface-empty",
      children: [
        el("h1", { text: "That address did not resolve" }),
        el("p", { text: reason }),
        el("p", {
          text: "Nothing was lost. The link may be from a different catalog version or a different browser profile.",
        }),
        el("div", { class: "actions" }, [
          el("button", {
            type: "button",
            class: "primary",
            text: "Go to Explore",
            onClick: () => actions.navigate({ name: "explore" }),
          }),
          el("button", {
            type: "button",
            text: "Go to Projects",
            onClick: () => actions.navigate({ name: "projects" }),
          }),
        ]),
      ],
    };
  }

  function catalogRecordList(state) {
    const { catalog } = state;
    if (!catalog) return el("p", { class: "empty-note", text: "Loading the location catalog…" });

    const selected = state.routeResolution?.locationId ?? null;
    return el(
      "ul",
      { class: "record-list" },
      catalog.locations.map((location) =>
        el("li", {}, [
          el(
            "button",
            {
              type: "button",
              class: `record-row${location.id === selected ? " is-selected" : ""}`,
              onClick: () => actions.navigate({ name: "location", params: { locationId: location.id } }),
            },
            [
              el("span", { class: "record-id", text: location.id }),
              el("span", { class: "record-name", text: location.name }),
              el("span", {
                class: `chip chip-${location.captureStatus}`,
                text: location.captureStatus === "current" ? "Captured" : "Future",
              }),
            ],
          ),
        ]),
      ),
    );
  }

  function catalogFigures(state) {
    const { catalog } = state;
    if (!catalog) return el("p", { class: "empty-note", text: "Not loaded." });
    const current = catalog.locations.filter((l) => l.captureStatus === "current").length;
    return fieldList(
      [
        ["Catalog version", catalog.version],
        ["Research snapshot", catalog.researchSnapshot],
        [
          "Locations",
          `${catalog.locations.length} (${current} current, ${catalog.locations.length - current} future)`,
        ],
        ["Operational areas", catalog.areas.length],
        ["Sources", catalog.sources.length],
      ],
      "catalog-figures",
    );
  }

  /**
   * Provenance for whatever imagery is on screen, floated over the map.
   *
   * It sits on the surface it describes rather than in a rail, because the
   * question it answers — what am I looking at, and how far can I trust it —
   * is asked while looking at the image.
   */
  function imageryPlate(state) {
    const imagery = state.imagery;
    const mapError = state.map.error;
    const tiles = state.tiles;

    if (tiles?.state === "active") {
      return el("div", { class: "imagery-plate" }, [
        el("div", { class: "imagery-headline", text: "Google Maps · Photorealistic 3D" }),
        el("p", { class: "imagery-accuracy", text: tiles.attribution }),
        el("p", { class: "imagery-accuracy", text: "Approximate exterior context. Not verified for measurements or object placement." }),
      ]);
    }

    if (mapError) {
      return el("div", { class: "imagery-plate is-unavailable" }, [
        el("div", { class: "imagery-headline" }, [
          el("span", { class: "imagery-year", text: "No map" }),
          el("span", { class: "imagery-source", text: mapError.message }),
        ]),
      ]);
    }
    if (!imagery) {
      return el("div", { class: "imagery-plate is-pending" }, [
        el("div", { class: "imagery-headline" }, [
          el("span", { class: "imagery-year", text: "…" }),
          el("span", {
            class: "imagery-source",
            text: state.map.status === "loading" ? "Loading the map" : "No imagery requested yet",
          }),
        ]),
      ]);
    }

    if (imagery.visible === false) {
      return el("div", { class: "imagery-plate" }, [
        el("div", { class: "imagery-headline", text: "Aerial imagery hidden" }),
        el("p", { class: "imagery-accuracy", text: "Use the aerial imagery button to restore the photograph. Street-map context is controlled separately." }),
      ]);
    }
    const neutral = imagery.state === "neutral";
    return el(
      "div",
      { class: `imagery-plate is-${imagery.state}${imagery.isFallback ? " is-fallback" : ""}` },
      [
        tiles && tiles.state !== "off"
          ? el("p", { class: "imagery-accuracy", role: "status", text: tiles.message })
          : null,
        el("div", { class: "imagery-headline" }, [
          el("span", { class: "imagery-year", text: neutral ? "None" : String(imagery.year) }),
          el("span", {
            class: "imagery-source",
            text: neutral
              ? "No aerial imagery is available. The map is showing a neutral ground."
              : `Louisiana DOTD aerial${imagery.isFallback ? ", fallback source" : ""}`,
          }),
          imagery.isFallback || neutral
            ? el("button", {
                type: "button",
                class: "link-button",
                text: "Retry primary",
                onClick: () => actions.retryImagery(),
              })
            : null,
        ]),
        imagery.accuracyNote
          ? el("p", { class: "imagery-accuracy", text: imagery.accuracyNote })
          : null,
      ],
    );
  }

  // ---- Modes -------------------------------------------------------------

  function exploreMode(state) {
    const { catalog } = state;

    const left = [
      railHead("Catalog records", catalog ? catalog.locations.length : null),
      el("div", { class: "rail-body" }, catalogRecordList(state)),
      el("button", { type: "button", class: "map-rail-recenter",
        text: `Recenter on all ${catalog?.locations.length ?? 0} locations`,
        onClick: () => actions.recenterMap(),
      }),
    ];

    const centre = state.catalogError
      ? {
          className: "surface-document",
          children: [
            el("h1", { text: "The catalog was not loaded" }),
            el("div", { class: "error-card" }, [
              el("h2", { text: state.catalogError.title }),
              el("p", { text: state.catalogError.advice }),
              el("p", { text: "A partial catalog is never shown, so no locations are listed." }),
              state.catalogError.detail
                ? el("pre", { class: "error-detail", text: state.catalogError.detail })
                : null,
              state.catalogError.problems.length > 0
                ? el(
                    "ul",
                    { class: "error-problems" },
                    state.catalogError.problems
                      .slice(0, 20)
                      .map((problem) => el("li", { text: `${problem.path}: ${problem.reason}` })),
                  )
                : null,
              el("div", { class: "actions" }, [
                el("button", {
                  type: "button",
                  class: "primary",
                  text: "Retry",
                  onClick: () => void actions.initializeCatalog(),
                }),
              ]),
            ]),
          ],
        }
      : { map: true, overlay: imageryPlate(state) };

    const right = state.routeResolution?.view
      ? locationRail(state)
      : [
          railHead("Selection"),
          el("div", { class: "rail-body" }, [
            section(null, [
              phaseNote(
                "The map fits the catalog locations on DOTD aerial imagery. Numbered pins match the location list; grouped pins expand to show locations sharing a position. Search, filters and full dossiers arrive in Phase 1.",
              ),
              el("p", {
                class: "empty-note",
                text: "Choose a record to see what the catalog holds for it.",
              }),
            ]),
            section("Catalog", catalogFigures(state)),
          ]),
        ];

    return { left, centre, right };
  }

  /** What the catalog holds for the selected location. */
  function locationRail(state) {
    const { location, area, capture, sources } = state.routeResolution.view;
    const unknowns = openValidationItems(location);

    return [
      railHead("Location", location.id),
      el("div", { class: "rail-body" }, [
        section(null, [
          el("h1", { class: "record-title", text: location.name }),
          phaseNote("The full dossier, evidence badges and project actions arrive in Phase 1."),
        ]),
        section("Identity", [
          fieldList([
            ["Operational area", area ? `${area.id} · ${area.name}` : "—"],
            ["Venue type", location.venueType],
            ["Address", formatAddress(location)],
            ["Coordinates", `${location.position[1]}, ${location.position[0]}`],
            ["Coordinate provenance", location.positionEvidence],
          ]),
        ]),
        section("Capture", [
          fieldList([
            ["Status", location.captureStatus === "current" ? "Captured" : "Future candidate"],
            ["Record", capture ? capture.id : "—"],
            ["Capture date", capture?.captureDate],
            ["Coverage", capture?.coverageNotes],
          ]),
          el("div", { class: "actions" }, [
            el("button", {
              type: "button",
              text: "Open in Immersive",
              onClick: () => actions.navigate({ name: "immersive", params: { locationId: location.id } }),
            }),
          ]),
        ]),
        section("Research", [
          fieldList([
            ["Research status", location.researchStatus],
            ["Sources", sources.length],
          ]),
          unknowns.length > 0
            ? el("div", { class: "unknowns" }, [
                el("h3", { text: "Still to validate" }),
                el(
                  "ul",
                  {},
                  unknowns.map((item) => el("li", { text: `${item.path}: ${item.value}` })),
                ),
              ])
            : null,
        ]),
      ]),
    ];
  }

  function projectsMode(state) {
    const nameInput = el("input", {
      type: "text",
      id: "new-project-name",
      name: "new-project-name",
      placeholder: "Production name",
      maxlength: "160",
    });

    const importInput = el("input", {
      type: "file",
      id: "import-project",
      accept: "application/json,.json",
      onChange: async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await actions.importFile(await file.text());
        event.target.value = "";
      },
    });

    const openId = state.route?.params?.projectId ?? state.openProjectId;
    const open = state.projects.find((project) => project.id === openId) ?? null;

    const left = [
      railHead("Projects", state.projects.length),
      el("div", { class: "rail-body" }, [
        section("New local project", [
          el(
            "form",
            {
              class: "field-row",
              onSubmit: async (event) => {
                event.preventDefault();
                await actions.createProject(nameInput.value);
                nameInput.value = "";
              },
            },
            [
              el("div", {}, [el("label", { for: "new-project-name", text: "Name" }), nameInput]),
              el("button", { type: "submit", class: "primary", text: "Create" }),
            ],
          ),
        ]),
        state.projects.length === 0
          ? el("p", { class: "empty-note", text: "No projects in this browser profile yet." })
          : el(
              "ul",
              { class: "record-list" },
              state.projects.map((project) =>
                el("li", {}, [
                  el(
                    "button",
                    {
                      type: "button",
                      class: `record-row${project.id === openId ? " is-selected" : ""}`,
                      onClick: () =>
                        actions.navigate({ name: "project", params: { projectId: project.id } }),
                    },
                    [el("span", { class: "record-name", text: project.name })],
                  ),
                  el("p", {
                    class: "record-meta",
                    text: `Updated ${project.updatedAt.slice(0, 10)} · revision ${project.revision}`,
                  }),
                ]),
              ),
            ),
      ]),
    ];

    const centre = {
      className: "surface-document",
      children: [
        el("h1", { text: open ? open.name : "Projects" }),
        phaseNote(
          "Scene requirements, candidates, comparison and decisions arrive in Phase 3. This mode exercises local persistence and versioned transfer.",
        ),
        state.routeResolution?.status === "unknown-record"
          ? el("p", { text: state.routeResolution.reason })
          : null,
        open
          ? fieldList([
              ["Identifier", open.id],
              ["Production type", open.productionType],
              ["Status", open.status],
              ["Time zone", open.timeZone],
              ["Created", open.createdAt],
              ["Updated", open.updatedAt],
              ["Revision", open.revision],
            ])
          : el("p", {
              text:
                state.projects.length === 0
                  ? "Create a local project to exercise saving, export and import."
                  : "Choose a project to see what is stored for it.",
            }),
        open
          ? el("div", { class: "actions" }, [
              el("button", {
                type: "button",
                class: "primary",
                text: "Export project JSON",
                onClick: async () => {
                  const file = await actions.exportProject(open.id);
                  if (file) downloadText(file.filename, file.text);
                },
              }),
              el("button", {
                type: "button",
                class: "destructive",
                text: "Delete project",
                onClick: () => actions.deleteProject(open.id),
              }),
            ])
          : null,
      ],
    };

    const right = [
      railHead("Workspace"),
      el("div", { class: "rail-body" }, [
        section("Transfer", [
          el("label", { for: "import-project", text: "Import project JSON" }),
          importInput,
          el("p", {
            class: "empty-note",
            text: "A file is validated in full before anything is written. An identifier that already exists asks how to resolve it.",
          }),
        ]),
        section("Storage", [
          el("p", {
            class: "empty-note",
            text: "Projects are stored in this browser profile only. They are not a backup and are not shared between devices.",
          }),
        ]),
        section("This session", [fieldList(describeCapabilities(state.capabilities))]),
      ]),
    ];

    return { left, centre, right };
  }

  /**
   * Immersive, in the approved three-pane shape: records on the left, the
   * viewer surface in the centre, capture detail on the right.
   *
   * The centre holds the provider's own viewer. Everything the application
   * knows about the place sits beside it rather than over it, because the
   * viewer is what is being read and an overlay would cover the thing the
   * person came to look at.
   */
  function immersiveMode(state) {
    const view = state.routeResolution?.view ?? null;
    const { catalog } = state;

    const left = [
      railHead("Captured locations", catalog ? catalog.captures.filter((c) => c.state === "current").length : null),
      el("div", { class: "rail-body" }, immersiveRecordList(state)),
    ];

    if (!state.route?.params?.locationId) {
      return {
        left,
        centre: {
          className: "surface-empty",
          children: [
            el("h1", { text: "Immersive" }),
            el("p", { text: "Choose a captured location to open the capture the provider holds for it." }),
            phaseNote("Bookmarks, saved viewpoints and the scene handoff arrive in Phase 2."),
          ],
        },
        right: null,
      };
    }
    if (!view) return { left, centre: notFoundSurface(state), right: null };

    const { location, capture } = view;
    const captured = location.captureStatus === "current";

    if (!captured || !capture?.url) {
      return {
        left,
        centre: {
          className: "surface-empty",
          children: [
            el("h1", { text: "No capture exists" }),
            el("p", { text: "This location is a future candidate, so there is nothing to open." }),
          ],
        },
        right: immersiveDetail(state, view),
      };
    }

    return {
      left,
      centre: { viewer: true, capture, overlay: viewerOverlay(state, capture) },
      right: immersiveDetail(state, view),
    };
  }

  /**
   * What the application can say about the viewer while it is running.
   *
   * Only shown when there is something to say. A viewer that loaded and
   * answered needs no caption; covering a working model with a banner
   * reporting that it works is noise over the evidence.
   */
  function viewerOverlay(state, capture) {
    const viewer = state.viewer ?? {};
    if (["ready", "loading", "handshaking", "navigating"].includes(viewer.status)) {
      return el("div", { class: "viewer-overlay" }, []);
    }

    const message =
      viewer.status === "unresponsive"
        ? "The viewer did not answer. The capture and requested entry have not been confirmed. Retry or open the supplied entry in a new tab."
        : viewer.error?.message ?? "The capture is not open.";

    return el("div", { class: "viewer-overlay" }, [
      el("div", { class: "viewer-note", role: "status" }, [
        el("p", { text: message }),
        el("button", {
          type: "button",
          text: "Reload supplied entry",
          onClick: () => actions.mountViewer(viewerHost.frame, capture, viewerHost.renewFrame, { force: true }),
        }),
        el("button", {
          type: "button",
          text: "Open the supplied entry in a new tab",
          onClick: () => win.open(capture.url, "_blank", "noopener,noreferrer"),
        }),
      ]),
    ]);
  }

  /** The right rail in Immersive: what is open, and what the viewer reported. */
  function immersiveDetail(state, view) {
    const { location, capture } = view;
    const viewer = state.viewer ?? {};

    return [
      railHead("Capture", capture?.id ?? null),
      el("div", { class: "rail-body" }, [
        section(null, [el("h1", { class: "record-title", text: location.name })]),
        section("Viewer", [
          fieldList([
            ["Connection", viewerStatusLabel(viewer.status)],
            ["Requested sweep", capture?.sweepId],
            ["Sweeps reported", viewer.sweeps ? String(viewer.sweeps.length) : "Not reported"],
          ]),
        ]),
        section("Provider record", [
          fieldList([
            ["Grouping", capture?.grouping],
            ["Experience", capture?.experienceId],
            ["Coverage", capture?.coverageNotes],
            ["Capture date", capture?.captureDate],
            ["Validation", capture?.validationStatus],
          ]),
        ]),
        section(null, [
          el("div", { class: "actions" }, [
            el("button", {
              type: "button",
              text: "Back to the location",
              onClick: () => actions.navigate({ name: "location", params: { locationId: location.id } }),
            }),
          ]),
        ]),
      ]),
    ];
  }

  /** Adapter states, in the words a person reading the rail would use. */
  function viewerStatusLabel(status) {
    switch (status) {
      case "loading":
        return "Loading the capture";
      case "handshaking":
        return "Waiting for the viewer to answer";
      case "ready":
        return "Connected";
      case "navigating":
        return "Moving to the requested entry";
      case "timedOut":
        return "Timed out; entry not confirmed";
      case "unresponsive":
        return "Bridge did not answer; capture unconfirmed";
      case "refused":
        return "Not loaded; experience is outside the approved list";
      case "failed":
        return "The capture did not load";
      default:
        return "Not open";
    }
  }

  /** Captured locations only: a future candidate has nothing to open. */
  function immersiveRecordList(state) {
    const { catalog } = state;
    if (!catalog) return el("p", { class: "empty-note", text: "Loading the location catalog…" });

    const selected = state.route?.params?.locationId ?? null;
    const captured = catalog.locations.filter((l) => l.captureStatus === "current");
    return el(
      "ul",
      { class: "record-list" },
      captured.map((location) =>
        el("li", {}, [
          el(
            "button",
            {
              type: "button",
              class: `record-row${location.id === selected ? " is-selected" : ""}`,
              onClick: () => actions.navigate({ name: "immersive", params: { locationId: location.id } }),
            },
            [
              el("span", { class: "record-id", text: location.id }),
              el("span", { class: "record-name", text: location.name }),
            ],
          ),
        ]),
      ),
    );
  }

  function shotMode(state) {
    return {
      left: null,
      centre: {
        className: "surface-empty",
        children: [
          el("h1", { text: "Shot Designer" }),
          el("p", {
            text: state.route?.params?.shotSceneId
              ? `No design with identifier ${state.route.params.shotSceneId} exists in this browser profile.`
              : "No design has been created yet.",
          }),
          phaseNote(
            "The plan and perspective workspace, cameras, lenses, blocking, paths and the shot list arrive in Phase 4.",
          ),
          el("div", { class: "actions" }, [
            el("button", {
              type: "button",
              class: "primary",
              text: "Go to Projects",
              onClick: () => actions.navigate({ name: "projects" }),
            }),
          ]),
        ],
      },
      right: null,
    };
  }

  // ---- Composition -------------------------------------------------------

  function renderWorkspace() {
    const state = store.getState();
    let parts;

    if (state.route?.name === "not-found") {
      parts = { left: null, centre: notFoundSurface(state), right: null };
    } else if (state.mode === "projects") {
      parts = projectsMode(state);
    } else if (state.mode === "immersive") {
      parts = immersiveMode(state);
    } else if (state.mode === "shot") {
      parts = shotMode(state);
    } else if (state.routeResolution?.status === "unknown-record") {
      parts = { ...exploreMode(state), centre: notFoundSurface(state) };
    } else {
      parts = exploreMode(state);
    }

    replaceChildren(railLeft, parts.left ?? []);
    replaceChildren(railRight, parts.right ?? []);

    const wantsMap = parts.centre?.map === true;
    const wantsViewer = parts.centre?.viewer === true;
    const floats = wantsMap || wantsViewer;
    mapHost.hidden = !wantsMap;
    viewerHost.element.hidden = !wantsViewer;
    surfaceContent.className = floats
      ? "surface-content surface-overlay"
      : `surface-content ${parts.centre?.className ?? ""}`.trim();
    replaceChildren(
      surfaceContent,
      floats ? [parts.centre.overlay] : (parts.centre?.children ?? []),
    );

    workspace.setAttribute("data-rails", parts.right ? "both" : parts.left ? "left" : "none");
    renderBreadcrumb(state);

    // Each provider surface is created only once its host is showing, and
    // released as soon as a mode that does not use it takes the surface. A
    // viewer left running holds a rendering context and keeps streaming.
    if (wantsMap) void actions.mountMap(mapHost);
    else actions.unmountMap();

    if (wantsViewer) actions.mountViewer(viewerHost.frame, parts.centre.capture, viewerHost.renewFrame);
    else actions.unmountViewer();
  }

  function emergencyExport() {
    const file = actions.exportEmergency("Requested from the save-status surface.");
    if (file) downloadText(file.filename, file.text);
    else actions.notice("No project is open, so there is nothing to export.");
  }

  // ---- Wiring ------------------------------------------------------------

  const unsubscribes = [
    store.subscribe((state) => state.mode, renderModes, { immediate: true }),
    store.subscribe((state) => state.route, renderWorkspace),
    store.subscribe((state) => state.routeResolution, renderWorkspace),
    store.subscribe((state) => state.catalog, renderWorkspace),
    store.subscribe((state) => state.catalogError, renderWorkspace),
    store.subscribe((state) => state.projects, renderWorkspace),
    store.subscribe((state) => state.workingBundle, renderWorkspace),
    store.subscribe((state) => state.imagery, renderWorkspace),
    store.subscribe((state) => state.tiles, renderWorkspace),
    store.subscribe((state) => state.map, renderWorkspace),
    store.subscribe((state) => state.viewer, renderWorkspace),
    // The veil follows the adapter directly rather than the rendered tree, so
    // a redraw caused by something else never restarts the wait.
    store.subscribe((state) => state.viewer?.status, (status) => viewerHost.setAdapterState(status), {
      immediate: true,
    }),
    store.subscribe((state) => state.save, renderSave, { immediate: true }),
    store.subscribe((state) => state.storage, renderStatusStrip),
    store.subscribe((state) => state.notice, renderStatusStrip),
    store.subscribe((state) => state.error, renderStatusStrip),
    store.subscribe((state) => state.pendingImport, renderDialog),
  ];

  renderWorkspace();
  renderStatusStrip();

  return {
    destroy() {
      for (const unsubscribe of unsubscribes) unsubscribe();
      viewerHost.dispose();
      root.replaceChildren();
    },
  };
}
