/** Numbered location pins and co-located arrays, adapted from the reference pin builder. */
export function groupLocations(locations) {
  const groups = new Map();
  for (const location of locations) {
    const key = location.position.map(value => value.toFixed(6)).join(",");
    if (!groups.has(key)) groups.set(key, { position: location.position, locations: [] });
    groups.get(key).locations.push(location);
  }
  for (const group of groups.values()) group.locations.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return [...groups.values()];
}

/** Extend exact-position groups to overlapping screen pins without altering catalog coordinates. */
export function groupNearbyLocations(locations, project, radius = 44) {
  if (!project) return groupLocations(locations);
  const groups = [];
  for (const location of [...locations].sort((a, b) => a.id.localeCompare(b.id))) {
    const point = project(location.position);
    const group = groups.find(g => Math.hypot(point.x - g.point.x, point.y - g.point.y) < radius);
    if (group) group.locations.push(location);
    else groups.push({ position: location.position, point, locations: [location] });
  }
  return groups;
}

function pinNumber(location) {
  const number = location.id.match(/(\d+)$/)?.[1];
  return number ? String(Number(number)) : location.id;
}

export function createMarkers({ map, maplibre, onSelect, onGroup = null }) {
  let markers = [];
  let pins = [];
  let groups = [];
  let selectedId = null;
  let records = [];

  function clear() {
    for (const marker of markers) marker.remove();
    markers = []; pins = []; groups = [];
  }

  function buildNode(location) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `map-pin map-pin-${location.captureStatus}`;
    node.dataset.locationId = location.id;
    node.setAttribute("aria-label", `${location.id}: ${location.name}. ${location.captureStatus === "current" ? "Captured" : "Future candidate"}.`);
    node.title = `${location.id}: ${location.name}`;
    const body = document.createElement("span");
    body.className = "map-pin-body";
    body.setAttribute("aria-hidden", "true");
    const number = document.createElement("span");
    number.className = "map-pin-number";
    number.textContent = pinNumber(location);
    body.append(number); node.append(body);
    node.addEventListener("click", event => { event.stopPropagation(); onSelect(location.id); });
    pins.push({ id: location.id, node });
    return node;
  }

  function setLocations(locations) {
    const openGroups = new Set(groups.filter(group => group.open).map(group => group.locations.map(l => l.id).join(",")));
    const focusedPin = pins.find(pin => pin.node === document.activeElement)?.id;
    const focusedGroup = groups.find(group => group.summary === document.activeElement)?.locations[0].id;
    records = locations;
    clear();
    if (!map || !maplibre?.Marker) return;
    for (const group of groupNearbyLocations(locations, map.project?.bind(map))) {
      let root;
      if (group.locations.length === 1) {
        root = buildNode(group.locations[0]);
      } else {
        root = document.createElement("div");
        root.className = "map-pin-cluster";
        const summary = document.createElement("button");
        summary.type = "button";
        summary.className = "map-pin-cluster-summary";
        const numbers = group.locations.map(pinNumber);
        summary.textContent = String(numbers.length);
        summary.title = `${numbers.length} nearby locations. Click to zoom in.`;
        summary.setAttribute("aria-label", `${numbers.length} nearby locations: ${numbers.join(", ")}. Zoom to these locations; arrow down to choose a member.`);
        const members = document.createElement("div");
        members.className = "map-pin-cluster-members";
        members.setAttribute("role", "group");
        members.setAttribute("aria-label", "Nearby locations; choose a pin to focus its actual position");
        members.id = `slivr-pin-group-${group.locations[0].id}`;
        summary.setAttribute("aria-controls", members.id);
        for (const location of group.locations) members.append(buildNode(location));
        root.append(summary, members);
        const entry = { root, summary, members, locations: group.locations, position: group.position, open: false };
        entry.setOpen = open => {
          entry.open = open;
          root.classList.toggle("is-open", open);
          members.hidden = !open;
          summary.setAttribute("aria-expanded", String(open));
          if (open && map.project && map.getContainer) {
            const x = map.project(group.position).x;
            const width = map.getContainer().clientWidth;
            const half = Math.min(160, width * .35);
            const shift = Math.max(half + 8 - x, Math.min(0, width - half - 8 - x));
            members.style.left = `calc(50% + ${shift}px)`;
          }
        };
        entry.setOpen(false);
        const hasSelected = () => group.locations.some(location => location.id === selectedId);
        root.addEventListener("mouseenter", () => entry.setOpen(true));
        root.addEventListener("mouseleave", () => {
          if (!hasSelected() && !root.contains(document.activeElement)) entry.setOpen(false);
        });
        let openBeforePointer = null;
        summary.addEventListener("pointerdown", () => { openBeforePointer = entry.open; });
        root.addEventListener("focusin", () => entry.setOpen(true));
        root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget) && !hasSelected()) entry.setOpen(false); });
        root.addEventListener("keydown", event => {
          if (event.key === "Escape") { event.stopPropagation(); summary.focus(); entry.setOpen(false); }
          if (event.key === "ArrowDown" && event.target === summary) {
            event.preventDefault(); entry.setOpen(true); members.querySelector("button")?.focus();
          }
        });
        // Click supports both touch and the button's native Enter/Space activation.
        summary.addEventListener("click", event => {
          event.stopPropagation();
          entry.setOpen(onGroup ? true : !(openBeforePointer ?? entry.open));
          openBeforePointer = null;
          onGroup?.(group.locations);
        });
        groups.push(entry);
      }
      const marker = new maplibre.Marker({ element: root, anchor: "bottom" }).setLngLat(group.position).addTo(map);
      markers.push(marker);
    }
    setSelected(selectedId);
    for (const group of groups) {
      if (openGroups.has(group.locations.map(l => l.id).join(","))) group.setOpen(true);
    }
    if (focusedPin) pins.find(pin => pin.id === focusedPin)?.node.focus?.({ preventScroll: true });
    if (focusedGroup) {
      const group = groups.find(group => group.locations.some(location => location.id === focusedGroup));
      (group?.summary ?? pins.find(pin => pin.id === focusedGroup)?.node)?.focus?.({ preventScroll: true });
    }
  }

  function setSelected(locationId) {
    selectedId = locationId;
    for (const { id, node } of pins) {
      const selected = id === locationId;
      node.classList.toggle("is-selected", selected);
      if (selected) node.setAttribute("aria-current", "true");
      else node.removeAttribute("aria-current");
    }
    for (const group of groups) {
      const selected = group.locations.some(location => location.id === locationId);
      group.root.classList.toggle("has-selected", selected);
      group.setOpen(selected);
    }
  }

  const regroup = () => setLocations(records);
  map?.on?.("zoomend", regroup);
  map?.on?.("resize", regroup);
  return { setLocations, setSelected, get count() { return pins.length; }, dispose() {
    map?.off?.("zoomend", regroup);
    map?.off?.("resize", regroup);
    records = []; clear();
  } };
}
