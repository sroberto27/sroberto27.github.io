import { bookmarkRecord, bookmarkOwnershipErrors } from "../domain/bookmark.js";
import { validate } from "../domain/schema.js";
import { ADAPTER_CAPABILITY_VERSION } from "./capability.js";

export const ENTRY_BOOKMARK_VERSION = `${ADAPTER_CAPABILITY_VERSION}/entry-only-1`;
export const ENTRY_LIMITATION = "Entry only: reopens the saved location entry, not your camera angle or position inside the tour. Capture date, coverage and provider revision remain unverified.";

export function createEntryBookmark({ id, project, candidate, catalog, capture, name, note, now }) {
  const bookmark = {
    id, projectId: project?.id, locationId: capture?.locationId, captureId: capture?.id,
    ...(candidate ? { candidateId: candidate.id } : {}),
    catalogVersion: catalog?.version, experienceId: capture?.experienceId, sweepId: capture?.sweepId,
    view: {}, supportedFields: [], name: name?.trim(), note: note ?? "", createdAt: now,
    captureVersionRef: `catalog-${catalog?.version}/${capture?.id}`,
    adapterCapabilityVersion: ENTRY_BOOKMARK_VERSION, revision: 1,
  };
  const errors = validate(bookmarkRecord, bookmark).errors.map(e => `${e.path}: ${e.reason}`);
  errors.push(...bookmarkOwnershipErrors(bookmark, project, candidate));
  const current = catalog?.captures.find(c => c.id === capture?.id);
  if (!current || current.state !== "current" || !current.url
      || current.locationId !== bookmark.locationId || current.experienceId !== bookmark.experienceId
      || current.sweepId !== bookmark.sweepId
      || !catalog.locations.some(l => l.id === bookmark.locationId)) errors.push("A current catalog entry is required.");
  return errors.length ? { ok: false, message: errors.join(" ") } : { ok: true, bookmark };
}

/** Never reinterpret old pose fields or silently redirect a retired entry. */
export function bookmarkRestoration(bookmark, bundle, catalog) {
  if (!bookmark) return { ok: false, message: "This bookmark is unavailable in the selected project." };
  const errors = bookmarkOwnershipErrors(bookmark, bundle?.projects?.[0],
    bundle?.candidates?.find(c => c.id === bookmark.candidateId));
  if (errors.length) return { ok: false, message: errors.join(" ") };
  if (!validate(bookmarkRecord, bookmark).ok) return { ok: false, message: "The bookmark record is invalid; its data is retained." };
  const capture = catalog?.captures.find(c => c.id === bookmark.captureId);
  if (!capture || capture.state !== "current" || !capture.url
      || !catalog.locations.some(l => l.id === bookmark.locationId)
      || capture.locationId !== bookmark.locationId || capture.experienceId !== bookmark.experienceId
      || capture.sweepId !== bookmark.sweepId) {
    return { ok: false, message: "This saved entry is retired or changed. The bookmark and note are retained; choose a current location separately." };
  }
  if (bookmark.adapterCapabilityVersion !== ENTRY_BOOKMARK_VERSION || bookmark.supportedFields.length
      || Object.keys(bookmark.view).length
      || bookmark.captureVersionRef !== `catalog-${bookmark.catalogVersion}/${bookmark.captureId}`) {
    return { ok: false, message: "This saved view uses an unverified restoration contract. Its original values are retained; choose a current location entry separately." };
  }
  return { ok: true, capture, message: ENTRY_LIMITATION + (bookmark.catalogVersion !== catalog.version
    ? ` Saved against catalog ${bookmark.catalogVersion}; current catalog is ${catalog.version}.` : "") };
}
