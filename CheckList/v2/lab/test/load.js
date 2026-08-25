/* Loads the browser-style IIFE modules into node's global scope so the
   same files serve the app, the lab page and these tests.

   Paths are resolved from the app root (CheckList/v2), not from lab/,
   because the modules under pano/ are the SHIPPING copies. The lab tests
   deliberately exercise the exact files the app loads — keeping a second
   copy under lab/ would let the two drift, and a geometry fix that landed
   in only one of them would be invisible here.
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  (0, eval)(src);
}

module.exports = { load: load, ROOT: ROOT };
