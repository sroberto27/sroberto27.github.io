import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { projectFixture, fixedId } from "./fixtures/project.mjs";
import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";
import { createWorkspaceRepo } from "../src/data/workspace-repo.js";
import { buildEnvelope, serializeEnvelope, parseEnvelope, importEnvelope } from "../src/data/transfer.js";
import { newAssessment } from "../src/domain/scout-assessment.js";
import { projectZip, readProjectFile, PACKAGE_LIMIT } from "../src/exports/project-json.js";
import { packetHtml } from "../src/exports/packet-html.js";
import { projectExportFilename } from "../src/exports/emergency.js";
import { createSaveStatus } from "../src/app/save-status.js";
import { configureServiceWorker } from "../src/app/service-worker.js";
import { createActions, initialState } from "../src/app/actions.js";
import { createStore } from "../src/app/store.js";
import { registerDraft } from "../src/scouting/autosave.js";
import { diagramPng, shotCsv } from "../src/shot-workspace/exports.js";
import { newDiagram } from "../src/shot-workspace/model.js";

const Zip=createRequire(import.meta.url)("../vendor/jszip-3.10.1.min.js");
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const region=JSON.parse(read("data/region/lafayette.region.json"));
const now="2026-09-29T12:00:00.000Z";
function envelope() { return buildEnvelope({bundle:projectFixture(),catalogVersion:"1.1.0",exportedAt:now}); }
function file(bytes) { return {name:"project.zip",size:bytes.length,arrayBuffer:async()=>bytes}; }
async function mediaEnvelope() {
  const { newId }=await import("../src/domain/ids.js");
  const e=envelope(), b=e.payload;
  const a=newAssessment({id:newId("assessment"),projectId:b.projects[0].id,locationId:"LOC-001",catalogVersion:"1.1.0",now});
  const media={id:newId("scoutMedia"),projectId:a.projectId,locationId:a.locationId,filename:"evidence.png",mime:"image/png",size:8,kind:"photo",provenance:"Owned test fixture",createdAt:now,data:"iVBORw0KGgo=",missing:false};
  a.answers.find(a=>a.questionId==="wide-angle").mediaIds=[media.id];
  a.answers.find(a=>a.questionId==="door-count").state="observed";
  a.answers.find(a=>a.questionId==="door-count").numberValue=0;
  a.answers.find(a=>a.questionId==="ambient-noise").state="observed";
  a.answers.find(a=>a.questionId==="ambient-noise").booleanValue=false;
  b.scoutAssessments=[a]; b.scoutMedia=[media];
  b.scoutAssessmentRevisions=[{id:newId("assessmentRevision"),assessmentId:a.id,projectId:a.projectId,locationId:a.locationId,revision:1,snapshot:structuredClone(a)}];
  return buildEnvelope({bundle:b,catalogVersion:"1.1.0",exportedAt:now});
}

test("117/122/211/212: native ZIP recovers stable IDs, immutable evidence and bytes into a clean repository",async()=>{
  const e=await mediaEnvelope(), bytes=await projectZip(serializeEnvelope(e),Zip);
  const parsed=parseEnvelope(await readProjectFile(file(bytes),Zip)); assert.equal(parsed.ok,true,parsed.error?.message);
  assert.equal(parsed.envelope.payload.scoutMedia[0].data,"iVBORw0KGgo=");
  const repo=createWorkspaceRepo({factory:createFakeIndexedDB().factory,storage:region.storage});
  await repo.open();
  const result=await importEnvelope({repo,envelope:parsed.envelope,currentCatalogVersion:"1.1.0"}); assert.equal(result.ok,true);
  const recovered=await repo.loadProjectBundle(e.payload.projects[0].id);
  assert.deepEqual(recovered.scoutAssessmentRevisions,e.payload.scoutAssessmentRevisions);
  assert.deepEqual(recovered.shotScenes,e.payload.shotScenes); assert.equal(recovered.scoutMedia[0].data,"iVBORw0KGgo=");
});
test("211/212: absent ZIP media is explicit and corrupt media is refused",async()=>{
  const e=await mediaEnvelope(), archive=await Zip.loadAsync(await projectZip(serializeEnvelope(e),Zip));
  archive.remove("media/1.bin");
  const recovered=JSON.parse(await readProjectFile(file(await archive.generateAsync({type:"uint8array"})),Zip));
  assert.deepEqual(recovered.mediaReport.missing,[e.payload.scoutMedia[0].id]);
  archive.file("media/1.bin","wrong bytes");
  await assert.rejects(readProjectFile(file(await archive.generateAsync({type:"uint8array"})),Zip),/byte size/);
});
test("211/212: package bounds, undeclared files and duplicate paths reject before persistence",async()=>{
  await assert.rejects(readProjectFile({name:"x.zip",size:PACKAGE_LIMIT+1},Zip),/128 MiB/);
  const z=await Zip.loadAsync(await projectZip(serializeEnvelope(await mediaEnvelope()),Zip));
  z.file("unexpected.txt","not declared");
  await assert.rejects(readProjectFile(file(await z.generateAsync({type:"uint8array"})),Zip),/undeclared/);
  z.remove("unexpected.txt"); const manifest=JSON.parse(await z.file("package.json").async("string"));manifest.files.push(manifest.files[0]);z.file("package.json",JSON.stringify(manifest));
  await assert.rejects(readProjectFile(file(await z.generateAsync({type:"uint8array"})),Zip),/Duplicate/);
});
test("120/211: packet section selection, escaping, false/zero and entry-only limits",async()=>{
  const e=await mediaEnvelope();e.payload.projects[0].name='<script>alert("test")</script>';
  const html=packetHtml({envelope:e,sections:["assessments","bookmarks"]});
  assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("<pre>0</pre>"));assert.ok(html.includes("<pre>false</pre>"));
  assert.ok(!html.includes("<h2>Shot diagrams"));assert.ok(html.includes("Content-Security-Policy"));
  const subset=packetHtml({envelope:e,sections:["assessments"],assessmentSections:["exterior"]});
  assert.ok(subset.includes("door count"));assert.ok(!subset.includes("ambient noise"));
});
test("121: distinct same-name projects cannot collide after filename sanitization",()=>{
  const names=["CON","a/b","a:b","東京","é","e"], files=names.map((name,i)=>projectExportFilename({name,id:fixedId("prj",i),revision:1},now));
  assert.equal(new Set(files).size,names.length);assert.ok(files.every(f=>!/[<>:"/\\|?*]/.test(f)&&f.length<180));
});

test("118/119: PNG title block carries context without inventing north; CSV carries stable IDs",async()=>{
  const b=projectFixture(),record={...b.shotScenes[0],diagram:newDiagram()},texts=[];
  const context=new Proxy({measureText:text=>({width:text.length*8}),fillText:text=>texts.push(text)}, {get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const canvas={getContext:()=>context,toBlob:callback=>callback(new Blob(["PNG"],{type:"image/png"}))};
  await diagramPng(record,null,{createElement:()=>canvas});
  const rendered=texts.join(" ");assert.ok(rendered.includes(record.projectId));assert.ok(rendered.includes(record.sceneId));assert.match(rendered,/North orientation not established/);assert.match(rendered,/image coordinates are pixels/);
  const csv=shotCsv(record);assert.match(csv,/"Project ID"/);assert.match(csv,/"Shot ID"/);
});

test("120/213: packet cites historical decision and diagram evidence revisions",async()=>{
  const e=await mediaEnvelope(),r=e.payload.scoutAssessmentRevisions[0],c=e.payload.candidates[0];
  e.payload.scenes[0].decisions=[{candidateSnapshots:[{...c,evaluations:[{assessmentRevisionId:r.id,questionId:"door-count"}]}]}];
  const html=packetHtml({envelope:e,sections:["evidence"]});assert.ok(html.includes(r.id));assert.ok(html.includes("<pre>0</pre>"));
  assert.ok(!packetHtml({envelope:e,sections:["assessments"],assessmentIds:[]}).includes("door count"));
});

test("114/115: Back restores validated scene/candidate context without overriding pinned assessment",()=>{
  const b=projectFixture(),store=createStore(initialState({})),actions=createActions({store,repo:null,region,saveStatus:createSaveStatus(),router:{navigate(){}},fetchJson:async()=>null});
  store.setState({workingBundle:b,openProjectId:b.projects[0].id});
  const first={name:"project-scene",params:{projectId:b.projects[0].id,sceneId:b.scenes[0].id}},second={name:"project-scene",params:{projectId:b.projects[0].id,sceneId:b.scenes[1].id}};
  actions.applyRoute(first);store.setState({activeCandidateId:b.candidates[0].id,activeAssessmentId:"pinned-assessment"});
  actions.applyRoute(second);actions.applyRoute(first,{historyTraversal:true});
  assert.equal(store.getState().activeSceneId,b.scenes[0].id);assert.equal(store.getState().activeCandidateId,b.candidates[0].id);assert.equal(store.getState().activeAssessmentId,"pinned-assessment");
});
test("116/181: later concurrent success cannot conceal an earlier failure; retry recovers",async()=>{
  const status=createSaveStatus();let release,fail=true;
  const first=status.track(async()=>{if(fail)throw Error("quota");});
  const second=status.track(()=>new Promise(resolve=>{release=resolve;}));await first;release();await second;
  assert.equal((await status.settled()).state,"failed");fail=false;assert.equal((await status.retry()).ok,true);assert.equal(status.status.state,"saved");
});
test("116/181: a newer successful autosave supersedes only the same owned draft failure",async()=>{
  const status=createSaveStatus();let staleRetried=false,otherRecovered=false;
  await status.track(async()=>{staleRetried=true;throw Error("old diagram quota failure");},"diagram:a");staleRetried=false;
  await status.track(async()=>{if(!otherRecovered)throw Error("other failure");},"diagram:b");
  await status.track(async()=>{},"diagram:a");assert.equal(status.status.state,"failed");
  otherRecovered=true;assert.equal((await status.retry()).ok,true);assert.equal(staleRetried,false);assert.equal(status.status.state,"saved");
});
test("115/116/179: failed history navigation restores URL; latest pending transition wins",async()=>{
  const store=createStore(initialState({})), status=createSaveStatus(), routes=[],restored=[];
  const actions=createActions({store,repo:null,region,saveStatus:status,router:{navigate:r=>routes.push(r),restore:r=>restored.push(r)},fetchJson:async()=>null});
  const current={name:"explore",params:{}};actions.applyRoute(current);
  store.setState({save:{state:"failed"}});actions.applyRoute({name:"projects",params:{}});
  assert.equal(store.getState().route,current);assert.deepEqual(restored,[current]);
  store.setState({save:{state:"saved"}});let release;const wait=new Promise(r=>release=r);const unregister=registerDraft(async()=>{await wait;unregister();});
  const first=actions.navigate({name:"projects"}),last=actions.navigate({name:"shot-index"});release();await Promise.all([first,last]);
  assert.deepEqual(routes,[{name:"shot-index"}]);
});
test("131/182: default-off removal filters exact scope and leaves neighboring caches/registrations",async()=>{
  const removed=[],deleted=[];
  const win={location:{href:"https://test/SLiVR/",pathname:"/SLiVR/",search:""},navigator:{serviceWorker:{getRegistrations:async()=>["/","/Wrapper/map/LSU3D/","/SLiVR/","/SLiVR/other/"].map(path=>({scope:`https://test${path}`,unregister:async()=>removed.push(path)}))}},caches:{keys:async()=>["neighbor","slivr-shell-v0"],delete:async k=>deleted.push(k)}};
  assert.equal((await configureServiceWorker(win)).state,"disabled");assert.deepEqual(removed,["/SLiVR/"]);assert.deepEqual(deleted,["slivr-shell-v0"]);
});
test("131: explicit enable uses scope and update policy; query kill switch overrides",async()=>{
  const calls=[],listeners=new Map(),win={location:{href:"https://test/SLiVR/",pathname:"/SLiVR/",search:""},document:{addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t)},navigator:{serviceWorker:{register:async(...args)=>{calls.push(args);return{update:async()=>{}};},getRegistrations:async()=>[]}}};
  const control=await configureServiceWorker(win,true);assert.deepEqual(calls,[["/SLiVR/sw.js",{scope:"/SLiVR/",updateViaCache:"none"}]]);control.dispose();assert.equal(listeners.size,0);
  win.location.search="?sw=off";assert.equal((await configureServiceWorker(win,true)).state,"disabled");assert.equal(calls.length,1);
});
function worker() {
  const handlers={},writes=[],deleted=[],cache={add:async()=>{},put:async(req)=>writes.push(req.url),match:async()=>undefined};
  const context={URL,Request,Response,Promise,Set,caches:{open:async()=>cache,keys:async()=>["neighbor","slivr-shell-v0","slivr-shell-v1"],delete:async k=>deleted.push(k)},fetch:async()=>new Response("fresh"),self:{location:{href:"https://test/SLiVR/sw.js",origin:"https://test"},registration:{scope:"https://test/SLiVR/",unregister:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn}};
  context.importScripts=()=>vm.runInContext(read("shell-cache.js"),context);vm.createContext(context);vm.runInContext(read("sw.js"),context);return {context,handlers,writes,deleted};
}
test("131/182: worker never intercepts provider/private/neighbor/query requests; switches network first",async()=>{
  const w=worker();for(const url of ["https://maps.dotd.la.gov/x","https://spaces.dtsxr.com/x","https://tile.googleapis.com/x","https://test/other/index.html","https://test/SLiVR/docs/private.pdf","https://test/SLiVR/index.html?key=x"]){let intercepted=false;w.handlers.fetch({request:new Request(url),respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);}
  let response;w.handlers.fetch({request:new Request("https://test/SLiVR/config/service-worker.js"),respondWith:p=>response=p});assert.equal(await(await response).text(),"fresh");assert.equal(w.writes.length,1);
  let activation;w.handlers.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(w.deleted,["slivr-shell-v0"]);
});
test("131: precache covers local index scripts/styles and every module import without private files",()=>{
  const context={self:{}};vm.runInNewContext(read("shell-cache.js"),context);const files=context.self.SLIVR_SHELL;
  for(const match of read("index.html").matchAll(/(?:src|href)="((?:styles|vendor|config)\/[^"#]+)"/g))assert.ok(files.includes(`./${match[1]}`),match[1]);
  for(const path of files){assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),path);assert.ok(!/docs\/|outputs\/|handoff|runtime\.js/.test(path));}
  for(const path of files.filter(p=>p.startsWith("./src/")&&p.endsWith(".js")))for(const match of read(path).matchAll(/(?:from\s*|import\s*\()"(\.[^"]+)"/g)){
    const resolved=new URL(match[1],new URL(`../${path}`,import.meta.url));const relative=resolved.pathname.split("/SLiVR/")[1];assert.ok(files.includes(`./${relative}`),relative);
  }
});
