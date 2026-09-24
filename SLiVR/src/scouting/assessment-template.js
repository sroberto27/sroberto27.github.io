/** Versioned adaptation of CheckList/v2/app.js field and section metadata. */
export const TEMPLATE_VERSION = "1.0.0";
export const ANSWER_STATES = ["unanswered", "observed", "needs-validation", "not-applicable"];
export const SOURCE_KINDS = ["virtual-tour", "site-visit", "document", "other"];
const counts = new Set(["door-count", "window-count", "fixture-count", "power-outlets"]);
const flags = new Set("room-layout-sketch wide-angle close-up video staging-area overhead sconce lamp LED ceiling wall table circuit-capacity furniture-present ease-of-moving-furniture zoning-regulations ownership-confirmed permission-to-film ambient-noise detailed-report database-entry".split(" "));
const labels = { "zoning-regulations": "Zoning evidence reviewed (validation still required)", "ownership-confirmed": "Ownership evidence reviewed (not authorization)", "permission-to-film": "Filming permission evidence reviewed (validate current scope)", "circuit-capacity": "Circuit capacity evidence available", "distance-to-location": "Distance to location (include units)", "parking-capacity": "Parking capacity (include units/source)" };
export const SECTIONS = [
 ["general", "General information and visual documentation", "room-name room-layout-sketch wide-angle close-up video"],
 ["exterior", "Exterior access, parking and staging", "door-count equipment-accessibility staging-area parking-capacity distance-to-location"],
 ["lighting", "Lighting", "window-count window-direction natural-light-type fixture-count overhead sconce lamp LED ceiling wall table color-temperature control-options"],
 ["power", "Power and network", "power-outlets outlet-locations network-connectivity circuit-capacity connectivity-details"],
 ["aesthetic", "Aesthetic and design", "wall-colors flooring-type architectural-details flooring-condition furniture-present ease-of-moving-furniture"],
 ["compliance", "Compliance validation prompts", "zoning-regulations ownership-confirmed permission-to-film"],
 ["acoustic", "Acoustics", "ambient-noise noise-source room-acoustics"],
 ["final", "Final documentation", "detailed-report database-entry tags-categories additional-notes"]
].map(([id, title, fields]) => ({ id, title, questions: fields.split(" ").map(id => ({ id, label: labels[id] ?? id.replaceAll("-", " "), type: counts.has(id) ? "number" : flags.has(id) ? "boolean" : "text", ...(counts.has(id) ? { unit: "count" } : {}) })) }));
export const QUESTIONS = SECTIONS.flatMap(s => s.questions);
export function completion(assessment) {
 const answers = assessment.answers;
 const observed = answers.filter(a => a.state === "observed").length;
 const excluded = answers.filter(a => a.state === "not-applicable").length;
 const needsValidation = answers.filter(a => a.state === "needs-validation").length;
 return { observed, excluded, needsValidation, unanswered: QUESTIONS.length - observed - excluded - needsValidation, total: QUESTIONS.length, percent: Math.round(100 * (observed + excluded) / QUESTIONS.length) };
}
