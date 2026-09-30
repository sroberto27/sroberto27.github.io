import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
function inventory(dirs,initial=[]) {
  const files=[...initial];
  function walk(dir){for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})){const path=`${dir}/${entry.name}`;if(entry.isDirectory())walk(path);else files.push(path);}}
  dirs.forEach(walk);
  return files.sort().filter(path=>path!=="config/runtime.js").map(path=>({path,sha256:createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex")}));
}
const runtime=inventory(["src","styles","data","vendor"],["index.html","sw.js","shell-cache.js","config/deployment.js","config/service-worker.js"]);
const tests=inventory(["tests"]);
const digest=files=>createHash("sha256").update(files.map(f=>`${f.path}\0${f.sha256}\n`).join("")).digest("hex");
const report={appVersion:"0.5.0",generatedAt:new Date().toISOString(),node:process.version,platform:process.platform,architecture:process.arch,osRelease:os.release(),runtimeSha256:digest(runtime),testsSha256:digest(tests),runtime,tests};
mkdirSync(resolve(root,"outputs"),{recursive:true});
writeFileSync(resolve(root,"outputs/phase5-build-manifest.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({...report,runtime:runtime.length,tests:tests.length},null,2));
