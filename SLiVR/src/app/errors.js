/**
 * Presenting failures to the user.
 *
 * The data modules return classified codes; this module turns one into a
 * heading, an explanation and the actions that actually recover from it. The
 * message says what was not done, so the user knows whether their work is
 * still intact.
 *
 * Nothing here invents a cause. An unrecognised code is reported as
 * unrecognised, together with the original message, rather than replaced by a
 * reassuring generic sentence.
 */

import { CATALOG_ERROR_CODES } from "../data/catalog-repo.js";
import { TRANSFER_ERROR_CODES } from "../data/transfer.js";
import { IDB_ERROR_CODES } from "../data/idb.js";
import { REPO_ERROR_CODES } from "../data/workspace-repo.js";

const PRESENTATION = new Map([
  [
    CATALOG_ERROR_CODES.fetchFailed,
    {
      title: "The location catalog could not be loaded",
      advice: "The catalog files were not reachable. No locations are shown, rather than a partial list.",
      actions: ["retry"],
    },
  ],
  [
    CATALOG_ERROR_CODES.notJson,
    {
      title: "The location catalog is not readable",
      advice: "A catalog file is not in the expected form. Nothing was loaded.",
      actions: ["retry"],
    },
  ],
  [
    CATALOG_ERROR_CODES.versionMismatch,
    {
      title: "The catalog files are from different versions",
      advice:
        "Mixing versions would show facts from two different research snapshots, so nothing was loaded.",
      actions: ["retry"],
    },
  ],
  [
    CATALOG_ERROR_CODES.invalid,
    {
      title: "The location catalog failed validation",
      advice:
        "The catalog was rejected as a whole. No partially corrupted catalog is loaded. The failing fields are listed below.",
      actions: ["retry"],
    },
  ],
  [
    TRANSFER_ERROR_CODES.invalidJson,
    {
      title: "That file is not valid JSON",
      advice: "Nothing was imported and your workspace is unchanged.",
      actions: ["dismiss"],
    },
  ],
  [
    TRANSFER_ERROR_CODES.notEnvelope,
    {
      title: "That file is not a SLiVR project export",
      advice: "Nothing was imported and your workspace is unchanged.",
      actions: ["dismiss"],
    },
  ],
  [
    TRANSFER_ERROR_CODES.unsupportedVersion,
    {
      title: "That file was written by a different version",
      advice:
        "It was not imported, because reading it partially could drop records this build does not know about.",
      actions: ["dismiss"],
    },
  ],
  [
    TRANSFER_ERROR_CODES.invalidPayload,
    {
      title: "That file did not pass validation",
      advice: "Validation runs before any write, so nothing in your workspace was changed.",
      actions: ["dismiss"],
    },
  ],
  [
    TRANSFER_ERROR_CODES.brokenReference,
    {
      title: "That file has a broken internal reference",
      advice: "Nothing was imported and your workspace is unchanged.",
      actions: ["dismiss"],
    },
  ],
  [
    TRANSFER_ERROR_CODES.conflictUnresolved,
    {
      title: "That project already exists here",
      advice: "Choose whether to cancel, add it as a copy, or replace the existing project.",
      actions: ["cancel", "copy", "replace"],
    },
  ],
  [
    IDB_ERROR_CODES.unavailable,
    {
      title: "Local storage is unavailable",
      advice:
        "SLiVR is running without saving. Your work stays in this tab only. Export it before closing.",
      actions: ["emergency-export"],
    },
  ],
  [
    IDB_ERROR_CODES.blocked,
    {
      title: "Another SLiVR tab is holding the database open",
      advice: "Close the other tab and retry.",
      actions: ["retry"],
    },
  ],
  [
    IDB_ERROR_CODES.openFailed,
    {
      title: "The local database could not be opened",
      advice: "SLiVR is running without saving. Export your work before closing this tab.",
      actions: ["retry", "emergency-export"],
    },
  ],
  [
    IDB_ERROR_CODES.transactionFailed,
    {
      title: "That change could not be saved",
      advice: "Your work is still open and unchanged in this tab. Retry, or export it now.",
      actions: ["retry", "emergency-export"],
    },
  ],
  [
    IDB_ERROR_CODES.writeFailed,
    {
      title: "That change could not be saved",
      advice: "Your work is still open and unchanged in this tab. Retry, or export it now.",
      actions: ["retry", "emergency-export"],
    },
  ],
  [
    REPO_ERROR_CODES.invalidRecord,
    {
      title: "That record did not pass validation",
      advice: "Validation runs before the write, so nothing was stored.",
      actions: ["dismiss"],
    },
  ],
  [
    REPO_ERROR_CODES.misconfigured,
    {
      title: "The workspace storage configuration is unusable",
      advice: "SLiVR did not open a database, because the configured identity is outside its own namespace.",
      actions: ["dismiss"],
    },
  ],
]);

/**
 * Turns a classified failure into something presentable.
 *
 * @param {{code?: string, message?: string, problems?: Array}} failure
 */
export function presentError(failure) {
  const code = failure?.code ?? "unknown";
  const known = PRESENTATION.get(code);
  return {
    code,
    title: known?.title ?? "Something did not complete",
    advice:
      known?.advice ??
      "This failure is not one SLiVR recognises. The original message is shown below unchanged.",
    detail: failure?.message ?? "",
    problems: failure?.problems ?? failure?.detail?.errors ?? [],
    actions: known?.actions ?? ["dismiss"],
    recognised: Boolean(known),
  };
}
