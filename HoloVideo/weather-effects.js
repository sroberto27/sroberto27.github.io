// Transparent, layered atmosphere. Coordinates are CSS pixels; backing resolution is capped.
class WeatherEffects {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.last=0;this.flash=null;this.nextFlash=0;this.previous='';
    this.drops=Array.from({length:420},()=>({x:Math.random(),y:Math.random(),depth:Math.random(),phase:Math.random()*Math.PI*2}));
    this.ripples=[];
    this.mist=document.createElement('canvas');this.mist.width=this.mist.height=128;
    const c=this.mist.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(177,196,207,.14)');g.addColorStop(.45,'rgba(177,196,207,.07)');g.addColorStop(1,'rgba(177,196,207,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
  }
  bolt(w,h) {
    const points=[[w*(.25+Math.random()*.5),-10]];
    for(let i=1;i<13;i++)points.push([points[i-1][0]+(Math.random()-.5)*w*.13,i*h*.065]);
    return points;
  }
  render(now,options) {
    if(now-this.last<1000/40||document.hidden)return;
    const dt=Math.min((now-this.last)/1000,.06);this.last=now;
    const {mode,intensity,weather,live,flashes}=options,c=this.ctx,w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    if(!w||!h)return;
    const dpr=Math.min(window.devicePixelRatio||1,2,1800/Math.max(w,h));
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr)}
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    if(mode!==this.previous){this.flash=null;this.ripples=[];this.nextFlash=now+3000+Math.random()*6000;this.previous=mode}
    if(!intensity||mode==='off')return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wind=live?Math.min(1.4,(weather?.wind_speed_10m||0)/45):.3;
    const wet=mode==='rain'||mode==='storm';
    const rainRate=live?Math.max(.08,Math.min(1.8,Math.sqrt((weather?.precipitation||.1)/4))):(mode==='storm'?1.5:.65);
    const count=Math.min(420,Math.round((wet?200*rainRate:mode==='snow'?120:55)*intensity));
    if(mode==='fog'||mode==='cloudy'||mode==='storm'){
      for(let i=0;i<12;i++){const p=this.drops[i],x=((p.x+now*.000003*(1+wind))%1)*w;
        c.globalAlpha=(mode==='fog'?.85:mode==='cloudy'?.45:.3)*intensity;
        c.drawImage(this.mist,x-w*.5,(mode==='fog'?p.y*h:h*p.y*.22)-h*.18,w,h*.5);
      }c.globalAlpha=1;
    }
    if(mode==='fog'||mode==='cloudy')return;
    // Clear daytime has a soft warm glow; stars remain fixed in the night sky.
    if(mode==='clear'&&live&&weather?.is_day!==0){const glow=c.createRadialGradient(w*.8,h*.12,0,w*.8,h*.12,w*.45);glow.addColorStop(0,'rgba(255,225,160,.09)');glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(0,0,w,h);return}
    for(let i=0;i<count;i++){
      const p=this.drops[i],z=.2+p.depth*.8;
      if(mode!=='clear'){
        p.y+=dt*(wet?(.45+z*.85):mode==='snow'?(.025+z*.055):.015)*(reduced?.5:1);
        p.x+=dt*(wet?wind*.16:mode==='wind'?.12+wind*.1:wind*.025);
        if(p.y>1){if(wet&&z>.65&&this.ripples.length<35)this.ripples.push({x:p.x*w,y:h*(.88+Math.random()*.1),age:0,z});p.y=-.05;p.x=Math.random()}
        p.x=(p.x+1)%1;
      }
      let x=p.x*w,y=p.y*h;
      if(wet){
        const length=(5+z*z*25)*(h/650),slant=wind*length*.5;
        c.strokeStyle=`rgba(181,211,235,${.1+z*.45})`;c.lineWidth=.35+z*1.2;c.lineCap='round';
        c.beginPath();c.moveTo(x,y);c.lineTo(x+slant,y+length);c.stroke();
      }else if(mode==='snow'){
        x+=Math.sin(now*.00065+p.phase)*18*z;
        c.fillStyle=`rgba(234,244,255,${.25+z*.65})`;c.beginPath();c.arc(x,y,.6+z*z*3,0,Math.PI*2);c.fill();
        if(z>.9){c.strokeStyle='rgba(240,249,255,.5)';c.lineWidth=.5;for(let a=0;a<3;a++){c.beginPath();c.moveTo(x+Math.cos(a*Math.PI/3)*4,y+Math.sin(a*Math.PI/3)*4);c.lineTo(x-Math.cos(a*Math.PI/3)*4,y-Math.sin(a*Math.PI/3)*4);c.stroke()}}
      }else if(mode==='wind'){
        y+=Math.sin(now*.001+p.phase)*22;c.save();c.translate(x,y);c.rotate(now*.001*(.3+z)+p.phase);c.scale(1,Math.cos(now*.002+p.phase)*.6);c.fillStyle=`rgba(174,149,91,${.2+z*.5})`;c.beginPath();c.ellipse(0,0,3+z*5,2+z*2,0,0,Math.PI*2);c.fill();c.restore();
      }else if(mode==='clear'){
        c.globalAlpha=(.25+z*.5)*(reduced?1:.8+.2*Math.sin(now*.001+p.phase));c.fillStyle='#dceeff';c.beginPath();c.arc(x,y,.45+z,0,Math.PI*2);c.fill();c.globalAlpha=1;
      }
    }
    this.ripples=this.ripples.filter(r=>r.age<.45);
    for(const r of this.ripples){r.age+=dt;c.strokeStyle=`rgba(175,213,235,${Math.max(0,(1-r.age/.45)*.22)})`;c.lineWidth=.7;c.beginPath();c.ellipse(r.x,r.y,1+r.age*22,1+r.age*5,0,0,Math.PI*2);c.stroke()}
    if(mode==='storm'&&flashes&&!reduced){
      if(now>=this.nextFlash){const points=this.bolt(w,h);this.flash={at:now,paths:[points,...[3,6,8].map(i=>[points[i],[points[i][0]+w*.07,points[i][1]+h*.06],[points[i][0]+w*.04,points[i][1]+h*.14]])]};this.nextFlash=now+7000+Math.random()*15000}
      if(this.flash){const age=now-this.flash.at,alpha=age<80?.85:age>160&&age<240?.5:0;
        if(age>400)this.flash=null;
        else if(alpha){c.fillStyle=`rgba(201,215,255,${alpha*.09})`;c.fillRect(0,0,w,h);for(const width of [7,2,.8]){c.strokeStyle=`rgba(211,226,255,${alpha*(width===7?.12:.8)})`;c.lineWidth=width;c.beginPath();for(const path of this.flash.paths){c.moveTo(...path[0]);for(const point of path.slice(1))c.lineTo(...point)}c.stroke()}}
      }
    }
  }
}
