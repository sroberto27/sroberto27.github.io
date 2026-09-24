/** Nonmodal tools share the viewing workspace without replacing its providers. */
export function createToolWindows({ doc, host, win, onLayout = () => {}, beforeClose = async () => true }) {
 const mobile = () => (win.innerWidth ?? 1200) <= 880;
 const tools = new Map(); let order = 60, saved = {};
 try { saved = JSON.parse(win.localStorage.getItem("slivr:tool-layout") || "{}"); } catch {}
 const strip = doc.createElement("div"); strip.className = "tool-strip"; (host.parentNode || host).append(strip);
 function persist() { try { win.localStorage.setItem("slivr:tool-layout", JSON.stringify({ ...saved, ...Object.fromEntries([...tools].map(([id,t]) => [id, { mode:t.preferred, state:t.mode, geometry:t.geometry }])) })); } catch {} }
 function raise(t) { t.priority=++order; [...tools.values()].sort((a,b)=>(a.priority??0)-(b.priority??0)).forEach((item,index)=>item.element.style?.setProperty("z-index",String(60+index))); }
 function layout(t) {
  t.element.hidden = t.mode === "minimized" || t.mode === "closed";
  t.element.setAttribute("data-window-mode", t.mode);
  t.restore.hidden = t.mode === "floating";
  t.element.setAttribute("data-mobile-size", t.mobileSize || "full");
  strip.hidden = ![...tools.values()].some(item => item.mode === "minimized");
  const active = [...tools.values()].find(item => !item.element.hidden);
  host.setAttribute("data-mobile-tool", mobile() && active ? active.mobileSize || "full" : "none");
  t.tab.hidden = t.mode !== "minimized";
  const g=t.geometry;
  t.element.setAttribute("style", `--tool-x:${g.x}px;--tool-y:${g.y}px;--tool-w:${g.w}px;--tool-h:${g.h}px;z-index:60`);
  const side=[...tools.values()].find(item=>item.mode === "docked");
  host.setAttribute("data-tool-docked", String(Boolean(side)));
  host.style?.setProperty("--dock-width", `${side?.geometry.w ?? 620}px`);
  raise(t); persist(); onLayout();
 }
 function setMode(t, mode) {
  if (mobile() && !["minimized","closed"].includes(mode)) for (const other of tools.values()) if (other !== t && !other.element.hidden) { other.mode="minimized"; layout(other); }
  if (mode === "docked") for (const other of tools.values()) if (other !== t && other.mode === "docked") {other.mode="floating"; layout(other);}
  if(!mobile() && ["floating","docked","maximized"].includes(mode)) t.preferred=mode; t.mode=mode; layout(t);
 }
 function create(id, title) {
  const element=doc.createElement("section"); element.className="tool-window"; element.setAttribute("role","region"); element.setAttribute("aria-label",title);
  const header=doc.createElement("header"); header.className="tool-window-bar";
  const heading=doc.createElement("button"); heading.type="button"; heading.className="tool-window-title"; heading.textContent=title; heading.setAttribute("aria-label",`${title}: drag to move; arrow keys move window; Shift and arrows resize`);
  const controls=doc.createElement("div"); controls.className="tool-window-controls";
  const body=doc.createElement("div"); body.className="tool-window-body";
  const tab=doc.createElement("button"); tab.type="button"; tab.textContent=title; strip.append(tab);
  const prior=saved[id] || {}, g=prior.geometry || {};
  const t={element,body,heading,tab,mode:"closed",preferred:["floating","docked","maximized"].includes(prior.mode)?prior.mode:"floating",geometry:{x:Number.isFinite(g.x)?Math.max(0,g.x):24,y:Number.isFinite(g.y)?Math.max(0,g.y):60,w:Number.isFinite(g.w)?Math.max(360,Math.min(g.w,1100)):760,h:Number.isFinite(g.h)?Math.max(250,Math.min(g.h,1000)):650}};
  const button=(label, fn)=>{const b=doc.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);controls.append(b);return b;};
  button("Minimize",()=>{setMode(t,"minimized");tab.focus();});
  button("Side by side",()=>setMode(t,"docked"));
  button("Maximize",()=>setMode(t,"maximized"));
  t.restore=button("Restore",()=>setMode(t,"floating"));
  const view=button("View",()=>setMode(t,"minimized")); view.className="mobile-tool-control";
  const size=button("View + tool",()=>{t.mobileSize=t.mobileSize === "half" ? "full" : "half";size.textContent=t.mobileSize === "half" ? "Expand" : "View + tool";layout(t);});size.className="mobile-tool-control";
  button("Close",async()=>{if(await beforeClose(id)) {setMode(t,"closed");t.opener?.focus?.();}});
  tab.addEventListener("click",()=>setMode(t,t.preferred));
  heading.addEventListener("keydown",event=>{const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!delta || mobile())return;event.preventDefault();if(event.shiftKey){t.geometry.w=Math.max(340,t.geometry.w+delta[0]);t.geometry.h=Math.max(240,t.geometry.h+delta[1]);}else{t.geometry.x=Math.max(0,t.geometry.x+delta[0]);t.geometry.y=Math.max(0,t.geometry.y+delta[1]);}setMode(t,"floating");});
  heading.addEventListener("pointerdown",event=>{if(t.mode!=="floating" || mobile())return;const x=event.clientX,y=event.clientY,start={...t.geometry};heading.setPointerCapture?.(event.pointerId);const move=e=>{t.geometry.x=Math.max(0,Math.min((host.clientWidth||1200)-120,start.x+e.clientX-x));t.geometry.y=Math.max(0,Math.min((host.clientHeight||800)-70,start.y+e.clientY-y));layout(t);};const up=()=>{heading.removeEventListener("pointermove",move);heading.removeEventListener("pointerup",up);};heading.addEventListener("pointermove",move);heading.addEventListener("pointerup",up);});
  element.addEventListener("pointerdown",()=>raise(t));
  header.append(heading,controls);element.append(header,body);host.append(element);tools.set(id,t);
  if(win.ResizeObserver){t.observer=new win.ResizeObserver(entries=>{if(mobile() || !["floating","docked"].includes(t.mode))return;const r=entries[0].contentRect;if(r.width>0&&r.height>0){t.geometry.w=r.width;t.geometry.h=r.height;persist();if(t.mode==="docked"){host.style.setProperty("--dock-width",`${r.width}px`);onLayout();}}});t.observer.observe(element);}
  layout(t);return t;
 }
 const back=()=>{if(mobile() && !win.history?.state?.slivrTool)for(const t of tools.values())if(!t.element.hidden)setMode(t,"minimized");};
 win.addEventListener?.("popstate",back);
 let wasMobile=mobile();
 const resized=()=>{const next=mobile();if(next===wasMobile)return;wasMobile=next;let active=false;for(const t of [...tools.values()].reverse()){if(next && !t.element.hidden){if(active)t.mode="minimized";active=true;}layout(t);}};
 win.addEventListener?.("resize",resized);
 return {
  hideAll(){for(const t of tools.values())if(!t.element.hidden)setMode(t,"minimized");},
  ensure(id,title){return tools.get(id)||create(id,title);},
  open(id,title){if(mobile() && win.history?.pushState && !win.history.state?.slivrTool)win.history.pushState({...win.history.state,slivrTool:id},"",win.location.href);const t=tools.get(id)||create(id,title);t.opener=doc.activeElement;setMode(t,["closed","minimized"].includes(t.mode)?t.preferred:t.mode);t.heading.focus();return t;},
  minimize(id){const t=tools.get(id);if(t)setMode(t,"minimized");},
  close(id){const t=tools.get(id);if(t)setMode(t,"closed");},
  get(id){return tools.get(id);},
  savedState(id){return saved[id]?.state;},
  resume(id,title){const t=tools.get(id)||create(id,title);setMode(t,["minimized","floating","docked","maximized"].includes(saved[id]?.state)?saved[id].state:"floating");return t;},
  reset(){saved={};for(const t of tools.values()){t.geometry={x:24,y:60,w:760,h:650};if(t.mode!=="closed")t.mode="minimized";layout(t);}},
  destroy(){win.removeEventListener?.("popstate",back);win.removeEventListener?.("resize",resized);for(const t of tools.values()){t.observer?.disconnect();t.element.remove();}strip.remove();}
 };
}
