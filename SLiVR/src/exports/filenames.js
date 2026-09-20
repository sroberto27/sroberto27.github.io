/**
 * Export filenames.
 *
 * A file that leaves the application is often the only copy of the work, so the
 * name has to identify the project, the date and the revision without depending
 * on where it was saved.
 *
 * Sanitisation is deliberately strict. A project name is user text and may
 * contain anything, while the file has to open on Windows, macOS and Linux,
 * survive being emailed, and still identify the work. Segments are reduced to
 * ASCII letters, digits, dot, dash and underscore: accents are decomposed and
 * dropped, every other character becomes a separator, reserved Windows device
 * names are suffixed, and the length is capped.
 *
 * A name written entirely in a non-Latin script leaves nothing behind, so the
 * fallback is used and the record identifier inside the file stays the way to
 * tell two exports apart.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
const NOT_PORTABLE = /[^A-Za-z0-9._-]+/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_SEGMENT = 60;

/** Reduces one piece of user text to a safe filename segment. */
export function sanitizeSegment(value, fallback = "untitled") {
  if (typeof value !== "string") return fallback;
  let text = value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(NOT_PORTABLE, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (text.length > MAX_SEGMENT) text = text.slice(0, MAX_SEGMENT).replace(/-+$/, "");
  if (!text) return fallback;
  if (WINDOWS_RESERVED.test(text)) return `${text}-file`;
  return text;
}

/** Calendar date in the local time zone, as YYYY-MM-DD. */
export function fileDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Builds a predictable export filename.
 *
 * @param {object} parts
 * @param {string} parts.project Project name.
 * @param {string} [parts.scene] Scene or shot-scene name.
 * @param {string} [parts.suffix] What kind of file this is, such as "emergency".
 * @param {number} [parts.revision] Record revision, included when known.
 * @param {string} parts.extension Without a leading dot.
 * @param {string} [parts.date] Pre-formatted date; defaults to today.
 */
export function buildFilename({ project, scene, suffix, revision, extension, date = fileDate() }) {
  const segments = ["SLiVR", sanitizeSegment(project, "project")];
  if (scene) segments.push(sanitizeSegment(scene, "scene"));
  if (suffix) segments.push(sanitizeSegment(suffix, "export"));
  segments.push(date);
  if (Number.isInteger(revision)) segments.push(`r${revision}`);
  return `${segments.join("_")}.${extension}`;
}
