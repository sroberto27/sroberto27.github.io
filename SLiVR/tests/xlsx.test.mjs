import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkbook, writeParts } from '../tools/lib/xlsx.mjs';

test('XLSX empty cells and rows do not consume following capture dates or other values', () => {
  const parent = fileURLToPath(new URL('../outputs/', import.meta.url));
  mkdirSync(parent, { recursive: true });
  const folder = mkdtempSync(join(parent, 'xlsx-test-'));
  try {
    const path = join(folder, 'fixture.xlsx');
    writeParts(path, new Map([
      ['xl/workbook.xml', '<workbook><sheets><sheet name="Fixture" sheetId="1" r:id="r1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"/><row r="2"><c r="A2" t="str"/><c r="B2" t="str"/><c r="C2" t="str"><v>Information has not been found</v></c><c r="D2"><v>30.228764095274858</v></c></row></sheetData></worksheet>'],
    ]));
    const rows = readWorkbook(path).get('Fixture');
    assert.deepEqual(rows.at(-1), ['', '', 'Information has not been found', '30.228764095274858']);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
