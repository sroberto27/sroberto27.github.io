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

/** Captures only this tab's viewer rectangle; the browser owns the permission prompt. */
export async function captureImmersiveView({ element, source, attribution, context = {}, isCurrent = () => true,
  signal, win = globalThis, doc = document, timeoutMs = 12000 }) {
  const media = win.navigator?.mediaDevices;
  if (!media?.getDisplayMedia || !win.CropTarget?.fromElement)
    throw new Error("Immersive capture is unavailable in this browser. Use Blank / imported-image diagram and import a screenshot.");
  if (!element?.isConnected || !isCurrent()) throw new Error("Open a loaded immersive view before capturing.");
  let stream, video, timer, watch, frameRequest, expired = false, abortHandler;
  const stop = value => value?.getTracks().forEach(track => track.stop());
  // Request sharing before any await so the initiating button supplies user activation.
  const request = media.getDisplayMedia({video:true,audio:false,preferCurrentTab:true,selfBrowserSurface:"include",surfaceSwitching:"exclude"});
  const pending = request.then(value => { if (expired) { stop(value); throw new Error("Capture cancelled."); } stream=value; return value; });
  try {
    const cancelled = new Promise((_,reject) => {
      abortHandler=()=>{expired=true;stop(stream);reject(new Error("Immersive capture cancelled. Retry or import an image."));};
      signal?.addEventListener("abort",abortHandler,{once:true});
      if(signal?.aborted)abortHandler();
    });
    await Promise.race([pending,cancelled]);
    const timeout = new Promise((_,reject) => {timer=win.setTimeout(()=>reject(new Error("The immersive image was not ready. Retry or import a screenshot.")),timeoutMs);});
    const changed = new Promise((_,reject) => {watch=win.setInterval(()=>{
      if(!element.isConnected||!isCurrent())reject(new Error("The immersive view changed. Capture again."));
    },100);});
    const work = async () => {
      const track=stream.getVideoTracks()[0];
      if(track?.getSettings().displaySurface!=="browser"||!track.cropTo)
        throw new Error("Choose the current SLiVR browser tab, not a window or entire screen.");
      const target=await win.CropTarget.fromElement(element);
      await track.cropTo(target); // Rejects another tab: never save uncropped pixels.
      if(expired)throw new Error("Capture cancelled.");
      video=doc.createElement("video");video.muted=true;video.playsInline=true;video.srcObject=stream;
      await video.play();
      if(!video.requestVideoFrameCallback)throw new Error("This browser cannot confirm a captured frame. Import a screenshot instead.");
      await new Promise(resolve=>{frameRequest=video.requestVideoFrameCallback(resolve);});
      if(expired||signal?.aborted||!isCurrent()||!element.isConnected)throw new Error("The immersive view changed. Capture again.");
      const width=video.videoWidth,height=video.videoHeight;
      if(width<1||height<1||width*(height+140)>MAX_PIXELS)throw new Error("Invalid or oversized viewer image. Reduce the viewport and retry.");
      const out=doc.createElement("canvas"),ctx=out.getContext("2d");
      out.width=width;out.height=height;
      ctx.font="14px sans-serif";
      const lines=wrapText(ctx,attribution,width-32),footer=(lines.length+1)*19+20;
      if(width*(height+footer)>MAX_PIXELS)throw new Error("Captured image exceeds the pixel limit.");
      out.height=height+footer;ctx.drawImage(video,0,0,width,height);
      const sample=ctx.getImageData(0,0,width,height).data;
      let visible=false;for(let i=0;i<sample.length;i+=Math.max(4,Math.floor(sample.length/16000/4)*4))if(sample[i+3]&&sample[i]+sample[i+1]+sample[i+2]>15){visible=true;break;}
      if(!visible)throw new Error("The viewer image was blank. Wait for the view to load and retry.");
      ctx.fillStyle="#172126";ctx.fillRect(0,height,width,footer);ctx.fillStyle="#fff";ctx.font="14px sans-serif";
      lines.forEach((line,i)=>ctx.fillText(line,16,height+24+i*19));
      ctx.fillText("Immersive reference - schematic shot planning",16,out.height-10);
      const dataUrl=out.toDataURL("image/png");
      if(dataUrl.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+64)throw new Error("Image exceeds 8 MiB. Reduce the viewport and retry.");
      return {id:newId("asset"),kind:"owned",width,height:out.height,dataUrl,source,attribution,
        capturedAt:new Date().toISOString(),oblique:true,view:{type:"immersive",...context,restoration:"entry-only"}};
    };
    return await Promise.race([work(),cancelled,timeout,changed]);
  } catch(error) {
    if(["NotAllowedError","AbortError"].includes(error.name))throw new Error("Sharing was cancelled or denied. Retry and choose this SLiVR tab, or import a screenshot.");
    throw error;
  } finally {
    expired=true;win.clearTimeout(timer);win.clearInterval(watch);signal?.removeEventListener("abort",abortHandler);
    if(video){if(frameRequest!==undefined)video.cancelVideoFrameCallback?.(frameRequest);video.pause();video.srcObject=null;}
    stop(stream);
  }
}
