/**
 * Hash routing.
 *
 * The application is served as static files from a sub-path with no rewrite
 * support, so a path route cannot be opened directly or shared. A hash route
 * keeps the approved route grammar working on any static host (D016).
 *
 * Routes carry record identifiers only. A project name, a note or any other
 * private content must never appear in a URL, because URLs are pasted into
 * messages and recorded in browser history.
 *
 * Parsing is a pure function so the grammar can be tested without a browser. An
 * unknown route parses successfully into a `not-found` route rather than
 * throwing: the application has to stay usable when a shared link is stale.
 */

/** Route grammar. The first matching pattern wins, so longer paths come first. */
const ROUTE_TABLE = [
  { name: "explore", mode: "explore", segments: ["explore"], params: [] },
  { name: "location", mode: "explore", segments: ["location", ":locationId"], params: ["locationId"] },
  { name: "projects", mode: "projects", segments: ["projects"], params: [] },
  {
    name: "project-scene",
    mode: "projects",
    segments: ["project", ":projectId", "scene", ":sceneId"],
    params: ["projectId", "sceneId"],
  },
  { name: "project", mode: "projects", segments: ["project", ":projectId"], params: ["projectId"] },
  { name: "immersive-index", mode: "immersive", segments: ["immersive"], params: [] },
  {
    name: "immersive",
    mode: "immersive",
    segments: ["immersive", ":locationId"],
    params: ["locationId"],
  },
  { name: "shot-index", mode: "shot", segments: ["shot"], params: [] },
  { name: "shot", mode: "shot", segments: ["shot", ":shotSceneId"], params: ["shotSceneId"] },
];

export const DEFAULT_ROUTE = Object.freeze({ name: "explore", params: {}, query: {} });

export const MODES = Object.freeze([
  { id: "explore", label: "Explore", route: { name: "explore" } },
  { id: "projects", label: "Projects", route: { name: "projects" } },
  { id: "immersive", label: "Immersive", route: { name: "immersive-index" } },
  { id: "shot", label: "Shot Designer", route: { name: "shot-index" } },
]);

function definitionFor(name) {
  return ROUTE_TABLE.find((route) => route.name === name) ?? null;
}

/**
 * Parses a location hash into a route.
 *
 * @param {string} hash With or without the leading `#`.
 * @returns {{name: string, mode: string, params: object, query: object, hash: string, raw?: string}}
 */
export function parseRoute(hash) {
  const text = typeof hash === "string" ? hash : "";
  const withoutHash = text.startsWith("#") ? text.slice(1) : text;
  const [pathPart, queryPart = ""] = withoutHash.split("?");

  const segments = pathPart
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => safeDecode(segment));

  const query = parseQuery(queryPart);

  if (segments.length === 0) {
    return { ...DEFAULT_ROUTE, mode: "explore", query, hash: routeToHash(DEFAULT_ROUTE) };
  }

  for (const definition of ROUTE_TABLE) {
    if (definition.segments.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < definition.segments.length; i += 1) {
      const expected = definition.segments[i];
      if (expected.startsWith(":")) {
        if (!segments[i]) {
          matched = false;
          break;
        }
        params[expected.slice(1)] = segments[i];
      } else if (expected !== segments[i].toLowerCase()) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    const route = { name: definition.name, mode: definition.mode, params, query };
    return { ...route, hash: routeToHash(route) };
  }

  return {
    name: "not-found",
    mode: "explore",
    params: {},
    query,
    raw: withoutHash,
    hash: text.startsWith("#") ? text : `#${withoutHash}`,
  };
}

/**
 * Serialises a route back to a hash.
 *
 * Deterministic: the same route always produces the same string, so comparing
 * the current hash with the intended one is a reliable re-entrancy check.
 */
export function routeToHash(route) {
  const definition = definitionFor(route?.name);
  if (!definition) return "#/explore";

  const path = definition.segments
    .map((segment) =>
      segment.startsWith(":") ? encodeURIComponent(route.params?.[segment.slice(1)] ?? "") : segment,
    )
    .join("/");

  const query = route.query ?? {};
  const pairs = Object.keys(query)
    .sort()
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`);

  return `#/${path}${pairs.length > 0 ? `?${pairs.join("&")}` : ""}`;
}

/** The workspace mode a route belongs to. */
export function routeMode(route) {
  return definitionFor(route?.name)?.mode ?? "explore";
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseQuery(text) {
  const query = {};
  if (!text) return query;
  for (const pair of text.split("&")) {
    if (!pair) continue;
    const [rawKey, rawValue = ""] = pair.split("=");
    if (!rawKey) continue;
    query[safeDecode(rawKey)] = safeDecode(rawValue);
  }
  return query;
}

/**
 * Binds route changes to a window.
 *
 * There is exactly one path into the route state: the hash changes, and the
 * listener applies it. A programmatic navigation writes the hash and lets that
 * listener do the work, instead of applying the route itself and then being
 * told about its own write, which is how a router ends up reporting the same
 * route twice and re-entering its own handler.
 *
 * `lastHash` is the guard. A hash that has already been applied is ignored,
 * whichever source it arrives from: the initial load, a programmatic
 * navigation, a Back gesture, or the user editing the address bar.
 *
 * @param {object} options
 * @param {Window} options.window
 * @param {(route: object) => void} options.onRoute
 */
export function createRouter({ window: win, onRoute }) {
  let lastHash = null;
  let current = null;

  function handle() {
    const hash = win.location.hash || routeToHash(DEFAULT_ROUTE);
    if (hash === lastHash) return;
    lastHash = hash;
    current = parseRoute(hash);
    onRoute(current);
  }

  /**
   * Navigates to a route.
   *
   * Assigning the hash is what triggers the listener. `replace` uses the
   * History API, which fires no event, so that path applies the route directly.
   */
  function navigate(route, { replace = false } = {}) {
    const hash = routeToHash(route);
    if (win.location.hash === hash) {
      handle();
      return;
    }
    if (replace && typeof win.history?.replaceState === "function") {
      win.history.replaceState(null, "", `${win.location.pathname}${win.location.search}${hash}`);
      handle();
      return;
    }
    win.location.hash = hash;
  }

  function start() {
    win.addEventListener("hashchange", handle);
    win.addEventListener("popstate", handle);
    if (!win.location.hash) navigate(DEFAULT_ROUTE, { replace: true });
    else handle();
    return current;
  }

  function stop() {
    win.removeEventListener("hashchange", handle);
    win.removeEventListener("popstate", handle);
  }

  return { start, stop, navigate, get current() { return current; } };
}
