/**
 * Location markers.
 *
 * Adapted from the reference project's pin builder. Markers are DOM elements
 * attached to the map rather than a symbol layer, which is what lets each one
 * carry its own label, state and click target without a sprite sheet.
 *
 * Two deliberate departures from the reference:
 *
 *  - Each pin is a `button`, not a `div` with a click listener. The reference
 *    pins cannot be reached from a keyboard at all; the architecture requires
 *    keyboard access and visible focus throughout.
 *  - Capture status is carried by the same evidence colours the rest of the
 *    interface uses, so a future candidate never looks like a captured one.
 *
 * Markers report a selection and nothing more. They never write application
 * state, which is what keeps the map and the list from correcting each other.
 *
 * Overlap is not handled here. The two closest records sit about 18 m apart,
 * which is roughly three pixels at the default view, so pins collide at low
 * zoom. The reference collapses pins that share an exact position; this
 * inventory has no exact duplicates but does have near ones, and proximity
 * clustering with touch-safe expansion is Phase 1 work under tests 32 and 36.
 */

/**
 * @param {object} options
 * @param {object} options.map A MapLibre map.
 * @param {object} options.maplibre The library, for its Marker constructor.
 * @param {(locationId: string) => void} options.onSelect
 */
export function createMarkers({ map, maplibre, onSelect }) {
  let markers = [];

  function clear() {
    for (const { marker } of markers) marker.remove();
    markers = [];
  }

  function buildNode(location) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `map-pin map-pin-${location.captureStatus}`;
    node.dataset.locationId = location.id;
    // The accessible name carries the state, because the colour alone does not.
    node.setAttribute(
      "aria-label",
      `${location.name}. ${location.captureStatus === "current" ? "Captured" : "Future candidate"}.`,
    );
    node.title = location.name;

    const dot = document.createElement("span");
    dot.className = "map-pin-dot";
    dot.setAttribute("aria-hidden", "true");
    node.append(dot);

    node.addEventListener("click", (event) => {
      // Without this the map treats the click as a background click and
      // clears the very selection the pin just made.
      event.stopPropagation();
      onSelect(location.id);
    });

    return node;
  }

  /** Draws a marker for every location, replacing whatever was there. */
  function setLocations(locations) {
    clear();
    if (!map || !maplibre?.Marker) return;

    for (const location of locations) {
      const node = buildNode(location);
      const marker = new maplibre.Marker({ element: node, anchor: "center" })
        .setLngLat(location.position)
        .addTo(map);
      markers.push({ id: location.id, marker, node });
    }
  }

  /** Marks one location as selected, or none when the id is null. */
  function setSelected(locationId) {
    for (const { id, node } of markers) {
      const selected = id === locationId;
      node.classList.toggle("is-selected", selected);
      if (selected) node.setAttribute("aria-current", "true");
      else node.removeAttribute("aria-current");
    }
  }

  return {
    setLocations,
    setSelected,
    get count() {
      return markers.length;
    },
    dispose: clear,
  };
}
