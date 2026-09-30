import { readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const files=["index.html","config/deployment.js","config/service-worker.js"];
function walk(dir) {
  for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})) {
    const path=`${dir}/${entry.name}`;
    if(entry.isDirectory()) walk(path);
    else if(/\.(js|css|json|html|woff2)$/.test(path)) files.push(path);
  }
}
for(const dir of ["src","styles","data","vendor"]) walk(dir);
writeFileSync(resolve(root,"shell-cache.js"), `/* Public shell allowlist. Update with node tools/build-shell-cache.mjs. */\nself.SLIVR_SHELL = ${JSON.stringify(files.sort().map(path=>`./${path}`),null,2)};\n`);
