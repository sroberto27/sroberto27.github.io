import { drawDiagram } from "./renderer.js";
import { wrapText } from "./capture.js";

export function csvCell(value) {
  let s=String(value??"");
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function shotCsv(record) {
  const d=record.diagram,headers=["Design","Location","Shot","Camera","Setup","Type","Focal mm","Gate width mm","Gate height mm","Aspect","Movement","Duration seconds","Status","Description","Notes","Revision"];
  const rows=d.shots.map(s=>{const o=d.objects.find(o=>o.id===s.cameraId);return [record.name,record.locationId,s.number,o.label,o.setup,s.shotType,o.lens.focalLengthMm,o.lens.gateWidthMm,o.lens.gateHeightMm,o.lens.targetAspect,s.movement,s.duration,s.status,s.description,s.notes,record.revision];});
  return "\ufeff"+[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
}
export function diagramFilename(record,extension){
  const name=record.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,"_").replace(/[. ]+$/,"").slice(0,80)||"diagram";
  return "SLiVR_"+name+"_"+record.id.slice(-8)+"_"+new Date().toISOString().slice(0,10)+"_r"+record.revision+"."+extension;
}
export function download(name,bytes,type){
  const url=URL.createObjectURL(bytes instanceof Blob?bytes:new Blob([bytes],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function diagramJson(record){return JSON.stringify({format:"slivr-diagram",version:1,exportedAt:new Date().toISOString(),record},null,2);}
export async function diagramPng(record,image,doc=document){
  const d=record.diagram,bg=d.background,scale=Math.min(2,4096/bg.width);
  const canvas=doc.createElement("canvas"),ctx=canvas.getContext("2d");
  canvas.width=Math.ceil(bg.width*scale);
  const details=[record.name,record.locationId??"Standalone diagram",new Date().toISOString().slice(0,10),
    "Revision "+record.revision,d.calibration?"Flat-plan scale: "+d.calibration.metresPerPixel.toPrecision(5)+" m/px; check error "+d.calibration.errorPct.toFixed(2)+"%":"Schematic image coordinates; no measured scale",
    bg.attribution||bg.source,"Camera overlays and movement are schematic."].join(" | ");
  ctx.font="16px sans-serif";const lines=wrapText(ctx,details,canvas.width-32);
  canvas.height=Math.ceil(bg.height*scale)+(lines.length+1)*23+20;
  ctx.save();ctx.scale(scale,scale);drawDiagram(ctx,d,image,{grid:false});ctx.restore();
  ctx.fillStyle="#172126";ctx.fillRect(0,bg.height*scale,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.font="16px sans-serif";
  lines.forEach((line,i)=>ctx.fillText(line,16,bg.height*scale+26+i*23));
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG could not be encoded.")),"image/png"));
}
