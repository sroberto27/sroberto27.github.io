import { formatAddress } from "./location.js";

export const MISSING = "Information has not been found";
export const PRACTICAL_FIELDS = Object.freeze([
  ["parking", "Parking"], ["loading", "Loading"], ["basecamp", "Basecamp / holding"],
  ["power", "Power"], ["restrooms", "Restrooms"], ["accessibility", "Accessibility"],
  ["ambientSound", "Ambient sound"], ["trafficImpact", "Traffic / public impact"],
  ["lightOrientation", "Light / orientation"], ["security", "Security"], ["catering", "Catering"],
  ["filmingRules", "Filming rules"], ["permits", "Approval / permit questions"],
  ["availabilityConstraints", "Availability constraints"], ["hazards", "Hazards"],
  ["onSiteValidationPriorities", "On-site validation priorities"],
]);
export const normalizeSearch = value => String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");

/** A description is not a verified practical fact, even when it has no unknown marker. */
export function evidenceState(value) {
  const text = normalizeSearch(value);
  if (!text || /information has not been found|not found|not supplied|not documented/.test(text)) return "missing";
  if (/need[s]? validation|must be confirmed|requires .*confirmation|not verified|not surveyed|validate/.test(text)) return "validation";
  return "reported";
}

/** Search facets describe catalog wording only; they never infer permission or measured geometry. */
export function discoveryFacts(location, detail = {}, capture = {}) {
  const characterText = normalizeSearch(detail.visualCharacter);
  const character = ["historic", "contemporary"].filter(word => characterText.includes(word));
  const spaces = ["interior", "exterior"].filter(word => normalizeSearch(location.coverageSummary).includes(word));
  const values = [location.propertyAuthority, location.ownershipStatus, location.publicHours?.text,
    location.filmingAccess, capture.captureDate, detail.visualCharacter, detail.knownSpaces,
    ...PRACTICAL_FIELDS.map(([key]) => detail[key])];
  const unresolved = values.filter(value => evidenceState(value) !== "reported").length;
  return {
    area: location.areaId, capture: location.captureStatus, venue: location.venueType,
    spaces: spaces.length ? spaces : ["unknown"], character: character.length ? character : ["unknown"],
    hours: evidenceState(location.publicHours?.text) === "reported" ? "reported" : "unknown",
    coverage: capture.state === "current" ? "entry" : "none",
    access: evidenceState(location.filmingAccess), validation: location.researchStatus,
    completeness: unresolved ? "gaps" : "described", unresolved, total: values.length,
  };
}

export function discoverLocations(catalog, { query = "", filters = {}, sort = "catalog", recent = [] } = {}) {
  if (!catalog) return [];
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  const locations = catalog.locations.filter(location => {
    const detail = catalog.scoutDetailsByLocationId.get(location.id) ?? {};
    const capture = catalog.capturesByLocationId.get(location.id) ?? {};
    const facts = discoveryFacts(location, detail, capture);
    const haystack = normalizeSearch([location.id, location.name, formatAddress(location), location.venueType,
      catalog.areasById.get(location.areaId)?.name, location.coverageSummary, detail.visualCharacter,
      detail.knownSpaces, ...PRACTICAL_FIELDS.map(([key, label]) => `${label} ${detail[key] ?? ""}`)].join(" "));
    return terms.every(term => haystack.includes(term)) && Object.entries(filters).every(([key, value]) =>
      !value || (Array.isArray(facts[key]) ? facts[key].includes(value) : facts[key] === value));
  });
  const compare = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
  const rank = id => recent.includes(id) ? recent.indexOf(id) : Number.MAX_SAFE_INTEGER;
  return locations.sort((a, b) => {
    let order = 0;
    if (sort === "name") order = compare(a.name, b.name);
    if (sort === "area") order = compare(catalog.areasById.get(a.areaId)?.name, catalog.areasById.get(b.areaId)?.name) || compare(a.name, b.name);
    if (sort === "capture") order = compare(a.captureStatus, b.captureStatus) || compare(a.name, b.name);
    if (sort === "recent") order = rank(a.id) - rank(b.id);
    return order || compare(a.id, b.id);
  });
}

/** Share only a public stable ID, stripping query strings and workspace context. */
export function publicLocationLink(href, locationId) {
  const url = new URL(href);
  url.search = "";
  url.hash = `/location/${encodeURIComponent(locationId)}`;
  return url.href;
}
