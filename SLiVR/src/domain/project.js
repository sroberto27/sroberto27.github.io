/**
 * Project record: one local production workspace.
 *
 * A project owns scenes, candidates, bookmarks and shot scenes. It never owns
 * a location: candidates reference the catalog by ID and catalog version, so a
 * project note can never rewrite a researched fact.
 *
 * Projects live only in this browser profile. The interface has to say so, and
 * `revision` exists so a stale write cannot overwrite a newer one.
 */

import { defineRecord } from "./schema.js";

export const PROJECT_STATUS = Object.freeze(["active", "archived"]);

export const projectRecord = defineRecord("Project", {
  id: { type: "workspaceId", kind: "project", required: true },
  name: { type: "string", required: true, minLength: 1, maxLength: 160 },
  productionType: { type: "string", required: false, maxLength: 120 },
  description: { type: "string", required: false, maxLength: 4000 },
  status: { type: "enum", values: PROJECT_STATUS, required: true },
  // Scout dates, call times and public hours are all local to the region.
  timeZone: { type: "string", required: true, minLength: 1 },
  createdAt: { type: "isoDate", required: true },
  updatedAt: { type: "isoDate", required: true },
  revision: { type: "number", required: true, integer: true, min: 1 },
});

/** A new project with no scenes, candidates or designs. */
export function createProject({ id, name, timeZone, now, productionType = "", description = "" }) {
  return {
    id,
    name,
    productionType,
    description,
    status: "active",
    timeZone,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
}
