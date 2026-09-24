import { hasDrafts, flushDrafts } from "../scouting/autosave.js";
/**
 * Every state mutation in the application.
 *
 * Views and adapters call these; nothing else writes to the store. Keeping the
 * writes in one file is what makes it possible to say where a value came from
 * when two surfaces disagree.
 *
 * Each action also keeps the in-memory working bundle in step with storage.
 * That bundle is what emergency export serialises, so a project remains
 * recoverable even when no write has ever succeeded.
 */

import { createProject as newProjectRecord } from "../domain/project.js";
import { newId } from "../domain/ids.js";
import { APP_VERSION } from "../domain/versions.js";
import { loadCatalog, locationView } from "../data/catalog-repo.js";
import {
  buildEnvelope,
  selectAssessmentExport,
  serializeEnvelope,
  parseEnvelope,
  describeEnvelope,
  importEnvelope,
  catalogVersionNote,
} from "../data/transfer.js";
import { emptyBundle, bundleProject, validateRecord, projectDeletionSummary } from "../data/workspace-repo.js";
import { createSceneBrief } from "../domain/scene-brief.js";
import { createCandidate, reviseCandidate } from "../domain/candidate.js";
import { detectConflicts } from "../data/conflicts.js";
import { buildEmergencyExport, projectExportFilename } from "../exports/emergency.js";
import { presentError } from "./errors.js";
import { createScoutingActions } from "../scouting/actions.js";
import { routeMode } from "./router.js";
import { createMapAdapter } from "../map/maplibre-adapter.js";
import { accuracyNote } from "../map/region-config.js";
import { createTreedisAdapter } from "../immersive/treedis-adapter.js";
import { captureAtOrigin, allowedOrigins } from "../immersive/origins.js";
import { createEntryBookmark, bookmarkRestoration } from "../immersive/bookmarks.js";

/**
 * Resolves the vendored map library.
 *
 * It is loaded as a classic script before the application module, so it is a
 * global rather than an import. An absent global means the script did not
 * load, which is reported and survivable rather than fatal.
 */
async function defaultMapLibrary() {
  const library = globalThis.maplibregl;
  if (!library) throw new Error("the vendored map library did not load");
  return library;
}

/**
 * Viewer state before anything is open.
 *
 * `capabilities` stays null until a viewer has actually run, because an
 * unknown capability and an absent viewer are different things and the
 * interface must not present the second as the first.
 */
function idleViewer() {
  return {
    status: "idle",
    captureId: null,
    locationId: null,
    sweepId: null,
    sweeps: null,
    capabilities: null,
    error: null,
  };
}

/** State before anything has been loaded. */
export function initialState(capabilities) {
  return {
    boot: "starting",
    route: null,
    mode: "explore",
    routeResolution: null,
    catalog: null,
    catalogError: null,
    recentLocations: [],
    capabilities,
    storage: { available: false, initializing: true, error: null },
    projects: [],
    openProjectId: null,
    activeSceneId: null,
    activeCandidateId: null,
    activeAssessmentId: null,
    comparisonScroll: {},
    workingBundle: null,
    save: { state: "idle", label: "Local workspace", lastSavedAt: null, error: null, canRetry: false },
    pendingImport: null,
    pendingDeletion: null,
    error: null,
    notice: null,
    bookmarkStatus: null,
    // Set once the map has been mounted; null means it has not been tried.
    map: { status: "idle", error: null },
    imagery: null,
    viewer: idleViewer(),
  };
}

/**
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.repo Workspace repository, or null when storage is unusable.
 * @param {object} deps.saveStatus
 * @param {object} deps.router
 * @param {(path: string) => Promise<unknown>} deps.fetchJson
 * @param {object} [deps.region] Region configuration already read during boot.
 * @param {() => Promise<object>} [deps.loadMapLibrary] Resolves the map library.
 * @param {{forceImageryFailure?: boolean}} [deps.diagnostics]
 * @param {object} [deps.viewerWindow] Message and timer source for the immersive viewer.
 * @param {() => string} [deps.now] ISO timestamp source.
 * @param {string} [deps.timeZone] Region time zone for new projects.
 */
export function createActions({
  store,
  repo,
  saveStatus,
  router,
  fetchJson,
  region = null,
  loadMapLibrary = defaultMapLibrary,
  diagnostics = {},
  disableStorageFailure = null,
  viewerWindow = globalThis,
  now = () => new Date().toISOString(),
  timeZone = "America/Chicago",
}) {
  const { getState, setState } = store;

  function setError(failure) {
    setState({ error: failure ? presentError(failure) : null });
  }

  function notice(message) {
    setState({ notice: message ?? null });
  }

  /** Loads the catalog as a unit. A failure publishes no records at all. */
  async function initializeCatalog() {
    setState({ catalogError: null });
    const result = await loadCatalog({ fetchJson, region });
    if (!result.ok) {
      setState({ catalog: null, catalogError: presentError(result.error), boot: "degraded" });
      return result;
    }
    setState({ catalog: result.catalog, catalogError: null });
    resolveRoute(getState().route);
    drawLocationMarkers();
    return result;
  }

  /** Opens storage and records this session. Never blocks the interface. */
  let storageInitialization = null;
  function initializeStorage(catalogVersion = "unknown") {
    storageInitialization ??= openStorage(catalogVersion);
    return storageInitialization;
  }

  async function openStorage(catalogVersion) {
    if (!repo) {
      setState({
        storage: {
          available: false, initializing: false,
          error: presentError({
            code: "idb-unavailable",
            message: "IndexedDB is not available in this browser profile.",
          }),
        },
      });
      return { ok: false };
    }
    try {
      await repo.open();
      await repo.recordSession({ catalogVersion, appVersion: APP_VERSION, openedAt: now() });
      setState({ storage: { available: true, initializing: false, error: null } });
      await refreshProjects();
      const routeProjectId = getState().route?.params?.projectId;
      if (routeProjectId) await openProject(routeProjectId);
      const context = await repo.getMeta("workspaceContext");
      if (!getState().route?.params?.projectId && context?.projectId
          && getState().projects.some(project => project.id === context.projectId)) {
        await openProject(context.projectId);
        selectScene(context.sceneId, { remember: false });
        const candidate = getState().workingBundle?.candidates.find(c => c.id === context.candidateId && c.sceneId === context.sceneId);
        if (candidate) setState({ activeCandidateId: candidate.id });
        setState({ comparisonScroll: context.comparisonScroll ?? {}, activeAssessmentId: getState().workingBundle?.scoutAssessments.some(a=>a.id===context.assessmentId) ? context.assessmentId : null });
        rememberWorkspace();
      }
      return { ok: true };
    } catch (caught) {
      setState({ storage: { available: false, initializing: false, error: presentError(caught) } });
      return { ok: false, error: caught };
    }
  }

  async function refreshProjects() {
    if (!getState().storage.available) return;
    try {
      setState({ projects: await repo.listProjects() });
      // A project route opened directly resolves before storage is ready, so
      // it is resolved again once the list exists. Without this, a shared
      // project link would stay on the not-found state for a project that is
      // in fact present.
      resolveRoute(getState().route);
    } catch (caught) {
      setError(caught);
    }
  }

  /**
   * Resolves the record IDs a route names.
   *
   * An unknown ID is a recoverable state with an explanation, not an error
   * page: shared links go stale, and the rest of the application still works.
   */
  function resolveRoute(route) {
    if (!route) return;
    const { catalog } = getState();

    if (route.name === "not-found") {
      setState({
        routeResolution: {
          status: "not-found",
          reason: `No route matches ${route.raw ? `"${route.raw}"` : "that address"}.`,
        },
      });
      return;
    }

    const locationId = route.params?.locationId;
    if (locationId) {
      if (!catalog) {
        setState({ routeResolution: { status: "pending", reason: "The catalog is still loading." } });
        return;
      }
      const view = locationView(catalog, locationId);
      if (!view) {
        setState({
          routeResolution: {
            status: "unknown-record",
            reason: `No location in catalog ${catalog.version} has the identifier ${locationId}.`,
          },
        });
        return;
      }
      setState({ routeResolution: { status: "ok", locationId, view },
        recentLocations: [locationId, ...(getState().recentLocations ?? []).filter(id => id !== locationId)].slice(0, 18) });
      drawLocationMarkers();
      mapAdapter?.setSelectedLocation(locationId);
      return;
    }

    const projectId = route.params?.projectId;
    if (projectId) {
      const project = getState().projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        setState({
          routeResolution: {
            status: "unknown-record",
            reason: `No project in this browser profile has the identifier ${projectId}.`,
          },
        });
        return;
      }
      setState({ routeResolution: { status: "ok", projectId } });
      return;
    }

    setState({ routeResolution: { status: "ok" } });
    drawLocationMarkers();
  }

  /** Applies a route that the router has already parsed. */
  function applyRoute(route) {
    if (hasDrafts()) { void flushDrafts().then(() => applyRoute(route)); return; }
    setState({ route, mode: routeMode(route), error: null, notice: null });
    resolveRoute(route);
    const projectId = route.params?.projectId ?? null;
    if (projectId && projectId !== getState().openProjectId) {
      void openProject(projectId);
    } else if (projectId && route.params?.sceneId !== undefined
        && route.params.sceneId !== getState().activeSceneId) {
      selectScene(route.params.sceneId);
    }
  }

  function navigate(route) {
    if (hasDrafts()) { void flushDrafts().then(() => navigate(route)); return; }
    if (route.name === "location") setState({ exploreSelectionRequest: { locationId: route.params?.locationId } });
    router.navigate(route);
    if (route.name === "location" && route.params?.locationId) {
      mapAdapter?.focusLocation(route.params.locationId);
    }
  }

  async function createProject(name) {
    await flushDrafts();
    await initializeStorage();
    if (["failed", "saving"].includes(getState().save.state) && getState().workingBundle) {
      notice("Retry the pending save before creating another project, or keep an emergency JSON copy before reloading.");
      return null;
    }
    projectLoadGeneration++;
    const project = newProjectRecord({
      id: newId("project"),
      name: name?.trim() || "Untitled production",
      timeZone,
      now: now(),
    });

    const bundle = emptyBundle();
    bundle.projects = [project];
    setState({
      projects: [project, ...getState().projects],
      openProjectId: project.id,
      workingBundle: bundle,
      activeSceneId: null, activeCandidateId: null,
    });

    await persist(() => repo.saveRecord("projects", project));
    rememberWorkspace();
    navigate({ name: "project", params: { projectId: project.id } });
    return project;
  }

  let projectLoadGeneration = 0;
  async function openProject(projectId) {
    if (hasDrafts()) await flushDrafts();
    const generation = ++projectLoadGeneration;
    if (getState().workingBundle?.projects[0]?.id === projectId) {
      setState({ openProjectId: projectId });
      return getState().workingBundle;
    }
    if (["failed", "saving"].includes(getState().save.state) && getState().workingBundle) {
      notice("Save or export the open project's changes before switching projects.");
      return null;
    }
    setState({ openProjectId: projectId });
    if (!getState().storage.available) return null;
    try {
      const bundle = await repo.loadProjectBundle(projectId);
      if (generation !== projectLoadGeneration) return null;
      const routeScene = getState().route?.params?.sceneId;
      setState({ workingBundle: bundle, activeAssessmentId: null, activeSceneId: bundle?.scenes.some(s => s.id === routeScene) ? routeScene : null, activeCandidateId: null });
      rememberWorkspace();
      return bundle;
    } catch (caught) {
      if (generation !== projectLoadGeneration) return null;
      setError(caught);
      return null;
    }
  }

  function workspaceWritable() {
    if (["saving", "failed"].includes(getState().save.state)) {
      notice("Finish or retry the pending save before changing other workspace records.");
      return false;
    }
    return true;
  }

  let contextWrite = Promise.resolve();
  function rememberWorkspace() {
    const state = getState();
    if (!state.storage.available) return;
    const context = { projectId: state.openProjectId, sceneId: state.activeSceneId, candidateId: state.activeCandidateId, assessmentId: state.activeAssessmentId, comparisonScroll: state.comparisonScroll };
    contextWrite = contextWrite.then(() => repo.setMeta("workspaceContext", context)).catch(() => {
      notice("The workspace selection could not be remembered for reload. Project records are unaffected.");
    });
  }

  function selectScene(sceneId, { remember = true } = {}) {
    const bundle = getState().workingBundle;
    const scene = bundle?.scenes.find(s => s.id === sceneId);
    setState({ activeSceneId: scene?.id ?? null, activeCandidateId: null });
    if (remember) rememberWorkspace();
    return Boolean(scene);
  }

  async function addLocationCandidate(sceneId, locationId) {
    if (!workspaceWritable()) return { ok: false };
    const state = getState(), bundle = state.workingBundle, project = bundleProject(bundle);
    const scene = bundle?.scenes.find(s => s.id === sceneId);
    const location = state.catalog?.locations.find(l => l.id === locationId);
    if (!project || project.id !== state.openProjectId || !scene || !location) {
      notice("Choose a project, a scene and a catalog location first."); return { ok: false };
    }
    const existing = bundle.candidates.find(c => c.sceneId === sceneId && c.locationId === locationId);
    if (existing) { selectCandidate(existing.id); return { ok: true, candidate: existing, created: false }; }
    const candidate = createCandidate({ id: newId("candidate"), projectId: project.id, scene, location,
      capture: state.catalog.captures.find(c => c.locationId === locationId), catalogVersion: state.catalog.version, now: now() });
    if (recordProblem("candidates", candidate)) return { ok: false };
    setState({ workingBundle: { ...bundle, candidates: [...bundle.candidates, candidate] }, activeSceneId: sceneId, activeCandidateId: candidate.id });
    const result = await persist(async () => {
      const saved = await repo.addCandidate(candidate);
      if (bundleProject(getState().workingBundle)?.id === project.id) {
        const current = getState().workingBundle;
        setState({ workingBundle: { ...current, candidates: [...current.candidates.filter(c => c.id !== candidate.id && c.id !== saved.candidate.id), saved.candidate] },
          ...(getState().activeCandidateId === candidate.id ? { activeCandidateId: saved.candidate.id } : {}) });
        rememberWorkspace();
      }
      return saved;
    });
    rememberWorkspace();
    return { ...result, candidate: result.result?.candidate ?? candidate, created: result.result?.created ?? false };
  }

  function selectCandidate(candidateId, destination = null) {
    const bundle = getState().workingBundle;
    const candidate = bundle?.candidates.find(c => c.id === candidateId);
    if (!candidate || bundleProject(bundle)?.id !== getState().openProjectId) return false;
    setState({ activeSceneId: candidate.sceneId, activeCandidateId: candidate.id, checklistLocationRequest: { locationId: candidate.locationId } });
    rememberWorkspace();
    if (destination === "immersive" || destination === "location") navigate({ name: destination, params: { locationId: candidate.locationId } });
    else if (destination === "project") navigate({ name: "project-scene", params: { projectId: candidate.projectId, sceneId: candidate.sceneId } });
    return true;
  }

  async function updateCandidate(candidateId, fields) {
    if (!workspaceWritable()) return { ok: false };
    const state = getState(), bundle = state.workingBundle;
    const previous = bundle?.candidates.find(c => c.id === candidateId);
    if (!previous || previous.projectId !== state.openProjectId
        || Object.keys(fields).some(key => !["status", "rationale", "strengths", "concerns", "missingInfo"].includes(key))) return { ok: false };
    let candidate;
    try { candidate = reviseCandidate(previous, fields, now()); }
    catch (error) { notice(error.message); return { ok: false }; }
    if (recordProblem("candidates", candidate)) return { ok: false };
    setState({ workingBundle: { ...bundle, candidates: bundle.candidates.map(c => c.id === candidateId ? candidate : c) } });
    return persist(() => saveWorkspaceRecord("candidates", candidate));
  }

  function recordProblem(storeName, record) {
    const result = validateRecord(storeName, record);
    if (!result.ok) notice(result.errors.map(error => `${error.path}: ${error.reason}`).join(" "));
    return !result.ok;
  }

  async function saveWorkspaceRecord(storeName, record) {
    const result = await repo.saveRecord(storeName, record);
    if (!result.written) throw new Error("A newer revision is already stored. Export your in-memory changes before reloading to review it.");
    return result;
  }

  async function updateProject(projectId, fields) {
    if (!workspaceWritable()) return { ok: false };
    const bundle = getState().workingBundle;
    const previous = bundleProject(bundle);
    if (previous?.id !== projectId || projectId !== getState().openProjectId) return { ok: false };
    const allowed = ["name", "productionType", "description", "status"];
    if (Object.keys(fields).some(key => !allowed.includes(key))) return { ok: false };
    const project = { ...previous, ...fields, name: (fields.name ?? previous.name).trim(), updatedAt: now(), revision: previous.revision + 1 };
    if (recordProblem("projects", project)) return { ok: false };
    setState({ workingBundle: { ...bundle, projects: [project] },
      projects: getState().projects.map(p => p.id === projectId ? project : p) });
    return persist(() => saveWorkspaceRecord("projects", project));
  }

  async function requestProjectDeletion(projectId) {
    await flushDrafts();
    if (!workspaceWritable() || !getState().storage.available) return { ok: false };
    try {
      const bundle = await repo.loadProjectBundle(projectId);
      const summary = projectDeletionSummary(bundle);
      if (!summary) return { ok: false };
      setState({ pendingDeletion: summary });
      return { ok: true, summary };
    } catch (caught) { setError(caught); return { ok: false }; }
  }

  async function deleteProject(projectId) {
    const pending = getState().pendingDeletion;
    if (!pending || pending.projectId !== projectId || !workspaceWritable()) return { ok: false };
    return persist(async () => {
      if (getState().pendingDeletion !== pending) throw new Error("Deletion review was cancelled.");
      const result = await repo.deleteProject(projectId, { expectedToken: pending.token });
      projectLoadGeneration++;
      setState({ pendingDeletion: null,
        projects: getState().projects.filter(project => project.id !== projectId),
        ...(getState().openProjectId === projectId ? { activeSceneId: null, activeCandidateId: null } : {}),
        openProjectId: getState().openProjectId === projectId ? null : getState().openProjectId,
        workingBundle: bundleProject(getState().workingBundle)?.id === projectId ? null : getState().workingBundle });
      rememberWorkspace();
      navigate({ name: "projects" });
      return result;
    });
  }

  async function saveScene(fields, sceneId = null) {
    if (!workspaceWritable()) return { ok: false };
    const bundle = getState().workingBundle, project = bundleProject(bundle);
    if (!project || project.id !== getState().openProjectId) return { ok: false };
    const old = bundle.scenes.find(scene => scene.id === sceneId);
    if (sceneId && !old) return { ok: false };
    // Identity, timestamps and ordering belong to the action, never form data.
    const forbidden = ["id", "projectId", "createdAt", "updatedAt", "revision", "order", "decisions"];
    if (Object.keys(fields).some(key => forbidden.includes(key))) return { ok: false };
    const scene = old ? { ...old, ...fields, updatedAt: now(), revision: old.revision + 1 }
      : createSceneBrief({ id: newId("scene"), projectId: project.id, now: now(),
        order: Math.max(-1, ...bundle.scenes.map((s, i) => s.order ?? i)) + 1, fields });
    if (recordProblem("scenes", scene)) return { ok: false };
    setState({ workingBundle: { ...bundle, scenes: old ? bundle.scenes.map(s => s.id === scene.id ? scene : s) : [...bundle.scenes, scene] } });
    const result = await persist(() => saveWorkspaceRecord("scenes", scene));
    return { ...result, scene };
  }

  async function removeScene(sceneId) {
    if (!workspaceWritable()) return { ok: false };
    const bundle = getState().workingBundle, project = bundleProject(bundle);
    if (!project || !bundle.scenes.some(s => s.id === sceneId)) return { ok: false };
    return persist(async () => {
      const result = await repo.deleteScene(project.id, sceneId);
      if (bundleProject(getState().workingBundle)?.id === project.id) {
        setState({ workingBundle: { ...getState().workingBundle, scenes: getState().workingBundle.scenes.filter(s => s.id !== sceneId) } });
        if (getState().activeSceneId === sceneId) selectScene(null);
      }
      return result;
    });
  }

  async function moveScene(sceneId, direction) {
    if (!workspaceWritable() || ![-1, 1].includes(direction)) return { ok: false };
    const bundle = getState().workingBundle, project = bundleProject(bundle);
    if (!project) return { ok: false };
    const scenes = [...bundle.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const index = scenes.findIndex(scene => scene.id === sceneId), target = index + direction;
    if (index < 0 || target < 0 || target >= scenes.length) return { ok: false };
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    return persist(async () => {
      const ordered = await repo.reorderScenes(project.id, scenes.map(scene => scene.id), now());
      if (bundleProject(getState().workingBundle)?.id === project.id) setState({ workingBundle: { ...getState().workingBundle, scenes: ordered } });
      return ordered;
    });
  }

  /**
   * Runs a write through the save-status surface.
   *
   * A failure is reported and kept retryable; it never discards the in-memory
   * records, which are still the user's work.
   */
  async function persist(operation) {
    if (!getState().storage.available) {
      const status = saveStatus.fail({
        code: "idb-unavailable",
        message: "Local storage is unavailable, so this change was not saved.",
      });
      setState({ save: status });
      return { ok: false };
    }
    const result = await saveStatus.track(operation);
    setState({ save: saveStatus.status });
    if (!result.ok) setError(result.error);
    else await refreshProjects();
    return result;
  }

  async function stopStorageFailureTest() {
    try {
      if (!disableStorageFailure) throw new Error("Storage-test recovery is unavailable in this session.");
      disableStorageFailure();
      setState({ storageSimulation: false, notice: null });
      const result = getState().save.canRetry ? await retrySave() : { ok: true };
      if (result.ok) rememberWorkspace();
      return result;
    } catch (error) { setError(error); return { ok: false }; }
  }

  async function retrySave() {
    const result = await saveStatus.retry();
    setState({ save: saveStatus.status });
    if (result.ok) {
      setError(null);
      await refreshProjects();
    }
    return result;
  }

  /** Builds the export file for a project, reading storage when it is available. */
  async function exportProject(projectId, selection = null) {
    await flushDrafts();
    const state = getState();
    let bundle = state.workingBundle;
    if (state.storage.available && !(bundle?.projects[0]?.id === projectId && ["saving", "failed"].includes(state.save.state))) {
      try {
        bundle = (await repo.loadProjectBundle(projectId)) ?? bundle;
      } catch (caught) {
        setError(caught);
      }
    }
    if (!bundle) return null;

    if (selection) { try { bundle = selectAssessmentExport(bundle, selection.assessmentIds, selection.includeMedia, selection.mediaIds); } catch (error) { notice(error.message); return null; } }
    const exportedAt = now();
    const envelope = buildEnvelope({
      bundle,
      catalogVersion: state.catalog?.version ?? "unknown",
      exportedAt,
    });
    return {
      filename: projectExportFilename(bundleProject(bundle), exportedAt),
      text: serializeEnvelope(envelope),
    };
  }

  /** Serialises the open project from memory without touching storage. */
  function exportEmergency(reason = "") {
    const state = getState();
    if (!state.workingBundle) return null;
    return buildEmergencyExport({
      bundle: state.workingBundle,
      catalogVersion: state.catalog?.version ?? "unknown",
      exportedAt: now(),
      reason,
    });
  }

  /**
   * Validates an exported file and either imports it or asks how to resolve an
   * ID conflict. Nothing is written until the whole file has passed.
   */
  async function importFile(text) {
    await flushDrafts();
    const parsed = parseEnvelope(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return parsed;
    }
    if (["failed", "saving"].includes(getState().save.state) && getState().workingBundle) {
      notice("Retry the pending save before importing, or keep an emergency JSON copy before reloading.");
      return { ok: false };
    }
    const catalog = getState().catalog;
    for (const bookmark of parsed.envelope.payload.bookmarks) {
      const capture = catalog?.captures.find(c => c.id === bookmark.captureId);
      if (bookmark.catalogVersion === catalog?.version && capture
          && (capture.locationId !== bookmark.locationId || capture.experienceId !== bookmark.experienceId
            || capture.sweepId !== bookmark.sweepId)) {
        setError({ code: "bookmark-context", message: "Bookmark identity disagrees with its declared catalog version. Nothing was imported." });
        return { ok: false };
      }
    }
    if (!getState().storage.available) {
      setError({
        code: "idb-unavailable",
        message: "Local storage is unavailable, so an import cannot be saved.",
      });
      return { ok: false };
    }

    const existing = await repo.existingProjectIds();
    const conflict = detectConflicts(parsed.envelope.payload, existing);
    const summary = describeEnvelope(parsed.envelope);

    if (conflict.hasConflict) {
      setState({
        pendingImport: {
          envelope: parsed.envelope,
          summary,
          conflict,
          catalogNote: catalogVersionNote(parsed.envelope, getState().catalog?.version),
        },
      });
      return { ok: true, conflict: true };
    }
    return completeImport(parsed.envelope, null);
  }

  async function completeImport(envelope, resolution) {
    const result = await importEnvelope({
      repo,
      envelope,
      resolution,
      currentCatalogVersion: getState().catalog?.version,
    });
    setState({ pendingImport: null });

    if (!result.ok) {
      setError(result.error);
      return result;
    }
    if (result.outcome === "cancelled") {
      notice("Import cancelled. Nothing was changed.");
      return result;
    }

    await refreshProjects();
    if (result.projectId) {
      setState({ workingBundle: null });
      await openProject(result.projectId);
    }
    notice(
      [`Imported ${result.written} record(s).`, result.catalogNote].filter(Boolean).join(" "),
    );
    if (result.projectId) navigate({ name: "project", params: { projectId: result.projectId } });
    return result;
  }

  /** Resolves a pending ID conflict with the user's explicit choice. */
  async function resolveImport(resolution) {
    const pending = getState().pendingImport;
    if (!pending) return { ok: false };
    return completeImport(pending.envelope, resolution);
  }

  function cancelImport() {
    setState({ pendingImport: null });
    notice("Import cancelled. Nothing was changed.");
  }

  let bookmarkWritePending = false;
  let pendingBookmarkCapture = null;
  async function saveEntryBookmark({ name, note, locationId, candidateId } = {}) {
    if (bookmarkWritePending) return { ok: false };
    const state = getState();
    if (["failed", "saving"].includes(state.save.state)) {
      setState({ bookmarkStatus: "Retry the pending save before saving another bookmark. Emergency JSON retains unsaved work." });
      return { ok: false };
    }
    const bundle = state.workingBundle;
    const project = bundle?.projects?.[0];
    const capture = state.catalog?.captures.find(c => c.locationId === locationId && c.state === "current");
    const candidate = bundle?.candidates?.find(c => c.id === candidateId);
    if (!project || project.id !== state.openProjectId || (candidateId && !candidate)) {
      const message = "Choose a loaded project and compatible candidate before saving.";
      setState({ bookmarkStatus: message }); return { ok: false, message };
    }
    const result = createEntryBookmark({ id: newId("bookmark"), project, candidate,
      catalog: state.catalog, capture, name, note, now: now() });
    if (!result.ok) { setState({ bookmarkStatus: result.message }); return result; }
    bookmarkWritePending = true;
    const next = { ...bundle, bookmarks: [...bundle.bookmarks, result.bookmark] };
    setState({ workingBundle: next, bookmarkStatus: "Saving entry bookmark…" });
    try {
      const saved = await persist(() => repo.saveRecord("bookmarks", result.bookmark));
      setState({ bookmarkStatus: saved.ok ? "Entry bookmark saved locally. Exact camera angle is not saved."
        : "Bookmark retained in memory. Save failed; use Retry save or emergency JSON before leaving." });
      return { ...saved, bookmark: result.bookmark };
    } finally { bookmarkWritePending = false; }
  }

  function restoreBookmark(bookmarkId) {
    const state = getState(), bundle = state.workingBundle;
    const bookmark = bundle?.bookmarks.find(b => b.id === bookmarkId);
    const result = bookmarkRestoration(bookmark, bundle, state.catalog);
    if (!result.ok) { setState({ bookmarkStatus: result.message }); return result; }
    pendingBookmarkCapture = result.capture.id;
    navigate({ name: "immersive", params: { locationId: bookmark.locationId } });
    setState({ bookmarkStatus: `Entry restore requested. ${result.message}` });
    return result;
  }

  // ---- Map ---------------------------------------------------------------

  let mapAdapter = null;
  let exploreCamera = null;
  /**
   * idle, mounting, mounted or failed.
   *
   * Mounting is triggered from a render, and it writes state, which causes
   * another render. Without a state of its own the second render would start a
   * second mount, and a failed mount would be retried forever. The status in
   * the store is for the interface; this is the guard.
   */
  let mapMountState = "idle";
  // The reference's js/16-google-tiles.js guards every awaited activation step.
  let mapGeneration = 0;

  /**
   * Mounts the map into a container that is already in the document.
   *
   * Every failure here is reported and survivable. The list and the dossier do
   * not depend on the map, so a missing library, absent WebGL or a refused
   * imagery service must not take the mode down with them. A failure is not
   * retried on its own; leaving and re-entering the mode tries again.
   */
  async function mountMap(container) {
    if (mapMountState !== "idle" || !region) return mapAdapter;
    mapMountState = "mounting";
    const generation = ++mapGeneration;
    setState({ map: { status: "loading", error: null } });

    let maplibre = null;
    try {
      maplibre = await loadMapLibrary();
    } catch (cause) {
      if (generation !== mapGeneration) return null;
      mapMountState = "failed";
      setState({
        map: {
          status: "unavailable",
          error: {
            code: "map-library-unavailable",
            message: `The map library did not load: ${cause.message}. The location list still works.`,
          },
        },
      });
      return null;
    }

    if (generation !== mapGeneration) return null;
    mapAdapter = createMapAdapter({
      container,
      region,
      maplibre: maplibre.default ?? maplibre,
      webgl: getState().capabilities.webgl,
      runtimeConfig: viewerWindow.SLIVR_RUNTIME ?? null,
      initialCamera: exploreCamera,
      onEvent: handleMapEvent,
    });

    const result = mapAdapter.create();
    if (!result.ok) {
      mapAdapter = null;
      mapMountState = "failed";
      setState({ map: { status: "unavailable", error: result.error } });
      return null;
    }

    mapMountState = "mounted";
    setState({ map: { status: "ready", error: null }, imagery: describeImagery(mapAdapter.imagery) });
    drawLocationMarkers();

    // Exercises the fallback path on demand, for the check that the primary
    // failing leaves equivalent coverage visible with its own year shown.
    if (diagnostics.forceImageryFailure) {
      mapAdapter.forceImageryFailure("imagery failure simulation is enabled for this profile");
    }
    return mapAdapter;
  }

  /**
   * Draws the catalog on the map.
   *
   * Called whenever either half becomes available, because the map and the
   * catalog load independently and either can finish first.
   */
  let exploreLocationIds = null;
  function drawLocationMarkers() {
    const { catalog } = getState();
    if (!mapAdapter || !catalog) return;
    mapAdapter.setLocations(catalog.locations.filter(l => !exploreLocationIds || exploreLocationIds.includes(l.id) || l.id === getState().routeResolution?.locationId), (locationId) =>
      navigate({ name: "location", params: { locationId } }),
    );
    mapAdapter.setSelectedLocation(getState().routeResolution?.locationId ?? null);
  }

  function handleMapEvent(event) {
    if (event.type === "tiles-changed") {
      setState({ tiles: event.status });
      return;
    }
    if (event.type === "imagery-changed") {
      setState({ imagery: describeImagery(event.status) });
      return;
    }
    if (event.type === "unavailable") {
      setState({ map: { status: "unavailable", error: { code: event.code, message: event.message } } });
      return;
    }
    if (event.type === "error") notice(event.message);
  }

  /** The part of imagery status the interface shows. */
  function describeImagery(status) {
    return {
      visible: mapAdapter?.imageryVisible ?? true,
      state: status.state,
      sourceId: status.sourceId,
      year: status.year,
      attribution: status.attribution,
      isFallback: status.isFallback,
      accuracyNote: accuracyNote(region),
      transitions: status.history.length,
    };
  }

  function unmountMap() {
    if (mapMountState === "idle") return;
    mapGeneration++;
    exploreCamera = mapAdapter?.getCamera() ?? exploreCamera;
    mapAdapter?.dispose();
    mapAdapter = null;
    mapMountState = "idle";
    setState({ map: { status: "idle", error: null } });
  }

  // ---- Immersive viewer ---------------------------------------------------

  let viewerAdapter = null;
  /** Guards the same re-entrancy the map mount does: idle, mounting or mounted. */
  let viewerMountState = "idle";
  let mountedCaptureId = null;

  /**
   * Opens a capture in the frame the shell keeps for the viewer.
   *
   * Re-entering the capture that is already open does nothing, because a
   * reload costs the whole model download and throws away wherever the person
   * had walked to. A responsive shared experience navigates in place;
   * independent experiences release the previous session.
   *
   * Every failure is survivable. The record list, the capture detail and the
   * supplied entry URL remain usable whatever the provider does.
   */
  function mountViewer(frame, requested, renewFrame = () => frame, { force = false } = {}) {
    if (!frame || !requested?.url || !region?.immersive) return null;
    if (viewerMountState === "mounting") return viewerAdapter;
    if (pendingBookmarkCapture === requested.id) {
      force = true;
      pendingBookmarkCapture = null;
    }
    if (!force && viewerMountState === "mounted" && mountedCaptureId === requested.id) return viewerAdapter;

    const resolved = resolveCapture(requested);
    const capture = resolved.capture;

    if (!isAllowedExperience(capture.experienceId)) {
      // A URL outside the allowlist is a catalog fault, not a provider one.
      setState({
        viewer: {
          ...idleViewer(),
          status: "refused",
          captureId: capture.id,
          locationId: capture.locationId,
          error: {
            code: "immersive-experience-not-allowed",
            message: `Experience ${capture.experienceId} is not in the approved list, so it was not loaded.`,
          },
        },
      });
      return null;
    }

    const reuse = !force && viewerAdapter?.entry?.experienceId === capture.experienceId &&
      originOf(viewerAdapter.entry.url) === resolved.origin &&
      ["ready", "navigating"].includes(viewerAdapter.state);
    if (!reuse) {
      unmountViewer();
      frame = renewFrame();
    }
    viewerMountState = "mounting";
    mountedCaptureId = capture.id;
    setState({
      viewer: {
        ...idleViewer(),
        status: "loading",
        captureId: capture.id,
        locationId: capture.locationId,
        sweepId: capture.sweepId ?? null,
      },
    });

    if (!reuse) viewerAdapter = createTreedisAdapter({
      // The adapter posts to, and accepts from, exactly the origin the frame
      // was pointed at, which is not always the region's primary host.
      region: { ...region.immersive, origin: resolved.origin },
      win: viewerWindow,
      onEvent: handleViewerEvent,
      now,
    });

    viewerAdapter.attach(frame, capture);
    viewerMountState = "mounted";
    mountedCaptureId = capture.id;
    return viewerAdapter;
  }

  /**
   * Decides which configured host serves this capture.
   *
   * The catalog records the primary host. A diagnostic may select one of the
   * region's other configured hosts instead, to establish whether the two
   * behave the same inside a frame; anything unlisted is ignored and the
   * catalog URL stands.
   */
  function resolveCapture(capture) {
    const wanted = diagnostics.viewerOrigin;
    if (!wanted) return { capture, origin: originOf(capture.url) };

    const moved = captureAtOrigin(capture, wanted, region.immersive);
    if (!moved) {
      notice(
        `The viewer host ${wanted} is not one of the configured hosts ` +
          `(${allowedOrigins(region.immersive).join(", ")}), so the catalog URL was used.`,
      );
      return { capture, origin: originOf(capture.url) };
    }
    return moved;
  }

  function originOf(url) {
    try {
      return new URL(url).origin;
    } catch {
      return region.immersive.origin;
    }
  }

  /** Only the six approved experiences may be loaded into the frame. */
  function isAllowedExperience(experienceId) {
    const allowlist = region?.immersive?.experienceAllowlist ?? [];
    return allowlist.includes(experienceId);
  }

  function handleViewerEvent(event) {
    const current = getState().viewer;
    const next = { ...current, status: viewerStatus(event), capabilities: event.capabilities };

    if (event.type === "sweeps") next.sweeps = event.sweeps ?? null;
    if (event.type === "navigated") next.sweepId = event.sweepId;
    if (event.type === "failed") {
      next.error = { code: "immersive-frame-failed", message: event.reason };
    }
    if (event.type === "load-timeout") {
      next.error = { code: "immersive-load-timeout", message: "The capture did not finish loading. Retry or open the supplied entry in a new tab." };
    }
    if (event.type === "navigation-timeout") {
      next.error = { code: "immersive-navigation-timeout", message: "The viewer did not confirm the requested sweep. Reload the supplied entry to try again." };
    }
    setState({ viewer: next });
  }

  /**
   * The adapter's own state, which the interface shows as-is.
   *
   * A silent bridge does not prove that the tour rendered or reached its entry.
   */
  function viewerStatus(event) {
    return event.state ?? "idle";
  }

  /** Moves to a sweep inside the open experience, when the bridge allows it. */
  function viewerGoToSweep(sweepId) {
    if (!viewerAdapter) return { ok: false, reason: "no viewer is open" };
    const result = viewerAdapter.goToSweep(sweepId);
    if (!result.ok) notice(`The viewer could not be moved: ${result.reason}.`);
    return result;
  }

  function unmountViewer() {
    if (viewerMountState === "idle") return;
    viewerAdapter?.dispose();
    viewerAdapter = null;
    viewerMountState = "idle";
    mountedCaptureId = null;
    setState({ viewer: idleViewer() });
  }

  /** The reconnaissance record for whatever is open, for test 28. */
  function viewerReport() {
    return viewerAdapter?.report() ?? null;
  }

  /** Returns to the primary imagery source after a failure. */
  function retryImagery() {
    if (!mapAdapter) return null;
    const status = mapAdapter.retryImagery();
    setState({ imagery: describeImagery(status) });
    return status;
  }

  function dismissError() {
    setError(null);
  }

  return {
    ...createScoutingActions({ store, repo, persist, now, notice, rememberWorkspace }),
    getWorkspace: () => getState().workingBundle,
    getComparisonScroll: sceneId => getState().comparisonScroll[sceneId] ?? 0,
    setComparisonScroll: (sceneId, value) => { setState({ comparisonScroll: { ...getState().comparisonScroll, [sceneId]: value } }); rememberWorkspace(); },
    initializeCatalog,
    initializeStorage,
    refreshProjects,
    applyRoute,
    resolveRoute,
    navigate,
    createProject,
    openProject,
    deleteProject,
    updateProject,
    requestProjectDeletion,
    cancelProjectDeletion() {
      if (getState().save.state === "saving") return;
      if (getState().pendingDeletion && getState().save.state === "failed") {
        saveStatus.reset(); setState({ save: saveStatus.status, error: null });
      }
      setState({ pendingDeletion: null });
    },
    saveScene,
    removeScene,
    moveScene,
    selectScene,
    selectCandidate,
    addLocationCandidate,
    updateCandidate,
    retrySave,
    stopStorageFailureTest,
    exportProject,
    exportEmergency,
    importFile,
    resolveImport,
    cancelImport,
    dismissError,
    notice,
    mountMap,
    unmountMap,
    retryImagery,
    setExploreLocations(ids) { exploreLocationIds = ids; drawLocationMarkers(); },
    recenterMap: () => mapAdapter?.recenter(),
    mountViewer,
    unmountViewer,
    viewerGoToSweep,
    viewerReport,
    saveEntryBookmark,
    restoreBookmark,
  };
}
