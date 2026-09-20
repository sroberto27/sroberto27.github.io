/**
 * Moves the immersive capture URLs in the reviewed workbook to another host.
 *
 * The provider serves the same tours from more than one host. Which one the
 * catalog records is a real decision, so it is made once in the workbook, the
 * source the catalog is generated from, rather than rewritten downstream where
 * the record and the data would disagree.
 *
 * Only the host of a capture URL changes. Path, sweep and entry orientation
 * are carried through untouched, and every other cell in the workbook is
 * compared before and after so an edit cannot quietly alter something else.
 *
 * Run by hand, with the workbook closed in Excel:
 *   node tools/rehost-captures.mjs --to https://spaces.dtsxr.com
 *   node tools/rehost-captures.mjs --to https://spaces.dtsxr.com --apply
 *
 * Without `--apply` it reports what would change and writes nothing.
 */

import { existsSync, copyFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { readParts, writeParts, readWorkbook } from "./lib/xlsx.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKBOOK = resolve(ROOT, "outputs/location_database/SLiVR_Location_Scouting_Database.xlsx");
const SHEET = "Capture Inventory";
const URL_COLUMN = "Treedis URL";

/** Parts that can hold cell text. Styles and relationships are never touched. */
const TEXT_PARTS = /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/;

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

/** Rewrites only the host of a tour URL, leaving everything after it intact. */
export function rehost(url, toOrigin) {
  const target = new URL(toOrigin);
  const source = new URL(url);
  source.protocol = target.protocol;
  source.host = target.host;
  return source.toString();
}

/** Capture URLs in the workbook, with the row they came from. */
function captureUrls(workbookPath) {
  const sheets = readWorkbook(workbookPath);
  const rows = sheets.get(SHEET);
  if (!rows) throw new Error(`${SHEET}: sheet not found`);

  const header = rows.findIndex((row) => row.includes(URL_COLUMN));
  if (header === -1) throw new Error(`${SHEET}: no "${URL_COLUMN}" column`);
  const column = rows[header].indexOf(URL_COLUMN);
  const idColumn = rows[header].indexOf("Capture ID");

  return rows
    .slice(header + 1)
    .map((row) => ({ id: row[idColumn] ?? "", url: row[column] ?? "" }))
    .filter((entry) => entry.url.startsWith("http"));
}

function main() {
  const toOrigin = argument("--to");
  const apply = process.argv.includes("--apply");

  if (!toOrigin) {
    console.error("Specify the destination host, for example --to https://spaces.dtsxr.com");
    process.exitCode = 2;
    return;
  }
  if (!existsSync(WORKBOOK)) {
    console.error(`Workbook not found: ${WORKBOOK}`);
    process.exitCode = 2;
    return;
  }
  if (existsSync(resolve(dirname(WORKBOOK), `~$${basename(WORKBOOK)}`))) {
    console.error("The workbook is open in Excel. Close it first, or a save will overwrite this edit.");
    process.exitCode = 2;
    return;
  }

  const before = captureUrls(WORKBOOK);
  const moves = before
    .map((entry) => ({ ...entry, next: rehost(entry.url, toOrigin) }))
    .filter((entry) => entry.next !== entry.url);

  console.log(`${before.length} capture URL(s) in "${SHEET}"; ${moves.length} would move to ${toOrigin}`);
  for (const move of moves) console.log(`  ${move.id}  ${new URL(move.url).origin} -> ${new URL(move.next).origin}`);
  if (moves.length === 0) return;

  if (!apply) {
    console.log("\nNothing written. Re-run with --apply to change the workbook.");
    return;
  }

  const backup = `${WORKBOOK}.bak`;
  copyFileSync(WORKBOOK, backup);

  const parts = readParts(WORKBOOK);
  const edited = new Map();
  let replacements = 0;
  for (const [name, content] of parts) {
    if (!TEXT_PARTS.test(name)) {
      edited.set(name, content);
      continue;
    }
    let xml = content.toString("utf8");
    for (const move of moves) {
      // Cell text is XML-escaped, so the ampersands in the query are entities.
      const from = move.url.replaceAll("&", "&amp;");
      const to = move.next.replaceAll("&", "&amp;");
      if (xml.includes(from)) {
        xml = xml.replaceAll(from, to);
        replacements += 1;
      }
    }
    edited.set(name, Buffer.from(xml, "utf8"));
  }

  if (replacements < moves.length) {
    console.error(
      `Only ${replacements} of ${moves.length} URLs were found in the workbook parts. Nothing written.`,
    );
    process.exitCode = 1;
    return;
  }

  writeParts(WORKBOOK, edited);

  // Read the result back and compare every cell, not only the ones edited.
  const originalSheets = readWorkbook(backup);
  const writtenSheets = readWorkbook(WORKBOOK);
  const expected = new Map();
  for (const move of moves) expected.set(move.url, move.next);

  let drift = 0;
  for (const [name, rows] of originalSheets) {
    const after = writtenSheets.get(name) ?? [];
    for (let r = 0; r < rows.length; r += 1) {
      for (let c = 0; c < rows[r].length; c += 1) {
        const was = rows[r][c];
        const now = after[r]?.[c];
        if (now === was) continue;
        if (expected.get(was) === now) continue;
        drift += 1;
        if (drift <= 5) console.error(`  unexpected change in ${name} r${r + 1}c${c + 1}: ${was} -> ${now}`);
      }
    }
  }

  if (drift > 0) {
    copyFileSync(backup, WORKBOOK);
    console.error(`${drift} unexpected cell change(s). The workbook was restored from the backup.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${replacements} URL(s) rewritten and verified. Backup kept at ${basename(backup)}.`);
  console.log("Regenerate the catalog next: node tools/build-catalog.mjs");
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("rehost-captures.mjs")) {
  main();
}
