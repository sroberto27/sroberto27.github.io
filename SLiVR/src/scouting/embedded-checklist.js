import { createAssessmentEditor } from "./assessment-editor.js";
import { SECTIONS, QUESTIONS } from "./assessment-template.js";

/** Local V2 presentation bound to the existing SLiVR assessment transaction path. */
export function createEmbeddedChecklist({ doc, host, assessment, getBundle, actions, win, getSaveState = () => ({label:"Local workspace"}) }) {
 const frame=doc.createElement("iframe"); frame.className="checklist-frame";frame.title="Location Scouting Checklist";
 frame.setAttribute("title","Location Scouting Checklist");
 let editor=null,disposed=false,observer=null,refreshStatus=()=>{};
 const fallback=()=>{if(editor||disposed)return;editor=createAssessmentEditor({doc,assessment,getBundle,actions});host.append(editor.element);};
 function connect() {
  if(disposed||editor)return;
  const d=frame.contentDocument;
  if(!d?.getElementById("checklistForm"))return;
  d.getElementById("checklistForm").addEventListener("submit",event=>event.preventDefault());
  editor=createAssessmentEditor({doc:d,assessment,getBundle,actions});
  editor.element.id="slivrEngine";d.body.append(editor.element);
  const meta=d.getElementById("slivrMeta");
  for(const child of [...editor.element.children]) if(!["NAV","DETAILS"].includes(child.tagName))meta.append(child);
  const sectionList=d.getElementById("sectionList");
  SECTIONS.forEach((section,index)=>{
   const li=d.createElement("li"),link=d.createElement("a");link.href=`#sec-${index+1}`;link.setAttribute("data-sec",String(index+1));
   const number=d.createElement("span"),name=d.createElement("span"),fraction=d.createElement("span");
   number.className="snum";number.textContent=String(index+1);name.className="sname";name.textContent=d.getElementById(`sec-${index+1}`).querySelector("h2").textContent.replace(/^\s*\d+\s*/,"").trim();fraction.className="sfrac";fraction.id=`sfrac-${index+1}`;
   link.append(number,name,fraction);
   link.addEventListener("click",event=>{event.preventDefault();d.getElementById(`sec-${index+1}`).scrollIntoView({block:"start"});for(const item of sectionList.querySelectorAll("a"))item.classList.toggle("active",item===link);d.getElementById("sidenav").classList.remove("open");d.getElementById("sidenavBackdrop").classList.remove("open");try{win.localStorage.setItem(`slivr:checklist-section:${assessment.id}`,String(index+1));}catch{};});
   li.append(link);sectionList.append(li);
  });
  for(const q of QUESTIONS){
   const original=d.getElementById(q.id), binding=editor.bindings.get(q.id);if(!original||!binding)continue;
   const {field,valueInput,stateInput}=binding;
   if(["wide-angle","close-up","video"].includes(q.id)) {
    const holder=d.createElement("div"),attach=d.createElement("button"),icon=d.createElement("i");holder.className="photo-tools";attach.type="button";attach.className="tbtn tbtn--sm photo-add-btn";icon.className=`fa-solid ${q.id==="video"?"fa-video":"fa-camera"}`;attach.append(icon,d.createTextNode(q.id==="video"?" Attach video":" Attach photo"));
    attach.addEventListener("click",()=>{field.querySelector(`[aria-label="${q.label}: attachment kind"]`).value=q.id==="video"?"video":"photo";field.querySelector('input[type="file"]').click();});holder.append(attach);original.closest(".doc-card").append(holder);
    if(q.id==="wide-angle"){const pano=d.createElement("button");pano.type="button";pano.className="tbtn tbtn--sm";const pi=d.createElement("i");pi.className="fa-solid fa-globe";pano.append(pi,d.createTextNode(" Attach existing 360"));pano.addEventListener("click",()=>{field.querySelector(`[aria-label="${q.label}: attachment kind"]`).value="panorama";field.querySelector('input[type="file"]').click();});holder.append(pano);}
   }
   if(["zoning-regulations","ownership-confirmed","permission-to-film","circuit-capacity"].includes(q.id)){const label=d.querySelector(`label[for="${q.id}"] > span`);if(label)label.textContent=q.label;}
   const wrapper=original.closest(".field, .doc-card") || original.parentElement.parentElement;
   const evidence=d.createElement("details");evidence.className="evidence-details";const summary=d.createElement("summary");summary.textContent=`Notes, evidence and attachments: ${q.label}`;evidence.append(summary,field);wrapper.append(evidence);
   valueInput.parentElement.hidden=true;
   stateInput.parentElement.className="slivr-answer-state";wrapper.append(stateInput.parentElement);
   const sync=()=>{if(q.type==="boolean"){original.checked=valueInput.value==="true";original.indeterminate=stateInput.value==="unanswered";}else{if(original.tagName==="SELECT"&&valueInput.value&&!Array.from(original.options).some(o=>o.value===valueInput.value)){const option=d.createElement("option");option.value=valueInput.value;option.textContent=valueInput.value;original.append(option);}original.value=valueInput.value;} };
   sync();
   original.addEventListener(q.type==="boolean"||original.tagName==="SELECT"?"change":"input",()=>{valueInput.value=q.type==="boolean"?String(original.checked):original.value;valueInput.dispatchEvent(new frame.contentWindow.Event(q.type==="boolean"?"change":"input",{bubbles:true}));sync();});
   stateInput.addEventListener("change",sync);
   // Known negative observations are explicit; untouched switches remain unanswered.
   if(q.type==="boolean"){const no=d.createElement("button");no.type="button";no.className="tbtn tbtn--sm";no.textContent="Record No";no.addEventListener("click",()=>{valueInput.value="false";valueInput.dispatchEvent(new frame.contentWindow.Event("change",{bubbles:true}));sync();});wrapper.append(no);}
  }
  // V2 numeric counters operate the same stored fields as direct typing.
  for(const b of d.querySelectorAll(".counter button")){b.addEventListener("click",()=>{const input=b.parentElement.querySelector("input");if(!input)return;input.value=String(Math.max(0,Number(input.value||0)+(b.getAttribute("data-action")==="inc"?1:-1)));input.dispatchEvent(new frame.contentWindow.Event("input",{bubbles:true}));});}
  const date=d.getElementById("date-of-scouting"), dateEngine=meta.querySelector('[aria-label="Observation date"]');if(date&&dateEngine){date.value=dateEngine.value;date.addEventListener("input",()=>{dateEngine.value=date.value;dateEngine.dispatchEvent(new frame.contentWindow.Event("input"));});dateEngine.parentElement.hidden=true;}
  const history=[...editor.element.children].find(n=>n.tagName==="DETAILS"&&n.textContent.includes("Assessment history"));if(history)meta.append(history);
  const save=d.getElementById("btnSaveBottom");save?.addEventListener("click",()=>editor.flush());
  const exportFile=async()=>{await editor.flush();const file=await actions.exportProject(assessment.projectId);if(!file)return;const url=URL.createObjectURL(new Blob([file.text],{type:"application/json"}));const a=d.createElement("a");a.href=url;a.download=file.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  d.getElementById("btnExport")?.addEventListener("click",exportFile);d.getElementById("btnExportBottom")?.addEventListener("click",exportFile);
  d.getElementById("themeToggle")?.addEventListener("click",()=>{const dark=d.documentElement.getAttribute("data-theme")!=="dark";d.documentElement.setAttribute("data-theme",dark?"dark":"light");});
  const nav=d.getElementById("sidenav"),backdrop=d.getElementById("sidenavBackdrop");
  d.getElementById("navToggle")?.addEventListener("click",()=>{nav.classList.toggle("open");backdrop.classList.toggle("open");});backdrop?.addEventListener("click",()=>{nav.classList.remove("open");backdrop.classList.remove("open");});
  function status(){SECTIONS.forEach((section,index)=>{const count=section.questions.filter(q=>["observed","not-applicable"].includes(editor.bindings.get(q.id).stateInput.value)).length;d.getElementById(`sfrac-${index+1}`).textContent=`${count}/${section.questions.length}`;sectionList.querySelector(`a[data-sec="${index+1}"]`).classList.toggle("complete",count===section.questions.length);});const statusLabel=d.getElementById("saveStatus").querySelector("span");statusLabel.textContent=/Unsaved|Saving/.test(editor.status.textContent)?editor.status.textContent:getSaveState().label;const match=editor.progress.textContent.match(/^(\d+)%/);d.getElementById("progressLabel").textContent=match?`${match[1]}% complete`:"";d.getElementById("progressFill").style.width=match?`${match[1]}%`:"0%";}
  refreshStatus=status; status();if(win.MutationObserver){observer=new win.MutationObserver(status);observer.observe(editor.status,{childList:true,subtree:true,characterData:true});observer.observe(editor.progress,{childList:true,subtree:true,characterData:true});}
  try{const section=Number(win.localStorage.getItem(`slivr:checklist-section:${assessment.id}`));if(section>=1&&section<=8)d.getElementById(`sec-${section}`).scrollIntoView({block:"start"});}catch{}
  d.addEventListener("keydown",event=>{if(event.key==="Escape"){nav.classList.remove("open");backdrop.classList.remove("open");}});
  const resize=()=>{const height=d.querySelector(".topbar").offsetHeight+d.querySelector(".toolbar").offsetHeight;d.documentElement.style.setProperty("--sticky-offset",`${height}px`);};frame.contentWindow.addEventListener("resize",resize);resize();
 }
 frame.addEventListener("load",()=>{try{connect();}catch(error){actions.notice(`Checklist could not initialize: ${error.message}. Your saved records are unchanged.`);}});frame.setAttribute("src","src/scouting/v2/index.html");host.append(frame);
 // Non-frame environments retain a functional accessible form.
 if(!("contentDocument" in frame)){frame.hidden=true;fallback();}
 return { element:frame,refreshStatus:()=>refreshStatus(),flush:()=>editor?.flush()??Promise.resolve(),matches:a=>editor?.matches(a)??a.id===assessment.id,dispose(){disposed=true;observer?.disconnect();editor?.dispose();frame.remove();} };
}
