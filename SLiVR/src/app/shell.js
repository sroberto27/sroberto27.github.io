import { createToolWindows } from "../ui/tool-windows.js";
import { createEmbeddedChecklist } from "../scouting/embedded-checklist.js";
import { locationView } from "../data/catalog-repo.js";
import { flushDrafts } from "../scouting/autosave.js";
/** Persistent mode shell; Explore owns a single list/dossier panel. */

import { discoverLocations, discoveryFacts, evidenceState, MISSING, PRACTICAL_FIELDS, publicLocationLink } from "../domain/discovery.js";
import { MODES } from "./router.js";
import { describeCapabilities } from "./capabilities.js";
import { formatAddress } from "../domain/location.js";
import { createFocusTrap } from "../ui/a11y.js";
import { createViewerHost } from "../immersive/viewer-host.js";
import { createImmersiveMap } from "../ui/immersive-map.js";
import { bookmarkRestoration, ENTRY_LIMITATION } from "../immersive/bookmarks.js";
import { workspaceForm, PROJECT_FIELDS, SCENE_FIELDS } from "../scouting/workspace-forms.js";
import { createAssessmentEditor } from "../scouting/assessment-editor.js";
import { comparisonView } from "../scouting/comparison.js";
import { completion } from "../scouting/assessment-template.js";
import { REVIEW_STATUSES } from "../domain/candidate.js";

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
export function createShell({ root, store, actions, region, win = globalThis }) {
  const modeNav = el("nav", { class: "modes", "aria-label": "Workspace modes" });
  const breadcrumb = el("p", { class: "breadcrumb", id: "breadcrumb" });
  const saveChip = el("p", { class: "save-chip", role: "status", "aria-live": "polite" });
  const statusStrip = el("div", { class: "status-strip", role: "status", "aria-live": "polite" });
  const railLeft = el("aside", { class: "rail rail-left", "aria-label": "Records" });
  const surface = el("section", { class: "surface", id: "workspace", tabindex: "-1" });
  const railRight = el("aside", { class: "rail rail-right", "aria-label": "Details" });
  const workspace = el("main", { class: "workspace" }, [railLeft, surface, railRight]);
  const immersiveMap = createImmersiveMap({ doc: document, win, region,
    onSelect: locationId => actions.navigate({ name: "immersive", params: { locationId } }),
    onExplore: locationId => actions.navigate({ name: "location", params: { locationId } }) });
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
  for (const mode of MODES.filter(mode => ["explore", "shot"].includes(mode.id))) {
    const button = el("button", {
      type: "button",
      class: "mode-button",
      "data-mode": mode.id,
      text: mode.label,
      onClick: () => {
        const state = store.getState();
        const locationId = state.routeResolution?.status === "ok"
          ? state.routeResolution.locationId : null;
        let route = mode.route;
        if (locationId && state.mode === "immersive" && mode.id === "explore") {
          route = { name: "location", params: { locationId } };
        } else if (locationId && state.mode === "explore" && mode.id === "immersive") {
          route = { name: "immersive", params: { locationId } };
        } else if (mode.id === "projects" && state.openProjectId) {
          route = state.activeSceneId
            ? { name: "project-scene", params: { projectId: state.openProjectId, sceneId: state.activeSceneId } }
            : { name: "project", params: { projectId: state.openProjectId } };
        }
        modeNav.classList.remove("is-open");
        actions.navigate(route);
      },
    });
    modeButtons.set(mode.id, button);
    modeNav.append(button);
  }

  const projectMenus = el("div", { class: "project-menus", "aria-label": "Project and scene tools" });
  root.append(
    el("header", { class: "topbar" }, [
      el("div", { class: "brand" }, [
        el("span", { class: "brand-name", text: "SLiVR" }),
        el("span", { class: "brand-sub", text: "Location scouting and shot design" }),
      ]),
      modeNav, projectMenus,
      el("button", {class:"mobile-context-button", text:"Project / scene", onClick:()=>{modeNav.classList.remove("is-open");projectMenus.classList.toggle("is-open");}}),
      el("button", {class:"mobile-menu-button", text:"Menu", onClick:()=>{projectMenus.classList.remove("is-open");modeNav.classList.toggle("is-open");}}),
      el("div", { class: "topbar-context" }, [breadcrumb, saveChip]),
    ]),
    statusStrip,
    workspace,
    dialogRegion,
  );

  // Retain the browse DOM, including scroll and input state, while reading a dossier.
  let browseScroll = 0, sheetScroll = 0;
  let searchTimer = null, refreshBrowse = null;
  let browse = null, browseCatalog = null, dossier = null, dossierView = null;
  let collapsed = false, expanded = false, lastLocation = null, menuTrap = null;
  let restoredWindows = false;
  let rememberedView = null;
  try { const value=JSON.parse(win.localStorage.getItem("slivr:explore-view") || "null"); if(["explore","location","immersive","immersive-index"].includes(value?.name)) rememberedView=value; } catch {}
  let viewingState = null, lastProjectRoute = null, projectNameDraft = "", menuSignature = "", projectSignature = null;
  const tools = createToolWindows({ doc: document, host: workspace, win,
    onLayout: () => { if(workspace.getAttribute("data-tool-docked")==="true" || workspace.getAttribute("data-mobile-tool") !== "none"){collapsed=true;syncPanel();} win.dispatchEvent?.(new Event("resize")); },
    beforeClose: async id => { await flushDrafts(); if (store.getState().save.state === "failed") { actions.notice("Save failed. Retry or export your draft before closing this tool."); return false; } if (id === "checklist") await actions.openAssessment(null); return true; } });
  const launchers = el("div", { class: "workspace-launchers" }); root.append(launchers);
  const mobileNav=el("nav",{class:"mobile-workspace-nav","aria-label":"Scouting workspace"},[
    el("button",{text:"View",onClick:()=>{tools.hideAll();setCollapsed(true);}}),
    el("button",{text:"Locations",onClick:()=>{tools.hideAll();setCollapsed(false);}}),
    el("button",{text:"Checklist",onClick:openChecklistTool}),
    el("button",{text:"Project",onClick:()=>{renderProjectTool();tools.open("project","Project tools");}}),
  ]);root.append(mobileNav);
  function shownState() {
    const state = store.getState();
    if (["explore", "immersive"].includes(state.mode)) return state;
    const route=viewingState?.route ?? rememberedView ?? {name:"explore",params:{}};
    const id=route.params?.locationId, view=id && state.catalog ? locationView(state.catalog,id) : null;
    return { ...state, mode: route.name.startsWith("immersive") ? "immersive" : "explore", route, routeResolution: view ? {status:"ok",locationId:id,view} : {status:"ok"} };
  }
  function returnToView(locationId = null) {
    const location = locationId ?? shownState().routeResolution?.locationId;
    actions.navigate(location ? { name: "location", params: { locationId: location } } : { name: "explore" });
  }
  function renderProjectMenus(state) {
    const signature=JSON.stringify([state.projects.map(p=>[p.id,p.name]),state.openProjectId,state.activeSceneId,state.workingBundle?.scenes.map(s=>[s.id,s.number,s.title])]);
    const contextButton=root.querySelector(".mobile-context-button");
    if(contextButton){const project=state.projects.find(p=>p.id===state.openProjectId),scene=state.workingBundle?.scenes.find(s=>s.id===state.activeSceneId);contextButton.textContent=project?`${project.name}${scene ? ` / ${scene.number}` : ""}`:"Project / scene";}
    if(signature===menuSignature)return; menuSignature=signature;
    const selectProject = el("select", { "aria-label": "Current project", onChange: async event => { await actions.openProject(event.target.value); renderWorkspace(); } },
      [el("option", { value: "", text: "Project: choose" }), ...state.projects.map(p => el("option", { value: p.id, text: p.name }))]);
    selectProject.value = state.openProjectId ?? "";
    const selectScene = el("select", { "aria-label": "Current scene", onChange: async event => { await flushDrafts(); if(store.getState().save.state !== "failed") actions.selectScene(event.target.value); } },
      [el("option", { value: "", text: "Scene: choose" }), ...(state.workingBundle?.scenes ?? []).map(scene => el("option", { value: scene.id, text: `${scene.number} - ${scene.title}` }))]);
    selectScene.value = state.activeSceneId ?? "";
    const openProjectTools = () => { projectMenus.classList.remove("is-open"); renderProjectTool(); tools.open("project", "Project tools"); };
    replaceChildren(projectMenus, [selectProject, selectScene,
      el("button", { type: "button", text: "New project", onClick: () => { openProjectTools(); document.getElementById("new-project-name")?.focus(); } }),
      el("button", { type: "button", text: "Project tools", onClick: openProjectTools }),
      el("button", { type: "button", text: "Add scene", onClick: () => { openProjectTools(); const details = tools.get("project").body.querySelectorAll("details"); for (const d of details) if (d.textContent.includes("Add scene brief")) d.open = true; } }),
      el("button", { type: "button", text: "Reset layout", onClick: () => { tools.reset(); collapsed=false; syncPanel(); } })]);
  }
  function renderProjectTool() {
    const t = tools.ensure("project", "Project tools"), state=store.getState();
    const signature=[state.projects,state.workingBundle,state.activeSceneId,state.activeCandidateId,state.catalog?.version];
    if(projectSignature && signature.every((value,index)=>value===projectSignature[index]))return; projectSignature=signature;
    const parts = projectsMode({ ...state, route: { ...state.route, params: { projectId: state.openProjectId } } });
    const scroll=t.body.scrollTop;
    replaceChildren(t.body, el("div", { class: "project-tool-grid" }, [el("div", {}, parts.left),el("div", {}, parts.centre.children),el("div", {}, parts.right)]));
    t.body.scrollTop=scroll;
  }
  let checklistPinned=false, selectedChecklistLocation=null, followingChecklist=false, followRunning=false, followRevision=0, shellDisposed=false, emptyChecklistLocation=null;
  const lastAssessments=new Map();
  const locationName=id=>store.getState().catalog?.locations.find(l=>l.id===id)?.name ?? id ?? "Choose a location";
  function checklistIdentity(id, assessment=null) {
    const state=store.getState();
    const pin=el("button",{type:"button",text:checklistPinned?"Follow selected location":"Pin checklist to this location","aria-pressed":String(checklistPinned),onClick:()=>{
      checklistPinned=!checklistPinned;tools.get("checklist")?.updateContext?.();if(!checklistPinned)requestChecklistFollow(selectedChecklistLocation ?? shownState().routeResolution?.locationId);
    }});
    const selector=el("select",{"aria-label":"Checklist assessment date",onChange:async event=>{await actions.openAssessment(event.target.value);}},
      (state.workingBundle?.scoutAssessments ?? []).filter(a=>a.locationId===id).map(a=>el("option",{value:a.id,text:`${a.observationDate} - ${a.title}${a.archived?" (archived)":""}`})));
    if(assessment)selector.value=assessment.id;
    selector.hidden=!assessment;
    return el("div",{class:"checklist-identity"},[
      el("strong",{text:locationName(id)}),
      el("span",{class:"checklist-owner",text:`${state.workingBundle?.projects[0]?.name ?? "Choose a project"} / ${state.workingBundle?.scenes.find(s=>s.id===state.activeSceneId)?.title ?? "Choose a scene"}${assessment?` / ${assessment.observationDate}`:""}`}),selector,pin,
    ]);
  }
  function renderEmptyChecklist() {
    const t=tools.get("checklist");if(!t)return;
    const state=store.getState(),id=checklistPinned && emptyChecklistLocation ? emptyChecklistLocation : selectedChecklistLocation ?? shownState().routeResolution?.locationId;
    emptyChecklistLocation=id;
    t.updateContext=()=>renderEmptyChecklist();
    const start=el("button",{type:"button",text:`Start assessment for ${locationName(id)}`,onClick:async()=>{
      const current=store.getState();if(!id || !current.openProjectId || !current.activeSceneId){actions.notice("Choose a project and scene before starting an assessment.");return;}
      const result=await actions.addLocationCandidate(current.activeSceneId,id);if(result?.ok)await actions.createAssessment(result.candidate.id);
    }});
    replaceChildren(t.body,el("div",{class:"checklist-empty"},[checklistIdentity(id),el("p",{text:"No assessment is open for this location. Existing answers stay with their original location."}),start,...candidateContext(state,id)]));
  }
  function requestChecklistFollow(id) {
    if(!id)return;
    selectedChecklistLocation=id;followRevision++;
    tools.get("checklist")?.updateContext?.();
    if(checklistPinned || followRunning || !tools.get("checklist") || tools.get("checklist").mode==="closed")return;
    void followChecklist();
  }
  async function followChecklist() {
    followRunning=true;
    try {
      let handled;
      do {
        handled=followRevision;
        await flushDrafts();await actions.flushScouting?.();
        if(checklistPinned || shellDisposed)return;
        if(["failed","saving"].includes(store.getState().save.state)){actions.notice("Checklist stayed at its previous location because its answers could not be saved. Retry saving, then choose Follow selected location.");return;}
        const state=store.getState(),id=selectedChecklistLocation,records=state.workingBundle?.scoutAssessments ?? [];
        const old=records.find(a=>a.id===state.activeAssessmentId);
        if(old)lastAssessments.set(`${old.projectId}:${old.locationId}`,old.id);
        const matches=records.filter(a=>a.locationId===id);
        const remembered=lastAssessments.get(`${state.openProjectId}:${id}`);
        const next=matches.find(a=>a.id===remembered) ?? matches.filter(a=>!a.archived).sort((a,b)=>b.observationDate.localeCompare(a.observationDate)||b.updatedAt.localeCompare(a.updatedAt))[0];
        if(old?.id!==next?.id || (!old && !next)) {
          followingChecklist=true;
          try {await actions.openAssessment(next?.id ?? null);if(!next && !store.getState().activeAssessmentId)renderEmptyChecklist();}
          finally {followingChecklist=false;}
        }
      } while(handled!==followRevision);
    } finally {followRunning=false;}
  }
  function openChecklistTool() {
    const state=store.getState();
    if(state.activeAssessmentId)renderAssessment();
    tools.open("checklist","Scouting checklist");
    if(!state.activeAssessmentId)renderEmptyChecklist();
    requestChecklistFollow(selectedChecklistLocation ?? shownState().routeResolution?.locationId);
    collapsed=true;syncPanel();
  }
  function renderLaunchers(state) {
    const shown=shownState(), id=shown.routeResolution?.locationId;
    launchers.hidden=state.mode === "shot";
    mobileNav.hidden=state.mode === "shot";
    replaceChildren(launchers,[
      el("button", { type:"button", text:"Map", "aria-pressed":String(shown.mode === "explore"), onClick:()=>returnToView(id) }),
      el("button", { type:"button", text:"Immersive", "data-view":"immersive", "aria-pressed":String(shown.mode === "immersive"), onClick:()=>actions.navigate(id ? {name:"immersive",params:{locationId:id}} : {name:"immersive-index"}) }),
      el("button", { type:"button", text:"Scouting checklist", onClick:openChecklistTool }),
      el("button", { type:"button", class:"mobile-map-options", text:"Map options", "aria-expanded":String(workspace.getAttribute("data-map-options")==="open"), onClick:event=>{const open=workspace.getAttribute("data-map-options")!=="open";workspace.setAttribute("data-map-options",open?"open":"closed");event.target.setAttribute("aria-expanded",String(open));} }),
      el("button", { type:"button", text:"Location details", onClick:()=>{ const t=tools.open("location","Location details"); const v=shown.routeResolution?.view; replaceChildren(t.body,v?immersiveDetail(shown,v):el("p",{text:"Choose a location on the map."})); } })]);
  }
  const panelToggle = el("button", { type: "button", class: "explore-restore",
    text: "Show locations", "aria-controls": "explore-panel", onClick: () => setCollapsed(false) });
  const menuButton = el("button", { type: "button", class: "explore-menu-button",
    text: "\u2630", "aria-label": "Catalog and help", "aria-expanded": "false", onClick: openExploreMenu });
  const menuRegion = el("div", { class: "explore-menu-region" });
  workspace.append(panelToggle, menuButton, menuRegion);
  function setCollapsed(value) {
    collapsed = value;
    if(!value && (win.innerWidth ?? 1200)<=880) tools.hideAll();
    syncPanel();
    if (value) panelToggle.focus();
    else (railLeft.querySelector("button") ?? railLeft).focus();
  }
  function syncPanel() {
    if((win.innerWidth ?? 1200)<=880 && workspace.getAttribute("data-mobile-tool") && workspace.getAttribute("data-mobile-tool")!=="none") collapsed=true;
    const active = store.getState().mode !== "shot";
    workspace.setAttribute("data-explore", String(active && shownState().mode === "explore"));
    workspace.setAttribute("data-panel", collapsed ? "closed" : expanded ? "expanded" : "open");
    railLeft.hidden = active && collapsed;
    panelToggle.hidden = !active || !collapsed;
    panelToggle.setAttribute("aria-expanded", String(!collapsed));
    menuButton.hidden = !active;
    const expand = railLeft.querySelector(".explore-expand");
    if (expand) expand.textContent = expanded ? "Half sheet" : "Expand sheet";
  }
  const menuBackground = () => [...root.children].filter(n => n !== workspace).concat([...workspace.children].filter(n => n !== menuRegion));
  function closeExploreMenu() {
    for (const node of menuBackground()) node.inert = false;
    menuTrap?.release(); menuTrap = null;
    menuRegion.replaceChildren();
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.focus();
  }
  function openExploreMenu() {
    if (menuTrap) { closeExploreMenu(); return; }
    const dialog = el("section", { class: "explore-menu", role: "dialog",
      "aria-modal": "true", "aria-label": "Catalog and help" }, [
      el("button", { type: "button", text: "Close menu", onClick: closeExploreMenu }),
      el("h2", { text: "Explore SLiVR" }),
      section("Catalog", catalogFigures(store.getState())),
      section("How to explore", el("p", { text: "Search or filter locations, then choose a list entry or numbered pin. Back to locations restores your results. Hide the panel for more map space. Recenter fits the visible locations. Drag to pan; scroll or pinch to zoom. In 3D, right-drag or Ctrl-drag to rotate. The compass resets north." })),
      section("Scouting evidence", el("p", { text: "Captured imagery is remote evidence, not filming permission or a completed physical scout. Unknown and unvalidated facts remain explicit. Projects are stored separately in this browser profile." })),
    ]);
    const backdrop = el("div", { class: "explore-menu-backdrop", onClick: closeExploreMenu });
    menuRegion.replaceChildren(backdrop, dialog);
    menuButton.setAttribute("aria-expanded", "true");
    for (const node of menuBackground()) node.inert = true;
    menuTrap = createFocusTrap({ container: dialog, onEscape: closeExploreMenu });
    dialog.querySelector("button")?.focus();
  }
  railLeft.addEventListener("keydown", event => {
    if (store.getState().mode !== "explore" || event.key !== "Escape") return;
    event.preventDefault();
    if (store.getState().routeResolution?.view) actions.navigate({ name: "explore" });
    else setCollapsed(true);
  });
  function browsePanel(state) {
    if (browse && browseCatalog === state.catalog) return browse;
    browseCatalog = state.catalog;
    const search = el("input", { type: "search", placeholder: "Name, address, visual or practical description",
      "aria-label": "Search locations" });
    const select = (label, values) => el("select", { "aria-label": label },
      values.map(([value, text]) => el("option", { value, text })));
    const controls = {};
    const filter = (key, label, values) => controls[key] = select(label, [["", `All: ${label}`], ...values]);
    const capture = filter("capture", "Capture availability", [["current", "Current Treedis"], ["future", "Future candidates"]]);
    const area = filter("area", "Operational area", (state.catalog?.areas ?? []).map(a => [a.id, a.name]));
    const advanced = [
      filter("spaces", "Interior / exterior", [["interior", "Interior described"], ["exterior", "Exterior described"], ["unknown", "Not described"]]),
      filter("venue", "Venue type", [...new Set((state.catalog?.locations ?? []).map(l => l.venueType))].sort().map(v => [v, v])),
      filter("character", "Visual character", [["historic", "Historic description"], ["contemporary", "Contemporary description"], ["unknown", "Not classified"]]),
      filter("hours", "Public hours", [["reported", "Hours reported"], ["unknown", "Unknown / need validation"]]),
      filter("coverage", "Immersive coverage", [["entry", "Entry supplied; extent unverified"], ["none", "No current capture"]]),
      filter("access", "Access information", [["validation", "Need validation"], ["missing", "Information not found"], ["reported", "Reported; permission not established"]]),
      filter("validation", "Research status", [...new Set((state.catalog?.locations ?? []).map(l => l.researchStatus))].sort().map(v => [v, v])),
      filter("completeness", "Dossier completeness", [["gaps", "Has missing / unvalidated fields"], ["described", "Fields described; not verified"]]),
    ];
    const sort = select("Sort locations", [["catalog", "Catalog order"], ["name", "Name A-Z"], ["area", "Area A-Z"],
      ["capture", "Current captures first"], ["recent", "Recently viewed (this session)"]]);
    const results = el("div", { class: "explore-results rail-body" });
    const count = el("p", { class: "explore-count", role: "status" });
    function update() {
      if (searchTimer !== null) win.clearTimeout(searchTimer);
      searchTimer = null;
      const locations = discoverLocations(state.catalog, { query: search.value,
        filters: Object.fromEntries(Object.entries(controls).map(([key, node]) => [key, node.value])),
        sort: sort.value, recent: store.getState().recentLocations ?? [] });
      results.replaceChildren(locations.length ? catalogRecordList({ ...store.getState(), catalog: { ...state.catalog, locations } })
        : el("p", { class: "empty-note", text: "No matching locations. Clear filters to see all locations." }));
      count.textContent = `${locations.length} locations`;
      actions.setExploreLocations(locations.map(l => l.id));
    }
    refreshBrowse = () => { if (sort.value === "recent") update(); };
    search.addEventListener("input", () => {
      if (searchTimer !== null) win.clearTimeout(searchTimer);
      searchTimer = win.setTimeout(update, 180);
    });
    for (const node of [...Object.values(controls), sort]) node.addEventListener("change", update);
    browse = el("div", { class: "explore-browse" }, [
      railHead("Locations"), el("div", { class: "explore-filters" }, [search, capture, area, sort,
        el("button", { type: "button", text: "Clear filters", onClick: () => {
          search.value = ""; for (const node of Object.values(controls)) node.value = "";
          sort.value = "catalog"; update(); search.focus();
        } }), count,
        el("details", { class: "explore-more-filters" }, [el("summary", { text: "More filters" }),
          el("p", { text: "Filters reflect catalog descriptions, not verified suitability or permission." }),
          ...advanced.map(node => el("label", {}, [el("span", { text: node.getAttribute("aria-label") }), node])),
        ]),
      ]), results,
    ]);
    update();
    return browse;
  }

  // ---- Persistent regions ------------------------------------------------

  function renderModes(mode) {
    mode = mode === "shot" ? "shot" : "explore";
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

    if (state.storageSimulation || state.save.error?.code === "storage-simulation-enabled") {
      lines.push(el("div", { class: "status-line is-warning" }, [
        el("strong", { text: "Save-failure test mode is ON." }),
        el("span", { text: "Project changes are deliberately not being saved. Turn the test off to resume normal saving." }),
        el("button", { type: "button", text: "Turn off save-failure test and retry", onClick: () => actions.stopStorageFailureTest() }),
      ]));
    }
    if (state.save.state === "failed" && state.save.error?.message) {
      lines.push(el("div", { class: "status-line is-danger", role: "alert" }, [
        el("strong", { text: "Not saved:" }), el("span", { text: state.save.error.message }),
      ]));
    }
    if (state.storage.initializing) {
      lines.push(el("div", { class: "status-line", role: "status", text: "Opening local storage. Create will wait until it is ready." }));
    } else if (state.storage.available === false) {
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
          el("span", { text: state.error.detail }),
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
    const pendingDeletion = store.getState().pendingDeletion;
    for (const node of root.children) if (node !== dialogRegion) node.inert = Boolean(pendingImport || pendingDeletion);
    if (pendingDeletion) {
      const saving = store.getState().save.state === "saving";
      const failed = store.getState().save.state === "failed";
      const dialog = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "delete-title" }, [
        el("h2", { id: "delete-title", text: `Delete ${pendingDeletion.name}?` }),
        el("p", { text: "This permanently removes this project's local records listed below. Export a backup before deleting. Public catalog locations and other projects are kept." }),
        fieldList(Object.entries(pendingDeletion.counts)),
        failed ? el("p", { role: "alert", text: store.getState().save.error?.message }) : null,
        el("button", { type: "button", text: "Cancel, keep project", ...(saving ? { disabled: "disabled" } : {}), onClick: () => actions.cancelProjectDeletion() }),
        el("button", { type: "button", class: "destructive", text: failed ? "Retry deletion" : "Confirm project deletion",
          ...(saving ? { disabled: "disabled" } : {}), onClick: () => failed ? actions.retrySave() : actions.deleteProject(pendingDeletion.projectId) }),
      ]);
      dialogTrap?.release(); replaceChildren(dialogRegion, dialog);
      dialogTrap = createFocusTrap({ container: dialog, onEscape: () => actions.cancelProjectDeletion() });
      return;
    }
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
              "data-location-id": location.id,
              onClick: () => actions.navigate({ name: "location", params: { locationId: location.id } }),
            },
            [
              el("span", { class: "record-id", text: location.id }),
              el("span", { class: "record-name", text: location.name }),
              el("span", {
                class: `chip chip-${location.captureStatus}`,
                text: location.captureStatus === "current" ? "Captured" : "Future",
              }),
              el("span", { class: "record-evidence", text: `Research: ${location.researchStatus}` }),
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
          ? el("details", {class:"imagery-explanation"}, [el("summary", {text:"Imagery information"}), el("p", { class: "imagery-accuracy", text: imagery.accuracyNote })])
          : null,
      ],
    );
  }

  // ---- Modes -------------------------------------------------------------

  function exploreMode(state) {
    const { catalog } = state;

    const view = state.routeResolution?.view;
    const listing = browsePanel(state);
    if (view !== dossierView) {
      dossierView = view;
      dossier = view ? el("div", { class: "explore-dossier" }, [
        el("button", { type: "button", class: "explore-back", text: "Back to locations",
          onClick: () => actions.navigate({ name: "explore" }) }), ...locationRail(state),
      ]) : null;
    }
    const left = [el("div", { class: "explore-panel-tools" }, [
      el("button", { type: "button", text: "Hide panel", onClick: () => setCollapsed(true) }),
      el("button", { type: "button", class: "explore-expand", text: expanded ? "Half sheet" : "Expand sheet",
        onClick: () => { expanded = !expanded; syncPanel(); } }),
    ]), dossier ?? listing];

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

    return { left, centre, right: null };
  }

  /** What the catalog holds for the selected location. */
  function locationRail(state) {
    const { location, area, capture, scoutDetail = {} } = state.routeResolution.view;
    const facts = discoveryFacts(location, scoutDetail, capture);
    const value = text => text === null || text === undefined || text === "" ? MISSING : text;
    const fields = pairs => el("dl", { class: "fields dossier-fields" }, pairs.flatMap(([label, text]) => [
      el("dt", { text: label }), el("dd", {}, [el("span", { text: value(text) }),
        el("span", { class: `evidence-label evidence-${evidenceState(text)}`,
          text: { missing: "Missing information", validation: "Needs validation", reported: "Catalog description / reported" }[evidenceState(text)] }),
      ]),
    ]));
    let publicLink;
    try { publicLink = publicLocationLink(win.location.href, location.id); }
    catch { publicLink = `#/location/${location.id}`; }
    const linkInput = el("input", { type: "text", readonly: "", "aria-label": "Public location link", value: publicLink });
    linkInput.value = publicLink;
    const copyStatus = el("p", { role: "status" });
    const copy = el("button", { type: "button", text: "Copy public location link", onClick: async () => {
      try {
        if (!win.navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await win.navigator.clipboard.writeText(publicLink);
        copyStatus.textContent = "Public location link copied.";
      } catch {
        copyStatus.textContent = "Copy unavailable. Select and copy the public link below.";
        linkInput.focus(); linkInput.select?.();
      }
    } });
    const sourceIds = [...new Set([...location.sourceIds, ...(scoutDetail?.sourceIds ?? [])])];
    const allSources = sourceIds.map(id => state.catalog.sourcesById.get(id)).filter(Boolean);
    const sourceList = el("div", { class: "dossier-sources" }, allSources.map(source =>
      el("details", {}, [el("summary", { text: `${source.id} - ${source.title}` }), fields([
        ["Publisher", source.publisher], ["Source type", source.type], ["Accessed (not observation date)", source.accessed],
        ["Facts supported", source.factsSupported], ["Authority limitation", source.authorityLimitation],
      ]), source.availability === "public" && /^https?:\/\//.test(source.url ?? "")
        ? el("a", { href: source.url, target: "_blank", rel: "noopener noreferrer", text: "Open public source" })
        : el("p", { text: "Source document is not published here." }),
      ])));
    return [railHead("Location", location.id), el("div", { class: "rail-body" }, [
      section("Overview", [el("h1", { class: "record-title", text: location.name }),
        location.captureStatus === "current" ? el("button", { type: "button", text: "Open in Immersive",
          onClick: () => actions.navigate({ name: "immersive", params: { locationId: location.id } }) }) : null,
        fields([["Operational area", area?.name], ["Venue type", location.venueType], ["Address", formatAddress(location)],
          ["Research status", location.researchStatus]]),
        el("p", { text: `${facts.unresolved} of ${facts.total} core fields missing or needing validation. Described fields are not independently verified.` }),
      ]),
      section("Production considerations", [fields(PRACTICAL_FIELDS.map(([key, label]) => [label, scoutDetail?.[key]]))]),
      section("Visual / spatial character", [fields([
        ["Visual description (not measured)", scoutDetail?.visualCharacter], ["Known spaces", scoutDetail?.knownSpaces],
        ["Coordinates (approximate; not surveyed)", `${location.position[1]}, ${location.position[0]}`],
        ["Coordinate provenance", location.positionEvidence], ["Entrances / floors / dimensions", MISSING],
        ["Approved reference photos", MISSING],
      ])]),
      section("Immersive coverage", [fields([
        ["Status", location.captureStatus === "current" ? "Current Treedis" : "Future candidate"],
        ["Capture record", capture?.id], ["Capture date", capture?.captureDate], ["Coverage summary", location.coverageSummary],
        ["Coverage limitations", capture?.coverageNotes], ["Experience grouping", capture?.grouping],
        ["Capture validation", capture?.validationStatus], ["Immersive notes", scoutDetail?.immersiveCaptureNotes],
      ]), el("p", { text: "Capture does not establish filming permission, current condition or a completed physical scout." }),
        location.captureStatus === "future"
          ? el("p", { text: "No current immersive capture. Validate access and capture coverage before planning a visit." }) : null,
      ]),
      section("Access information", [fields([
        ["Operator (not necessarily owner)", location.operator], ["Property authority", location.propertyAuthority],
        ["Ownership status", location.ownershipStatus], ["Public access contact", location.accessContact],
        ["Public phone", location.publicPhone], ["Filming access inquiry", location.filmingAccess],
        ["Public hours", location.publicHours?.text], ["Hours evidence", location.publicHours?.evidence],
      ]), el("p", { text: "Public hours do not imply production availability. Operator, property owner and filming authority must be confirmed separately." }),
        /^https?:\/\//.test(location.website ?? "") ? el("a", { href: location.website, target: "_blank", rel: "noopener noreferrer", text: "Public venue website" }) : null,
      ]),
      section("Evidence / sources", [el("p", { text: `Catalog ${state.catalog.version}; research snapshot ${state.catalog.researchSnapshot}. Public catalog descriptions are read-only. Sources below support the record; exact per-field observation dates, observers and methods have not been supplied. No on-site verification is implied. Virtual observations and project notes remain separate.` }), sourceList]),

      section("Share location", [copy, linkInput, copyStatus]),
    ])];
  }

  const bookmarkDrafts = new Map();
  const workspaceForms = new Map();
  const assessmentEditors = new Map();
  let assessmentDialog = null, assessmentId = null;
  function renderAssessment() {
    const state=store.getState(), a=state.workingBundle?.scoutAssessments.find(a=>a.id===state.activeAssessmentId);
    if(!a){ if(assessmentId){ if(!followingChecklist)tools.close("checklist"); for(const editor of assessmentEditors.values()) editor.dispose(); assessmentEditors.clear(); assessmentDialog=null; assessmentId=null; } return; }
    const t=tools.ensure("checklist", "Scouting checklist");
    if(assessmentId === a.id && assessmentDialog) return;
    for(const editor of assessmentEditors.values()) editor.dispose(); assessmentEditors.clear();
    assessmentId=a.id; assessmentDialog=t.element;
    lastAssessments.set(`${a.projectId}:${a.locationId}`,a.id);
    const context=el("div",{class:"checklist-context"});
    const identity=el("p",{text:`${state.workingBundle.projects[0].name} / ${state.workingBundle.scenes.find(s=>s.id===state.activeSceneId)?.title ?? "No scene selected"} / ${state.catalog?.locationsById?.get(a.locationId)?.name ?? a.locationId} / ${a.title} - ${a.observationDate}`});
    const mismatch=el("p",{role:"status"});
    const contextDetails=el("details",{class:"checklist-context-details"},[el("summary",{text:"Assessment / project context"}),identity,...candidateContext(state,a.locationId)]);
    const prominent=el("div");
    context.append(contextDetails);
    const host=el("div",{class:"embedded-checklist-host"});
    t.body.replaceChildren(prominent,mismatch,context,host);
    const editor=createEmbeddedChecklist({doc:document,host,assessment:a,getBundle:actions.getWorkspace,actions,win,getSaveState:()=>store.getState().save});
    assessmentEditors.set(a.id,editor);
    t.updateContext=()=>{ replaceChildren(prominent,checklistIdentity(a.locationId,a)); const current=store.getState(); const record=current.workingBundle?.scoutAssessments.find(item=>item.id===a.id) ?? a; identity.textContent=`${current.workingBundle?.projects[0]?.name ?? ""} / ${current.workingBundle?.scenes.find(s=>s.id===current.activeSceneId)?.title ?? "No scene selected"} / ${current.catalog?.locations.find(l=>l.id===a.locationId)?.name ?? a.locationId} / ${record.title} - ${record.observationDate}`; const viewing=selectedChecklistLocation ?? shownState().routeResolution?.locationId; mismatch.textContent=viewing && viewing!==a.locationId?`Viewing another location: ${locationName(viewing)}. Answers still belong to ${locationName(a.locationId)}.`:""; if(viewing && viewing!==a.locationId)replaceChildren(mismatch,[el("span",{text:mismatch.textContent}),el("button",{type:"button",text:"Follow selected location",onClick:()=>{checklistPinned=false;requestChecklistFollow(viewing);}})]); };
    contextDetails.append(el("button",{type:"button",text:"Return to assessment location",onClick:()=>actions.navigate({name:"immersive",params:{locationId:a.locationId}})}));
    t.updateContext(); if(followingChecklist)return; if(state.boot === "starting" && tools.savedState("checklist")) tools.resume("checklist","Scouting checklist"); else tools.open("checklist","Scouting checklist"); collapsed=true; syncPanel();
    if(state.mode === "projects") {
      tools.minimize("project");
      const view=state.catalog ? locationView(state.catalog,a.locationId) : null;
      actions.navigate({name:view?.capture?.url?"immersive":"location",params:{locationId:a.locationId}});
    }
  }
  function assessmentLinks(state, candidate) {
    const list = state.workingBundle.scoutAssessments.filter(a => a.locationId === candidate.locationId);
    return el("details", {}, [el("summary", { text: "Scouting assessments" }),
      el("button", { type: "button", text: "New scouting checklist", onClick: () => actions.createAssessment(candidate.id) }),
      ...list.map(a => el("button", { type: "button", text: `${a.title} - ${a.observationDate} - ${completion(a).percent}% complete${a.archived ? " - archived" : ""}`, onClick: () => actions.openAssessment(a.id) }))]);
  }
  const expandedScenes = new Set();
  function candidateContext(state, locationId) {
    const bundle = state.workingBundle;
    const project = bundle?.projects[0]?.id === state.openProjectId ? bundle.projects[0] : null;
    const projectSelect = el("select", { "aria-label": "Candidate project", onChange: event => {
      if (event.target.value) void actions.openProject(event.target.value);
    } }, [el("option", { value: "", text: "Choose a project" }), ...state.projects.map(p => el("option", { value: p.id, text: p.name }))]);
    projectSelect.value = project?.id ?? "";
    const sceneSelect = el("select", { "aria-label": "Candidate scene", onChange: event => actions.selectScene(event.target.value) }, [
      el("option", { value: "", text: "Choose a scene" }), ...(project ? bundle.scenes : []).map(s => el("option", { value: s.id, text: `${s.number} · ${s.title}` })),
    ]);
    sceneSelect.value = state.activeSceneId ?? "";
    const candidate = project ? bundle.candidates.find(c => c.sceneId === state.activeSceneId && c.locationId === locationId) : null;
    return [projectSelect, sceneSelect,
      candidate ? el("div", {}, [el("p", { text: `Candidate status: ${candidate.status}. This is separate from capture availability or permission.` }),
        el("button", { type: "button", text: "Open candidate", onClick: () => actions.selectCandidate(candidate.id, "project") }), assessmentLinks(state, candidate)])
        : project && state.activeSceneId ? el("button", { type: "button", text: "Add location to scene", onClick: () => actions.addLocationCandidate(state.activeSceneId, locationId) })
          : el("p", { text: "Choose a project and scene, or create them in Projects, before adding this location." }),
      el("button", { type: "button", text: "Open project workspace", onClick: () => actions.navigate(project ? { name: "project", params: { projectId: project.id } } : { name: "projects" }) }),
    ];
  }

  function sceneCandidates(state, scene) {
    const locationSelect = el("select", { "aria-label": `Add candidate to scene ${scene.number}` }, [
      el("option", { value: "", text: "Choose a catalog location" }),
      ...(state.catalog?.locations ?? []).map(location => el("option", { value: location.id, text: `${location.name} · ${location.captureStatus}` })),
    ]);
    return section("Candidate locations", [
      el("button", { type: "button", text: state.activeSceneId === scene.id ? "Scene selected" : "Select this scene", onClick: () => actions.selectScene(scene.id) }),
      locationSelect,
      el("button", { type: "button", text: "Add candidate", onClick: () => actions.addLocationCandidate(scene.id, locationSelect.value) }),
      ...state.workingBundle.candidates.filter(c => c.sceneId === scene.id).map(candidate => {
        const location = state.catalog?.locations.find(l => l.id === candidate.locationId);
        const fields = [["status", "Review status", REVIEW_STATUSES.includes(candidate.status) ? REVIEW_STATUSES : [candidate.status, ...REVIEW_STATUSES]],
          ["rationale", "Rationale", "textarea", 4000], ["strengths", "Strengths", "list"], ["concerns", "Concerns", "list"], ["missingInfo", "Missing information", "list"]];
        return el("article", { class: "candidate-card", "data-candidate-id": candidate.id }, [
          el("h4", { text: location?.name ?? candidate.locationId }),
          el("p", { text: `${candidate.status} · ${candidate.requirementAssessments.filter(r => r.result === "unknown").length} unknown requirements · catalog ${candidate.catalogVersion}` }),
          !candidate.workflowVersion ? el("p", { text: "Legacy workflow and ratings retained. Selecting a review status explicitly updates the workflow; it does not reassess requirements." }) : null,
          el("div", { class: "actions" }, [
            el("button", { type: "button", text: state.activeCandidateId === candidate.id ? "Candidate selected" : "Select candidate", onClick: () => actions.selectCandidate(candidate.id) }),
            el("button", { type: "button", text: "Open location dossier", onClick: () => actions.selectCandidate(candidate.id, "location") }),
            location?.captureStatus === "current" ? el("button", { type: "button", text: "Inspect in Immersive", onClick: () => actions.selectCandidate(candidate.id, "immersive") }) : el("p", { text: "No current capture; this location can still be considered." }),
          ]),
          el("button", { type: "button", text: "Create / open linked shot workspace", onClick: async () => { const result = await actions.linkShot(candidate.id); if (result.ok) actions.navigate({ name: "shot", params: { shotSceneId: result.shotScene.id } }); } }),
          assessmentLinks(state, candidate),
          el("details", {}, [el("summary", { text: "Candidate requirement judgments" }), comparisonView({ doc: document, scene, bundle: state.workingBundle, catalog: state.catalog, actions, candidateIds: [candidate.id], decisionControls: false })]),
          el("details", {}, [el("summary", { text: "Edit candidate notes and review status" }),
            retainedForm(`${candidate.id}-${candidate.revision}`, candidate, fields, "Save candidate", values => actions.updateCandidate(candidate.id, values))]),
        ]);
      }),
    ]);
  }
  function retainedForm(key, record, fields, label, onSave) {
    if (!workspaceForms.has(key)) workspaceForms.set(key, workspaceForm({ doc: document, key, record, fields, label, onSave }));
    return workspaceForms.get(key);
  }

  function assessmentExportPanel(state) {
    const boxes = state.workingBundle.scoutAssessments.map(a => { const input = el("input", { type: "checkbox", value: a.id }); input.checked = true; return { input, label: el("label", {}, [input, a.title]) }; });
    const media = el("input", { type: "checkbox" }); media.checked = true;
    const assets = state.workingBundle.scoutMedia.map(m => { const input = el("input", { type: "checkbox", value: m.id }); input.checked = true; return { input, label: el("label", {}, [input, m.filename]) }; });
    return el("details", {}, [el("summary", { text: "Export selected assessment evidence" }), ...boxes.map(b => b.label), ...assets.map(m => m.label), el("label", {}, [media, "Include owned media bytes (uncheck for an explicit data-only backup)"]),
      el("button", { type: "button", text: "Export selected JSON", onClick: async () => { const file = await actions.exportProject(state.openProjectId, { assessmentIds: boxes.filter(b => b.input.checked).map(b => b.input.value), includeMedia: media.checked, mediaIds: assets.filter(m => m.input.checked).map(m => m.input.value) }); if (file) downloadText(file.filename, file.text); } })]);
  }
  function legacyImportPanel(state) {
    if (!state.catalog) return el("p", { text: "Checklist import needs the location catalog. Local project editing remains available." });
    const select = el("select", { "aria-label": "Import checklist target location" }, [el("option", { value: "", text: "Choose catalog location explicitly" }), ...state.catalog.locations.map(l => el("option", { value: l.id, text: l.name }))]);
    const file = el("input", { type: "file", accept: ".json,.zip", "aria-label": "Legacy checklist JSON or ZIP" });
    const report = el("pre"), status = el("p", { role: "status" }); let preview = null, previewGeneration = 0;
    const confirm = el("button", { type: "button", text: "Import reviewed checklist", disabled: "disabled", onClick: async () => { if (!preview) return; confirm.disabled = true; const result = await actions.importChecklistPreview(preview); status.textContent = result.ok ? "Checklist imported." : "Import failed; workspace storage unchanged. Review recovery status."; } });
    const cancel = el("button", { type: "button", text: "Cancel preview", onClick: () => { previewGeneration++; preview = null; report.textContent = ""; confirm.disabled = true; file.value = ""; } });
    const prepare = async () => {
      const generation = ++previewGeneration;
      preview = null; confirm.disabled = true; if (!select.value || !file.files?.[0]) return;
      try { const { readLegacyFile, previewChecklist } = await import("../data/checklist-import.js"); const source = await readLegacyFile(file.files[0]);
        if (generation !== previewGeneration) return;
        preview = previewChecklist(source, { projectId: state.openProjectId, locationId: select.value, catalogVersion: state.catalog.version, now: new Date().toISOString() });
        report.textContent = JSON.stringify({ targetProject: state.workingBundle.projects[0].name, targetLocation: select.value, title: preview.assessment.title, supportedAnswers: preview.assessment.answers.filter(a => a.state !== "unanswered"), ...preview.report, mediaCount: preview.media.length }, null, 2);
        confirm.disabled = false; status.textContent = "Review exclusions, unresolved defaults and missing media. Status/stars are not imported as decisions.";
      } catch (error) { status.textContent = error.message; }
    };
    select.addEventListener("change", prepare); file.addEventListener("change", prepare);
    return el("details", {}, [el("summary", { text: "Import existing checklist (review before writing)" }), select, file, status, report, confirm, cancel]);
  }
  function projectEditor(state, project) {
    const bundle = state.workingBundle;
    if (bundle?.projects[0]?.id !== project.id) return el("p", { text: "Loading project records…" });
    const current = bundle.projects[0];
    const projectKey = `${project.id}-${current.revision}`;
    const scenes = [...bundle.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return el("div", {}, [
      section("Project details", [retainedForm(projectKey, current, PROJECT_FIELDS, "Save project changes", values => actions.updateProject(project.id, values))]),
      legacyImportPanel(state),
      assessmentExportPanel(state),
      section("Scene briefs", [
        el("p", { text: "Define creative and practical requirements before evaluating locations. Blank counts remain unknown." }),
        ...scenes.map((scene, index) => {
          const linked = [...bundle.candidates, ...bundle.shotScenes].filter(record => record.sceneId === scene.id).length;
          return el("details", { class: "scene-brief", ...(expandedScenes.has(scene.id) || state.activeSceneId === scene.id ? { open: "open" } : {}),
            onToggle: event => { if (event.target.open) expandedScenes.add(scene.id); else expandedScenes.delete(scene.id); } }, [
            el("summary", { text: `${scene.number} · ${scene.title}` }),
            el("div", { class: "actions" }, [
              index > 0 ? el("button", { type: "button", text: "Move scene earlier", onClick: () => actions.moveScene(scene.id, -1) }) : null,
              index < scenes.length - 1 ? el("button", { type: "button", text: "Move scene later", onClick: () => actions.moveScene(scene.id, 1) }) : null,
            ]),
            retainedForm(`${scene.id}-${scene.revision}`, scene, SCENE_FIELDS, "Save scene brief", values => actions.saveScene(values, scene.id)),
            sceneCandidates(state, scene),
            comparisonView({ doc: document, scene, bundle, catalog: state.catalog, actions }),
            linked ? el("p", { text: `${linked} linked candidate/shot record(s). Resolve these links before removing this scene.` })
              : el("details", {}, [el("summary", { text: "Remove scene…" }),
                el("p", { text: "This scene has no linked candidates or shot designs. Removing it cannot be undone; export a backup first." }),
                el("button", { type: "button", class: "destructive", text: "Confirm remove scene", onClick: () => actions.removeScene(scene.id) })]),
          ]);
        }),
        el("details", {}, [el("summary", { text: "Add scene brief" }),
          retainedForm(`${project.id}-new-scene-${bundle.scenes.length}`, { dayNight: "UNSPECIFIED" }, SCENE_FIELDS,
            "Create scene brief", async values => {
              const result = await actions.saveScene(values);
              if (result.ok) workspaceForms.delete(`${project.id}-new-scene-${bundle.scenes.length}`);
              return result;
            })]),
      ]),
    ]);
  }
  function bookmarkList(state) {
    const bundle = state.workingBundle;
    if (!bundle || bundle.projects[0]?.id !== state.openProjectId) return null;
    return section("Saved entry bookmarks", [
      el("p", { class: "empty-note", text: ENTRY_LIMITATION }),
      ...(bundle.bookmarks.length ? bundle.bookmarks.map(bookmark => {
        const restore = bookmarkRestoration(bookmark, bundle, state.catalog);
        return el("article", { class: "rail-section" }, [
          el("h4", { text: bookmark.name }),
          el("p", { text: bookmark.note ?? "" }),
          el("p", { class: "record-meta", text: `${bookmark.locationId} · ${bookmark.captureId} · catalog ${bookmark.catalogVersion}` }),
          restore.ok ? el("button", { type: "button", text: "Restore entry",
            onClick: () => actions.restoreBookmark(bookmark.id) }) : el("p", { text: restore.message }),
        ]);
      }) : [el("p", { text: "No saved entries in this project yet." })]),
      state.bookmarkStatus ? el("p", { role: "status", text: state.bookmarkStatus }) : null,
    ]);
  }

  function bookmarkPanel(state, view) {
    const project = state.workingBundle?.projects[0];
    const selected = project?.id === state.openProjectId ? project : null;
    const select = el("select", { id: "bookmark-project", "aria-label": "Bookmark project",
      onChange: event => { if (event.target.value) void actions.openProject(event.target.value); } }, [
      el("option", { value: "", text: "Choose a project" }),
      ...state.projects.map(p => el("option", { value: p.id, text: p.name,
        ...(p.id === selected?.id ? { selected: "selected" } : {}) })),
    ]);
    const key = `${selected?.id ?? ""}/${view.location.id}`;
    const draft = bookmarkDrafts.get(key) ?? { name: view.location.name, note: "" };
    bookmarkDrafts.set(key, draft);
    const name = el("input", { id: "bookmark-name", type: "text", required: "required", maxlength: "160",
      value: draft.name, onInput: event => { draft.name = event.target.value; } });
    const note = el("textarea", { id: "bookmark-note", maxlength: "4000",
      onInput: event => { draft.note = event.target.value; } });
    note.value = draft.note;
    return section("Save location entry", [
      el("p", { class: "empty-note", text: ENTRY_LIMITATION }),
      el("label", { for: "bookmark-project", text: "Project" }), select,
      selected && view.capture?.state === "current" ? el("form", {
        class: "bookmark-form", onSubmit: async event => {
          event.preventDefault();
          await actions.saveEntryBookmark({ name: draft.name, note: draft.note, locationId: view.location.id, candidateId: state.workingBundle?.candidates.find(c => c.id === state.activeCandidateId && c.locationId === view.location.id)?.id });
        },
      }, [el("label", { for: "bookmark-name", text: "Bookmark name" }), name,
        el("label", { for: "bookmark-note", text: "Note" }), note,
        el("button", { type: "submit", text: "Save entry bookmark" })])
        : el("p", { text: "Choose an existing project, or create one in Projects, then return to this location." }),
      el("button", { type: "button", text: "Open Projects", onClick: () => actions.navigate({ name: "projects" }) }),
      bookmarkList(state),
    ]);
  }

  function projectsMode(state) {
    const nameInput = el("input", {
      type: "text",
      id: "new-project-name",
      name: "new-project-name",
      placeholder: "Production name",
      maxlength: "160",
      onInput: event => { projectNameDraft=event.target.value; },
    });

    nameInput.value=projectNameDraft;
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
                nameInput.value = ""; projectNameDraft="";
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
          "Projects stay in this browser profile. Export project JSON to keep a backup or move to another device.",
        ),
        state.routeResolution?.status === "unknown-record"
          ? el("p", { text: state.routeResolution.reason })
          : null,
        open
          ? el("div", {}, [projectEditor(state, open), fieldList([
              ["Identifier", open.id],
              ["Production type", open.productionType],
              ["Status", open.status],
              ["Time zone", open.timeZone],
              ["Created", open.createdAt],
              ["Updated", open.updatedAt],
              ["Revision", open.revision],
            ])])
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
                onClick: () => actions.requestProjectDeletion(open.id),
              }),
            ])
          : null,
        open && open.id === state.workingBundle?.projects[0]?.id ? bookmarkList(state) : null,
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
            el("p", { text: "Choose a location to save a named entry bookmark in a project." }),
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
          map: true,
          overlay: el("p", { class: "phase-note", text: "No capture exists for this location. Continue scouting on the map." }),
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
        bookmarkPanel(state, view),
        section("Project candidate", candidateContext(state, location.id)),
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
              "data-location-id": location.id,
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
    const linked = state.workingBundle?.shotScenes.find(s => s.id === state.route?.params?.shotSceneId);
    if (linked) return { left: null, centre: { className: "surface-empty", children: [el("h1", { text: linked.name }),
      el("p", { text: `Project ${linked.projectId} / scene ${linked.sceneId} / candidate ${linked.candidateId}. Schematic planning origin; not measured.` }),
      el("p", { text: "Linked workspace saved. Spatial editing arrives in Phase 4." }),
      el("button", { type: "button", text: "Return to candidate", onClick: () => actions.selectCandidate(linked.candidateId, "project") })] } };
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
    const actual = store.getState();
    if (["explore","immersive"].includes(actual.mode)) { viewingState=actual; if(actual.route)try{win.localStorage.setItem("slivr:explore-view",JSON.stringify(actual.route));}catch{} }
    if(actual.boot !== "starting" && !restoredWindows){restoredWindows=true;if(["floating","docked","maximized","minimized"].includes(tools.savedState("project"))){renderProjectTool();tools.resume("project","Project tools");}}
    const state = actual.mode === "projects" ? shownState() : actual;
    workspace.setAttribute("data-surface-mode",state.mode);
    renderProjectMenus(actual); renderLaunchers(actual);
    if(tools.get("project")) renderProjectTool();
    if(actual.mode === "projects" && lastProjectRoute !== actual.route) { renderProjectTool(); tools.open("project","Project tools"); }
    lastProjectRoute=actual.route;
    tools.get("checklist")?.updateContext?.();
    const checklistTool=tools.get("checklist");
    if(checklistTool && !actual.activeAssessmentId && !["closed","minimized"].includes(checklistTool.mode))renderEmptyChecklist();
    const detailTool=tools.get("location");
    if(detailTool && state.routeResolution?.view) replaceChildren(detailTool.body,immersiveDetail(state,state.routeResolution.view));
    const bookmarkFocus = /^(bookmark-|workspace-)/.test(document.activeElement?.id ?? "")
      ? { id: document.activeElement.id, start: document.activeElement.selectionStart,
        end: document.activeElement.selectionEnd } : null;
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

    const previousLocation = lastLocation;
    const locationId = state.mode === "explore" ? state.routeResolution?.locationId ?? null : null;
    if (locationId && locationId !== previousLocation && !["floating","docked","maximized"].includes(tools.get("checklist")?.mode)) collapsed = false;
    if (browse?.parentNode) {
      browseScroll = browse.querySelector(".explore-results")?.scrollTop ?? 0;
      sheetScroll = browse.scrollTop ?? 0;
    }
    const miniLocation = parts.centre?.viewer ? state.routeResolution?.view?.location : null;
    if (miniLocation && immersiveMap.element.parentNode === railLeft) {
      // Keep the live map canvas attached while viewer messages redraw the rails.
      for (const child of Array.from(railLeft.children)) {
        if (child !== immersiveMap.element) child.remove();
      }
      railLeft.append(...(parts.left ?? []));
    } else {
      immersiveMap.update(null, state.capabilities.webgl);
      replaceChildren(railLeft, miniLocation ? [immersiveMap.element, ...(parts.left ?? [])] : parts.left ?? []);
    }
    immersiveMap.update(miniLocation, state.capabilities.webgl,
      (state.catalog?.locations ?? []).filter(location => location.captureStatus === "current"));
    if (!locationId && browse) {
      browse.querySelector(".explore-results").scrollTop = browseScroll;
      browse.scrollTop = sheetScroll;
    }
    railLeft.setAttribute("id", "explore-panel");
    syncPanel();
    if (locationId !== previousLocation) {
      if (locationId) dossier?.querySelector("button")?.focus();
      else if (state.mode === "explore" && previousLocation) {
        const row = browse?.querySelectorAll("button");
        (Array.from(row ?? []).find(n => n.getAttribute("data-location-id") === previousLocation)
          ?? browse?.querySelector("input"))?.focus({ preventScroll: true });
      }
    }
    for (const row of browse?.querySelectorAll("button") ?? []) {
      if (!row.getAttribute("data-location-id")) continue;
      const selected = row.getAttribute("data-location-id") === locationId;
      row.classList.toggle("is-selected", selected);
      if (selected) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    }
    lastLocation = locationId;
    if (state.mode !== "explore" && menuTrap) closeExploreMenu();
    replaceChildren(railRight, state.mode === "immersive" ? [] : parts.right ?? []);
    if (bookmarkFocus) {
      const field = document.getElementById(bookmarkFocus.id);
      field?.focus({ preventScroll: true });
      if (typeof bookmarkFocus.start === "number") field?.setSelectionRange?.(bookmarkFocus.start, bookmarkFocus.end);
    }

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
    if (bookmarkFocus?.id.startsWith("workspace-")) document.getElementById(bookmarkFocus.id)?.focus({ preventScroll: true });

    workspace.setAttribute("data-rails", state.mode === "immersive" ? (parts.left ? "left" : "none") : parts.right ? "both" : parts.left ? "left" : "none");
    renderBreadcrumb(state);

    // Each provider surface is created only once its host is showing, and
    // released as soon as a mode that does not use it takes the surface. A
    // viewer left running holds a rendering context and keeps streaming.
    if (wantsMap) void actions.mountMap(mapHost);
    else actions.unmountMap();

    if (wantsViewer) actions.mountViewer(viewerHost.frame, parts.centre.capture, viewerHost.renewFrame);
    else actions.unmountViewer();
  }

  async function emergencyExport() {
    await flushDrafts();
    const file = actions.exportEmergency("Requested from the save-status surface.");
    if (file) downloadText(file.filename, file.text);
    else actions.notice("No project is open, so there is nothing to export.");
  }

  // ---- Wiring ------------------------------------------------------------

  const unsubscribes = [
    store.subscribe((state) => state.mode, renderModes, { immediate: true }),
    store.subscribe((state) => state.boot, renderWorkspace),
    store.subscribe((state) => state.route, renderWorkspace),
    store.subscribe((state) => state.exploreSelectionRequest, () => {
      collapsed = false; renderWorkspace(); dossier?.querySelector("button")?.focus();
    }),
    store.subscribe((state) => state.routeResolution, () => {renderWorkspace();requestChecklistFollow(store.getState().routeResolution?.locationId);}),
    store.subscribe((state) => state.catalog, renderWorkspace),
    store.subscribe((state) => state.recentLocations, () => refreshBrowse?.()),
    store.subscribe((state) => state.catalogError, renderWorkspace),
    store.subscribe((state) => state.projects, renderWorkspace),
    store.subscribe((state) => state.workingBundle, () => { renderWorkspace(); if (store.getState().activeAssessmentId && !assessmentDialog) renderAssessment(); }),
    store.subscribe((state) => state.activeSceneId, renderWorkspace),
    store.subscribe((state) => state.activeCandidateId, renderWorkspace),
    store.subscribe((state) => state.checklistLocationRequest, request => requestChecklistFollow(request?.locationId)),
    store.subscribe((state) => state.activeAssessmentId, renderAssessment),
    store.subscribe((state) => state.bookmarkStatus, renderWorkspace),
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
    store.subscribe((state) => state.save, renderStatusStrip),
    store.subscribe((state) => state.save, save => { const t=tools.get("checklist"); if(t)t.tab.textContent=`Scouting checklist - ${save.label}`; for(const editor of assessmentEditors.values())editor.refreshStatus?.(); }),
    store.subscribe((state) => state.storageSimulation, renderStatusStrip),
    store.subscribe((state) => state.storage, renderStatusStrip),
    store.subscribe((state) => state.notice, renderStatusStrip),
    store.subscribe((state) => state.error, renderStatusStrip),
    store.subscribe((state) => state.pendingImport, renderDialog),
    store.subscribe((state) => state.pendingDeletion, () => renderDialog(store.getState().pendingImport)),
    store.subscribe((state) => state.save, () => { if (store.getState().pendingDeletion) renderDialog(store.getState().pendingImport); }),
  ];

  renderWorkspace();
  renderStatusStrip();
  const fitViewport=()=>{const phone=(win.innerWidth ?? 1200)<=880;root.setAttribute("data-keyboard",String(phone && win.visualViewport && win.visualViewport.height < win.innerHeight * 0.8));if(phone && win.visualViewport)root.style?.setProperty("--visual-height",`${win.visualViewport.height}px`);else root.style?.removeProperty("--visual-height");};
  win.visualViewport?.addEventListener("resize",fitViewport);
  fitViewport();

  return {
    destroy() {
      shellDisposed=true;
      win.visualViewport?.removeEventListener("resize",fitViewport);
      if (searchTimer !== null) win.clearTimeout(searchTimer);
      for (const unsubscribe of unsubscribes) unsubscribe();
      menuTrap?.release();
      dialogTrap?.release();
      tools.destroy();
      for (const editor of assessmentEditors.values()) editor.dispose();
      viewerHost.dispose();
      immersiveMap.dispose();
      root.replaceChildren();
    },
  };
}
