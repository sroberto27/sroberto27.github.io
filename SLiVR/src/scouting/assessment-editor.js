import { registerDraft } from "./autosave.js";
import { SECTIONS, QUESTIONS, SOURCE_KINDS, ANSWER_STATES, completion } from "./assessment-template.js";
/** One editor instance per assessment is reused across project and provider surfaces. */
export function createAssessmentEditor({ doc, assessment, getBundle, actions }) {
 const bindings = new Map();
 const root = doc.createElement("section"); root.className = "assessment-editor";
 let unregister = null, savedRevision = assessment.revision;
 let draft = structuredClone(assessment), timer = null, pending = Promise.resolve(), dirty = false;
 const h = (tag, text) => { const node = doc.createElement(tag); if (text) node.textContent = text; return node; };
 const status = h("p"); status.setAttribute("role", "status");
 const progress = h("p");
 function showProgress() { const c = completion(draft); progress.textContent = `${c.percent}% complete: ${c.observed} observed, ${c.excluded} not applicable, ${c.needsValidation} need validation, ${c.unanswered} unanswered. Completion is not suitability or filming readiness.`; }
 function changed() { unregister ??= registerDraft(flush); dirty = true; status.textContent = "Unsaved changes; saving shortly..."; clearTimeout(timer); timer = setTimeout(flush, 450); showProgress(); }
 function flush() {
  clearTimeout(timer); timer = null; unregister?.(); unregister = null; if (!dirty) return pending; dirty = false;
  const fields = structuredClone({ title: draft.title, observationDate: draft.observationDate, sourceKind: draft.sourceKind, sourceNote: draft.sourceNote, answers: draft.answers });
  pending = pending.then(async () => { status.textContent = "Saving..."; const result = await actions.updateAssessment(assessment.id, fields); if (result.ok) savedRevision = getBundle().scoutAssessments.find(a => a.id === assessment.id)?.revision; status.textContent = result.ok ? "Saved locally." : "Save failed. Your answers remain here; use retry or emergency export."; return result; });
  return pending;
 }
 function control(parent, label, value, options, onChange, type = "text") {
  const wrap = h("label", label); const input = h(options ? "select" : type === "textarea" ? "textarea" : "input");
  input.setAttribute("aria-label", label); if (!options && type !== "textarea") input.type = type;
  for (const option of options ?? []) { const node = h("option", typeof option === "string" ? option : option.label); node.value = typeof option === "string" ? option : option.value; input.append(node); }
  input.value = value ?? ""; input.addEventListener(options ? "change" : "input", () => onChange(input.value)); wrap.append(input); parent.append(wrap); return input;
 }
 root.append(h("h3", "Scouting checklist"), h("p", "Observations are source-specific, not independently verified. Do not enter private contacts, access codes or confidential documents. A virtual tour cannot prove capacity, current permission or acoustic performance."));
 for (const [key, label, options, type] of [["title", "Assessment title / room"], ["observationDate", "Observation date", null, "date"], ["sourceKind", "Observation source", SOURCE_KINDS], ["sourceNote", "Source context", null, "textarea"]]) control(root, label, draft[key], options, value => { draft[key] = value; changed(); }, type);
 root.append(progress, status); showProgress();
 const nav = h("nav"); nav.setAttribute("aria-label", "Checklist sections"); root.append(nav);
 for (const section of SECTIONS) {
  const details = h("details"), summary = h("summary", section.title); details.append(summary); root.append(details);
  const jump = h("button", section.title); jump.type = "button"; jump.addEventListener("click", () => { details.open = true; summary.focus(); details.scrollIntoView?.({ block: "nearest" }); }); nav.append(jump);
  for (const q of section.questions) {
   const field = h("fieldset"), legend = h("legend", q.label + (q.unit ? ` (${q.unit})` : "")); field.append(legend); details.append(field);
   const a = draft.answers.find(a => a.questionId === q.id), key = q.type === "text" ? "textValue" : q.type + "Value";
   const stateInput = control(field, `${q.label}: answer state`, a.state, ANSWER_STATES, value => { a.state = value; if (["unanswered", "not-applicable"].includes(value)) { delete a[key]; valueInput.value = ""; } changed(); });
   const valueInput = control(field, `${q.label}: value`, a[key] === undefined ? "" : String(a[key]), q.type === "boolean" ? ["", "true", "false"] : null, value => {
    if (value === "") { delete a[key]; a.state = "unanswered"; } else { a[key] = q.type === "number" ? Number(value) : q.type === "boolean" ? value === "true" : value; a.state = "observed"; }
    stateInput.value = a.state; changed();
   }, q.type === "number" ? "number" : "text");
   bindings.set(q.id, { field, valueInput, stateInput });
   control(field, `${q.label}: notes`, a.note, null, value => { a.note = value; changed(); }, "textarea");
   control(field, `${q.label}: reference URL`, a.referenceUrl, null, value => { if (value) a.referenceUrl = value; else delete a.referenceUrl; changed(); }, "url");
   const bookmarks = getBundle().bookmarks.filter(b => b.projectId === assessment.projectId && b.locationId === assessment.locationId);
   control(field, `${q.label}: entry bookmark`, a.bookmarkId, [{ value: "", label: "No bookmark" }, ...bookmarks.map(b => ({ value: b.id, label: `${b.name} - entry only` }))], value => { if (value) a.bookmarkId = value; else delete a.bookmarkId; changed(); });
   const mediaList = h("div"); field.append(mediaList);
   function renderMedia() {
    mediaList.replaceChildren();
    for (const id of a.mediaIds) {
     const m = getBundle().scoutMedia.find(m => m.id === id); if (!m) continue;
     const row = h("div"), view = h("button", m.missing ? `${m.filename} (missing bytes)` : `View ${m.kind}: ${m.filename}`); view.type = "button"; view.disabled = m.missing;
     view.addEventListener("click", async () => { const { openMedia } = await import("./assessment-media.js"); if (root.isConnected !== false) openMedia(m, doc, () => root.isConnected !== false); });
     const remove = h("button", "Detach (history retains media)"); remove.type = "button"; remove.addEventListener("click", () => { a.mediaIds = a.mediaIds.filter(value => value !== id); changed(); renderMedia(); });
     row.append(view, remove); mediaList.append(row);
    }
   }
   renderMedia();
   const kind = control(field, `${q.label}: attachment kind`, "photo", ["photo", "video", "panorama"], () => {});
   const file = h("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/webp,video/mp4,video/webm"; file.setAttribute("aria-label", `${q.label}: attach supplied media`);
   file.addEventListener("change", async () => { if (!file.files?.[0]) return; await flush(); status.textContent = "Attaching..."; const result = await actions.attachMedia(assessment.id, q.id, file.files[0], kind.value); if (result.ok) { a.mediaIds = [...getBundle().scoutAssessments.find(item => item.id === assessment.id).answers.find(item => item.questionId === q.id).mediaIds]; renderMedia(); } status.textContent = result.ok ? "Media saved locally." : "Media not saved; review the message."; file.value = ""; }); field.append(file);
  }
 }
 const save = h("button", "Save assessment now"); save.type = "button"; save.addEventListener("click", flush); root.append(save);
 const history = h("details"), summary = h("summary", "Assessment history (immutable saved revisions)"); history.append(summary);
 history.addEventListener("toggle", () => { if (!history.open) return; while (history.children.length > 1) history.lastChild.remove(); for (const r of getBundle().scoutAssessmentRevisions.filter(r => r.assessmentId === assessment.id)) { const entry = h("details"); entry.append(h("summary", `Revision ${r.revision}: ${r.snapshot.updatedAt}`), h("pre", JSON.stringify(r.snapshot, null, 2))); history.append(entry); } }); root.append(history);
 const archive = h("button", "Archive assessment (retain all evidence)"); archive.type = "button"; archive.addEventListener("click", async () => { await flush(); await actions.updateAssessment(assessment.id, { archived: true }); actions.openAssessment(null); }); root.append(archive);
 return { element: root, bindings, status, progress, flush, matches: record => record.revision === savedRevision, dispose() { clearTimeout(timer); unregister?.(); } };
}
