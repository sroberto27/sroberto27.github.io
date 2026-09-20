/**
 * Location catalog record.
 *
 * A location is a physical place. It exists independently of any project, and
 * project notes never write to it. Several locations may share one immersive
 * experience without becoming one record: the six downtown entries inside the
 * shared experience keep their own address, authority questions and history.
 *
 * Every descriptive field is a `text` field rather than a structured value,
 * because the reviewed research vocabulary travels inside these strings. A
 * value may read "Need validation" outright, or carry the marker inline as in
 * "filming, closed-set access, fees and insurance Need validation".
 */

import { defineRecord, unknownMarkerIn } from "./schema.js";

export const CAPTURE_STATUS = Object.freeze(["current", "future"]);

/** Fields whose unknown state must stay visible in the dossier and in exports. */
export const EVIDENCE_SENSITIVE_FIELDS = Object.freeze([
  "propertyAuthority",
  "ownershipStatus",
  "publicHours.text",
  "accessContact",
  "filmingAccess",
  "researchStatus",
]);

export const locationRecord = defineRecord("Location", {
  id: { type: "catalogId", kind: "location", required: true },
  name: { type: "text", required: true },
  areaId: { type: "catalogId", kind: "area", required: true },
  captureStatus: { type: "enum", values: CAPTURE_STATUS, required: true },
  venueType: { type: "text", required: true },
  coverageSummary: { type: "text", required: true },
  address: {
    type: "object",
    required: true,
    fields: {
      street: { type: "text", required: true },
      city: { type: "text", required: true },
      state: { type: "string", required: true, minLength: 2, maxLength: 2 },
      zip: { type: "string", required: true, pattern: /^\d{5}(-\d{4})?$/ },
    },
  },
  position: { type: "lonlat", required: true },
  positionEvidence: { type: "text", required: true },
  operator: { type: "text", required: true },
  propertyAuthority: { type: "text", required: true },
  ownershipStatus: { type: "text", required: true },
  publicHours: {
    type: "object",
    required: true,
    fields: {
      text: { type: "text", required: true },
      evidence: { type: "text", required: true },
    },
  },
  publicPhone: { type: "string", required: false, minLength: 1 },
  accessContact: { type: "text", required: true },
  website: { type: "url", required: false },
  filmingAccess: { type: "text", required: true },
  researchStatus: { type: "text", required: true },
  sourceIds: {
    type: "array",
    required: true,
    minItems: 1,
    of: { type: "catalogId", kind: "source" },
  },
});

export function hasCurrentCapture(location) {
  return location.captureStatus === "current";
}

export function formatAddress(location) {
  const { street, city, state, zip } = location.address;
  return `${street}, ${city}, ${state} ${zip}`;
}

/**
 * Lists the evidence-sensitive fields that carry an unknown marker, so the
 * dossier can show what still needs checking without inspecting every string.
 */
export function openValidationItems(location) {
  return EVIDENCE_SENSITIVE_FIELDS.map((path) => {
    const value = path.split(".").reduce((acc, key) => acc?.[key], location);
    const marker = unknownMarkerIn(value);
    return marker ? { path, marker, value } : null;
  }).filter(Boolean);
}
