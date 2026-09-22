import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createMarkers, groupLocations, groupNearbyLocations } from "../src/map/markers.js";

const locations = JSON.parse(
  readFileSync(new URL("../data/catalog/locations.v1.json", import.meta.url), "utf8"),
).locations;

/** Enough of a document and a Marker to place pins without a browser. */
function stage() {
  const placed = [];
  const previousDocument = globalThis.document;

  globalThis.document = {
    createElement: () => {
      const classes = new Set();
      return {
        dataset: {},
        attributes: new Map(),
        listeners: new Map(),
        children: [],
        classList: {
          toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
          contains: (name) => classes.has(name),
        },
        set className(value) {
          classes.clear();
          for (const c of String(value).split(/\s+/).filter(Boolean)) classes.add(c);
        },
        get className() {
          return [...classes].join(" ");
        },
        setAttribute(name, value) {
          this.attributes.set(name, value);
        },
        removeAttribute(name) {
          this.attributes.delete(name);
        },
        getAttribute(name) {
          return this.attributes.get(name) ?? null;
        },
        addEventListener(type, fn) {
          this.listeners.set(type, fn);
        },
        append(...nodes) { this.children.push(...nodes); },
        contains(node) { return this === node || this.children.some(child => child.contains(node)); },
        click(event = {}) {
          this.listeners.get("click")?.({ stopPropagation() {}, ...event });
        },
      };
    },
  };

  const maplibre = {
    Marker: class {
      constructor({ element }) {
        this.element = element;
        this.removed = false;
      }
      setLngLat(position) {
        this.position = position;
        return this;
      }
      addTo() {
        placed.push(this);
        return this;
      }
      remove() {
        this.removed = true;
        placed.splice(placed.indexOf(this), 1);
      }
    },
  };

  return { maplibre, placed, restore: () => { globalThis.document = previousDocument; } };
}

test("every catalog location gets a marker at its own position", () => {
  const { maplibre, placed, restore } = stage();
  try {
    const markers = createMarkers({ map: {}, maplibre, onSelect: () => {} });
    markers.setLocations(locations);

    assert.equal(markers.count, 18);
    assert.equal(placed.length, 18);
    assert.deepEqual(placed[0].position, locations[0].position);
  } finally {
    restore();
  }
});

test("co-located records expand into individually selectable pins without changing coordinates", () => {
  const { maplibre, placed, restore } = stage();
  try {
    const chosen = [];
    const records = [locations[0], { ...locations[1], position: locations[0].position }];
    const markers = createMarkers({ map: {}, maplibre, onSelect: id => chosen.push(id) });
    markers.setLocations(records);
    assert.equal(markers.count, 2, "catalog count is not the number of collapsed groups");
    assert.equal(placed.length, 1);
    assert.deepEqual(placed[0].position, locations[0].position);
    const [summary, members] = placed[0].element.children;
    assert.equal(summary.getAttribute("aria-expanded"), "false");
    assert.equal(members.hidden, true);
    summary.click();
    assert.equal(summary.getAttribute("aria-expanded"), "true");
    assert.equal(members.hidden, false);
    members.children[1].click();
    assert.deepEqual(chosen, [records[1].id]);
    markers.setSelected(records[1].id);
    assert.equal(members.children[1].getAttribute("aria-current"), "true");
    assert.equal(members.hidden, false, "list selection reveals the selected member");
    markers.setSelected(null);
    assert.equal(members.hidden, true);
    markers.dispose();
    assert.equal(placed.length, 0);
  } finally { restore(); }
});

test("coordinate grouping follows the reference six-decimal precision, not broad proximity clustering", () => {
  const a = { ...locations[0], position: [-92.02, 30.22] };
  const b = { ...locations[1], position: [-92.02000001, 30.22000001] };
  const c = { ...locations[2], position: [-92.0201, 30.22] };
  const groups = groupLocations([b, c, a]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].locations.map(location => location.id), [a.id, b.id]);
});

test("capture status is carried by class and by accessible name", () => {
  // Colour alone does not say whether a place has been captured.
  const { maplibre, placed, restore } = stage();
  try {
    createMarkers({ map: {}, maplibre, onSelect: () => {} }).setLocations(locations);

    const current = placed.find((m) => m.element.classList.contains("map-pin-current"));
    const future = placed.find((m) => m.element.classList.contains("map-pin-future"));
    assert.ok(current && future, "both states must be represented");
    assert.match(current.element.getAttribute("aria-label"), /Captured\./);
    assert.match(future.element.getAttribute("aria-label"), /Future candidate\./);
  } finally {
    restore();
  }
});

test("a pin is a button, so it can be reached without a pointer", () => {
  // The reference pins are divs with a click listener and no keyboard path.
  const { maplibre, placed, restore } = stage();
  try {
    createMarkers({ map: {}, maplibre, onSelect: () => {} }).setLocations([locations[0]]);
    assert.equal(placed[0].element.type, "button");
  } finally {
    restore();
  }
});

test("clicking a pin reports the location and stops the map clearing it", () => {
  const { maplibre, placed, restore } = stage();
  try {
    const chosen = [];
    let propagationStopped = false;
    createMarkers({ map: {}, maplibre, onSelect: (id) => chosen.push(id) }).setLocations(locations);

    placed[3].element.click({ stopPropagation: () => { propagationStopped = true; } });
    assert.deepEqual(chosen, [locations[3].id]);
    assert.equal(propagationStopped, true, "a map background click would clear the new selection");
  } finally {
    restore();
  }
});

test("selection marks exactly one pin, and clears", () => {
  const { maplibre, placed, restore } = stage();
  try {
    const markers = createMarkers({ map: {}, maplibre, onSelect: () => {} });
    markers.setLocations(locations);

    markers.setSelected("LOC-003");
    const selected = placed.filter((m) => m.element.classList.contains("is-selected"));
    assert.equal(selected.length, 1);
    assert.equal(selected[0].element.dataset.locationId, "LOC-003");
    assert.equal(selected[0].element.getAttribute("aria-current"), "true");

    markers.setSelected(null);
    assert.equal(placed.filter((m) => m.element.classList.contains("is-selected")).length, 0);
  } finally {
    restore();
  }
});

test("redrawing replaces the previous pins rather than stacking them", () => {
  const { maplibre, placed, restore } = stage();
  try {
    const markers = createMarkers({ map: {}, maplibre, onSelect: () => {} });
    markers.setLocations(locations);
    markers.setLocations(locations);
    assert.equal(placed.length, 18, "the first set must be removed");

    markers.dispose();
    assert.equal(placed.length, 0);
    assert.equal(markers.count, 0);
  } finally {
    restore();
  }
});

test("38/217: nearby grouping changes with zoom without changing geographic records", () => {
  const records = [locations[0], locations[1], locations[2]];
  const before = JSON.stringify(records);
  const project = scale => ([x,y]) => ({x:x*scale,y:y*scale});
  assert.equal(groupNearbyLocations(records, project(100)).length,1);
  assert.equal(groupNearbyLocations(records, project(1e7)).length,3);
  assert.deepEqual(groupNearbyLocations(records, project(100))[0].locations.map(l => l.id), records.map(l => l.id));
  assert.equal(JSON.stringify(records),before);
});

test("38/217: zoom regroup retains selected ID, current filters and removes listeners on dispose", () => {
  const { maplibre, placed, restore } = stage();
  const events = new Map(); let scale = 100;
  const map = { project:([x,y]) => ({x:x*scale,y:y*scale}),
    on:(event,fn) => events.set(event,fn), off:(event,fn) => { if (events.get(event)===fn) events.delete(event); } };
  try {
    const markers = createMarkers({ map, maplibre, onSelect:()=>{} });
    markers.setLocations(locations.slice(0,3)); markers.setSelected("LOC-002");
    assert.equal(placed.length,1);
    assert.equal(placed[0].element.children[1].hidden,false);
    scale=1e7; events.get("zoomend")();
    assert.equal(placed.length,3);
    assert.equal(placed.find(m => m.element.dataset.locationId==="LOC-002").element.getAttribute("aria-current"),"true");
    markers.setLocations([locations[1]]); scale=100; events.get("zoomend")();
    assert.equal(placed.length,1); assert.equal(markers.count,1);
    markers.dispose(); assert.equal(events.size,0); assert.equal(placed.length,0);
  } finally { restore(); }
});

test("218: circular group activation requests its members without selecting a location", () => {
  const { maplibre, placed, restore } = stage();
  try {
    const members = [locations[0], {...locations[1],position:locations[0].position}];
    const zooms=[], selected=[];
    const markers=createMarkers({map:{},maplibre,onSelect:id=>selected.push(id),onGroup:group=>zooms.push(group)});
    markers.setLocations(members);
    const summary=placed[0].element.children[0];
    assert.equal(summary.textContent,"2");
    assert.match(summary.getAttribute("aria-label"),/Zoom to these locations/);
    summary.click();
    assert.deepEqual(zooms,[members]); assert.deepEqual(selected,[]);
    markers.setLocations(members);
    assert.equal(placed[0].element.children[1].hidden,false,"coincident members remain selectable after regrouping");
    placed[0].element.children[1].children[1].click();
    assert.deepEqual(selected,[members[1].id]);
    markers.dispose();
  } finally {restore();}
});
