/* Loads onnxruntime-web for the lab page.

   Uses the same bundled ESM build the refine worker uses, from the same
   shared vendor/ folder as the app, so the lab exercises exactly what
   ships rather than a second copy that could drift.
*/
import * as ort from '../vendor/ort.wasm.bundle.min.mjs';
window.ort = ort;
window.__ortReady = Promise.resolve(ort);
