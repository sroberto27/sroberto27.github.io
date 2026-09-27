import { previewPosition } from "./model.js";
import { fieldOfView } from "../spatial/optics.js";

// Sample each leg separately so every authored step receives a direction arrow.
export function pathLegs(o) {
  const curved=o.pathStyle?o.pathStyle!=="straight":o.curved;
  return o.path.slice(1).map((_,i)=>Array.from({length:curved?25:2},(_,n)=>
    previewPosition(o,(i+n/(curved?24:1))/(o.path.length-1)*o.duration)));
}
export function offsetLine(points,distance) {
  return points.map((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    return length?{x:p.x-(b.y-a.y)/length*distance,y:p.y+(b.x-a.x)/length*distance}:{...p};
  });
}
function strokeLine(ctx,points,color,width) {
  if(points.length<2)return;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.strokeStyle="#ffffffb0";ctx.lineWidth=width+2;ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function drawPath(ctx,o) {
  const camera=o.type==="camera",color=camera?"#18252e":o.color;
  for(const points of pathLegs(o)) {
    strokeLine(ctx,points,color,camera?2:3);
    const direction=camera?offsetLine(points,Math.max(10,o.size*.65)):points;
    if(camera)strokeLine(ctx,direction,color,2);
    // Place the arrow before the next symbol rather than underneath it.
    let distance=0,index=direction.length-1;
    const clearance=camera?o.size*.45:o.size*.75;
    while(index>0&&distance<clearance){distance+=Math.hypot(direction[index].x-direction[index-1].x,direction[index].y-direction[index-1].y);index--;}
    const a=direction[index],b=direction[Math.min(index+1,direction.length-1)];
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length>0&&distance>clearance){
      const t=Math.max(0,Math.min(1,(distance-clearance)/length));
      arrow(ctx,a,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},color,Math.max(9,o.size*.35),false);
    }
  }
}
export function drawDiagram(ctx,d,image,{selected=[],time=null,grid=true}={}) {
  const bg=d.background;
  ctx.fillStyle="#edf1f3";ctx.fillRect(0,0,bg.width,bg.height);
  if(image){ctx.save();ctx.globalAlpha=d.opacity;ctx.drawImage(image,0,0,bg.width,bg.height);ctx.restore();}
  if(grid&&d.grid){ctx.strokeStyle="#637c8c44";ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<bg.width;x+=d.gridSize){ctx.moveTo(x,0);ctx.lineTo(x,bg.height);}for(let y=0;y<bg.height;y+=d.gridSize){ctx.moveTo(0,y);ctx.lineTo(bg.width,y);}ctx.stroke();}
  const objects=d.objects.filter(o=>!o.hidden);
  // Paths sit below all symbols, including those belonging to other objects.
  for(const o of objects)if(o.path.length>1)drawPath(ctx,o);
  for(const o of objects){
    const steps=o.path.length>1?o.path:[];
    steps.forEach((p,i)=>{
      drawSymbol(ctx,o,p,selected.includes(o.id));
      ctx.save();ctx.fillStyle="#fff";ctx.strokeStyle="#18252e";ctx.lineWidth=2.5;
      ctx.font=`bold ${Math.max(11,o.size*.48)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      const shift=o.type==="camera"?-o.size*.15:0,a=o.angle*Math.PI/180;
      const x=p.x+shift*Math.cos(a),y=p.y+shift*Math.sin(a);
      ctx.strokeText(String(i+1),x,y);ctx.fillText(String(i+1),x,y);ctx.restore();
    });
    const pos=time===null?o:previewPosition(o,time);
    if(time!==null||!steps.some(p=>Math.hypot(p.x-o.x,p.y-o.y)<.01))drawSymbol(ctx,o,pos,selected.includes(o.id));
    ctx.save();ctx.font="bold 14px sans-serif";ctx.textAlign="center";ctx.lineWidth=4;ctx.strokeStyle="#fff";ctx.fillStyle="#172b36";
    const label=o.label+(o.type==="camera"?" / "+o.setup:"");
    ctx.strokeText(label,pos.x,pos.y+o.size+18);ctx.fillText(label,pos.x,pos.y+o.size+18);ctx.restore();
  }
}
function drawSymbol(ctx,o,pos,selected=false){
    ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(o.angle*Math.PI/180);ctx.fillStyle=o.color;ctx.strokeStyle="#16252c";ctx.lineWidth=2;
    const r=o.size;
    if(o.type==="camera"){
      if(o.wedge){const half=fieldOfView(o.lens).horizontalDeg*Math.PI/360;ctx.save();ctx.fillStyle=o.color+"30";ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(r*5*Math.cos(half),-r*5*Math.sin(half));ctx.lineTo(r*5*Math.cos(half),r*5*Math.sin(half));ctx.closePath();ctx.fill();ctx.restore();}
      ctx.fillRect(-r*.65,-r*.4,r,r*.8);ctx.strokeRect(-r*.65,-r*.4,r,r*.8);
      ctx.beginPath();ctx.moveTo(r*.35,0);ctx.lineTo(r*.9,-r*.45);ctx.lineTo(r*.9,r*.45);ctx.closePath();ctx.fill();ctx.stroke();
    } else if(o.type==="actor"||o.type==="mark"){
      ctx.beginPath();ctx.arc(0,0,r*.55,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(r*.1,-r*.48);ctx.lineTo(r*.1,r*.48);ctx.stroke();
    } else if(o.type==="arrow")arrow(ctx,{x:-r,y:0},{x:r,y:0},o.color,r*.4);
    else if(o.type==="annotation"){ctx.fillStyle="#fffc";ctx.fillRect(-r,-r*.5,r*2,r);ctx.strokeRect(-r,-r*.5,r*2,r);}
    else {ctx.fillRect(-r,-r*.45,r*2,r*.9);ctx.strokeRect(-r,-r*.45,r*2,r*.9);}
    if(selected){ctx.strokeStyle="#007acc";ctx.lineWidth=3;ctx.setLineDash([5,3]);ctx.strokeRect(-r-5,-r-5,r*2+10,r*2+10);ctx.setLineDash([]);}
    ctx.restore();
}
function arrow(ctx,a,b,color,size,shaft=true){
  const angle=Math.atan2(b.y-a.y,b.x-a.x);ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=4;if(shaft){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-size*Math.cos(angle-.55),b.y-size*Math.sin(angle-.55));ctx.lineTo(b.x-size*Math.cos(angle+.55),b.y-size*Math.sin(angle+.55));ctx.closePath();ctx.fill();ctx.restore();
}
export function hitObjects(d,p) {
  return d.objects.filter(o=>!o.hidden).reverse().filter(o=>[o,...o.path].some(q=>Math.hypot(q.x-p.x,q.y-p.y)<o.size+12));
}
export const imagePoint=(p,view)=>({x:(p.x-view.x)/view.scale,y:(p.y-view.y)/view.scale});
