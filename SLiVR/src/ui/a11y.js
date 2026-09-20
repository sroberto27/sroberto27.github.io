/**
 * Keyboard and focus behaviour for modal surfaces.
 *
 * Adapted from the reference project's start-screen trap. A dialog that
 * declares `aria-modal="true"` is telling assistive technology that the rest of
 * the page is inert; without a trap that claim is false, and a keyboard user
 * tabs straight out of the dialog into controls that are supposedly
 * unreachable. The import conflict dialog offers a destructive choice, so
 * being able to tab behind it and activate something else is not a cosmetic
 * problem.
 *
 * Three things together make a modal usable without a pointer: focus moves
 * into it, Tab cycles inside it, and Escape leaves by the safe route. The third
 * matters most here, because the safe route is cancel.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Focusable descendants, in document order.
 *
 * Elements hidden with `display: none` are skipped; a control that is only
 * visually hidden stays reachable, because that is usually deliberate.
 */
export function focusableElements(container) {
  if (!container?.querySelectorAll) return [];
  let candidates = [];
  try {
    candidates = Array.from(container.querySelectorAll(FOCUSABLE));
  } catch {
    // A container without full selector support, such as a test stand-in.
    return [];
  }
  return candidates.filter((node) => {
    if (typeof node.getClientRects !== "function") return true;
    return node.offsetParent !== null || node.getClientRects().length > 0;
  });
}

/**
 * Confines keyboard focus to a container until released.
 *
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {() => void} [options.onEscape] The safe way out. Escape does nothing without one.
 * @param {Document} [options.doc]
 * @returns {{release: () => void}}
 */
export function createFocusTrap({ container, onEscape = null, doc = globalThis.document }) {
  const previouslyFocused = doc?.activeElement ?? null;

  function onKeyDown(event) {
    if (event.key === "Escape" && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== "Tab") return;

    const focusables = focusableElements(container);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = doc.activeElement;
    const inside = container.contains?.(current) ?? false;

    if (event.shiftKey) {
      if (current === first || !inside) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (current === last || !inside) {
      event.preventDefault();
      first.focus();
    }
  }

  doc?.addEventListener("keydown", onKeyDown, true);
  focusableElements(container)[0]?.focus();

  return {
    release() {
      doc?.removeEventListener("keydown", onKeyDown, true);
      // Returning focus to where it came from is what makes a dialog feel like
      // a detour rather than a place the keyboard got lost in.
      if (previouslyFocused?.focus && previouslyFocused !== doc?.body) {
        try {
          previouslyFocused.focus();
        } catch {
          // The element that opened the dialog is gone; leave focus alone.
        }
      }
    },
  };
}
