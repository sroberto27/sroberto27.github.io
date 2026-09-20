/**
 * Record validation.
 *
 * A small declarative validator with no dependencies, used before every write,
 * export and import. It reports every problem it finds with a positional path
 * so an operator can locate the offending field, and it never repairs, coerces
 * or defaults a value on the way through.
 *
 * The unknown markers below are the reviewed research vocabulary. They are
 * carried verbatim from the workbook into the catalog and on to the interface.
 * Turning one into an empty string, null, false or a favourable claim is a
 * correctness failure, not a formatting choice.
 */

import { isLonLat } from "../spatial/geo.js";
import { isCatalogId, isWorkspaceId } from "./ids.js";

export const UNKNOWN_MARKERS = Object.freeze([
  "Need validation",
  "Information has not been found",
]);

/** Returns the unknown marker carried by a text value, or null. */
export function unknownMarkerIn(value) {
  if (typeof value !== "string") return null;
  return UNKNOWN_MARKERS.find((marker) => value.includes(marker)) ?? null;
}

/** True when the whole value is an unknown marker rather than a qualified note. */
export function isExactlyUnknown(value) {
  return typeof value === "string" && UNKNOWN_MARKERS.includes(value.trim());
}

const CHECKS = {
  string(value, node) {
    if (typeof value !== "string") return "must be a string";
    if (node.minLength !== undefined && value.length < node.minLength) {
      return `must be at least ${node.minLength} characters`;
    }
    if (node.maxLength !== undefined && value.length > node.maxLength) {
      return `must be at most ${node.maxLength} characters`;
    }
    if (node.pattern && !node.pattern.test(value)) return "does not match the required format";
    return null;
  },

  // A display string that may legitimately carry an unknown marker.
  text(value, node) {
    const base = CHECKS.string(value, { ...node, minLength: node.minLength ?? 1 });
    return base;
  },

  number(value, node) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "must be a finite number";
    }
    if (node.integer && !Number.isInteger(value)) return "must be an integer";
    if (node.min !== undefined && value < node.min) return `must be at least ${node.min}`;
    if (node.max !== undefined && value > node.max) return `must be at most ${node.max}`;
    if (node.exclusiveMin !== undefined && value <= node.exclusiveMin) {
      return `must be greater than ${node.exclusiveMin}`;
    }
    return null;
  },

  boolean(value) {
    return typeof value === "boolean" ? null : "must be true or false";
  },

  enum(value, node) {
    return node.values.includes(value)
      ? null
      : `must be one of: ${node.values.join(", ")}`;
  },

  lonlat(value) {
    return isLonLat(value) ? null : "must be a [longitude, latitude] pair within valid ranges";
  },

  isoDate(value) {
    if (typeof value !== "string") return "must be an ISO date string";
    return /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(value)
      ? null
      : "must be an ISO date or date-time";
  },

  url(value) {
    if (typeof value !== "string") return "must be a URL string";
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:"
        ? null
        : "must be an http or https URL";
    } catch {
      return "must be a valid URL";
    }
  },

  catalogId(value, node) {
    return isCatalogId(node.kind, value) ? null : `must be a valid ${node.kind} catalog ID`;
  },

  workspaceId(value, node) {
    return isWorkspaceId(value, node.kind) ? null : `must be a valid ${node.kind} ID`;
  },
};

function pushError(errors, path, reason) {
  errors.push({ path, reason });
}

function validateNode(node, value, path, errors) {
  const missing = value === undefined || value === null;
  if (missing) {
    if (node.required) pushError(errors, path, "is required");
    else if (value === null && node.nullable === false) {
      pushError(errors, path, "must not be null");
    }
    return;
  }

  if (node.type === "array") {
    if (!Array.isArray(value)) {
      pushError(errors, path, "must be an array");
      return;
    }
    if (node.minItems !== undefined && value.length < node.minItems) {
      pushError(errors, path, `must contain at least ${node.minItems} items`);
    }
    value.forEach((item, index) => validateNode(node.of, item, `${path}[${index}]`, errors));
    return;
  }

  if (node.type === "object") {
    if (typeof value !== "object" || Array.isArray(value)) {
      pushError(errors, path, "must be an object");
      return;
    }
    validateShape(node.fields, value, path, errors, node.allowExtra !== false);
    return;
  }

  const check = CHECKS[node.type];
  if (!check) {
    pushError(errors, path, `unknown schema type: ${node.type}`);
    return;
  }
  const reason = check(value, node);
  if (reason) pushError(errors, path, reason);
}

function validateShape(fields, value, path, errors, allowExtra) {
  for (const [key, node] of Object.entries(fields)) {
    validateNode(node, value[key], path ? `${path}.${key}` : key, errors);
  }
  if (!allowExtra) {
    for (const key of Object.keys(value)) {
      if (!(key in fields)) {
        pushError(errors, path ? `${path}.${key}` : key, "is not an allowed field");
      }
    }
  }
}

/**
 * Validates a value against a record definition.
 * @returns {{ok: boolean, errors: Array<{path: string, reason: string}>}}
 */
export function validate(definition, value, path = "") {
  const errors = [];
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: [{ path: path || definition.name || "", reason: "must be an object" }] };
  }
  validateShape(definition.fields, value, path, errors, definition.allowExtra !== false);
  return { ok: errors.length === 0, errors };
}

/** Declares a named record definition. */
export function defineRecord(name, fields, options = {}) {
  return Object.freeze({ name, fields, allowExtra: options.allowExtra ?? false });
}

/** Formats errors for a console tool or an import report. */
export function formatErrors(errors, limit = 25) {
  const shown = errors.slice(0, limit).map((e) => `  ${e.path || "(root)"}: ${e.reason}`);
  if (errors.length > limit) shown.push(`  …and ${errors.length - limit} more`);
  return shown.join("\n");
}
