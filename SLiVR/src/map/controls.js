/**
 * Map controls the library does not provide.
 *
 * The reference builds a rail of custom buttons beside the map. These follow
 * the same idea but register as library controls, so they sit in the same
 * stack as zoom and compass and inherit their placement and theming.
 *
 * A toggle states what it will do, not what it is showing: the label reads
 * "Tilt the view" while flat and "Flatten the view" while tilted, and
 * `aria-pressed` carries the state for anything reading the page aloud.
 */

/** Pitch used for the tilted view, matching the reference. */
export const TILTED_PITCH_DEG = 60;

/**
 * A two-state view control.
 *
 * @param {object} options
 * @param {() => boolean} options.isTilted
 * @param {() => void} options.onToggle
 */
export function createDimensionControl({ isTilted, onToggle }) {
  let container = null;
  let button = null;

  function paint() {
    if (!button) return;
    const tilted = isTilted();
    button.setAttribute("aria-pressed", String(tilted));
    const label = tilted ? "Flatten the view" : "Tilt the view";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.classList.toggle("is-active", tilted);
  }

  return {
    onAdd() {
      container = document.createElement("div");
      container.className = "maplibregl-ctrl maplibregl-ctrl-group";

      button = document.createElement("button");
      button.type = "button";
      button.className = "map-dimension-toggle";
      button.textContent = "3D";
      button.addEventListener("click", () => {
        onToggle();
        paint();
      });

      container.append(button);
      paint();
      return container;
    },
    onRemove() {
      container?.remove();
      container = null;
      button = null;
    },
    /** Re-reads the state, for a change made from somewhere else. */
    refresh: paint,
  };
}
