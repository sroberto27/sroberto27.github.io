/**
 * Stable identifiers.
 *
 * Catalog IDs come from the reviewed location workbook and are never
 * regenerated: they are the join key between locations, captures, areas and
 * sources, and they appear in shareable routes. Workspace IDs are generated
 * locally with a type prefix so a record can be recognised in an export or a
 * conflict report without consulting its store.
 *
 * A display name is never used as a foreign key. Renaming a location must not
 * be able to break a capture or candidate relationship.
 */

export const CATALOG_ID_PATTERNS = Object.freeze({
  location: /^LOC-\d{3}$/,
  capture: /^CAP-\d{3}$/,
  area: /^AREA-\d{2}$/,
  source: /^SRC-\d{3}$/,
});

export const WORKSPACE_ID_PREFIXES = Object.freeze({
  project: "prj",
  scene: "scn",
  candidate: "cnd",
  bookmark: "bkm",
  shotScene: "sht",
  sceneObject: "obj",
  path: "pth",
  shot: "shot",
  variant: "var",
  asset: "ast",
});

const WORKSPACE_ID_PATTERN = /^(prj|scn|cnd|bkm|sht|obj|pth|shot|var|ast)_[0-9a-f-]{36}$/;

export function isCatalogId(kind, value) {
  const pattern = CATALOG_ID_PATTERNS[kind];
  return Boolean(pattern) && typeof value === "string" && pattern.test(value);
}

export function isWorkspaceId(value, kind) {
  if (typeof value !== "string" || !WORKSPACE_ID_PATTERN.test(value)) return false;
  if (!kind) return true;
  const prefix = WORKSPACE_ID_PREFIXES[kind];
  return Boolean(prefix) && value.startsWith(`${prefix}_`);
}

/**
 * Generates a workspace ID. Falls back to a random hex composition where
 * crypto.randomUUID is unavailable, so imports and tests work in any runtime.
 */
export function newId(kind) {
  const prefix = WORKSPACE_ID_PREFIXES[kind];
  if (!prefix) throw new RangeError(`unknown workspace record kind: ${kind}`);
  return `${prefix}_${uuid()}`;
}

function uuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Rewrites generated IDs during an add-as-copy import, keeping every internal
 * reference consistent. Catalog IDs are left untouched because the copy still
 * refers to the same real place.
 */
export function createIdRemapper() {
  const mapping = new Map();
  return {
    mapping,
    remap(value) {
      if (!isWorkspaceId(value)) return value;
      if (!mapping.has(value)) {
        const kind = Object.entries(WORKSPACE_ID_PREFIXES).find(
          ([, prefix]) => value.startsWith(`${prefix}_`),
        );
        mapping.set(value, kind ? newId(kind[0]) : value);
      }
      return mapping.get(value);
    },
  };
}
