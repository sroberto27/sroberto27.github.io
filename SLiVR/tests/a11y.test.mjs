import test from "node:test";
import assert from "node:assert/strict";

import { focusableElements, createFocusTrap } from "../src/ui/a11y.js";

/** A container whose focusable children and active element can be driven. */
function stage(labels) {
  const doc = { activeElement: null, listeners: new Map(), body: { focus() {} } };
  const nodes = labels.map((label) => ({
    label,
    focus() {
      doc.activeElement = this;
    },
    getClientRects: () => [{}],
    offsetParent: {},
  }));

  const container = {
    querySelectorAll: () => nodes,
    contains: (node) => nodes.includes(node),
  };

  doc.addEventListener = (type, fn) => {
    if (!doc.listeners.has(type)) doc.listeners.set(type, new Set());
    doc.listeners.get(type).add(fn);
  };
  doc.removeEventListener = (type, fn) => doc.listeners.get(type)?.delete(fn);
  doc.press = (key, { shiftKey = false } = {}) => {
    let defaultPrevented = false;
    const event = { key, shiftKey, preventDefault: () => { defaultPrevented = true; } };
    for (const fn of [...(doc.listeners.get("keydown") ?? [])]) fn(event);
    return defaultPrevented;
  };
  doc.listenerCount = () => doc.listeners.get("keydown")?.size ?? 0;

  return { doc, container, nodes };
}

test("only genuinely visible controls are treated as focusable", () => {
  const hidden = { getClientRects: () => [], offsetParent: null };
  const visible = { getClientRects: () => [{}], offsetParent: {} };
  const container = { querySelectorAll: () => [hidden, visible] };
  assert.deepEqual(focusableElements(container), [visible]);
});

test("a container that cannot answer the query yields nothing rather than throwing", () => {
  assert.deepEqual(focusableElements(null), []);
  assert.deepEqual(
    focusableElements({ querySelectorAll: () => { throw new Error("unsupported selector"); } }),
    [],
  );
});

test("focus moves into the dialog when it opens", () => {
  const { doc, container, nodes } = stage(["cancel", "copy", "replace"]);
  createFocusTrap({ container, doc });
  assert.equal(doc.activeElement, nodes[0], "the first control takes focus");
});

test("Tab cycles inside the dialog instead of escaping behind it", () => {
  // Without this the dialog's aria-modal claim is false: a keyboard user tabs
  // straight out into controls that are supposedly unreachable.
  const { doc, container, nodes } = stage(["cancel", "copy", "replace"]);
  createFocusTrap({ container, doc });

  doc.activeElement = nodes[2];
  assert.equal(doc.press("Tab"), true, "the last control wraps rather than leaving");
  assert.equal(doc.activeElement, nodes[0]);

  assert.equal(doc.press("Tab", { shiftKey: true }), true, "and backwards from the first");
  assert.equal(doc.activeElement, nodes[2]);
});

test("focus outside the dialog is pulled back in", () => {
  const { doc, container, nodes } = stage(["cancel", "copy"]);
  createFocusTrap({ container, doc });
  doc.activeElement = { label: "something behind the dialog" };
  doc.press("Tab");
  assert.equal(doc.activeElement, nodes[0]);
});

test("Escape leaves by the safe route, and only when one is offered", () => {
  const { doc, container } = stage(["cancel", "replace"]);
  let escaped = 0;
  createFocusTrap({ container, doc, onEscape: () => { escaped += 1; } });

  assert.equal(doc.press("Escape"), true);
  assert.equal(escaped, 1, "Escape takes the safe route, never the destructive one");

  const plain = stage(["only"]);
  createFocusTrap({ container: plain.container, doc: plain.doc });
  assert.equal(plain.doc.press("Escape"), false, "with no safe route, Escape does nothing");
});

test("releasing removes the listener and returns focus to the opener", () => {
  const { doc, container } = stage(["cancel"]);
  const opener = { label: "import control", focus() { doc.activeElement = this; } };
  doc.activeElement = opener;

  const trap = createFocusTrap({ container, doc });
  assert.equal(doc.listenerCount(), 1);

  trap.release();
  assert.equal(doc.listenerCount(), 0, "the key handler must not outlive the dialog");
  assert.equal(doc.activeElement, opener, "focus returns where it came from");
});

test("a vanished opener does not break the release", () => {
  const { doc, container } = stage(["cancel"]);
  doc.activeElement = { focus() { throw new Error("removed from the document"); } };
  const trap = createFocusTrap({ container, doc });
  assert.doesNotThrow(() => trap.release());
});
