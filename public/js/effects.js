"use strict";

class CityEffects {
 constructor(renderer){
  this.r=renderer;this.windows=new WeakMap();
  const flare=this.halo=document.createElement("canvas");flare.width=flare.height=48;
  const g=flare.getContext("2d"),grad=g.createRadialGradient(24,24,0,24,24,24);
  grad.addColorStop(0,"#fff3c1b5");grad.addColorStop(.35,"#ffd58159");grad.addColorStop(1,"#ffb64800");
  g.fillStyle=grad;g.fillRect(0,0,48,48);
 }
 glow(x,y,rx,ry){
  this.r.ctx.drawImage(this.halo,x-rx,y-ry,rx*2,ry*2);
 }
 windowMask(art,meta,height,id){
  if(this.windows.has(art))return this.windows.get(art);
  const rows=Math.min(8,Math.max(1,Math.floor(height/9))),c=document.createElement("canvas");
  c.width=Math.ceil(meta.w*1.5);c.height=Math.ceil(meta.h*1.5);
  const g=c.getContext("2d"),sx=c.width/meta.w,sy=c.height/meta.h;
  const h=Math.min(57,height),first=height>24?8:id==="airport"||id==="stadium"?4:5;
  let points=0;
  for(let j=0;j<rows;j++){
   const floor=first+(h*.73-first)*j/Math.max(1,rows-1);
   for(const [i,dx] of [-15,-9,-3,4,10,16].entries()){
    if((i+j*3)%7===1||height<16&&i%2===0)continue;
    const x=(meta.ax+dx)*sx,y=(meta.ay-floor+(17-Math.abs(dx))*.38)*sy;
    g.drawImage(this.halo,x-5*sx,y-4.5*sy,10*sx,9*sy);
    g.fillStyle="#ffe4a6";g.beginPath();g.roundRect(x-1.1*sx,y-1.4*sy,2.2*sx,2.8*sy,.45*sx);g.fill();points++;
   }
  }
  if(points){
   g.globalCompositeOperation="destination-in";g.drawImage(art,0,0,c.width,c.height);
  }
  this.windows.set(art,c);return c;
 }
 lightBuilding(box,meta,height,id,night){
  if(night<=.19||height<6||["solar_plant","wind_farm","water_tower","metro_wonder"].includes(id))return;
  const g=this.r.ctx;
  g.globalAlpha=Math.min(1,(night-.19)*1.6);
  g.drawImage(this.windowMask(box.art,meta,height,id),box.x,box.y,box.w,box.h);
  g.globalAlpha=1;
 }
 street(b,night,dark){
  if(night<=.18||(b.x+b.y*2)%3!==0)return;
  const r=this.r,z=r.camera.zoom,p=r.project(b.x+.82,b.y+.16),g=r.ctx;
  const x=p.x,y=p.y-12*z;
  if(!dark){
   g.globalAlpha=Math.min(1,night*1.25);
   if(!GameArt.draw(g,"terrain-props","light-pool",x,p.y,24*z,12*z))this.glow(x,p.y,12*z,6*z);
   g.globalAlpha=1;
  }
  if(!GameArt.draw(g,"terrain-props","lamp",p.x-1.5*z,p.y+z,8*z,15*z,{ground:true}))
   r.line([p,{x,y},{x:x-3*z,y:y-z}],dark?"#3c4c53":"#686663",1.35*z);
  if(!dark){this.glow(x-3*z,y-z,5*z,5*z);r.ellipse(x-3*z,y-z,1.9*z,1.25*z,"#ffedbb")}
 }
 bounce(b){
  if(this.r.sim.reduceEffects)return 1;
  const e=this.r.sim.fx.find(e=>(e.kind==="upgrade"||e.kind==="built")&&e.x===b.x&&e.y===b.y);
  return e?1+.115*Math.sin(Math.PI*Math.min(1,e.age/e.duration*1.45)):1;
 }
 render(world,heights){
  const r=this.r,g=r.ctx,z=r.camera.zoom;
  for(const e of r.sim.fx){
   if((e.world||r.sim.world)!==world)continue;
   const t=e.age/e.duration;
   if(e.kind==="reward"){
    this.reward(e,t,heights);continue;
   }
   const dust=e.kind==="dust"||e.kind==="built",repair=e.kind==="repair";
   const p=r.project(e.x+.5,e.y+.5),height=heights.get(coord(e.x,e.y))||12;
   const top=r.project(e.x+.5,e.y+.5,height*.55);
   if(!dust){
    g.globalAlpha=(1-t)*.9;
    if(!GameArt.draw(g,"vfx-construction-celebration",repair?"ring-mint":"ring-gold",p.x,p.y,(24+50*t)*z,(12+20*t)*z,{stretch:true})){
     g.beginPath();g.ellipse(p.x,p.y,(12+25*t)*z,(6+10*t)*z,0,0,Math.PI*2);
     g.strokeStyle=repair?"#b6f3d7":"#ffdf9b";g.lineWidth=(2.8-t*2)*z;g.stroke();
    }
   }
   for(let i=0;i<(dust?7:12);i++){
    const angle=i*2.399,spread=(9+t*(19+i%3*4))*z;
    const x=(dust?p.x:top.x)+Math.cos(angle)*spread,y=(dust?p.y:top.y)+Math.sin(angle)*spread*.45-19*t*z;
    g.globalAlpha=(1-t)*(dust?.55:1);
    if(dust){
     if(!GameArt.draw(g,"vfx-construction-celebration",i%3===0?"smoke-light":i%2?"dust-small":"dust-medium",x,y,(6+t*10)*z))
      r.ellipse(x,y,(3+t*5)*z,(2+t*3)*z,i%2?"#ede0bf":"#bb9f81");
    }
    else{
     const s=(1.5+(i%4)*.65)*(1-t*.6)*z;
     if(!GameArt.draw(g,"vfx-construction-celebration",repair?"sparkle-mint":i%3===0?"star":"sparkle-gold",x,y,3*s))
      r.poly([{x:x-s,y},{x,y:y-s*1.5},{x:x+s,y},{x,y:y+s*1.5}],repair?"#c7ffdf":i%2?"#fff1b7":"#ffcb6f");
    }
   }
   g.globalAlpha=1;
  }
 }
 reward(e,t,heights){
  const r=this.r,g=r.ctx;
  const target=r.ui?.resources[e.resource]?.el;
  if(!target)return;
  if(!e.to){
   const bounds=target.querySelector(".resource-icon").getBoundingClientRect(),canvas=r.canvas.getBoundingClientRect();
   e.to={x:bounds.left+bounds.width/2-canvas.left,y:bounds.top+bounds.height/2-canvas.top};
  }
  const from=e.x==null?{x:r.width*.5,y:r.height*.43}:r.project(e.x+.5,e.y+.5,(heights.get(coord(e.x,e.y))||6)+e.lift);
  const u=Math.min(1,t/.75),v=u*u*(3-2*u);
  const x=from.x+(e.to.x-from.x)*v,y=from.y+(e.to.y-from.y)*v-48*Math.sin(v*Math.PI);
  const color={coin:"#ffdd82",prestige:"#ffe3a6",brain:"#c0e1eb"}[e.resource];
  if(t<.82){
   g.globalAlpha=Math.min(1,(.82-t)*14);
   this.glow(x,y,15,13);
   const token={coin:"coin-token",prestige:"gem-token",brain:"know-token"}[e.resource];
   if(!GameArt.draw(g,"markers-rewards",token,x,y,24)){
   if(e.resource==="prestige"&&r.prestigeIcon.naturalWidth)g.drawImage(r.prestigeIcon,x-12,y-12,24,24);
   else if(e.resource==="brain"){
    g.fillStyle="#68869b";g.fillRect(x-9,y-8,18,16);g.fillStyle=color;g.fillRect(x-7,y-7,6,12);g.fillRect(x+1,y-7,6,12);
   }else{
    r.ellipse(x,y,8,8,"#af793a");r.ellipse(x,y-1,7,7,color);r.text("V",x,y-1,8,"#77512b");
   }
   }
  }
  if(t>.52){
   g.globalAlpha=Math.min(1,(1-t)*6);
   const label="+"+fmt(e.amount),y=e.to.y+32-(t-.52)*19;
   r.text(label,e.to.x+18,y+1,13,"#323b37");r.text(label,e.to.x+18,y,13,color);
  }
  g.globalAlpha=1;
 }
}
