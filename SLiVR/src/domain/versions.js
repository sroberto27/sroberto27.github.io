/**
 * Contract versions that appear in stored and transferred data.
 *
 * These are data-format identifiers, not a product version. Changing the
 * workspace version requires an IndexedDB upgrade path; changing the transfer
 * version decides whether another build will accept an exported file.
 */

export const APP_VERSION = "0.2.0";

/** Envelope version written by the exporter and checked by the importer. */
export const TRANSFER_SCHEMA_VERSION = "1.0.0";

/** IndexedDB version. Must agree with region config `storage.databaseVersion`. */
export const WORKSPACE_SCHEMA_VERSION = 1;

/** Parses a dotted version, or null when it is not one. */
export function parseVersion(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Whether this build can read an envelope of the given version.
 *
 * The same major line is required, and a newer minor is refused rather than
 * partially read: a file written by a later build may carry records this one
 * would silently drop.
 */
export function canReadTransferVersion(value, current = TRANSFER_SCHEMA_VERSION) {
  const other = parseVersion(value);
  const mine = parseVersion(current);
  if (!other || !mine) return false;
  if (other.major !== mine.major) return false;
  return other.minor <= mine.minor;
}
