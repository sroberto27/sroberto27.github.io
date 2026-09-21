// Reference map affordances, scoped to the Explore map lifecycle.
const paths = {
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  imagery: 'M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6',
  dimension: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 3v18M4 7.5l8 4.5 8-4.5',
  recenter: 'M12 2v4M12 18v4M2 12h4M18 12h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
};

export function createExploreControls({ getState, recenter, toggleLayers, toggleImagery,
  toggleDimension }) {
  let root, status;
  const buttons = {};
  function button(label, action, icon) {
    const node = document.createElement('button');
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[icon]}"/></svg>`;
    node.addEventListener('click', action);
    return node;
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
  }
  return {
    onAdd() {
      root = document.createElement('div');
      root.className = 'maplibregl-ctrl slivr-map-tools';
      for (const [key, label, action] of [
        ['layers', 'Toggle streets, buildings and place labels', toggleLayers],
        ['imagery', 'Toggle aerial imagery', toggleImagery],
        ['dimension', 'Show photorealistic 3D', toggleDimension],
        ['recenter', 'Recenter visible locations', recenter],
      ]) {
        buttons[key] = button(label, () => { action(); refresh(); }, key);
        root.append(buttons[key]);
      }
      status = document.createElement('span');
      status.className = 'map-view-badge';
      status.setAttribute('role', 'status');
      root.append(status);
      refresh();
      return root;
    },
    onRemove() { root?.remove(); root = null; },
    refresh,
    setLocations() {},
    setSelected() {},
  };
}
