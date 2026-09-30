import { drawDiagram } from "./renderer.js";
import { wrapText } from "./capture.js";
import { buildFilename } from "../exports/filenames.js";

export function csvCell(value) {
  let s=String(value??"");
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function shotCsv(record) {
  const d=record.diagram,headers=["Design","Location","Shot","Camera","Setup","Type","Focal mm","Gate width mm","Gate height mm","Aspect","Movement","Duration seconds","Status","Description","Notes","Revision","Project ID","Scene ID","Design ID","Shot ID","Camera ID"];
  const rows=d.shots.map(s=>{const o=d.objects.find(o=>o.id===s.cameraId);return [record.name,record.locationId,s.number,o.label,o.setup,s.shotType,o.lens.focalLengthMm,o.lens.gateWidthMm,o.lens.gateHeightMm,o.lens.targetAspect,s.movement,s.duration,s.status,s.description,s.notes,record.revision,record.projectId,record.sceneId,record.id,s.id,s.cameraId];});
  return "\ufeff"+[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
}
export function diagramFilename(record,extension){
  return buildFilename({project:record.name,scene:record.sceneId,suffix:record.id,revision:record.revision,extension});
}
export function download(name,bytes,type){
  const url=URL.createObjectURL(bytes instanceof Blob?bytes:new Blob([bytes],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function diagramJson(record){return JSON.stringify({format:"slivr-diagram",version:1,exportedAt:new Date().toISOString(),record},null,2);}
export async function diagramPng(record,image,doc=document){
  const d=record.diagram,bg=d.background,scale=Math.min(2,4096/bg.width),outputWidth=Math.max(800,Math.ceil(bg.width*scale));
  const canvas=doc.createElement("canvas"),ctx=canvas.getContext("2d");
  canvas.width=outputWidth;
  const details=[record.name,record.locationId??"Standalone diagram",new Date().toISOString().slice(0,10),
    "Project: "+(record.projectId??"Standalone"),"Scene: "+(record.sceneId??"Unassigned"),"Design: "+record.id,
    "Shots: "+(d.shots.map(s=>s.number+" ("+s.id+")").join(", ")||"None"),
    ...d.objects.filter(o=>o.type==="camera").map(o=>`${o.label} / setup ${o.setup}: ${o.lens.focalLengthMm} mm, gate ${o.lens.gateWidthMm} x ${o.lens.gateHeightMm} mm, aspect ${o.lens.targetAspect}`),
    "Revision "+record.revision,d.calibration?"Flat-plan scale: "+d.calibration.metresPerPixel.toPrecision(5)+" m/px; check error "+d.calibration.errorPct.toFixed(2)+"%":"Schematic image coordinates; no measured scale",
    bg.attribution||bg.source,"Camera overlays and movement are schematic; image coordinates are pixels.",
    bg.kind==="map"&&!bg.oblique&&Number.isFinite(bg.view?.bearing)?"North arrow follows captured map bearing.":"North orientation not established for this image."].join(" | ");
  ctx.font="16px sans-serif";const lines=wrapText(ctx,details,canvas.width-32);
  canvas.height=Math.ceil(bg.height*scale)+(lines.length+1)*23+20;
  ctx.save();ctx.scale(scale,scale);drawDiagram(ctx,d,image,{grid:false});ctx.restore();
  if(bg.kind==="map"&&!bg.oblique&&Number.isFinite(bg.view?.bearing)){
    ctx.save();ctx.translate(canvas.width-42,50);ctx.fillStyle="#172126";ctx.fillRect(-26,-35,52,70);
    ctx.fillStyle="#fff";ctx.font="bold 16px sans-serif";ctx.fillText("N",-6,-17);ctx.rotate(-bg.view.bearing*Math.PI/180);
    ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,20);ctx.lineTo(0,-12);ctx.moveTo(-6,-4);ctx.lineTo(0,-12);ctx.lineTo(6,-4);ctx.stroke();ctx.restore();
  }
  ctx.fillStyle="#172126";ctx.fillRect(0,bg.height*scale,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.font="16px sans-serif";
  lines.forEach((line,i)=>ctx.fillText(line,16,bg.height*scale+26+i*23));
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG could not be encoded.")),"image/png"));
}
