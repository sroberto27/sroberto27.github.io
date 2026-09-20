/**
 * Shot scene and the records it owns: scene objects, movement paths and
 * imported reference assets.
 *
 * A shot scene works in local ENU metres around `origin`, with `northOffsetDeg`
 * describing how the scene +Y axis relates to true north. Everything persisted
 * is metric; feet and inches exist only at an input or output boundary.
 *
 * `frameVersion` increments when calibration changes. Existing variants and
 * review snapshots keep the frame version they were authored in, so a
 * recalibration cannot silently move geometry that someone already approved.
 *
 * `accuracyMode` is the honest label for how much the numbers mean. A schematic
 * scene must never present itself as measured.
 */

import { defineRecord } from "./schema.js";

export const ACCURACY_MODE = Object.freeze([
  "schematic",
  "approximatelyAligned",
  "measuredCalibrated",
]);

export const SCENE_OBJECT_TYPES = Object.freeze([
  "camera",
  "actor",
  "mark",
  "prop",
  "set",
  "lightingUnit",
  "vehicle",
  "annotation",
]);

const transform = {
  type: "object",
  required: true,
  fields: {
    // Metres in the scene frame; z is height above the floor the object sits on.
    x: { type: "number", required: true },
    y: { type: "number", required: true },
    z: { type: "number", required: true },
    headingDeg: { type: "number", required: true },
    pitchDeg: { type: "number", required: false },
    rollDeg: { type: "number", required: false },
    scale: { type: "number", required: false, exclusiveMin: 0 },
  },
};

export const shotSceneRecord = defineRecord("ShotScene", {
  id: { type: "workspaceId", kind: "shotScene", required: true },
  projectId: { type: "workspaceId", kind: "project", required: false },
  sceneId: { type: "workspaceId", kind: "scene", required: false },
  candidateId: { type: "workspaceId", kind: "candidate", required: false },
  locationId: { type: "catalogId", kind: "location", required: false },
  catalogVersion: { type: "string", required: false, minLength: 1 },
  name: { type: "string", required: true, minLength: 1, maxLength: 160 },
  origin: {
    type: "object",
    required: true,
    fields: {
      lon: { type: "number", required: true, min: -180, max: 180 },
      lat: { type: "number", required: true, min: -90, max: 90 },
      groundElevationM: { type: "number", required: true },
      elevationDatum: { type: "string", required: true, minLength: 1 },
    },
  },
  northOffsetDeg: { type: "number", required: true },
  units: { type: "enum", values: ["metric", "imperial"], required: true },
  backgroundRef: {
    type: "object",
    required: false,
    fields: {
      kind: { type: "enum", values: ["none", "aerial", "plan", "grid"], required: true },
      assetId: { type: "workspaceId", kind: "asset", required: false },
      note: { type: "string", required: false, maxLength: 1000 },
    },
  },
  calibration: {
    type: "object",
    required: true,
    fields: {
      accuracyMode: { type: "enum", values: ACCURACY_MODE, required: true },
      method: { type: "string", required: false, maxLength: 200 },
      // Reported in metres alongside the badge, because the badge alone invites
      // more confidence than the measurement supports.
      residualEstimateM: { type: "number", required: false, min: 0 },
      date: { type: "isoDate", required: false },
    },
  },
  activeVariantId: { type: "workspaceId", kind: "variant", required: false },
  frameVersion: { type: "number", required: true, integer: true, min: 1 },
  createdAt: { type: "isoDate", required: true },
  updatedAt: { type: "isoDate", required: true },
  revision: { type: "number", required: true, integer: true, min: 1 },
});

export const sceneObjectRecord = defineRecord("SceneObject", {
  id: { type: "workspaceId", kind: "sceneObject", required: true },
  shotSceneId: { type: "workspaceId", kind: "shotScene", required: true },
  type: { type: "enum", values: SCENE_OBJECT_TYPES, required: true },
  label: { type: "string", required: true, minLength: 1, maxLength: 160 },
  transform,
  props: { type: "object", required: true, allowExtra: true, fields: {} },
  revision: { type: "number", required: true, integer: true, min: 1 },
});

export const pathRecord = defineRecord("Path", {
  id: { type: "workspaceId", kind: "path", required: true },
  shotSceneId: { type: "workspaceId", kind: "shotScene", required: true },
  ownerObjectId: { type: "workspaceId", kind: "sceneObject", required: true },
  points: {
    type: "array",
    required: true,
    of: {
      type: "object",
      fields: {
        x: { type: "number", required: true },
        y: { type: "number", required: true },
        z: { type: "number", required: false },
        // Seconds from the start of the move; the first point is normally zero.
        atS: { type: "number", required: false, min: 0 },
      },
    },
  },
  interpolation: { type: "enum", values: ["linear", "smooth"], required: true },
  durationS: { type: "number", required: false, min: 0 },
  revision: { type: "number", required: true, integer: true, min: 1 },
});

/**
 * Imported reference image owned by the user, such as a floor plan.
 *
 * Provider imagery is never stored here and never enters an export. The binary
 * payload representation is deliberately left open until floor-plan import is
 * built in Phase 4; this record carries identity and provenance so the
 * repository and the transfer envelope can move an asset without interpreting
 * it.
 */
export const assetRecord = defineRecord(
  "Asset",
  {
    id: { type: "workspaceId", kind: "asset", required: true },
    shotSceneId: { type: "workspaceId", kind: "shotScene", required: true },
    kind: { type: "string", required: true, minLength: 1, maxLength: 64 },
    provenance: { type: "string", required: true, minLength: 1, maxLength: 1000 },
    originalWidth: { type: "number", required: false, integer: true, exclusiveMin: 0 },
    originalHeight: { type: "number", required: false, integer: true, exclusiveMin: 0 },
    revision: { type: "number", required: true, integer: true, min: 1 },
  },
  { allowExtra: true },
);
