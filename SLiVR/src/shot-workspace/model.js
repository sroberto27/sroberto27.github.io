import { newId, isWorkspaceId } from "../domain/ids.js";
import { validateOptics } from "../spatial/optics.js";

export const TYPES = ["camera", "actor", "vehicle", "prop", "mark", "arrow", "annotation", "set"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PIXELS = 24000000;
export const MAX_DIAGRAM_CHARS = 48 * 1024 * 1024;
export const clone = value => structuredClone(value);
export const angle = n => ((n % 360) + 360) % 360;
export const blankBackground = () => ({ id: newId("asset"), width: 1600, height: 1000, kind: "blank",
  dataUrl: "", attribution: "", source: "Blank canvas", capturedAt: new Date().toISOString(), oblique: false });
export function newDiagram(background = blankBackground()) {
  return { version: 1, coordinateSpace: "imagePixels", background, opacity: 1, objects: [], shots: [],
    evidence: [], variants: [], grid: false, snap: false, gridSize: 25, calibration: null };
}
export function newObject(type, x, y, count = 1) {
  if (!TYPES.includes(type)) throw new Error("Unknown object type.");
  const id = newId("sceneObject");
  return { id, type, label: `${type === "camera" ? "Camera" : type} ${count}`, x, y,
    angle: 0, size: 30, color: type === "camera" ? "#df68ce" : "#7ef09b",
    hidden: false, locked: false, groupId: null, path: [], curved: false, duration: 5,
    ...(type === "camera" ? { rigId: id, setup: "1", lens: { focalLengthMm: 50, gateWidthMm: 36, gateHeightMm: 24, targetAspect: 16/9, cropFactor: 1 },
      heightM: 1.5, tiltDeg: 0, rollDeg: 0, wedge: false } : {}) };
}
export function snapshot(d) {
  const { variants, ...rest } = d;
  return clone(rest);
}
export function saveVariant(d, name) {
  if (!name.trim()) throw new Error("Name this variant.");
  d.variants.push({ id: newId("variant"), name: name.trim().slice(0,160), createdAt: new Date().toISOString(), snapshot: snapshot(d) });
}
export function restoreVariant(d, id) {
  const v = d.variants.find(v => v.id === id);
  if (!v) throw new Error("Variant not found.");
  return { ...clone(v.snapshot), variants: clone(d.variants) };
}
export function duplicateObjects(d, ids, setup = false) {
  const copies = [];
  const groupMap = new Map();
  for (const o of d.objects.filter(o => ids.includes(o.id))) {
    const c = clone(o); c.id = newId("sceneObject"); c.x += 25; c.y += 25;
    c.path = c.path.map(p => ({ x: p.x + 25, y: p.y + 25 }));
    if (c.type === "camera") {
      c.rigId = setup ? o.rigId : c.id;
      c.setup = setup ? String(1 + Math.max(0, ...d.objects.filter(x=>x.rigId===o.rigId).map(x=>Number(x.setup)||0))) : "1";
    }
    if (c.groupId) { if (!groupMap.has(c.groupId)) groupMap.set(c.groupId,newId("sceneObject")); c.groupId=groupMap.get(c.groupId); }
    c.label += setup ? " setup" : " copy"; c.locked = false; copies.push(c);
  }
  d.objects.push(...copies); return copies.map(o=>o.id);
}
export function deleteObjects(d, ids) {
  ids = ids.filter(id => d.objects.some(o => o.id === id && !o.locked));
  d.objects = d.objects.filter(o => !ids.includes(o.id));
  d.shots = d.shots.filter(s => !ids.includes(s.cameraId));
}
export function moveObjects(d, ids, dx, dy) {
  for (const o of d.objects.filter(o => ids.includes(o.id) && !o.locked)) {
    o.x += dx; o.y += dy; o.path = o.path.map(p => ({ x:p.x+dx,y:p.y+dy }));
  }
}
export function rotateObjects(d, ids, degrees) {
  const objects=d.objects.filter(o=>ids.includes(o.id)&&!o.locked); if(!objects.length)return;
  const cx=objects.reduce((n,o)=>n+o.x,0)/objects.length,cy=objects.reduce((n,o)=>n+o.y,0)/objects.length;
  const a=degrees*Math.PI/180;
  const rotate=p=>({x:cx+(p.x-cx)*Math.cos(a)-(p.y-cy)*Math.sin(a),y:cy+(p.x-cx)*Math.sin(a)+(p.y-cy)*Math.cos(a)});
  for(const o of objects){Object.assign(o,rotate(o));o.angle=angle(o.angle+degrees);o.path=o.path.map(rotate);}
}
export function previewPosition(o, seconds) {
  const pts = o.path.length > 1 ? o.path : [{ x:o.x,y:o.y }];
  if (pts.length === 1) return pts[0];
  const t=Math.max(0,Math.min(1,seconds/o.duration))*(pts.length-1);
  const i=Math.min(pts.length-2,Math.floor(t)),u=t-i;
  const b=pts[i],c=pts[i+1];
  if(o.pathStyle==="spaced") {
    const dx=c.x-b.x,dy=c.y-b.y,length=Math.hypot(dx,dy);
    const offset=Math.min(length*.2,Math.max(40,o.size*2.5));
    const bend=4*u*(1-u)*offset;
    return {x:b.x+dx*u-(length?dy/length*bend:0),y:b.y+dy*u+(length?dx/length*bend:0)};
  }
  if(!(o.pathStyle==="smooth"||(o.pathStyle===undefined&&o.curved)))return {x:b.x+(c.x-b.x)*u,y:b.y+(c.y-b.y)*u};
  const a=pts[Math.max(0,i-1)],e=pts[Math.min(pts.length-1,i+2)];
  const f=k=>0.5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-e[k])*u*u+(-a[k]+3*b[k]-3*c[k]+e[k])*u*u*u);
  return { x:f("x"),y:f("y") };
}
export function calibrate(d, a, b, distanceM, checkA, checkB, checkM) {
  if(d.background.oblique || d.background.kind !== "owned") throw new Error("Scale calibration requires an owned flat plan.");
  const pixels=Math.hypot(b.x-a.x,b.y-a.y),checkPixels=Math.hypot(checkB.x-checkA.x,checkB.y-checkA.y);
  if(![pixels,checkPixels,distanceM,checkM].every(n=>Number.isFinite(n)&&n>0))throw new Error("Use distinct points and positive known distances.");
  const scale=distanceM/pixels;
  d.calibration={ version:(d.calibration?.version??0)+1, metresPerPixel:scale,
    a,b,distanceM,checkA,checkB,checkM,errorPct:Math.abs(checkPixels*scale-checkM)/checkM*100, date:new Date().toISOString() };
}
export function createHistory(initial, onChange = () => {}) {
  let current=clone(initial), past=[],future=[];
  const historyLimit=next=>Math.max(1,Math.min(60,Math.floor(64*1024*1024/Math.max(1,JSON.stringify(next).length))));
  function install(next){const errors=diagramErrors(next);if(errors.length)throw new Error(errors[0].reason);current=clone(next);onChange(current);}
  return {
    get value(){return current;},get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
    commit(next){if(JSON.stringify(next)===JSON.stringify(current))return;const errors=diagramErrors(next);if(errors.length)throw new Error(errors[0].reason);past.push(current);while(past.length>historyLimit(next))past.shift();future=[];install(next);},
    undo(){if(!past.length)return;future.push(current);install(past.pop());},
    redo(){if(!future.length)return;past.push(current);install(future.pop());}
  };
}

export function diagramErrors(d) {
  const errors=[],bad=reason=>errors.push({path:"diagram",reason});
  const finite=(n,min=-100000,max=100000)=>Number.isFinite(n)&&n>=min&&n<=max;
  const text=(s,max=4000)=>typeof s==="string"&&s.length<=max;
  if(!d || d.version!==1 || d.coordinateSpace!=="imagePixels"){bad("Unsupported diagram format.");return errors;}
  if(JSON.stringify(d).length>MAX_DIAGRAM_CHARS){bad("Diagram exceeds 48 MiB transfer limit.");return errors;}
  function content(s) {
    const bg=s?.background;
    if(!bg || !isWorkspaceId(bg.id,"asset") || !Number.isInteger(bg.width)||!Number.isInteger(bg.height)||bg.width<1||bg.height<1||bg.width>16384||bg.height>16384||bg.width*bg.height>MAX_PIXELS ||
      !["blank","owned","map"].includes(bg.kind)||!text(bg.source,1000)||!text(bg.attribution,8000)||typeof bg.oblique!=="boolean") {bad("Invalid background metadata.");return;}
    if(typeof bg.dataUrl!=="string" || (bg.kind!=="blank" && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(bg.dataUrl)||bg.dataUrl.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+64)))bad("Invalid or oversized background image.");
    if(bg.kind==="blank"&&bg.dataUrl!=="")bad("Blank background cannot carry image bytes.");
    if(!finite(s.opacity,0,1)||!finite(s.gridSize,5,500)||typeof s.grid!=="boolean"||typeof s.snap!=="boolean")bad("Invalid canvas settings.");
    if(!Array.isArray(s.objects)||s.objects.length>1000||!Array.isArray(s.shots)||s.shots.length>1000||!Array.isArray(s.evidence)||s.evidence.length>500){bad("Invalid diagram collections.");return;}
    const ids=new Set();
    for(const o of s.objects){
      if(!o||!isWorkspaceId(o.id,"sceneObject")||ids.has(o.id)){bad("Duplicate or invalid object identity.");continue;}ids.add(o.id);
      if(!TYPES.includes(o.type)||(o.pathStyle!==undefined&&!["straight","smooth","spaced"].includes(o.pathStyle))||!text(o.label,4000)||![o.x,o.y,o.angle].every(n=>finite(n))||!finite(o.size,5,500)||
        !/^#[0-9a-f]{6}$/i.test(o.color)||typeof o.hidden!=="boolean"||typeof o.locked!=="boolean"||
        (o.groupId!==null&&!isWorkspaceId(o.groupId,"sceneObject"))||typeof o.curved!=="boolean"||!finite(o.duration,0.1,3600)||
        !Array.isArray(o.path)||o.path.length>500||o.path.some(p=>!p||!finite(p.x)||!finite(p.y)))bad("Invalid object or path.");
      if(o.type==="camera"&&(!isWorkspaceId(o.rigId,"sceneObject")||!text(o.setup,32)||!validateOptics(o.lens).ok||
        typeof o.wedge!=="boolean"||!finite(o.heightM,0,1000)||!finite(o.tiltDeg,-360,360)||!finite(o.rollDeg,-360,360)))bad("Invalid camera setup.");
    }
    const shotIds=new Set();
    for(const shot of s.shots){
      if(!shot||!isWorkspaceId(shot.id,"shot")||shotIds.has(shot.id)||!s.objects.some(o=>o?.id===shot.cameraId&&o.type==="camera")||
        !["number","description","shotType","movement","notes","status"].every(k=>text(shot[k]))||!finite(shot.duration,0,3600))bad("Invalid shot or missing camera setup.");
      if(shot)shotIds.add(shot.id);
    }
    for(const e of s.evidence)if(!e||!isWorkspaceId(e.assessmentId,"assessment")||!Number.isInteger(e.revision)||e.revision<1||!text(e.questionId,160))bad("Invalid assessment reference.");
    if(s.calibration && (!Number.isInteger(s.calibration.version)||s.calibration.version<1||!["a","b","checkA","checkB"].every(k=>finite(s.calibration[k]?.x)&&finite(s.calibration[k]?.y))||![s.calibration.distanceM,s.calibration.checkM].every(n=>finite(n,0.0000001,100000))||bg.oblique||bg.kind!=="owned"||!finite(s.calibration.metresPerPixel,0.0000001,100000)||!finite(s.calibration.errorPct,0,100000)))bad("Invalid plan calibration.");
  }
  content(d);
  if(!Array.isArray(d.variants)||d.variants.length>30)bad("At most 30 variants are supported.");
  else { const ids=new Set(); for(const v of d.variants){if(!v||!isWorkspaceId(v.id,"variant")||ids.has(v.id)||!text(v.name,160))bad("Invalid variant.");if(v){ids.add(v.id);content(v.snapshot);}} }
  return errors;
}
export function diagramEvidenceErrors(scene, bundle) {
  const refs=[...(scene.diagram?.evidence??[]),...(scene.diagram?.variants??[]).flatMap(v=>v.snapshot.evidence)];
  return refs.filter(e=>!bundle.scoutAssessmentRevisions.some(r=>r.assessmentId===e.assessmentId&&r.revision===e.revision&&r.projectId===scene.projectId&&r.locationId===scene.locationId&&r.snapshot.answers.some(a=>a.questionId===e.questionId)))
    .map(()=>({path:"diagram.evidence",reason:"Assessment revision must belong to this project and location."}));
}
