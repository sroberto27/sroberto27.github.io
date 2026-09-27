import { MAX_IMAGE_BYTES, MAX_PIXELS } from "./model.js";
import { newId } from "../domain/ids.js";

export function wrapText(ctx, text, width) {
  const lines=[]; let line="";
  for(const word of text.split(/\s+/)){const next=line?line+" "+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line); return lines;
}
export function captureMapView({ map, source, attribution, isReady = () => true, isCurrent = () => true, doc = document, timeoutMs = 10000 }) {
  const camera=()=>({center:[map.getCenter().lng,map.getCenter().lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()});
  const view=camera(), canvas=map.getCanvas(), width=canvas.width,height=canvas.height;
  const initial=JSON.stringify(view);
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);map.off("render",render);map.off("remove",removed);error?reject(error):resolve(value);};
    const removed=()=>finish(new Error("Map closed before capture finished."));
    const render=()=>{
      if(done)return;
      if(!isCurrent()||JSON.stringify(camera())!==initial||canvas.width!==width||canvas.height!==height)return finish(new Error("Map view changed. Please capture again."));
      if(!isReady() || map.isMoving?.() || map.areTilesLoaded?.()===false)return;
      try{
        if(width<1||height<1||width*(height+140)>MAX_PIXELS)throw new Error("Map image is too large. Reduce the browser window before capturing.");
        const out=doc.createElement("canvas"),ctx=out.getContext("2d");
        out.width=width;out.height=height;
        ctx.drawImage(canvas,0,0);
        // Reject empty WebGL buffers; do not treat a successful encoder as evidence of rendered pixels.
        const sample=ctx.getImageData(0,0,width,height).data;
        let visible=0;for(let i=0;i<sample.length;i+=Math.max(4,Math.floor(sample.length/16000/4)*4))if(sample[i+3]&&(sample[i]+sample[i+1]+sample[i+2]>15))visible++;
        if(!visible)throw new Error("The map frame was blank. Wait for imagery and retry.");
        const font=Math.max(14,Math.round(width/100));ctx.font=font+"px sans-serif";
        const credit=typeof attribution==="function"?attribution():attribution;
        const lines=wrapText(ctx,credit,width-32),footer=(lines.length+1)*(font+5)+16;
        if(width*(height+footer)>MAX_PIXELS)throw new Error("Captured image exceeds the pixel limit.");
        const image=ctx.getImageData(0,0,width,height);
        out.height=height+footer;ctx.putImageData(image,0,0);
        ctx.fillStyle="#172126";ctx.fillRect(0,height,width,footer);ctx.fillStyle="#fff";ctx.font=font+"px sans-serif";
        lines.forEach((line,i)=>ctx.fillText(line,16,height+font+10+i*(font+5)));
        ctx.font=Math.max(12,font-2)+"px sans-serif";ctx.fillText("Reference image • Schematic shot planning • Captured "+new Date().toISOString().slice(0,10),16,out.height-10);
        const dataUrl=out.toDataURL("image/png");
        if(dataUrl.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+64)throw new Error("Captured image exceeds 8 MiB. Reduce the viewport and retry.");
        finish(null,{id:newId("asset"),kind:"map",width,height:out.height,dataUrl,source,attribution:credit,capturedAt:new Date().toISOString(),oblique:view.pitch!==0,view});
      }catch(error){finish(error);}
    };
    const timer=setTimeout(()=>finish(new Error("The map did not become ready for capture. Wait for imagery, then retry.")),timeoutMs);
    map.on("render",render);map.on("remove",removed);map.triggerRepaint();
  });
}
export async function readBackground(file, { oblique = false, provenance = "" } = {}) {
  if(!["image/png","image/jpeg","image/webp"].includes(file?.type)||!file.size||file.size>MAX_IMAGE_BYTES)throw new Error("Choose PNG, JPEG or WebP up to 8 MiB.");
  if(!provenance.trim())throw new Error("Enter the source and permission for this image.");
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Image could not be read."));r.readAsDataURL(file);});
  const img=await loadImage(dataUrl);
  if(img.width>16384||img.height>16384||img.width*img.height>MAX_PIXELS)throw new Error("Image exceeds 24 million pixels.");
  return {id:newId("asset"),kind:"owned",width:img.width,height:img.height,dataUrl,source:provenance.slice(0,1000),attribution:provenance.slice(0,1000),capturedAt:new Date().toISOString(),oblique};
}
export function loadImage(url) {
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Background image could not be decoded."));img.src=url;});
}


// Rotation happens in the import preview, before an arrangement uses the image.
export async function rotateBackground(background,doc=document) {
  const image=await loadImage(background.dataUrl),canvas=doc.createElement("canvas");
  canvas.width=background.height;canvas.height=background.width;
  const ctx=canvas.getContext("2d");ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0);
  const dataUrl=canvas.toDataURL("image/png");
  if(dataUrl.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+64)throw new Error("Rotated image exceeds 8 MiB.");
  return {...background,id:newId("asset"),width:canvas.width,height:canvas.height,dataUrl};
}
