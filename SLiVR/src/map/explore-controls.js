// Reference map affordances, scoped to the Explore map lifecycle.
const paths = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  imagery: 'M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6',
  dimension: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 3v18M4 7.5l8 4.5 8-4.5',
  recenter: 'M12 2v4M12 18v4M2 12h4M18 12h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
};

export function createExploreControls({ getState, recenter, toggleLayers, toggleImagery,
  toggleDimension, visit }) {
  let root, panel, menu, status, search, results, previous, next, progress, navigation;
  const buttons = {};
  let locations = [], selected = null;
  function button(label, action, icon = null) {
    const node = document.createElement('button');
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    if (icon) node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[icon]}"/></svg>`;
    else node.textContent = label;
    node.addEventListener('click', action);
    return node;
  }
  function open(value) {
    panel.hidden = !value;
    menu.setAttribute('aria-expanded', String(value));
    if (value) search.focus();
  }
  function renderResults() {
    if (!results) return;
    results.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase();
    const matches = locations.filter(l => `${l.id} ${l.name}`.toLocaleLowerCase().includes(query));
    for (const location of matches) {
      results.append(button(`${location.id} · ${location.name}`, () => {
        visit(location.id); open(false); menu.focus();
      }));
    }
    if (!matches.length) results.textContent = 'No matching locations.';
  }
  function step(direction) {
    const index = locations.findIndex(l => l.id === selected);
    const target = index < 0 ? (direction > 0 ? 0 : locations.length - 1) : index + direction;
    if (locations[target]) visit(locations[target].id);
  }
  function refresh() {
    if (!root) return;
    const state = getState();
    for (const [key, value] of Object.entries({ layers: state.layers, imagery: state.imagery, dimension: state.tilted })) {
      buttons[key].setAttribute('aria-pressed', String(value));
    }
    buttons.dimension.title = state.tilted ? 'Return to 2D aerial imagery' : 'Show photorealistic 3D';
    buttons.dimension.setAttribute('aria-label', buttons.dimension.title);
    buttons.imagery.disabled = state.tiles === 'active';
    buttons.imagery.title = state.tiles === 'active' ? 'Aerial imagery is covered by Google 3D' : 'Toggle aerial imagery';
    status.textContent = state.tilted
      ? (state.tiles === 'active' ? '3D' : state.tiles === 'loading' ? 'Loading 3D…' : '3D · aerial fallback')
      : '2D';
    const index = locations.findIndex(l => l.id === selected);
    previous.disabled = !locations.length || index === 0;
    next.disabled = !locations.length || index === locations.length - 1;
    progress.textContent = index < 0 ? `Browse ${locations.length} locations` : `${index + 1} / ${locations.length} · ${locations[index].name}`;
    progress.setAttribute('aria-label', `${progress.textContent}. Open location menu`);
  }
  return {
    onAdd(map) {
      root = document.createElement('div');
      root.className = 'maplibregl-ctrl slivr-map-tools';
      menu = button('Map menu and location search', () => open(panel.hidden), 'menu');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-controls', 'slivr-map-menu');
      root.append(menu);
      for (const [key, label, action] of [
        ['layers', 'Toggle streets, buildings and place labels', toggleLayers],
        ['imagery', 'Toggle aerial imagery', toggleImagery],
        ['dimension', 'Show photorealistic 3D', toggleDimension],
        ['recenter', 'Recenter on all locations', recenter],
      ]) {
        buttons[key] = button(label, () => { action(); refresh(); }, key);
        root.append(buttons[key]);
      }
      status = document.createElement('span');
      status.className = 'map-view-badge';
      status.setAttribute('role', 'status');
      root.append(status);
      panel = document.createElement('section');
      panel.className = 'map-menu-panel';
      panel.id = 'slivr-map-menu';
      panel.setAttribute('aria-label', 'Map menu');
      panel.hidden = true;
      const heading = document.createElement('strong');
      heading.textContent = 'Explore SLiVR';
      panel.append(heading, button('Close map menu', () => { open(false); menu.focus(); }));
      search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Search locations';
      search.setAttribute('aria-label', 'Search map locations');
      search.addEventListener('input', renderResults);
      results = document.createElement('div');
      results.className = 'map-search-results';
      navigation = document.createElement('div');
      navigation.className = 'map-location-navigation';
      navigation.setAttribute('role', 'group');
      navigation.setAttribute('aria-label', 'Browse catalog locations');
      previous = button('Previous location', () => step(-1));
      next = button('Next location', () => step(1));
      previous.textContent = '‹'; next.textContent = '›';
      progress = button('Browse catalog locations', () => open(true));
      navigation.append(previous, progress, next);
      const help = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'How to use the map';
      const text = document.createElement('p');
      text.textContent = 'Select a numbered pin or search result to open its record. Open a grouped pin to choose a location at that address. Drag to pan; scroll or pinch to zoom. In 3D, right-drag or Ctrl-drag to rotate and tilt; use two fingers on touch screens. The compass resets north. Recenter fits every location. Streets and aerial imagery can be toggled independently. Your location is requested only when you press the location button.';
      help.append(summary, text);
      panel.append(search, results, button('Recenter on all locations', recenter), help);
      map.getContainer().append(panel, navigation);
      const handleEscape = event => {
        if (event.key === 'Escape' && !panel.hidden) { event.stopPropagation(); open(false); menu.focus(); }
      };
      root.addEventListener('keydown', handleEscape);
      panel.addEventListener('keydown', handleEscape);
      for (const node of [panel, navigation]) {
        for (const type of ['mousedown', 'touchstart', 'dblclick', 'wheel']) {
          node.addEventListener(type, event => event.stopPropagation());
        }
      }
      renderResults(); refresh();
      return root;
    },
    onRemove() { panel?.remove(); navigation?.remove(); root?.remove(); root = null; },
    refresh,
    setLocations(value) { locations = value; renderResults(); refresh(); },
    setSelected(value) { selected = value; refresh(); },
  };
}
