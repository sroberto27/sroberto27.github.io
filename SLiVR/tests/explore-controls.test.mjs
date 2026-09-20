import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExploreControls } from '../src/map/explore-controls.js';
import { createMapAdapter } from '../src/map/maplibre-adapter.js';
import { IMAGERY_LAYER_ID } from '../src/map/imagery.js';
import { createActions, initialState } from '../src/app/actions.js';
import { createStore } from '../src/app/store.js';

function documentFixture() {
  const original = globalThis.document;
  const nodes = [];
  globalThis.document = {
    createElement(tag) {
      const node = {
        tag, children: [], attributes: {}, events: {}, value: '', dataset: {}, classList: { toggle() {} },
        setAttribute(k, v) { this.attributes[k] = v; },
        removeAttribute(k) { delete this.attributes[k]; },
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        addEventListener(type, fn) { this.events[type] = fn; },
        focus() { globalThis.document.activeElement = this; },
        remove() { this.removed = true; },
        click() { if (!this.disabled) this.events.click?.({ stopPropagation() {} }); },
      };
      nodes.push(node);
      return node;
    },
  };
  return { nodes, find: label => nodes.find(n => n.attributes['aria-label'] === label),
    restore() { globalThis.document = original; } };
}

test('map menu search, catalog stepping, Escape and disposal work without changing catalog order', () => {
  const fixture = documentFixture();
  try {
    const visits = [];
    const control = createExploreControls({ getState: () => ({}), recenter() {},
      toggleLayers() {}, toggleImagery() {}, toggleDimension() {}, visit: id => visits.push(id) });
    control.onAdd({ getContainer: () => document.createElement('div') });
    control.setLocations([{ id: 'A', name: 'Cafe' }, { id: 'B', name: 'Park' }]);
    fixture.find('Map menu and location search').click();
    const search = fixture.find('Search map locations');
    assert.equal(document.activeElement, search);
    search.value = 'park'; search.events.input();
    const results = fixture.nodes.find(n => n.className === 'map-search-results');
    assert.equal(results.children.length, 1);
    results.children[0].click();
    assert.deepEqual(visits, ['B']);
    assert.equal(fixture.find('Map menu').hidden, true);
    control.setSelected('A');
    assert.equal(fixture.find('Previous location').disabled, true);
    fixture.find('Next location').click();
    assert.deepEqual(visits, ['B', 'B']);
    control.setSelected('B');
    assert.equal(fixture.find('Next location').disabled, true);
    fixture.find('Map menu and location search').click();
    fixture.find('Map menu').events.keydown({ key: 'Escape', stopPropagation() {} });
    assert.equal(fixture.find('Map menu').hidden, true);
    control.onRemove();
    assert.equal(fixture.find('Map menu').removed, true);
    assert.equal(fixture.nodes.find(n => n.className === 'map-location-navigation').removed, true);
  } finally { fixture.restore(); }
});

test('location navigation from the list action and actual pin callbacks both center the selected record', async () => {
  const fixture = documentFixture();
  try {
    const region = JSON.parse(readFileSync(new URL('../data/region/lafayette.region.json', import.meta.url)));
    const flights = [], pins = [];
    const map = { loaded: () => false, on() {}, addControl() {}, resize() {}, remove() {},
      getBearing: () => 0, getPitch: () => 0, getMaxZoom: () => 20,
      fitBounds() {}, flyTo: value => flights.push(value) };
    const maplibre = { Map: function () { return map; }, Marker: class {
      constructor({ element }) { pins.push(element); }
      setLngLat() { return this; } addTo() { return this; } remove() {}
    } };
    const store = createStore(initialState({ webgl: true }));
    const actions = createActions({ store, region, repo: null, saveStatus: {},
      router: { navigate: route => actions.applyRoute(route) },
      fetchJson: async path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url))),
      loadMapLibrary: async () => maplibre,
    });
    assert.equal((await actions.initializeCatalog()).ok, true);
    await actions.mountMap({ clientWidth: 1000, clientHeight: 800 });
    actions.navigate({ name: 'location', params: { locationId: 'LOC-011' } });
    assert.deepEqual(flights.at(-1).center, [-92.03966956609332, 30.202416010615966]);
    pins.find(node => node.dataset.locationId === 'LOC-018').click();
    assert.equal(store.getState().routeResolution.locationId, 'LOC-018');
    assert.deepEqual(flights.at(-1).center, [-92.04441771641942, 30.228764095274858]);
    const count = flights.length;
    actions.navigate({ name: 'location', params: { locationId: 'LOC-018' } });
    assert.ok(flights.length > count, 'repeat selection still recenters');
    actions.unmountMap();
  } finally { fixture.restore(); }
});

test('map controls retain independent toggles and disable aerial switching while Google geometry renders', () => {
  const fixture = documentFixture();
  try {
    const state = { imagery: true, layers: false, tilted: false, tiles: 'off' };
    let fits = 0;
    const control = createExploreControls({ getState: () => state, recenter: () => fits++,
      toggleLayers: () => state.layers = !state.layers,
      toggleImagery: () => state.imagery = !state.imagery,
      toggleDimension: () => state.tilted = !state.tilted, visit() {} });
    control.onAdd({ getContainer: () => document.createElement('div') });
    const aerial = fixture.find('Toggle aerial imagery');
    aerial.click();
    fixture.find('Toggle streets, buildings and place labels').click();
    fixture.find('Show photorealistic 3D').click();
    assert.equal(aerial.attributes['aria-pressed'], 'false');
    assert.equal(state.layers, true);
    state.tiles = 'active'; control.refresh();
    assert.equal(aerial.disabled, true);
    aerial.click(); assert.equal(state.imagery, false);
    state.tiles = 'fallback'; control.refresh();
    assert.equal(aerial.disabled, false);
    fixture.find('Recenter on all locations').click(); assert.equal(fits, 1);
  } finally { fixture.restore(); }
});

test('adapter lazily adds reference overlay and preserves aerial-off after provider failover', () => {
  const fixture = documentFixture();
  try {
    const region = JSON.parse(readFileSync(new URL('../data/region/lafayette.region.json', import.meta.url)));
    const container = document.createElement('div');
    container.clientWidth = 900; container.clientHeight = 700;
    const sources = new Map(), layers = new Map(), controls = [], events = [];
    const map = {
      loaded: () => true, on() {}, getContainer: () => container,
      addControl(control) { controls.push(control); container.append(control.onAdd(map)); },
      addSource(id, spec) { sources.set(id, spec); }, getSource: id => sources.get(id),
      removeSource: id => sources.delete(id),
      addLayer(spec) { layers.set(spec.id, spec); }, getLayer: id => layers.get(id),
      removeLayer: id => layers.delete(id), getStyle: () => ({ layers: [...layers.values()] }),
      moveLayer(id) { const layer = layers.get(id); layers.delete(id); layers.set(id, layer); },
      setLayoutProperty(id, property, value) { layers.get(id)[property] = value; },
      remove() { controls.forEach(c => c.onRemove()); },
    };
    const adapter = createMapAdapter({ container, region, onEvent: event => events.push(event), maplibre: { Map: function () { return map; } } });
    assert.equal(adapter.create().ok, true);
    assert.equal(sources.has('slivr-reference-source'), false);
    fixture.find('Toggle streets, buildings and place labels').click();
    assert.equal(layers.get('slivr-reference-layer').visibility, 'visible');
    assert.equal([...layers.keys()].at(-1), 'slivr-reference-layer');
    assert.equal(events.filter(e => e.type === 'error').length, 0);
    fixture.find('Toggle aerial imagery').click();
    assert.equal(layers.get(IMAGERY_LAYER_ID).visibility, 'none');
    adapter.forceImageryFailure('fixture provider unavailable');
    assert.equal(layers.get(IMAGERY_LAYER_ID).visibility, 'none');
    assert.equal(layers.get('slivr-reference-layer').visibility, 'visible');
    adapter.dispose();
  } finally { fixture.restore(); }
});
