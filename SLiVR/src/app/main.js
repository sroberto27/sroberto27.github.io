/**
 * Boot sequence.
 *
 * The order matters. The shell is mounted and the route applied before any
 * network or storage work, so a slow catalog or an unusable database shows a
 * working application explaining itself rather than a blank page.
 *
 * Storage is opened after the region configuration is read, because the
 * database name and version belong to that configuration rather than to this
 * file. A storage failure is reported and the application continues without
 * saving; a catalog failure leaves the catalog empty rather than partial.
 */

import { APP_VERSION } from "../domain/versions.js";
import { createStore } from "./store.js";
import { createRouter } from "./router.js";
import { createActions, initialState } from "./actions.js";
import { createShell } from "./shell.js";
import { createSaveStatus } from "./save-status.js";
import { detectCapabilities, readDiagnostics } from "./capabilities.js";
import { createHttpFetchJson } from "../data/catalog-repo.js";
import { createWorkspaceRepo, StorageError } from "../data/workspace-repo.js";

const REGION_PATH = "data/region/lafayette.region.json";

/** Keep failure injection local and reversible without discarding unsaved memory. */
export function withForcedStorageFailure(repo, win) {
  const wrapped = { ...repo };
  for (const name of ["saveRecord", "saveScouting", "addCandidate", "writeProjectBundle", "deleteProject", "deleteScene", "reorderScenes", "setMeta"]) {
    wrapped[name] = (...args) => readDiagnostics(win).forceStorageFailure
      ? Promise.reject(new StorageError("storage-simulation-enabled", "Save-failure test mode is enabled in this browser. Turn it off and retry to save your work."))
      : repo[name](...args);
  }
  return wrapped;
}

export function disableStorageFailureTest(win) {
  const key = "slivr:diagnostics";
  const raw = win.localStorage.getItem(key);
  const current = raw ? JSON.parse(raw) : {};
  win.localStorage.setItem(key, JSON.stringify({ ...current, forceStorageFailure: false }));
  if (readDiagnostics(win).forceStorageFailure) throw new Error("The save-failure test setting could not be disabled.");
}

export async function boot({ root, win } = {}) {
  win ??= globalThis.window ?? globalThis;
  root ??= win.document?.getElementById("app") ?? globalThis.document?.getElementById("app");
  if (!root) throw new Error("SLiVR could not find its mount point: no element with id \"app\"");

  const capabilities = detectCapabilities({ win, runtimeConfig: win.SLIVR_RUNTIME ?? null });
  const diagnostics = readDiagnostics(win);

  const store = createStore(initialState(capabilities), (error) => {
    console.error("A view failed to update", error);
  });

  store.setState({ storageSimulation: diagnostics.forceStorageFailure });
  const fetchJson = createHttpFetchJson();
  const saveStatus = createSaveStatus();

  let region = null;
  let repo = null;
  try {
    region = await fetchJson(REGION_PATH);
    if (capabilities.indexedDB) {
      repo = createWorkspaceRepo({ factory: win.indexedDB, storage: region.storage });
      repo = withForcedStorageFailure(repo, win);
    }
  } catch (error) {
    // Reported through the catalog load below, which reads the same file.
    console.error("The region configuration could not be read", error);
  }

  const router = createRouter({ window: win, onRoute: (route) => actions.applyRoute(route) });
  const actions = createActions({
    store,
    repo,
    saveStatus,
    router,
    fetchJson,
    region,
    diagnostics,
    disableStorageFailure: () => disableStorageFailureTest(win),
    viewerWindow: win,
    timeZone: region?.timeZone ?? "America/Chicago",
  });

  createShell({ root, store, actions, region, win });
  router.start();

  // Local projects must remain usable while network catalog loading is pending.
  const storageReady = actions.initializeStorage();
  const catalog = await actions.initializeCatalog();
  const storageResult = await storageReady;
  if (storageResult.ok && catalog.ok) {
    try {
      await repo.recordSession({ catalogVersion: catalog.catalog.version, appVersion: APP_VERSION, openedAt: new Date().toISOString() });
    } catch (error) {
      console.warn("Session metadata could not be updated", error);
    }
  }
  store.setState({ boot: catalog.ok ? "ready" : "degraded" });

  return { store, actions, router };
}

// Starts itself only in a real browser. Importing the module elsewhere, as the
// boot smoke check does, must not launch a second application.
if (typeof window !== "undefined" && typeof window.document !== "undefined") {
  const start = () =>
    boot().catch((error) => {
      console.error("SLiVR failed to start", error);
    });
  if (window.document.readyState === "loading") {
    window.document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
