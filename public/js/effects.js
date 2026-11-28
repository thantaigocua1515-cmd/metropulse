"use strict";

const SKIN_STAMPS={
 cyberpunk:["neon","hologram"],sakura:["petal","petal"],desert:["sand","sand"],
 jungle:["firefly","leaf"],ocean:["bubble","bubble"],steampunk:["steam","spark"]
};
const STAMP_GLOWS={
 neon:["#c3fcff","#27ecdfa0","#159aff00"],hologram:["#e3bdff","#aa52ff99","#ac19ff00"],
 firefly:["#fcffb2","#d9ff6066","#a5ef2000"],steam:["#f8ffffd9","#cbecf28c","#b7ecff00"],
 spark:["#fff9ce","#ff9c43a0","#ff711500"],smoke:["#eeebe4ab","#aeb2b45c","#969da300"]
};

class CityEffects {
 constructor(renderer){
  this.r=renderer;this.windows=new WeakMap();this.stamps=new Map();
  const flare=this.halo=document.createElement("canvas");flare.width=flare.height=48;
  const g=flare.getContext("2d"),grad=g.createRadialGradient(24,24,0,24,24,24);
  grad.addColorStop(0,"#fff3c1b5");grad.addColorStop(.35,"#ffd58159");grad.addColorStop(1,"#ffb64800");
  g.fillStyle=grad;g.fillRect(0,0,48,48);
 }
 glow(x,y,rx,ry){
  this.r.ctx.drawImage(this.halo,x-rx,y-ry,rx*2,ry*2);
 }
 motion(){return !this.r.sim.reduceEffects&&!this.r.skinMotion?.matches}
 begin(){this.ambientBudget=this.r.quality.ambientFX;this.burstBudget=this.r.quality.burstFX}
 chimney(b,height){
  if(!this.ambientBudget||!this.motion()||b.left>0||height<8)return;
  const industrial=b.id==="power_plant"||b.id==="waste_plant"||b.id==="construction_hq";
  if(!industrial&&(b.id!=="house_small"||(b.x+2*b.y)%4))return;
  const r=this.r,g=r.ctx,z=r.camera.zoom,p=r.project(b.x+.6,b.y+.32,height*.83);
  if(!r.inView(p,28,34))return;
  const stamp=this.stamp("smoke"),count=Math.min(this.ambientBudget,industrial?3:2);
  for(let i=0;i<count;i++){
   const t=(r.elapsed*.61+(b.x*13+b.y*7)%11/11+i/count)%1,s=(6+t*12)*z;
   g.globalAlpha=(1-t)*.64;g.drawImage(stamp,p.x+(t*t*13)*z-s/2,p.y-t*26*z-s/2,s,s*.86);
  }
  g.globalAlpha=1;this.ambientBudget-=count;
 }
 puddle(b,night){
  const r=this.r,g=r.ctx,z=r.camera.zoom,p=r.project(b.x+.66,b.y+.39,1);
  r.ellipse(p.x,p.y,7*z,2.2*z,"#719aad65");
  if(night>.19){g.globalAlpha=night*.5;this.glow(p.x,p.y,10*z,2.6*z);g.globalAlpha=1}
 }
 beam(x,y,dx,dy,z){
  if(!this.motion())return;
  const g=this.r.ctx;
  g.save();g.translate(x,y);g.rotate(Math.atan2(dx+dy,2*(dx-dy)));
  this.glow(9*z,0,15*z,3*z);g.restore();
 }
 incident(c,p,t){
  if(!this.motion()||this.burstBudget<3||!["fire","water_leak","collapse"].includes(c.id))return;
  const r=this.r,g=r.ctx,z=r.camera.zoom;
  const kind=c.id==="fire"?"spark":c.id==="collapse"?"smoke":"bubble",stamp=this.stamp(kind);
  for(let i=0;i<3;i++){
   const f=(i/3+t*.9)%1,s=(3+5*f)*z;
   g.globalAlpha=(1-f)*.85;
   g.drawImage(stamp,p.x+(i-1)*f*23*z-s/2,p.y-(c.id==="water_leak"?Math.sin(f*Math.PI)*28:f*38)*z-s,s,s);
  }
  g.globalAlpha=1;this.burstBudget-=3;
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
 skin(pack,world,heights,night=0){
  if(Object.hasOwn(SKIN_STAMPS,pack)){this.themeStamps(pack,world,heights,night);return}
  if(pack!=="tet"&&pack!=="noel")return;
  const r=this.r,g=r.ctx,z=r.camera.zoom,time=r.elapsed;
  let bursts=0;
  g.save();
  for(const b of world.buildings){
   const height=heights.get(coord(b.x,b.y));
   if(!height||b.left>0)continue;
   const p=r.project(b.x+.5,b.y+.5,height);
   if(p.x<-32*z||p.x>r.width+32*z||p.y<-((height+16)*z)||p.y>r.height+20*z)continue;
   const seed=b.x*37+b.y*101+b.x*b.y*17;
   if(pack==="noel"){
    g.fillStyle="#f2fcff";
    for(let i=0;i<(r.quality?.flakes??2);i++){
     const phase=(time*.41+seed*.091+i*.49)%1;
     g.globalAlpha=.86*Math.sin(Math.PI*phase);
     const x=p.x+((seed+i*23)%41-20+Math.sin(time*2+i+seed)*3)*z,y=p.y+(-10+phase*(height+14))*z;
     const size=(i?1.45:1.9)*z;
     g.fillRect(x,y,size,size);
    }
    continue;
   }
   const flower=this.flower||this.maiFlower();
   for(let i=0;i<(r.quality?.flakes??2);i++){
    const x=p.x+(i?23:-23)*z,y=p.y+(height*.76+((seed+i*7)%9))*z;
    g.globalAlpha=.48+.42*(1+Math.sin(time*2.7+seed+i*1.8))*.5;
    g.drawImage(flower,x-3*z,y-3*z,6*z,6*z);
   }
   const phase=(time+seed*.199)%19;
   if(phase>=.85||bursts>=2)continue;
   bursts++;
   const spread=(3+phase*20)*z,x=p.x+(seed%9-4)*z,y=p.y-13*z;
   g.globalAlpha=1-phase/.85;g.lineWidth=Math.max(.75,z);
   for(const color of ["#ffe48a","#ff7973"]){
    g.strokeStyle=color;g.beginPath();
    for(let i=color==="#ffe48a"?0:1;i<8;i+=2){
     const angle=i*Math.PI/4+seed,dx=Math.cos(angle)*spread,dy=Math.sin(angle)*spread;
     g.moveTo(x+dx*.65,y+dy*.65);g.lineTo(x+dx,y+dy);
    }
    g.stroke();
   }
  }
  g.restore();
 }
 stamp(kind){
  if(this.stamps.has(kind))return this.stamps.get(kind);
  const image=document.createElement("canvas");image.width=image.height=32;
  const g=image.getContext("2d"),colors=STAMP_GLOWS[kind];
  if(colors){
   const glow=g.createRadialGradient(16,16,0,16,16,16);
   glow.addColorStop(0,colors[0]);glow.addColorStop(.35,colors[1]);glow.addColorStop(1,colors[2]);
   g.fillStyle=glow;g.fillRect(0,0,32,32);
  }
  if(kind==="petal"||kind==="leaf"){
   g.fillStyle=kind==="petal"?"#ff9cc0":"#85c55b";g.beginPath();g.ellipse(16,16,13,8,-.6,0,Math.PI*2);g.fill();
   g.fillStyle=kind==="petal"?"#ffe0ee":"#e5ef99";g.beginPath();g.ellipse(17,15,7,2,-.6,0,Math.PI*2);g.fill();
  }else if(kind==="bubble"){
   g.fillStyle="#60d8eb40";g.strokeStyle="#9af7ff";g.lineWidth=3;
   g.beginPath();g.arc(16,16,12,0,Math.PI*2);g.fill();g.stroke();
   g.fillStyle="#edffff";g.fillRect(11,9,5,4);
  }else if(kind==="sand"){
   g.strokeStyle="#efc180";g.lineWidth=2;g.beginPath();
   g.moveTo(3,20);g.quadraticCurveTo(15,7,29,12);g.moveTo(8,25);g.quadraticCurveTo(16,17,25,17);g.stroke();
  }else if(kind==="hologram"||kind==="spark"){
   g.fillStyle=colors[0];g.fillRect(14,9,4,14);g.fillRect(9,14,14,4);
  }else if(kind==="firefly"){
   g.fillStyle=colors[0];g.fillRect(13,13,6,6);
  }
  this.stamps.set(kind,image);return image;
 }
 themeStamps(pack,world,heights,night){
  const r=this.r,g=r.ctx,z=r.camera.zoom,time=r.elapsed;
  const [primary,secondary]=SKIN_STAMPS[pack],first=this.stamp(primary),second=this.stamp(secondary);
  const budget=r.quality?.skinStamps??64,layers=r.quality?.skinLayers??2;
  const stride=Math.max(1,Math.ceil(heights.size*(layers===2?1.5:layers)/budget));
  let building=0,drawn=0;
  g.save();
  for(const b of world.buildings){
   const height=heights.get(coord(b.x,b.y));
   if(!height||b.left>0||building++%stride)continue;
   const p=r.project(b.x+.5,b.y+.5,height);
   if(p.x<-32*z||p.x>r.width+32*z||p.y<-((height+20)*z)||p.y>r.height+24*z)continue;
   const seed=b.x*37+b.y*101+b.x*b.y*17;
   for(let i=0,n=layers===2?1+seed%2:layers;i<n&&drawn<budget;i++){
    const phase=(time*.36+seed*.071+i*.47)%1,fade=Math.sin(Math.PI*phase);
    const drift=Math.sin(time*1.8+seed+i*2),offset=(seed+i*13)%31-15;
    let x=offset,y=0,w=8,h=8,alpha=.8*fade;
    switch(pack){
     case "cyberpunk":
      if(!i){y=height*.48;w=20;h=11;alpha=(.36+.44*night)*(.68+.32*Math.sin(time*9+seed))}
      else{x+=drift*5;y=height*.54-phase*(height*.7+9);w=h=7}
      break;
     case "sakura":
      x+=drift*7;y=-12+phase*(height*.9+22);w=5+2*Math.abs(drift);h=6;break;
     case "desert":
      x=(phase-.5)*46+offset*.35;y=height+8+i*4-drift*4;w=20+7*phase;h=9;alpha*=.72;break;
     case "jungle":
      if(!i){x+=drift*11;y=height*.64+Math.cos(time*2+seed)*8;w=h=8;alpha=(.24+.68*night)*fade}
      else{x+=drift*7;y=-8+phase*(height+16);w=6;h=7}
      break;
     case "ocean":
      x+=drift*5;y=height*.73-phase*(height*.84+20);w=h=5+4*phase;break;
     case "steampunk":
      if(!i){x=offset*.55+phase*9;y=4-phase*25;w=h=8+13*phase;alpha*=.83}
      else{x+=drift*7;y=height*.55-phase*16;w=h=6;alpha*=1-phase}
      break;
    }
    g.globalAlpha=alpha;
    g.drawImage(i?second:first,p.x+(x-w/2)*z,p.y+(y-h/2)*z,w*z,h*z);
    drawn++;
   }
   if(drawn===budget)break;
  }
  g.restore();
 }
 maiFlower(){
  const flower=this.flower=document.createElement("canvas");flower.width=flower.height=24;
  const g=flower.getContext("2d");
  g.fillStyle="#ffe17b";g.beginPath();
  for(let i=0;i<5;i++){
   const angle=i*Math.PI*2/5,x=12+Math.cos(angle)*4.4,y=12+Math.sin(angle)*4.4;
   g.moveTo(x+4.4,y);g.arc(x,y,4.4,0,Math.PI*2);
  }
  g.fill();g.fillStyle="#e88c1b";g.beginPath();g.arc(12,12,2.2,0,Math.PI*2);g.fill();
  return flower;
 }
 render(world,heights){
  const r=this.r,g=r.ctx,z=r.camera.zoom;
  for(const e of r.sim.fx){
   if((e.world||r.sim.world)!==world)continue;
   const t=e.age/e.duration;
   if(e.kind==="levelup"){
    const count=Math.min(this.burstBudget,18);
    for(let i=0;i<count;i++){
     const a=i*2.39996,x=r.width*.5+Math.cos(a)*t*r.width*.43,y=r.height*.38+Math.sin(a)*t*105;
     g.globalAlpha=1-t;g.drawImage(this.stamp(i%3?"spark":"hologram"),x-5,y-5,10,10);
    }
    g.globalAlpha=1;this.burstBudget-=count;continue;
   }
   if(e.kind==="reward"){
    if(e.x!=null&&!r.inView(r.project(e.x+.5,e.y+.5),28,120)&&t<.8)continue;
    this.reward(e,t,heights);continue;
   }
   const dust=e.kind==="dust"||e.kind==="built",repair=e.kind==="repair";
   const p=r.project(e.x+.5,e.y+.5),height=heights.get(coord(e.x,e.y))||12;
   if(!r.inView(p,48,120))continue;
   const top=r.project(e.x+.5,e.y+.5,height*.55);
   if(!dust){
    g.globalAlpha=(1-t)*.9;
    if(!GameArt.draw(g,"vfx-construction-celebration",repair?"ring-mint":"ring-gold",p.x,p.y,(24+50*t)*z,(12+20*t)*z,{stretch:true})){
     g.beginPath();g.ellipse(p.x,p.y,(12+25*t)*z,(6+10*t)*z,0,0,Math.PI*2);
     g.strokeStyle=repair?"#b6f3d7":"#ffdf9b";g.lineWidth=(2.8-t*2)*z;g.stroke();
    }
   }
   const count=Math.min(this.burstBudget,dust?7:12);this.burstBudget-=count;
   for(let i=0;i<count;i++){
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
   if(!GameArt.draw(g,"hud",e.resource,x,y,24)&&!GameArt.draw(g,"markers-rewards",token,x,y,24)){
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
