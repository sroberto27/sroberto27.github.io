/**
 * Treedis message protocol.
 *
 * Command vocabulary follows Experimental/js/03-tour-bridge.js. Runtime
 * capabilities are recorded per SLiVR session rather than assumed from SCSU.
 *
 * This module only parses and builds messages. It performs no I/O, so the
 * rules that keep a hostile frame from driving the application can be tested
 * without a browser:
 *
 *  - An inbound message is accepted only from the exact configured origin.
 *    The reference checks the origin only when one happens to be configured;
 *    here a missing or mismatched origin is a rejection.
 *  - An outbound message is posted to the configured origin, never to "*".
 *    The reference posts to "*", which hands every command to whatever
 *    document currently occupies the frame.
 *  - An unrecognised message is reported rather than silently dropped,
 *    because reconnaissance needs to record what the provider actually sent.
 */

/** Commands this application may send. */
export const OUTBOUND_TYPES = Object.freeze(["Ping", "Navigate", "RequestSweeps"]);

/** Messages the viewer is documented to send. */
export const INBOUND_TYPES = Object.freeze([
  "TourReady",
  "PoseChanged",
  "SweepsChanged",
  "TagClicked",
  "TagFocused",
  "TagDocked",
  "TagHovered",
]);

export const MESSAGE_REJECTIONS = Object.freeze({
  wrongOrigin: "message-wrong-origin",
  notAnObject: "message-not-an-object",
  noType: "message-no-type",
  unknownType: "message-unknown-type",
  invalidPayload: "message-invalid-payload",
});

/** Asks the viewer whether its bridge is up yet. */
export function ping() {
  return { type: "Ping" };
}

/**
 * Moves to a sweep.
 *
 * `transitionTime` of 0 is a real value used to pre-warm a target without an
 * animated move, so it is passed through whenever it is a finite number rather
 * than tested for truthiness.
 */
export function navigate(sweepId, { transitionTime, rotation } = {}) {
  if (typeof sweepId !== "string" || sweepId.length === 0) {
    throw new RangeError("navigate requires a sweep id");
  }
  const command = { type: "Navigate", sweepId };
  if (Number.isFinite(transitionTime)) command.transitionTime = transitionTime;
  if (rotation !== undefined && rotation !== null) command.rotation = rotation;
  return command;
}

export function requestSweeps() {
  return { type: "RequestSweeps" };
}

/**
 * Validates an inbound message event.
 *
 * @param {{origin?: string, data?: unknown}} event
 * @param {string} expectedOrigin Exact origin the experience was loaded from.
 * @returns {{ok: true, type: string, data: object, shape: string[]}
 *          |{ok: false, reason: string, detail: object}}
 */
export function readInbound(event, expectedOrigin) {
  if (!expectedOrigin || event?.origin !== expectedOrigin) {
    return {
      ok: false,
      reason: MESSAGE_REJECTIONS.wrongOrigin,
      detail: { origin: event?.origin ?? null, expected: expectedOrigin ?? null },
    };
  }

  const data = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: MESSAGE_REJECTIONS.notAnObject, detail: { received: typeof data } };
  }
  if (typeof data.type !== "string" || data.type.length === 0) {
    return { ok: false, reason: MESSAGE_REJECTIONS.noType, detail: { shape: describeShape(data) } };
  }
  if (!INBOUND_TYPES.includes(data.type)) {
    // Recorded rather than discarded: an undocumented type is a finding.
    return {
      ok: false,
      reason: MESSAGE_REJECTIONS.unknownType,
      detail: { type: data.type, shape: describeShape(data) },
    };
  }

  let valid = true;
  if (data.type === "PoseChanged") {
    const pose = data.pose;
    valid = pose === undefined || (pose !== null && typeof pose === "object" && !Array.isArray(pose));
    for (const fields of [data, pose].filter(value => value && typeof value === "object" && !Array.isArray(value))) {
      for (const key of ["x", "y", "z", "rotationX", "rotationY", "rotationZ", "yawDeg", "pitchDeg", "fovDeg"]) {
        if (key in fields && (!Number.isFinite(fields[key]) || (key === "fovDeg" && fields[key] <= 0))) valid = false;
      }
      for (const key of ["sweep", "sweepId"]) {
        if (key in fields && (typeof fields[key] !== "string" || !fields[key].length)) valid = false;
      }
    }
    valid = valid && readPose(data).fields.length > 0;
  } else if (data.type === "SweepsChanged") {
    const sweeps = readSweeps(data);
    valid = sweeps !== null && sweeps.length === data.sweeps.length;
  }
  if (!valid) {
    return { ok: false, reason: MESSAGE_REJECTIONS.invalidPayload, detail: { shape: describeShape(data) } };
  }

  return { ok: true, type: data.type, data, shape: describeShape(data) };
}

/**
 * Describes a message's structure without keeping its contents.
 *
 * Reconnaissance records need to say what the provider sent, and a captured
 * payload could carry coordinates or identifiers from a private experience.
 * Recording `key:type` keeps the finding and drops the content.
 */
export function describeShape(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value)
    .sort()
    .map((key) => `${key}:${Array.isArray(value[key]) ? "array" : typeof value[key]}`);
}

/**
 * Extracts a pose from a `PoseChanged` payload without inventing one.
 *
 * Observed live on 2026-09-20 against experience `5eb11a1b`, the viewer sends
 * `{ type, sweep, x, y, z, rotationX, rotationY, rotationZ }`. The reference
 * project's notes imply `sweepId`, so both spellings are accepted; the sweep is
 * an identifier either way and there is no ambiguity in reading it.
 *
 * The rotation triple is deliberately *not* mapped onto yaw and pitch. Which
 * axis carries the compass bearing, and whether the values are degrees or
 * radians, has not been established, and guessing would put an unverified
 * number into a bookmark that then restores a confidently wrong direction. The
 * values are carried through under their own names until Phase 2 establishes
 * the convention against a known heading.
 *
 * A field that is absent stays absent. Nothing here defaults to zero.
 *
 * @returns {{fields: string[], values: object, rotationConvention: string}}
 */
export function readPose(data) {
  const values = {};
  const source = (key) => data?.[key] ?? data?.pose?.[key];

  const sweep = source("sweepId") ?? source("sweep");
  if (typeof sweep === "string" && sweep.length > 0) values.sweepId = sweep;

  // Position in the provider's own frame, whatever that frame turns out to be.
  for (const key of ["x", "y", "z"]) {
    const value = source(key);
    if (Number.isFinite(value)) values[key] = value;
  }

  // Raw rotation, unlabelled on purpose.
  for (const key of ["rotationX", "rotationY", "rotationZ"]) {
    const value = source(key);
    if (Number.isFinite(value)) values[key] = value;
  }

  // Accepted only where the viewer names them outright.
  for (const key of ["yawDeg", "pitchDeg"]) {
    const value = source(key);
    if (Number.isFinite(value)) values[key] = value;
  }
  const fov = source("fovDeg");
  if (Number.isFinite(fov) && fov > 0) values.fovDeg = fov;

  return {
    fields: Object.keys(values).sort(),
    values,
    rotationConvention:
      "rotationX, rotationY and rotationZ are carried through unmapped: the axis order, " +
      "reference direction and units have not been established.",
  };
}

/** The sweep list from a `SweepsChanged` payload, or null when unusable. */
export function readSweeps(data) {
  const list = Array.isArray(data?.sweeps) ? data.sweeps : null;
  if (!list) return null;
  return list
    .map((entry) => (typeof entry === "string" ? entry : entry?.sweepId ?? entry?.id ?? null))
    .filter((id) => typeof id === "string" && id.length > 0);
}
