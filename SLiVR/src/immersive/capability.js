/**
 * Immersive provider capability record.
 *
 * Every capability starts `unknown` and becomes `true` or `false` only when
 * something was actually observed. That is the whole point of the record: the
 * architecture treats the viewer's runtime behaviour as unverified, and the
 * one uncertainty that can block a phase gate is whether the provider permits
 * embedding from this origin at all.
 *
 * A capability that is `unknown` is never treated as available. It is also
 * never treated as unavailable, because both are findings and neither has been
 * made. Features consult `isAvailable` and fall back when it is not `true`.
 */

export const UNKNOWN = "unknown";

export const CAPABILITY_KEYS = Object.freeze([
  "embedding",
  "messaging",
  "ready",
  "sweepList",
  "sweepSwitchWithoutReload",
  "poseReporting",
]);

/** Adapter contract version, recorded with every bookmark. */
export const ADAPTER_CAPABILITY_VERSION = "treedis-recon-2";

/** A capability record with nothing observed yet. */
export function unknownCapabilities() {
  return Object.freeze({
    version: ADAPTER_CAPABILITY_VERSION,
    ...Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, UNKNOWN])),
  });
}

/** True only when the named capability was observed to work. */
export function isAvailable(capabilities, key) {
  return capabilities?.[key] === true;
}

/**
 * Records an observation.
 *
 * Observations only ever move a capability off `unknown`; the caller decides
 * what it saw. Nothing here infers one capability from another, because
 * "messages arrived, so pose must work" is the kind of inference that puts an
 * unverified claim into the record.
 */
export function observe(capabilities, key, value) {
  if (!CAPABILITY_KEYS.includes(key)) throw new RangeError(`unknown capability: ${key}`);
  if (value !== true && value !== false && value !== UNKNOWN) {
    throw new RangeError(`capability ${key} must be true, false or "${UNKNOWN}"`);
  }
  return Object.freeze({ ...capabilities, [key]: value });
}

/**
 * What the interface may offer, given what is known.
 *
 * The supplied URL encodes an entry, but its rendering remains provider-dependent.
 */
export function describeCapabilities(capabilities) {
  const state = (key) => {
    const value = capabilities?.[key];
    if (value === true) return "available";
    if (value === false) return "not available";
    return UNKNOWN;
  };

  return {
    entryByUrl: "available",
    embedding: state("embedding"),
    messaging: state("messaging"),
    sweepSwitchWithoutReload: state("sweepSwitchWithoutReload"),
    poseReporting: state("poseReporting"),
    // Receiving pose fields does not verify an outbound restore contract.
    bookmarkRestore: isAvailable(capabilities, "poseReporting")
      ? "not verified; reported pose does not establish view restoration"
      : "not verified; only the supplied entry URL is available",
  };
}
