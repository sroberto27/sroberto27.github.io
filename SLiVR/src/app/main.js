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

import { createStore } from "./store.js";
import { createRouter } from "./router.js";
import { createActions, initialState } from "./actions.js";
import { createShell } from "./shell.js";
import { createSaveStatus } from "./save-status.js";
import { detectCapabilities, readDiagnostics } from "./capabilities.js";
import { createHttpFetchJson } from "../data/catalog-repo.js";
import { createWorkspaceRepo, StorageError } from "../data/workspace-repo.js";
import { IDB_ERROR_CODES } from "../data/idb.js";

const REGION_PATH = "data/region/lafayette.region.json";

/**
 * Wraps a repository so every write fails.
 *
 * A quota or transaction failure cannot be produced on demand in a normal
 * profile, and the recovery path it exercises is the one that matters most. The
 * flag is read from a SLiVR-scoped storage key, defaults to off, and is never
 * written by the application.
 */
function withForcedStorageFailure(repo) {
  const fail = () =>
    Promise.reject(
      new StorageError(
        IDB_ERROR_CODES.writeFailed,
        "Storage failure simulation is enabled for this profile.",
      ),
    );
  return {
    ...repo,
    saveRecord: fail,
    writeProjectBundle: fail,
    deleteProject: fail,
    setMeta: fail,
  };
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

  const fetchJson = createHttpFetchJson();
  const saveStatus = createSaveStatus();

  let region = null;
  let repo = null;
  try {
    region = await fetchJson(REGION_PATH);
    if (capabilities.indexedDB) {
      repo = createWorkspaceRepo({ factory: win.indexedDB, storage: region.storage });
      if (diagnostics.forceStorageFailure) repo = withForcedStorageFailure(repo);
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
    viewerWindow: win,
    timeZone: region?.timeZone ?? "America/Chicago",
  });

  createShell({ root, store, actions, region, win });
  router.start();

  const catalog = await actions.initializeCatalog();
  await actions.initializeStorage(catalog.ok ? catalog.catalog.version : "unknown");
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
