import { registerDraft } from "./autosave.js";
const decisionDrafts = new Map();
export const FIT_RATINGS = ["unknown", "strong-fit", "acceptable", "concern", "fails-requirement"];
export function criteria(scene) { return [...scene.mustHave.map(requirement => ({ requirement, kind: "mustHave" })), ...scene.preferred.map(requirement => ({ requirement, kind: "preferred" })), ...scene.rejectionConditions.map(requirement => ({ requirement, kind: "rejection" }))]; }
export function comparisonView({ doc, scene, bundle, catalog, actions, candidateIds = null, decisionControls = true }) {
 const h = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n; };
 const root = h("section"); root.className = "comparison"; root.append(h("h3", "Compare candidates"), h("p", "Unknown is unresolved, never a favorable score. Ratings are explicit judgments; no overall score is calculated. Rejection rows describe the stated rejection condition."));
 const candidates = bundle.candidates.filter(c => c.sceneId === scene.id && (!candidateIds || candidateIds.includes(c.id))), table = h("table"), head = h("tr"); head.append(h("th", "Requirement / evidence"));
 for (const c of candidates) {
  const cell = h("th", catalog?.locations.find(l => l.id === c.locationId)?.name ?? c.locationId);
  const open = h("button", "Open candidate location"); open.type = "button"; open.addEventListener("click", () => actions.selectCandidate(c.id, "location")); cell.append(open); head.append(cell);
 }
 table.append(head);
 for (const criterion of criteria(scene)) {
  const row = h("tr"); row.append(h("th", `${criterion.kind}: ${criterion.requirement}`));
  for (const candidate of candidates) {
   const cell = h("td"); row.append(cell);
   const current = candidate.evaluations?.find(e => e.requirement === criterion.requirement && e.kind === criterion.kind) ?? { ...criterion, rating: "unknown", note: "" };
   let draft = { ...current };
   const select = h("select"); select.setAttribute("aria-label", `${candidate.locationId}: ${criterion.requirement} fit`);
   for (const rating of FIT_RATINGS) { const option = h("option", rating); option.value = rating; select.append(option); } select.value = current.rating;
   const note = h("textarea"); note.id = `workspace-fit-${candidate.id}-${criteria(scene).findIndex(c => c.requirement === criterion.requirement && c.kind === criterion.kind)}-${decisionControls}`; note.value = current.note ?? ""; note.setAttribute("aria-label", `${candidate.locationId}: ${criterion.requirement} note`);
   const evidence = h("select"); evidence.setAttribute("aria-label", `${candidate.locationId}: ${criterion.requirement} evidence`); const none = h("option", "No linked evidence (explicit judgment)"); none.value = ""; evidence.append(none);
   for (const revision of bundle.scoutAssessmentRevisions.filter(r => r.locationId === candidate.locationId)) for (const answer of revision.snapshot.answers.filter(a => a.state !== "unanswered")) {
    const option = h("option", `${revision.snapshot.title} r${revision.revision} / ${answer.questionId} (${answer.state})`); option.value = `${revision.id}|${answer.questionId}`; evidence.append(option);
   }
   evidence.value = current.assessmentRevisionId ? `${current.assessmentRevisionId}|${current.questionId}` : "";
   const changed = () => { draft = { ...criterion, rating: select.value, note: note.value }; if (evidence.value) [draft.assessmentRevisionId, draft.questionId] = evidence.value.split("|"); const latest = actions.getWorkspace().candidates.find(c => c.id === candidate.id); return actions.evaluateCandidate(candidate.id, [...(latest.evaluations ?? []).filter(e => e.requirement !== criterion.requirement || e.kind !== criterion.kind), draft]); };
   let timer = null, unregister = null;
   const flush = () => { clearTimeout(timer); unregister?.(); unregister = null; return changed(); };
   note.addEventListener("input", () => { unregister ??= registerDraft(flush); clearTimeout(timer); timer = setTimeout(flush, 450); });
   select.addEventListener("change", flush); note.addEventListener("change", flush); evidence.addEventListener("change", flush);
   cell.append(select, note, evidence);
   const ref = bundle.scoutAssessmentRevisions.find(r => r.id === current.assessmentRevisionId);
   if (ref && bundle.scoutAssessments.find(a => a.id === ref.assessmentId)?.revision !== ref.revision) cell.append(h("p", "Evidence changed: this judgment still cites the saved older revision."));
  }
  table.append(row);
 }
 const scroll = h("div"); scroll.className = "comparison-scroll"; scroll.tabIndex = 0; scroll.append(table); if (decisionControls) { scroll.scrollLeft = actions.getComparisonScroll?.(scene.id) ?? 0; scroll.addEventListener("scroll", () => actions.setComparisonScroll?.(scene.id, scroll.scrollLeft)); } root.append(scroll);
 if (!decisionControls) return root;
 const decisionDraft = decisionDrafts.get(scene.id) ?? { preferredCandidateId: candidates[0]?.id, backupCandidateIds: [], rationale: "", openQuestions: "" };
 decisionDrafts.set(scene.id, decisionDraft);
 const form = h("form"), preferred = h("select"), backups = h("div"), boxes = [];
 preferred.setAttribute("aria-label", "Preferred candidate");
 for (const c of candidates) { const name = catalog?.locations.find(l => l.id === c.locationId)?.name ?? c.locationId; const option = h("option", name); option.value = c.id; preferred.append(option); const label = h("label", `Backup: ${name}`), box = h("input"); box.type = "checkbox"; box.value = c.id; box.checked = decisionDraft.backupCandidateIds.includes(c.id); box.addEventListener("change", () => { decisionDraft.backupCandidateIds = boxes.filter(b => b.checked).map(b => b.value); }); label.append(box); backups.append(label); boxes.push(box); }
 preferred.value = decisionDraft.preferredCandidateId ?? ""; preferred.addEventListener("change", () => { decisionDraft.preferredCandidateId = preferred.value; });
 const rationale = h("textarea"), questions = h("textarea"); rationale.value = decisionDraft.rationale; questions.value = decisionDraft.openQuestions; rationale.addEventListener("input", () => { decisionDraft.rationale = rationale.value; }); questions.addEventListener("input", () => { decisionDraft.openQuestions = questions.value; }); rationale.setAttribute("aria-label", "Decision rationale"); rationale.placeholder = "Decision rationale (required)"; rationale.required = true; questions.setAttribute("aria-label", "Decision open questions"); questions.placeholder = "Remaining questions";
 const save = h("button", "Save preferred and backup decision"); save.type = "submit";
 form.append(h("h4", "Scene decision"), preferred, backups, rationale, questions, save);
 form.addEventListener("submit", event => { event.preventDefault(); actions.decideScene(scene.id, { preferredCandidateId: preferred.value, backupCandidateIds: boxes.filter(b => b.checked).map(b => b.value), rationale: rationale.value, openQuestions: questions.value }); }); root.append(form);
 for (const [index, decision] of (scene.decisions ?? []).entries()) {
  const details = h("details");
  const changedEvidence = decision.candidateSnapshots.some(c => (c.evaluations ?? []).some(e => { const r = bundle.scoutAssessmentRevisions.find(r => r.id === e.assessmentRevisionId); return r && bundle.scoutAssessments.find(a => a.id === r.assessmentId)?.revision !== r.revision; }));
  if (changedEvidence) details.append(h("p", "Evidence changed since this decision. Its original saved revision is retained below."));
  details.append(h("summary", `Decision ${index + 1}: ${decision.decidedAt}${decision.reopenedAt ? " (reopened)" : ""}`), h("p", decision.rationale), h("p", decision.openQuestions), h("p", `Preferred: ${decision.preferredCandidateId}; backups: ${decision.backupCandidateIds.join(", ")}`), h("pre", JSON.stringify(decision.candidateSnapshots, null, 2))); root.append(details);
 }
 if (scene.decisions?.length) { const reopen = h("button", "Reopen decision; retain history"); reopen.type = "button"; reopen.addEventListener("click", () => actions.reopenDecision(scene.id)); root.append(reopen); }
 return root;
}
