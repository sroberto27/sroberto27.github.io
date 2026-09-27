import { TYPES, clone, newDiagram, newObject, createHistory, duplicateObjects, deleteObjects, moveObjects,
  rotateObjects, saveVariant, restoreVariant, calibrate, diagramErrors, snapshot, MAX_DIAGRAM_CHARS } from "./model.js";
import { drawDiagram, imagePoint, hitObjects } from "./renderer.js";
import { readBackground, loadImage, rotateBackground } from "./capture.js";
import { diagramFilename, diagramJson, diagramPng, shotCsv, download } from "./exports.js";
import { fieldOfView } from "../spatial/optics.js";
import { newId } from "../domain/ids.js";
import { registerDraft } from "../scouting/autosave.js";

function node(tag,props={},children=[]) {
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(props)){if(k==="text")n.textContent=v;else if(k.startsWith("on"))n.addEventListener(k.slice(2).toLowerCase(),v);else if(k==="class")n.className=v;else n.setAttribute(k,v);}
  for(const child of children)if(child)n.append(child);return n;
}
export function createDiagramEditor({record:initial,actions,store,win=globalThis}) {
  let record=clone(initial),selected=[],image=null,imageId=null,imageGeneration=0,disposed=false;
  let unregister=null,timer=null,dirty=false,saving=Promise.resolve(),panelName="",tool="select",drag=null,preview=null,playing=false,raf=null,start=0;
  let view={x:0,y:0,scale:1},fitPending=true,pendingBackground=null,calibrationPoints=[];
  const root=node("section",{class:"shot-editor","aria-label":"Shot diagram editor"});
  const status=node("p",{class:"shot-message",role:"status","aria-live":"polite"});
  const canvas=node("canvas",{tabindex:"0","aria-label":"Shot diagram. Select objects with the Objects menu; arrow keys move selection. Use Pan to move the view."});
  const viewport=node("div",{class:"shot-viewport"},[canvas]);
  const ctx=canvas.getContext?.("2d");
  const pane=node("aside",{class:"shot-pane",hidden:"","aria-label":"Diagram tools"});
  const title=node("input",{"aria-label":"Design name",value:record.name,maxlength:"160"});
  const toolbar=node("div",{class:"shot-toolbar","aria-label":"Diagram tools"});
  const bottom=node("div",{class:"shot-playback"});
  const seek=node("input",{type:"range",min:"0",max:"30",step:"0.01",value:"0","aria-label":"Preview time"});
  const timeLabel=node("span",{text:"0.00 s"});
  const notify=message=>{status.textContent=message;};
  const history=createHistory(record.diagram??newDiagram(),d=>{
    record=actions.updateDiagram(record,d,title.value.trim()||record.name);markDirty();loadBackground();paint();refreshPanel();
  });
  const value=()=>history.value;
  const safe=fn=>async()=>{try{await fn();}catch(error){notify(error.message);}};
  const button=(text,fn)=>node("button",{type:"button",text,onClick:safe(fn)});
  function change(fn){const d=clone(value());fn(d);history.commit(d);}
  function markDirty(){
    dirty=true;unregister??=registerDraft(flush);clearTimeout(timer);
    timer=setTimeout(()=>{void flush();},650);
    notify("Saving locally…");
  }
  async function flush(){
    clearTimeout(timer);
    if(!dirty)return saving;
    const revision=record.revision,snapshot=clone(record);
    saving=saving.then(async()=>{
      if(disposed&&!dirty)return {ok:false};
      const result=await actions.saveDiagram(snapshot);
      if(result.ok&&record.revision===revision){dirty=false;unregister?.();unregister=null;notify("Saved locally · browser storage is not a backup.");}
      else if(!result.ok)notify("Save failed. Your diagram is retained. Retry save or export Diagram JSON.");
      return result;
    }).catch(error=>{notify("Save failed: "+error.message);return {ok:false};});
    return saving;
  }
  function loadBackground(){
    const bg=value().background;if(bg.id===imageId)return;
    imageId=bg.id;image=null;const generation=++imageGeneration;fitPending=true;
    if(bg.dataUrl)loadImage(bg.dataUrl).then(img=>{if(disposed||generation!==imageGeneration)return;image=img;paint();}).catch(e=>{if(generation===imageGeneration)notify(e.message+" Overlays remain editable.");});
  }
  function fit(){
    const b=value().background,w=viewport.clientWidth||800,h=viewport.clientHeight||500;
    view.scale=Math.max(.02,Math.min((w-40)/b.width,(h-40)/b.height));
    view.x=(w-b.width*view.scale)/2;view.y=(h-b.height*view.scale)/2;fitPending=!viewport.isConnected;
  }
  function paint(){
    seek.max=String(Math.max(1,...value().objects.map(o=>o.duration)));
    if(!ctx||disposed)return;
    const w=viewport.clientWidth||800,h=viewport.clientHeight||500,dpr=Math.min(2,win.devicePixelRatio||1);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    if(fitPending)fit();
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#d8e0e5";ctx.fillRect(0,0,w,h);
    ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);
    drawDiagram(ctx,drag?.draft??value(),image,{selected,time:preview});
    if(tool==="path"){const o=value().objects.find(o=>selected.includes(o.id));if(o)for(const p of o.path){ctx.fillStyle="#0069a8";ctx.fillRect(p.x-6,p.y-6,12,12);}}
    if(tool==="calibrate"){ctx.fillStyle="#f06";calibrationPoints.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,6/view.scale,0,Math.PI*2);ctx.fill();ctx.font=14/view.scale+"px sans-serif";ctx.fillText(String(i+1),p.x+8/view.scale,p.y);});}
  }
  function setTool(next){tool=next;notify(next==="path"?"Click to add path points; drag a point to edit.":"Tool: "+next);paint();}
  function showPanel(name){panelName=panelName===name?"":name;pane.hidden=!panelName;refreshPanel();}
  function refreshPanel(){
    const scroll=pane.scrollTop;
    if(!panelName){pane.hidden=true;return;}
    pane.hidden=false;pane.replaceChildren(node("header",{},[node("strong",{text:panelName}),button("Close",()=>showPanel(panelName))]));
    const add=(...nodes)=>pane.append(...nodes);
    const field=(label,value,onChange,{type="text",min,max,step}={})=>{
      const input=node("input",{type,value:String(value??""),...(min!==undefined?{min}:{}),...(max!==undefined?{max}:{}),...(step?{step}:{}),
        onChange:()=>{try{onChange(type==="number"?Number(input.value):input.value);}catch(e){notify(e.message);input.value=String(value??"");}}});
      return node("label",{text:label},[input]);
    };
    const check=(label,checked,onChange)=>{const input=node("input",{type:"checkbox"});input.checked=checked;input.addEventListener("change",()=>{try{onChange(input.checked);}catch(e){notify(e.message);}});return node("label",{class:"shot-check"},[input,node("span",{text:label})]);};
    const d=value(),o=d.objects.find(o=>selected.includes(o.id));
    if(panelName==="Add"){
      for(const type of TYPES)add(button("Add "+type,()=>{change(d=>{const o=newObject(type,d.background.width/2,d.background.height/2,d.objects.filter(o=>o.type===type).length+1);d.objects.push(o);selected=[o.id];});panelName="Properties";refreshPanel();}));
    } else if(panelName==="Objects / Layers"){
      add(node("p",{text:"Select in the list or Shift-click objects to select several."}));
      for(const type of TYPES){
        const objects=d.objects.filter(o=>o.type===type);if(!objects.length)continue;
        add(node("strong",{text:type}),button("Show / hide "+type,()=>change(d=>{const hidden=!objects.every(o=>o.hidden);d.objects.filter(o=>o.type===type).forEach(o=>o.hidden=hidden);})),
          button("Lock / unlock "+type,()=>change(d=>{const locked=!objects.every(o=>o.locked);d.objects.filter(o=>o.type===type).forEach(o=>o.locked=locked);})));
        for(const item of objects)add(button((selected.includes(item.id)?"✓ ":"")+item.label+(item.locked?" 🔒":""),()=>{selected=[item.id];panelName="Properties";refreshPanel();paint();}));
      }
      add(check("Grid",d.grid,v=>change(d=>d.grid=v)),check("Snap",d.snap,v=>change(d=>d.snap=v)),field("Grid interval (image pixels)",d.gridSize,v=>change(d=>d.gridSize=v),{type:"number",min:5,max:500}));
    } else if(panelName==="Properties"){
      if(!o){add(node("p",{text:"Select an object on the canvas or in Objects / Layers."}));return;}
      add(node("small",{text:o.id}),field("Label",o.label,v=>edit(o.id,{label:v})),field("Color",o.color,v=>edit(o.id,{color:v}),{type:"color"}),
        field("X (image pixels)",o.x,v=>change(d=>moveObjects(d,selected,v-o.x,0)),{type:"number",step:"1"}),
        field("Y (image pixels)",o.y,v=>change(d=>moveObjects(d,selected,0,v-o.y)),{type:"number",step:"1"}),
        field("Rotation (degrees clockwise)",o.angle,v=>change(d=>rotateObjects(d,selected,v-o.angle)),{type:"number",step:"1"}),
        field("Symbol size (pixels)",o.size,v=>edit(o.id,{size:v}),{type:"number",min:5,max:500}),
        check("Locked",o.locked,v=>edit(o.id,{locked:v})),check("Hidden",o.hidden,v=>edit(o.id,{hidden:v})));
      if(o.type==="camera"){
        add(field("Setup mark",o.setup,v=>edit(o.id,{setup:v})),button("Add another setup of this camera",()=>change(d=>{selected=duplicateObjects(d,[o.id],true);})));
        for(const [key,label] of [["focalLengthMm","Focal length (mm)"],["gateWidthMm","Sensor width (mm)"],["gateHeightMm","Sensor height (mm)"],["targetAspect","Aspect ratio"],["cropFactor","Crop factor"]])
          add(field(label,o.lens[key],v=>edit(o.id,{lens:{...o.lens,[key]:v}}),{type:"number",min:.01,step:".01"}));
        for(const [key,label] of [["heightM","Camera height (m, recorded)"],["tiltDeg","Tilt (degrees, recorded)"],["rollDeg","Roll (degrees, recorded)"]])add(field(label,o[key],v=>edit(o.id,{[key]:v}),{type:"number",step:".1"}));
        const fov=fieldOfView(o.lens);add(node("p",{text:`Ideal FOV: ${fov.horizontalDeg.toFixed(2)}° H / ${fov.verticalDeg.toFixed(2)}° V. Coverage over this image is schematic.`}),check("Show schematic coverage",o.wedge,v=>edit(o.id,{wedge:v})),button("Add shot for this setup",()=>addShot(o)));
      }
      add(button("Duplicate",()=>change(d=>{selected=duplicateObjects(d,selected);})),
        button("Group selection",()=>change(d=>{const id=newId("sceneObject");d.objects.filter(o=>selected.includes(o.id)).forEach(o=>o.groupId=id);})),
        button("Ungroup",()=>change(d=>d.objects.filter(o=>selected.includes(o.id)).forEach(o=>o.groupId=null))),
        button("Delete selected",remove),button("Edit path on canvas",()=>setTool("path")),
        field("Move duration (seconds)",o.duration,v=>edit(o.id,{duration:v}),{type:"number",min:.1,max:3600,step:".1"}),
        button("Reverse path",()=>edit(o.id,{path:[...o.path].reverse()})),
        button("Clear path",()=>edit(o.id,{path:[]})));
      const style=node("select",{"aria-label":"Path line style"});
      for(const [value,label] of [["straight","Straight"],["smooth","Smooth curve"],["spaced","Spaced curve (automatic)"]])style.append(node("option",{value,text:label}));
      style.value=o.pathStyle??(o.curved?"smooth":"straight");
      style.addEventListener("change",()=>{try{edit(o.id,{pathStyle:style.value,curved:style.value==="smooth"});}catch(e){notify(e.message);}});
      add(node("label",{text:"Path line style"},[style]),node("small",{text:"Spaced curves bow between your steps; icons stay in place. Crossings may still need manual adjustment."}));
      add(button("Add path step",()=>{const last=o.path.at(-1)??o;edit(o.id,{path:[...(o.path.length?o.path:[{x:o.x,y:o.y}]),{x:last.x+100,y:last.y}]});}));
      o.path.forEach((p,i)=>add(node("div",{class:"shot-point"},[
        field("Point "+(i+1)+" X",p.x,v=>pointEdit(o,i,"x",v),{type:"number"}),
        field("Point "+(i+1)+" Y",p.y,v=>pointEdit(o,i,"y",v),{type:"number"}),
        button("Remove point "+(i+1),()=>edit(o.id,{path:o.path.filter((_,n)=>n!==i)}))])));
    } else if(panelName==="Shots"){
      const cameras=d.objects.filter(o=>o.type==="camera");for(const c of cameras)add(button("New shot · "+c.label+" / "+c.setup,()=>addShot(c)));
      d.shots.forEach((s,i)=>{
        const card=node("section",{class:"shot-card"}),c=d.objects.find(o=>o.id===s.cameraId);
        card.append(node("strong",{text:c.label+" · setup "+c.setup}));
        for(const [key,label] of [["number","Shot number"],["shotType","Shot type"],["description","Description"],["movement","Movement"],["status","Status"],["notes","Notes"]])
          card.append(field(label,s[key],v=>change(d=>d.shots.find(x=>x.id===s.id)[key]=v)));
        card.append(field("Duration (s)",s.duration,v=>change(d=>d.shots.find(x=>x.id===s.id).duration=v),{type:"number",min:0,max:3600}),
          button("Select camera / lens",()=>{selected=[c.id];panelName="Properties";refreshPanel();paint();}),
          button("Move earlier",()=>change(d=>{if(i>0)[d.shots[i-1],d.shots[i]]=[d.shots[i],d.shots[i-1]];})),
          button("Move later",()=>change(d=>{if(i<d.shots.length-1)[d.shots[i+1],d.shots[i]]=[d.shots[i],d.shots[i+1]];})),
          button("Duplicate shot",()=>change(d=>d.shots.push({...clone(s),id:newId("shot"),number:s.number+" copy"}))),
          button("Remove shot",()=>change(d=>d.shots=d.shots.filter(x=>x.id!==s.id))));
        add(card);
      });
    } else if(panelName==="Variants"){
      const name=node("input",{"aria-label":"Variant name",placeholder:"Name this arrangement",maxlength:"160"});
      add(name,button("Save variant",()=>change(d=>saveVariant(d,name.value))));
      for(const v of d.variants)add(node("div",{class:"shot-card"},[node("strong",{text:v.name}),node("small",{text:v.createdAt}),
        button("Remove variant",()=>change(d=>d.variants=d.variants.filter(item=>item.id!==v.id))),
        button("Restore",()=>{if(win.confirm("Restore this arrangement? Current work is kept as an automatic variant.")){const next=clone(value());saveVariant(next,"Before restore "+new Date().toLocaleTimeString());history.commit(restoreVariant(next,v.id));selected=[];}})]));
    } else if(panelName==="Background"){
      add(node("p",{text:d.background.source}),node("p",{text:d.background.attribution}),node("small",{text:`${d.background.width} × ${d.background.height} image pixels. ${d.background.oblique?"Oblique image; schematic.":"No surveyed accuracy implied."}`}),
        field("Background opacity (0–1)",d.opacity,v=>change(d=>d.opacity=v),{type:"number",min:0,max:1,step:".1"}));
      const source=node("input",{"aria-label":"Image source and permission",placeholder:"Image source and permission"}),
        oblique=node("input",{type:"checkbox","aria-label":"Perspective / oblique image"}),file=node("input",{type:"file",accept:"image/png,image/jpeg,image/webp","aria-label":"Choose background image"});
      file.addEventListener("change",async()=>{try{if(!file.files[0])return;pendingBackground=await readBackground(file.files[0],{provenance:source.value,oblique:oblique.checked});if(!disposed)refreshPanel();}catch(e){notify(e.message);}});
      add(source,node("label",{class:"shot-check"},[oblique,node("span",{text:"Perspective / oblique image"})]),file);
      if(pendingBackground){
        add(node("img",{class:"shot-bg-preview",src:pendingBackground.dataUrl,alt:"Proposed background"}),
          node("p",{text:"Replacement starts a new arrangement. The current arrangement is saved as a variant."}),
          button("Rotate image 90 degrees",async()=>{pendingBackground=await rotateBackground(pendingBackground);refreshPanel();}),
          button("Use this background",()=>{change(d=>{saveVariant(d,"Before background replacement");const next=newDiagram(pendingBackground);Object.assign(d,{...next,variants:d.variants});});pendingBackground=null;selected=[];refreshPanel();}),
          button("Cancel replacement",()=>{pendingBackground=null;refreshPanel();}));
      }
      if(d.background.kind==="owned"&&!d.background.oblique){
        const known=node("input",{type:"number",min:".001",step:".01","aria-label":"Known distance in metres",placeholder:"Known distance (m)"}),
          check=node("input",{type:"number",min:".001",step:".01","aria-label":"Independent check distance in metres",placeholder:"Check distance (m)"});
        add(node("p",{text:"Pick four points: two for the known distance, then two for an independent check. Distances are metres."}),
          button("Pick calibration points",()=>{calibrationPoints=[];setTool("calibrate");}),known,check,
          button("Apply calibration",()=>{if(calibrationPoints.length!==4)throw new Error("Pick four points first.");change(d=>{saveVariant(d,"Before calibration");calibrate(d,...calibrationPoints.slice(0,2),Number(known.value),...calibrationPoints.slice(2),Number(check.value));});setTool("select");}));
      }
      if(d.calibration)add(node("p",{text:`Plan scale ${d.calibration.metresPerPixel.toPrecision(5)} m/px; independent error ${d.calibration.errorPct.toFixed(2)}%. Version ${d.calibration.version}.`}));
    } else if(panelName==="Evidence"){
      const bundle=store.getState().workingBundle;
      if(!record.projectId){add(node("p",{text:"Attach to a project to link scouting findings."}));return;}
      const assessments=bundle?.scoutAssessments.filter(a=>a.projectId===record.projectId&&a.locationId===record.locationId)??[];
      for(const a of assessments){
        add(node("strong",{text:a.title+" · "+a.observationDate+" · revision "+a.revision}));
        for(const answer of a.answers.filter(a=>a.state!=="unanswered"))add(button("Link "+answer.questionId,()=>change(d=>{const ref={assessmentId:a.id,revision:a.revision,questionId:answer.questionId};if(!d.evidence.some(e=>JSON.stringify(e)===JSON.stringify(ref)))d.evidence.push(ref);})));
      }
      for(const e of d.evidence){
        const revision=bundle?.scoutAssessmentRevisions.find(r=>r.assessmentId===e.assessmentId&&r.revision===e.revision),a=revision?.snapshot,
          current=bundle?.scoutAssessments.find(a=>a.id===e.assessmentId),answer=a?.answers.find(a=>a.questionId===e.questionId);
        const card=node("section",{class:"shot-card"},[node("strong",{text:(a?.title??"Missing assessment")+" · revision "+e.revision}),
          node("p",{text:e.questionId+" · "+(answer?.state??"Missing evidence")+" · "+JSON.stringify(answer?.textValue??answer?.numberValue??answer?.booleanValue??null)}),
          node("p",{text:answer?.note??""}),node("small",{text:current?.revision!==e.revision?"Newer evidence exists; retained revision shown.":"Current evidence revision."}),
          button("Unlink",()=>change(d=>d.evidence=d.evidence.filter(x=>x!==d.evidence.find(x=>x.assessmentId===e.assessmentId&&x.questionId===e.questionId&&x.revision===e.revision))))]);
        for(const id of answer?.mediaIds??[]){const m=bundle.scoutMedia.find(m=>m.id===id);if(m?.data&&m.mime.startsWith("image/"))card.append(node("img",{class:"shot-bg-preview",src:"data:"+m.mime+";base64,"+m.data,alt:m.filename}));else card.append(node("p",{text:m?.filename??"Missing media"}));}
        add(card);
      }
    } else if(panelName==="Save / Export"){
      add(node("p",{text:record.projectId?"Project-owned diagram":"Standalone diagram · stored in this browser"}),
        button("Save locally / Retry",async()=>{if(!record.diagram)record=actions.updateDiagram(record,value());markDirty();await flush();}),
        button("Attach to active project / scene",()=>{record=actions.attachDiagram(record);markDirty();refreshPanel();}),
        button("Diagram JSON / emergency backup",()=>download(diagramFilename(record,"json"),diagramJson({...record,diagram:value()}),"application/json")),
        button("Project JSON",async()=>{if(!record.projectId)throw new Error("Attach to a project first.");const file=await actions.exportProject(record.projectId);if(file)download(file.filename,file.text,"application/json");}),
        button("Export PNG",async()=>{if(value().background.dataUrl&&!image)throw new Error("Background unavailable. Wait for decoding or use JSON to preserve the work.");download(diagramFilename(record,"png"),await diagramPng({...record,diagram:value()},image),"image/png");}),
        button("Export shot-list CSV",()=>download(diagramFilename(record,"csv"),shotCsv({...record,diagram:value()}),"text/csv;charset=utf-8")));
      const input=node("input",{type:"file",accept:".json","aria-label":"Import standalone diagram JSON"});
      input.addEventListener("change",async()=>{try{
        const f=input.files[0];if(!f||f.size>MAX_DIAGRAM_CHARS)throw new Error("Diagram JSON must be under 48 MiB.");
        const data=JSON.parse(await f.text());if(data.format!=="slivr-diagram"||data.version!==1)throw new Error("Choose a SLiVR diagram export. Project JSON uses Project tools.");
        const errors=diagramErrors(data.record?.diagram);if(errors.length)throw new Error(errors[0].reason);
        for(const bg of [data.record.diagram.background,...data.record.diagram.variants.map(v=>v.snapshot.background)]){if(bg.dataUrl){const decoded=await loadImage(bg.dataUrl);if(decoded.width!==bg.width||decoded.height!==bg.height)throw new Error("Background dimensions do not match the stored image.");}}
        if(!win.confirm("Import as a new arrangement? The current one will be retained as a variant."))return;
        const incoming=clone(data.record.diagram);
        // Standalone transfer cannot transplant private evidence ownership.
        incoming.evidence=[];incoming.variants.forEach(v=>v.snapshot.evidence=[]);
        saveVariant(incoming,"Before import");incoming.variants.at(-1).snapshot=snapshot(value());
        history.commit(incoming);
      }catch(e){notify(e.message);}});
      add(node("label",{text:"Import diagram (project evidence stays with project JSON)"},[input]));
    }
    pane.scrollTop=scroll;
  }
  function edit(id,fields){change(d=>{const o=d.objects.find(o=>o.id===id);if(o.locked&&!Object.keys(fields).every(k=>["locked","hidden"].includes(k)))throw new Error("Unlock this object before editing.");Object.assign(o,fields);});}
  function pointEdit(o,i,key,v){const path=clone(o.path);path[i][key]=v;edit(o.id,{path});}
  function addShot(o){change(d=>d.shots.push({id:newId("shot"),cameraId:o.id,number:String(d.shots.length+1),shotType:"",description:"",movement:"",duration:o.duration,status:"planned",notes:""}));panelName="Shots";refreshPanel();}
  function remove(){const d=value(),linked=d.shots.filter(s=>selected.includes(s.cameraId)).length;if(win.confirm("Delete "+selected.length+" object(s), their paths and "+linked+" linked shot(s)?")){change(d=>deleteObjects(d,selected));selected=[];paint();}}
  function point(event){const r=canvas.getBoundingClientRect();return imagePoint({x:event.clientX-r.left,y:event.clientY-r.top},view);}
  canvas.addEventListener("pointerdown",event=>{
    if(event.button!==0&&event.button!==1)return;canvas.focus();canvas.setPointerCapture?.(event.pointerId);
    const p=point(event),d=value();
    if(tool==="calibrate"){if(calibrationPoints.length<4)calibrationPoints.push(p);paint();return;}
    if(tool==="pan"||event.button===1){drag={pan:true,start:{x:event.clientX,y:event.clientY},view:{...view}};return;}
    const o=d.objects.find(o=>selected.includes(o.id));
    if(tool==="path"&&o&&!o.locked){
      const n=o.path.findIndex(q=>Math.hypot(q.x-p.x,q.y-p.y)<12/view.scale);
      if(n>=0)drag={pointIndex:n,id:o.id,start:p,draft:clone(d),original:clone(d)};
      else change(d=>{const target=d.objects.find(x=>x.id===o.id);if(!target.path.length)target.path.push({x:o.x,y:o.y});target.path.push(p);});
      return;
    }
    const hits=hitObjects(d,p),hit=event.altKey?hits[(hits.findIndex(o=>selected.includes(o.id))+1)%hits.length]:hits[0];
    if(hit){
      if(event.shiftKey)selected=selected.includes(hit.id)?selected.filter(id=>id!==hit.id):[...selected,hit.id];
      else if(!selected.includes(hit.id))selected=hit.groupId?d.objects.filter(o=>o.groupId===hit.groupId).map(o=>o.id):[hit.id];
      drag={start:p,draft:clone(d),original:clone(d),rotate:tool==="rotate"};
      panelName="Properties";refreshPanel();
    }else {selected=[];drag={pan:true,start:{x:event.clientX,y:event.clientY},view:{...view}};}
    paint();
  });
  canvas.addEventListener("pointermove",event=>{
    if(!drag)return;
    if(drag.pan){view.x=drag.view.x+event.clientX-drag.start.x;view.y=drag.view.y+event.clientY-drag.start.y;paint();return;}
    const p=point(event),d=clone(drag.original);
    if(drag.pointIndex!==undefined)d.objects.find(o=>o.id===drag.id).path[drag.pointIndex]=p;
    else if(drag.rotate){const o=d.objects.find(o=>selected.includes(o.id));if(o)rotateObjects(d,selected,(Math.atan2(p.y-o.y,p.x-o.x)-Math.atan2(drag.start.y-o.y,drag.start.x-o.x))*180/Math.PI);}
    else{
      let dx=p.x-drag.start.x,dy=p.y-drag.start.y;
      if(d.snap){const o=d.objects.find(o=>selected.includes(o.id));if(o){dx=Math.round((o.x+dx)/d.gridSize)*d.gridSize-o.x;dy=Math.round((o.y+dy)/d.gridSize)*d.gridSize-o.y;}}
      moveObjects(d,selected,dx,dy);
    }
    drag.draft=d;paint();
  });
  function endDrag(commit){if(drag?.draft&&commit){const d=drag.draft;drag=null;try{history.commit(d);}catch(e){notify(e.message);}}else drag=null;paint();}
  canvas.addEventListener("pointerup",()=>endDrag(true));canvas.addEventListener("pointercancel",()=>endDrag(false));
  canvas.addEventListener("wheel",e=>{e.preventDefault();const p=point(e),old=view.scale;view.scale=Math.max(.03,Math.min(8,old*Math.exp(-e.deltaY*.001)));view.x+=(old-view.scale)*p.x;view.y+=(old-view.scale)*p.y;paint();},{passive:false});
  canvas.addEventListener("keydown",e=>{
    try{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?history.redo():history.undo();}
      else if(e.key==="Delete"){e.preventDefault();remove();}
      else if(e.key==="Escape"){selected=[];tool="select";panelName="";pane.hidden=true;paint();}
      else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();const n=e.shiftKey?10:1;change(d=>moveObjects(d,selected,e.key==="ArrowLeft"?-n:e.key==="ArrowRight"?n:0,e.key==="ArrowUp"?-n:e.key==="ArrowDown"?n:0));}
    }catch(error){notify(error.message);}
  });
  title.addEventListener("change",()=>{if(title.value.trim()){record=actions.updateDiagram(record,value(),title.value.trim());markDirty();}});
  toolbar.append(button("← Explore",async()=>{const result=await flush();if(result?.ok===false)return;actions.returnFromDiagram();}),title,
    ...["Add","Objects / Layers","Shots","Variants","Background","Evidence","Save / Export"].map(name=>button(name,()=>showPanel(name))),
    button("Undo",()=>history.undo()),button("Redo",()=>history.redo()),button("Select",()=>setTool("select")),button("Pan",()=>setTool("pan")),
    button("Rotate",()=>setTool("rotate")),button("Fit",()=>{fitPending=true;paint();}));
  function frame(now){
    if(!playing||disposed)return;
    preview=(now-start)/1000;const duration=Math.max(1,...value().objects.map(o=>o.duration));
    if(preview>=duration){preview=duration;playing=false;}seek.max=duration;seek.value=preview;timeLabel.textContent=preview.toFixed(2)+" s";paint();
    if(playing)raf=win.requestAnimationFrame(frame);
  }
  seek.addEventListener("input",()=>{playing=false;preview=Number(seek.value);timeLabel.textContent=preview.toFixed(2)+" s";paint();});
  bottom.append(button("Play",()=>{if(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches){notify("Reduced motion: use the time slider to preview positions.");return;}if(playing)return;if(raf)win.cancelAnimationFrame?.(raf);playing=true;start=win.performance.now()-(preview??0)*1000;raf=win.requestAnimationFrame(frame);}),
    button("Pause",()=>{playing=false;}),button("Reset",()=>{playing=false;preview=null;seek.value=0;timeLabel.textContent="0.00 s";paint();}),seek,timeLabel,node("span",{text:"Schematic overlay · image pixels"}));
  root.append(toolbar,viewport,pane,bottom,status);
  const observer=typeof ResizeObserver==="function"?new ResizeObserver(()=>{pane.style.top=(toolbar.offsetHeight+8)+"px";paint();}):null;observer?.observe(viewport);observer?.observe(toolbar);
  const beforeUnload=e=>{if(dirty){e.preventDefault();e.returnValue="";}};
  win.addEventListener?.("beforeunload",beforeUnload);
  loadBackground();paint();notify(record.diagram?"Local diagram ready.":"Blank image diagram ready. Any earlier spatial content is preserved separately; it has not been converted to this image.");
  return {element:root,id:record.id,flush,
    dispose(){disposed=true;playing=false;clearTimeout(timer);if(raf)win.cancelAnimationFrame?.(raf);observer?.disconnect();unregister?.();win.removeEventListener?.("beforeunload",beforeUnload);imageGeneration++;},
    refresh(){paint();}
  };
}
