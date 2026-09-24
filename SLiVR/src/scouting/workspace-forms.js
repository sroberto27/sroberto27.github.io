import { registerDraft, orderedSave } from "./autosave.js";
import { INT_EXT, DAY_NIGHT } from "../domain/scene-brief.js";

export const PROJECT_FIELDS = [
  ["name", "Project name", "text", 160, true],
  ["productionType", "Production type", "text", 120],
  ["description", "Description", "textarea", 4000],
  ["status", "Status", ["active", "archived"]],
];
export const SCENE_FIELDS = [
  ["number", "Scene number", "text", 32, true], ["title", "Scene title", "text", 200, true],
  ["storyLocation", "Story location", "text", 200], ["intExt", "Interior / exterior", INT_EXT, null, true],
  ["dayNight", "Time of day", DAY_NIGHT], ["description", "Scene description", "textarea", 4000],
  ["characterNotes", "Characters", "textarea", 2000], ["periodNotes", "Period", "textarea", 2000],
  ["requiredSpaces", "Required spaces", "list"], ["castCount", "Cast count", "number"],
  ["extrasCount", "Extras count", "number"], ["crewSize", "Crew size", "number"],
  ["vehicles", "Vehicles", "list"], ["equipment", "Equipment", "list"],
  ["mustHave", "Must-have requirements", "list"], ["preferred", "Preferences", "list"],
  ["rejectionConditions", "Rejection conditions", "list"], ["openQuestions", "Open questions", "list"],
  ["notes", "Notes", "textarea", 4000],
];

/** A retained form keeps unsaved text local until its explicit Save action. */
export function workspaceForm({ doc, fields, record, key, label, onSave }) {
  const form = doc.createElement("form"); form.className = "workspace-form";
  const controls = new Map();
  for (const [name, title, type, max, required] of fields) {
    const wrapper = doc.createElement("div");
    const caption = doc.createElement("label"); caption.textContent = title;
    const id = `workspace-${key}-${name}`; caption.setAttribute("for", id);
    const input = doc.createElement(Array.isArray(type) ? "select" : ["textarea", "list"].includes(type) ? "textarea" : "input");
    input.setAttribute("id", id); input.setAttribute("name", name);
    if (Array.isArray(type)) {
      for (const value of (required ? ["", ...type] : type)) {
        const option = doc.createElement("option"); option.setAttribute("value", value);
        option.textContent = value || "Choose…"; input.append(option);
      }
    } else if (!["textarea", "list"].includes(type)) input.setAttribute("type", type);
    if (max) input.setAttribute("maxlength", String(max));
    if (required) input.setAttribute("required", "required");
    if (type === "number") { input.setAttribute("min", "0"); input.setAttribute("step", "1"); }
    input.value = type === "list" ? (record[name] ?? []).join("\n") : String(record[name] ?? "");
    wrapper.append(caption, input);
    if (type === "list" || type === "number") {
      const hint = doc.createElement("small"); hint.textContent = type === "list" ? "One item per line." : "Leave blank if unknown; zero is an explicit count.";
      wrapper.append(hint);
    }
    form.append(wrapper); controls.set(name, input);
  }
  const status = doc.createElement("p"); status.setAttribute("role", "status");
  status.textContent = record.id ? "Changes save automatically; Save also saves immediately." : "Save to create this record.";
  const button = doc.createElement("button"); button.setAttribute("type", "submit"); button.textContent = label;
  form.append(status, button);
  let timer = null, dirty = false, unregister = null, pending = Promise.resolve();
  function values() {
    const result = {};
    for (const [name, , type] of fields) {
      const text = controls.get(name).value;
      result[name] = type === "list" ? text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
        : type === "number" ? (text.trim() === "" ? undefined : Number(text)) : text;
    }
    return result;
  }
  function flush() {
    clearTimeout(timer); unregister?.(); unregister = null;
    if (!dirty) return pending; dirty = false;
    const captured = values();
    pending = orderedSave(async () => { status.textContent = "Saving..."; const result = await onSave(captured);
      status.textContent = result?.ok ? "Saved locally." : "Not saved. Your text is retained; review the save status."; return result; });
    return pending;
  }
  function changed() {
    dirty = true; status.textContent = "Unsaved changes...";
    if (!record.id) return;
    unregister ??= registerDraft(flush); clearTimeout(timer); timer = setTimeout(flush, 450);
  }
  form.addEventListener("input", changed); form.addEventListener("change", changed);
  form.addEventListener("submit", event => { event.preventDefault(); dirty = true; void flush(); });
  return form;
}
