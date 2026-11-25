"use strict";
const CREW_ART={power_plant:"electric",water_tower:"water",fire_station:"fire",police_station:"police",
 construction_hq:"construction",waste_plant:"waste",hospital:"medical",cyber_hub:"cyber"};
const CREW_TRANSPORT=["foot","bicycle","scooter","truck","van"];
const ROAD_DIRECTIONS=[[1,0],[0,-1],[-1,0],[0,1]];
const ROAD_PROFILES=[[.30,.085,"#ddd7c5"],[.255,.06,"#7d8388"]].map(([half,round,color])=>({
 color,round,outlines:Array.from({length:16},(_,mask)=>ROAD_DIRECTIONS.flatMap(([dx,dy],i)=>{
  const point=(along,across,corner=false)=>[dx*along+dy*across,dy*along-dx*across,corner];
  const corner=point(half,half,true);
  return mask&(1<<i)?[point(.52,-half),point(.52,half),corner]:[corner];
 }))
}));

class IsoRenderer {
 constructor(canvas,sim){
  this.canvas=canvas;this.ctx=canvas.getContext("2d");this.sim=sim;this.camera={x:0,y:0,zoom:1};this.hover=null;this.target=null;this.hits=[];this.life=new CityLife(this);this.guide=null;this.elapsed=0;this.width=0;this.height=0;this.paintCache=new Map();this.sprites=new Map();
  this.prestigeIcon=new Image();this.prestigeIcon.src=asset("img/prestige.svg");
  this.effects=new CityEffects(this);
  document.fonts?.load(canvasFont(9,800),"012ABC").then(()=>{this.groundReady=false},()=>{});
  this.resize();addEventListener("resize",()=>this.resize());
 }
 resize(){
  const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),oldW=this.width,oldH=this.height;
  this.origin={x:rect.left,y:rect.top};
  this.width=rect.width;this.height=rect.height;this.dpr=dpr;this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);
  if(oldW){this.camera.x+=(this.width-oldW)/2;this.camera.y+=(this.height-oldH)/2}else this.center();
 }
 center(){
  const zoom=this.width<=780?1.1:clamp(Math.min((this.width-22)/940,(this.height-98)/595),.5,1.2);
  this.camera={x:this.width*.5,y:this.height*.54-240*zoom,zoom};this.target=null;this.back=null;
 }
 zoom(factor,x=this.width/2,y=this.height*.54){
  const c=this.camera,newZoom=clamp(c.zoom*factor,.5,1.8),scale=newZoom/c.zoom;
  c.x=x-(x-c.x)*scale;c.y=y-(y-c.y)*scale;c.zoom=newZoom;this.target=null;this.back=null;
 }
 pan(dx,dy){this.target=null;this.back=null;this.camera.x+=dx;this.camera.y+=dy}
 focus(x,y){
  const c=this.camera,p=IsoMath.gridToScreen(x+.5,y+.5,c);
  this.target={x:c.x+this.width*.5-p.x,y:c.y+this.height*.51-p.y};
 }
 // Lướt tới một ô và phóng gần lên; nhớ mức thu phóng cũ để closeDown() trả lại. Người chơi tự kéo hay thu phóng thì thôi không trả.
 closeUp(x,y,anchor=.51){
  const c=this.camera,zoom=Math.max(c.zoom,this.width<780?1.05:1.5),k=zoom/c.zoom,p=IsoMath.gridToScreen(x+.5,y+.5,c);
  if(this.back==null&&zoom>c.zoom)this.back=c.zoom;
  this.target={x:this.width*.5-(p.x-c.x)*k,y:this.height*anchor-(p.y-c.y)*k,zoom};
 }
 closeDown(){
  if(this.back==null)return;
  const c=this.camera,zoom=this.back,k=zoom/c.zoom,cx=this.width*.5,cy=this.height*.51;this.back=null;
  this.target={x:cx-(cx-c.x)*k,y:cy-(cy-c.y)*k,zoom};
 }
 local(event){return {x:event.clientX-this.origin.x,y:event.clientY-this.origin.y}}
 project(x,y,z=0){const p=IsoMath.gridToScreen(x,y,this.camera);p.y-=z*this.camera.zoom;return p}
 poly(points,fill,stroke,width=1){
  const g=this.ctx;if(!points.length)return;
  g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.closePath();
  if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}
 }
 line(points,color,width=1){
  const g=this.ctx;g.beginPath();g.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.strokeStyle=color;g.lineWidth=width;g.stroke();
 }
 plate(x,y,x2,y2,z=0){return [this.project(x,y,z),this.project(x2,y,z),this.project(x2,y2,z),this.project(x,y2,z)]}
 ellipse(x,y,rx,ry,color){
  const g=this.ctx;g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);g.fillStyle=color;g.fill();
 }
 tone(hex,factor){
  const key=hex+factor;let value=this.paintCache.get(key);if(value)return value;
  const n=parseInt(hex.slice(1),16),rgb=[n>>16,n>>8&255,n&255].map(c=>Math.min(255,Math.round(c*factor+(factor>1?(factor-1)*14:0))));
  value="rgb("+rgb.join(",")+")";this.paintCache.set(key,value);return value;
 }
 block(x,y,w,d,base,height,color,hits=null,dark=false){
  const top=this.plate(x,y,x+w,y+d,base+height),low=this.plate(x,y,x+w,y+d,base);
  const left=[top[2],top[3],low[3],low[2]],right=[top[1],top[2],low[2],low[1]];
  this.poly(left,this.tone(color,dark?.32:.68));this.poly(right,this.tone(color,dark?.44:.86));this.poly(top,this.tone(color,dark?.48:1.17),this.tone(color,dark?.52:1.26),.65*this.camera.zoom);
  if(hits)hits.push(left,right,top);return top;
 }
 text(text,x,y,size,color,bold=true){
  const g=this.ctx;g.font=canvasFont(size,bold?800:400);g.textAlign="center";g.textBaseline="middle";g.fillStyle=color;g.fillText(text,x,y);
 }
 tree(x,y,variant=0,height=1){
  const p=this.project(x,y),z=this.camera.zoom*height;
  if(GameArt.draw(this.ctx,"terrain-props","tree"+(1+variant%3),p.x,p.y+z,24*z,31*z,{ground:true}))return;
  const colors=[["#547a50","#8ab568","#a8c878"],["#3a7153","#5caa75","#92c78c"],["#547a55","#78a96e","#b0cc79"]][variant%3];
  this.ellipse(p.x+3*z,p.y+1*z,10*z,3.6*z,"#172d2559");
  this.line([{x:p.x,y:p.y+1*z},{x:p.x,y:p.y-15*z}],"#5b4931",2.8*z);
  this.ellipse(p.x,p.y-15.5*z,9*z,10*z,colors[0]);this.ellipse(p.x-2*z,p.y-17*z,7.1*z,8.5*z,colors[1]);this.ellipse(p.x-3*z,p.y-20*z,4.5*z,4.7*z,colors[2]);
 }
 ambient(night,mood,world){
  const g=this.ctx,{width:w,height:h}=this,gradient=g.createLinearGradient(0,0,w*.27,h);
  const palette=mood==="storm"?["#8fa5b0","#a9bcc4","#7f97a3"]:night>.5?["#2b4660","#3c5e79","#253f58"]:mood==="heat"?["#e9e4c6","#f1ecd4","#d8ddba"]:["#cfe6ee","#e4f1f4","#b8d9e4"];
  gradient.addColorStop(0,palette[0]);gradient.addColorStop(.52,palette[1]);gradient.addColorStop(1,palette[2]);g.fillStyle=gradient;g.fillRect(0,0,w,h);
  const water=GameArt.image("background-map-water");
  if(water){
   this.waterPattern??=g.createPattern(water,"repeat");
   if(this.waterPattern){
    g.globalAlpha=night>.5?.2:mood==="storm"?.34:.65;g.fillStyle=this.waterPattern;g.fillRect(0,0,w,h);g.globalAlpha=1;return;
   }
  }
  const size=Math.max(38,49*this.camera.zoom),ox=((this.camera.x*.14)%size+size)%size,oy=((this.camera.y*.14)%size+size)%size;
  g.fillStyle=night>.5?"#d0eee026":"#ffffff8c";
  for(let x=ox;x<w;x+=size)for(let y=oy;y<h;y+=size)g.fillRect(x,y,1.5,1.5);
  g.lineWidth=1;
  for(let i=0;i<72;i++){
   const x=((i*139.163+w*.31+this.camera.x*.09)%(w+120)+w+120)%(w+120)-60,y=((i*167.377+this.camera.y*.1)%(h+80)+h+80)%(h+80)-40,l=3+(i*17)%25;
   const a=.065+.028*Math.sin(this.elapsed*.85+i);this.line([{x,y},{x:x+l,y:y-l*.13}],night>.5?"rgba(198,229,224,"+a+")":"rgba(255,255,255,"+(a*5)+")",.75);
  }
  const c=this.camera;
  for(let i=1;i<=4;i++){
   const a=-i*.26,b=16+i*.26;
   const ring=this.plate(a,a,b,b,-16);
   for(const p of ring)p.x+=Math.sin(this.elapsed*.55+i)*1.7*c.zoom;
   this.poly(ring,null,night>.5?"#b9e4d228":i%2?"#ffffff9c":"#ffffff60",1.2);
  }
 }
 ground(w){
  const c=this.camera,z=c.zoom,g=this.ctx,base=this.plate(0,0,16,16),low=this.plate(0,0,16,16,-17);
  const shadow=low.map(p=>({x:p.x+10*z,y:p.y+9*z}));this.poly(shadow,"#2d556a4d");
  this.poly([base[1],base[2],low[2],low[1]],"#496752","#395c48");this.poly([base[2],base[3],low[3],low[2]],"#3c5946","#365543");
  const side=(a,b,face)=>{
   const from=base[a],to=base[b],x=(from.x+to.x)/2,width=Math.abs(from.x-to.x);
   const top=Math.min(from.y,to.y),seam=Math.max(from.y,to.y)+4*z,bottom=Math.max(low[a].y,low[b].y);
   g.save();
   this.poly([from,to,low[b],low[a]]);g.clip();
   GameArt.draw(g,"terrain-edge","soil-"+face,x,(top+bottom)/2,width,bottom-top,{stretch:true});
   GameArt.draw(g,"terrain-edge","seam-"+face,x,(top+seam)/2,width,seam-top,{stretch:true});
   g.restore();
  };
  side(1,2,"right");
  side(2,3,"left");
  const soil=this.plate(0,0,16,16,-9);this.line([soil[1],soil[2],soil[3]],"#9fb4866c",3*z);this.line([base[1],base[2],base[3]],"#abc8a2",2.5*z);
  const active=["#87aa73","#8cae76","#91b079","#84a66f","#8cad74"],locked=["#59776a","#5c7b6c","#5d7d6b","#567667"];
  for(let x=0;x<16;x++)for(let y=0;y<16;y++){
   const avail=unlocked(w,x,y),hash=(x*11+y*17+x*y*3)%101;
   const grass=avail?active:locked,p=this.project(x+.5,y+.5);
   if(!GameArt.draw(g,"terrain-grass",(avail?"grass":"locked")+(1+hash%3),p.x,p.y,CONFIG.tileW*z,CONFIG.tileH*z,{stretch:true}))
    this.poly(this.plate(x,y,x+1,y+1),grass[hash%grass.length],avail?"#53734e85":"#405f54a0",.72);
   if(!lookup(w,x,y)){
    const p=this.project(x+.59,y+.38);
    if(hash%3===0&&!GameArt.draw(g,"terrain-props","grass-tuft",p.x-2*z,p.y,5*z))this.line([{x:p.x-4*z,y:p.y+2*z},{x:p.x-2*z,y:p.y},{x:p.x-1*z,y:p.y+2*z}],"#c2cf918d",1.1*z);
    if(hash%7===0&&!GameArt.draw(g,"terrain-props","flowers",p.x+5*z,p.y+1.5*z,5*z))this.ellipse(p.x+5*z,p.y+1.5*z,2*z,z,"#d2c87c8b");
    if(!avail&&hash%7===2&&z>.58&&!GameArt.draw(g,"terrain-props","lock",p.x,p.y-2*z,8*z)){
     g.strokeStyle="#b3cbb277";g.lineWidth=z;g.beginPath();g.arc(p.x,p.y-3*z,2.3*z,Math.PI,Math.PI*2);g.stroke();
     g.fillStyle="#bbd0ba85";g.fillRect(p.x-3.7*z,p.y-3*z,7.4*z,5*z);
    }
   }
  }
  const lo=8-w.unlockedRadius,hi=8+w.unlockedRadius;
  if(lo>0){
   g.save();g.setLineDash([3*z,4*z]);this.poly(this.plate(lo,lo,hi,hi),null,"#d4edaaad",1.5*z);g.restore();
  }
  if(z>.65)for(let i=0;i<16;i+=2){
   const p=this.project(16.38,i+.52,-3),q=this.project(i+.52,16.38,-3);
   this.text(String.fromCharCode(65+i),p.x,p.y,9*z,"#ffffffb0");this.text(String(i+1).padStart(2,"0"),q.x,q.y,9*z,"#ffffffb0");
  }
  this.roads(w);
 }
 groundLayer(w){
  const {canvas,ctx,camera:c,dpr}=this,key=[canvas.width,canvas.height,dpr,c.x,c.y,c.zoom,w.unlockedRadius,...Array.from(w.index,([k,b])=>b.id==="road"?k+"r":k),
   GameArt.ready("terrain-grass"),GameArt.ready("terrain-props"),GameArt.ready("terrain-edge")].join("|");
  if(this.groundKey!==key){
   this.groundKey=key;this.groundReady=false;this.ground(w);return;
  }
  const layer=this.groundCanvas??=document.createElement("canvas");
  if(!this.groundReady){
   layer.width=canvas.width;layer.height=canvas.height;
   const g=layer.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);
   this.ctx=g;
   try{this.ground(w)}finally{this.ctx=ctx}
   this.groundReady=true;
  }
  ctx.drawImage(layer,0,0,layer.width/dpr,layer.height/dpr);
 }
 roadConnections(b,w){
  return ROAD_DIRECTIONS.reduce((mask,[dx,dy],i)=>mask|(lookup(w,b.x+dx,b.y+dy)?.id==="road"?1<<i:0),0);
 }
 roads(w){
  const tiles=w.buildings.filter(b=>b.id==="road").map(b=>[b.x+.5,b.y+.5,this.roadConnections(b,w)]);
  if(!tiles.length)return;
  const g=this.ctx;
  for(const {color,round,outlines} of ROAD_PROFILES){
   g.beginPath();
   for(const [x,y,mask] of tiles){
    const points=outlines[mask],radius=mask?round:.17;
    for(let i=0;i<points.length;i++){
     const [u,v,corner]=points[i],p=this.project(x+u,y+v);
     const move=i===0?"moveTo":"lineTo";
     if(!corner){g[move](p.x,p.y);continue}
     const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
     const near=([a,b])=>this.project(x+u+Math.sign(a-u)*radius,y+v+Math.sign(b-v)*radius);
     const start=near(prev),end=near(next);
     g[move](start.x,start.y);g.quadraticCurveTo(p.x,p.y,end.x,end.y);
    }
    g.closePath();
   }
   g.fillStyle=color;g.fill();
  }
  g.beginPath();
  for(const [x,y,mask] of tiles)for(const [i,[dx,dy]] of ROAD_DIRECTIONS.entries()){
   if(!(mask&(1<<i))||(dx<0||dy<0))continue;
   const u=x+dx*.5,v=y+dy*.5;
   const points=this.plate(u-(dx?.12:.027),v-(dy?.12:.027),u+(dx?.12:.027),v+(dy?.12:.027));
   g.moveTo(points[0].x,points[0].y);
   for(const p of points.slice(1))g.lineTo(p.x,p.y);
   g.closePath();
  }
  g.fillStyle="#eed9a0";g.fill();
 }
 roadFrame(b,w){
  const mask=this.roadConnections(b,w);
  return [null,"end_3","end_0","corner_1","end_1","straight_1","corner_2","tee_1",
   "end_2","corner_0","straight_0","tee_0","corner_3","tee_3","tee_2","cross_0"][mask];
 }
 windows(b,x,y,w,d,height,color,night,dark,base=0){
  const columns=height>40?4:3,rows=Math.max(1,Math.round(height/12)),z=this.camera.zoom;
  for(let floor=0;floor<rows;floor++)for(let j=0;j<columns;j++){
   const u=(j+.25)/columns,v=u+.48/columns,lower=base+4+floor*(height-3)/rows,upper=lower+Math.min(6,(height-3)/rows*.53);
   if(upper>base+height-1)continue;
   const lit=!dark&&night>.22&&(b.x*9+b.y*5+j*3+floor)%5!==1;
   const light=dark?"#172827":lit?"#ffd987":color;
   this.poly([this.project(x+w*u,y+d,upper),this.project(x+w*v,y+d,upper),this.project(x+w*v,y+d,lower),this.project(x+w*u,y+d,lower)],light);
   this.poly([this.project(x+w,y+d*u,upper),this.project(x+w,y+d*v,upper),this.project(x+w,y+d*v,lower),this.project(x+w,y+d*u,lower)],lit?"#fff0ac":light);
   if(lit&&z>.7)this.line([this.project(x+w*u,y+d,upper),this.project(x+w*v,y+d,upper)],"#fff4ca",.55);
  }
 }
 gable(x,y,w,d,base,height,color,hits){
  const back=this.project(x,y+d/2,base+height),front=this.project(x+w,y+d/2,base+height);
  const a=this.project(x,y,base),b=this.project(x+w,y,base),c=this.project(x+w,y+d,base),e=this.project(x,y+d,base);
  const l=[back,front,c,e],r=[a,b,front,back],end=[b,c,front];
  this.poly(l,this.tone(color,.9));this.poly(r,this.tone(color,1.13));this.poly(end,this.tone(color,.69));this.line([back,front],this.tone(color,1.26),this.camera.zoom);
  hits.push(l,r,end);
 }
 building(b,w,night){
  const d=CONFIG.buildings[b.id],z=this.camera.zoom,x=b.x,y=b.y,polys=[];
  const deck=this.plate(x+.035,y+.035,x+.965,y+.965),color=d.color;
  const dark=w.crises.some(c=>c.id==="blackout"&&distance(c,b)<=1);
  const meta=SPRITES[b.id],rot=meta&&b.left<=0?this.facing(b,w):null;
  const art=rot===null?false:this.sprite(b.id,this.buildingFrame(b,rot),dark);
  let height=0,sprite=null;
  if(art===false){
   this.poly(deck,"#c1c4a3","#637f637d",.7);this.poly(this.plate(x+.11,y+.11,x+.89,y+.89),"#9aa98f");
   const p=this.project(x+.6,y+.59);this.ellipse(p.x+6*z,p.y+3*z,25*z,8*z,"#293e3455");
  }
  if(art!==false){
   height=meta.tops[b.level-1][rot];
   if(art){
    sprite=this.drawSprite(art,meta,x,y,this.sim.social.world===this.sim.world?this.effects.bounce(b):1);
    if(!dark)this.effects.lightBuilding(sprite,meta,height,b.id,night);
   }
  }else if(b.left>0){
   const progress=clamp(1-b.left/b.total,0,1);height=11+18*progress;
   const site=this.project(x+.5,y+.5),painted=GameArt.draw(this.ctx,"scaffolding-stages","stage"+Math.min(4,1+Math.floor(progress*4)),site.x,site.y+8*z,52*z,(height+19)*z,{ground:true});
   if(painted)polys.push(deck);else{
   this.block(x+.22,y+.22,.56,.56,0,height,"#9e9e85",polys);
   for(const [a,c] of [[.14,.17],[.82,.17],[.14,.82],[.82,.82]]){
    this.line([this.project(x+a,y+c,0),this.project(x+a,y+c,height+7)],"#f8cc76",2*z);
   }
   for(const v of [4,height*.55,height+5])this.line([this.project(x+.14,y+.82,v),this.project(x+.82,y+.82,v),this.project(x+.82,y+.17,v)],"#ebaf5f",1.4*z);
   this.line([this.project(x+.14,y+.82,1),this.project(x+.82,y+.82,height),this.project(x+.82,y+.17,1)],"#8e613c",1.2*z);
   }
   const t=this.project(x+.5,y+.5,height+12);this.progress(t.x,t.y,progress,"#ffe081");
  }else{
   const extra=(b.level-1)*2.2;
   const box=(a,c,wi,de,base,h,col=color)=>this.block(x+a,y+c,wi,de,base,h,col,polys,dark);
   const details=(a,c,wi,de,h,base=0)=>this.windows(b,x+a,y+c,wi,de,h,"#3f6868",night,dark,base);
   switch(b.id){
    case "house_small":
     height=25+extra;box(.16,.20,.66,.58,0,height-9,"#f4ce9c");details(.16,.20,.66,.58,height-9);this.gable(x+.12,y+.16,.74,.66,height-9,9,dark?"#754839":"#c9624c",polys);
     box(.30,.25,.12,.12,height-2,6,"#ab6353");this.tree(x+.84,y+.83,b.x%3,.65);break;
    case "power_plant":
     height=35+extra;box(.16,.22,.66,.6,0,height-19);details(.16,.22,.66,.6,height-19);
     box(.22,.27,.16,.16,height-19,19,"#9a785b");box(.21,.26,.18,.18,height-4,3,"#ecd2a0");box(.58,.32,.16,.21,height-19,7,"#527c75");
     {const t=this.project(x+.54,y+.82,7);this.text("ϟ",t.x,t.y,10*z,"#fff1ab")}break;
    case "water_tower":
     height=40+extra;box(.26,.32,.45,.43,0,9,"#a8bcb4");
     for(const [a,c] of [[.31,.35],[.67,.35],[.31,.68],[.67,.68]])this.line([this.project(x+a,y+c,7),this.project(x+a,y+c,height-8)],"#b9c9c0",2.4*z);
     box(.19,.23,.62,.6,height-17,14);box(.23,.27,.54,.52,height-3,3,"#b7e0df");break;
    case "park":
     height=16+extra;this.poly(this.plate(x+.08,y+.08,x+.92,y+.92),"#88b370");
     this.poly(this.plate(x+.42,y+.08,x+.56,y+.92),"#ded0a0");
     this.poly(this.plate(x+.08,y+.42,x+.92,y+.56),"#ded0a0");box(.34,.34,.32,.32,0,3,"#64bcc2");
     for(const [a,c,i] of [[.21,.24,0],[.73,.22,1],[.76,.75,2],[.21,.76,1]])this.tree(x+a,y+c,i,.75+extra*.02);break;
    case "solar_plant":
     height=15+extra;for(let i=0;i<3;i++){
      const a=.13+i*.25;box(a,.16,.2,.66,0,4+extra,"#596a6f");
      this.poly([this.project(x+a,y+.16,12+extra),this.project(x+a+.21,y+.16,12+extra),this.project(x+a+.21,y+.82,5+extra),this.project(x+a,y+.82,5+extra)],"#354f86","#a6d0f6",.8*z);
      for(let j=1;j<4;j++)this.line([this.project(x+a,y+.16+j*.165,12+extra-j*1.75),this.project(x+a+.21,y+.16+j*.165,12+extra-j*1.75)],"#789fd0",.6*z);
     }break;
    case "office_tower":case "tech_tower":case "metro_wonder":case "apartment":{
     const h={apartment:44,office_tower:62,tech_tower:78,metro_wonder:94}[b.id];height=h+extra;
     box(.12,.12,.76,.76,0,8,"#97b9aa");box(.23,.22,.54,.56,8,height-13);details(.23,.22,.54,.56,height-13,8);
     box(.27,.27,.45,.45,height-5,5,b.id==="metro_wonder"?"#f6dfa8":"#cae6d9");
     if(b.id==="metro_wonder"||b.id==="tech_tower"){
      box(.39,.38,.21,.22,height,9,"#96e0c9");
      this.line([this.project(x+.5,y+.5,height+8),this.project(x+.5,y+.5,height+18)],"#edffcf",1.2*z);
      const a=this.project(x+.5,y+.5,height+18);this.ellipse(a.x,a.y,2*z,2*z,"#eeffaa");height+=17;
     }else box(.31,.34,.24,.23,height,3,"#627e75");
     break;
    }
    case "night_market":
     height=16+extra;
     for(let i=0;i<2;i++){
      const a=.12+i*.41;box(a,.17,.34,.67,0,height-5,"#d3b395");this.gable(x+a-.025,y+.14,.39,.73,height-5,5,i?"#c96a86":"#d6a55d",polys);
      for(let v=0;v<4;v++){const t=this.project(x+a+.04+v*.075,y+.84,height-5);this.ellipse(t.x,t.y,1.3*z,1.3*z,i?"#ffbfab":"#fff090")}
     }break;
    case "trade_port":
     height=41+extra;box(.12,.12,.76,.74,0,5,"#92a49f");box(.18,.5,.35,.27,5,10+extra,"#7caaa2");box(.52,.53,.32,.27,5,11+extra,"#b87961");box(.27,.18,.42,.26,5,9,"#d49765");
     this.line([this.project(x+.19,y+.25,6),this.project(x+.19,y+.25,height),this.project(x+.78,y+.25,height)],"#f5d577",3*z);
     this.line([this.project(x+.20,y+.25,height-10),this.project(x+.55,y+.25,height),this.project(x+.67,y+.25,height-15)],"#af8059",1.5*z);break;
    case "wind_farm":
     height=46+extra;box(.1,.1,.8,.8,0,2,"#8fb37c");
     for(const [a,c,ph] of [[.28,.3,0],[.7,.42,2],[.4,.74,4]]){
      const top=this.project(x+a,y+c,height-(a>.5?7:0));
      this.line([this.project(x+a,y+c,2),top],dark?"#7c8a8c":"#eef4f4",2.2*z);
      for(let k=0;k<3;k++){const ang=this.elapsed*2.2+ph+k*2.094;this.line([top,{x:top.x+Math.cos(ang)*11*z,y:top.y+Math.sin(ang)*11*z}],dark?"#9aa7a9":"#ffffff",1.6*z)}
      this.ellipse(top.x,top.y,1.8*z,1.8*z,"#cfd8dc");
     }
     polys.push(this.plate(x+.1,y+.1,x+.9,y+.9,height*.5));break;
    case "stadium":{
     height=20+extra;const c0=this.project(x+.5,y+.5,0),c1=this.project(x+.5,y+.5,height);
     this.ellipse(c0.x,c0.y,27*z,13.5*z,this.tone(color,dark?.3:.62));
     g.fillStyle=this.tone(color,dark?.36:.8);g.fillRect(c0.x-27*z,c1.y,54*z,c0.y-c1.y);
     this.ellipse(c1.x,c1.y,27*z,13.5*z,this.tone("#dfe7e2",dark?.45:1));
     this.ellipse(c1.x,c1.y+1.5*z,19*z,9*z,dark?"#2f5a33":"#5fa85a");this.ellipse(c1.x,c1.y+1.5*z,6*z,3*z,dark?"#3c6a3c":"#7cc070");
     if(night>.22&&!dark)for(const side of [-1,1]){const l=this.project(x+.5+side*.42,y+.5-side*.42,height+10);this.ellipse(l.x,l.y,2.6*z,2.6*z,"#fff6c9")}
     polys.push([{x:c0.x-27*z,y:c1.y-13*z},{x:c0.x+27*z,y:c1.y-13*z},{x:c0.x+27*z,y:c0.y+13*z},{x:c0.x-27*z,y:c0.y+13*z}]);break;
    }
    case "airport":{
     height=40+extra;box(.08,.08,.84,.84,0,2,"#7f8c8d");
     this.poly(this.plate(x+.14,y+.6,x+.86,y+.8,2),"#4d5a5c");
     for(let k=0;k<4;k++)this.line([this.project(x+.2+k*.17,y+.7,2),this.project(x+.29+k*.17,y+.7,2)],"#f3f0d0",1.2*z);
     box(.16,.14,.5,.3,2,11+extra*.4);details(.16,.14,.5,.3,11+extra*.4,2);
     box(.72,.18,.12,.12,2,height-10,"#aeb9bd");box(.68,.14,.2,.2,height-8,6,"#7fd0e0");
     const ang=this.elapsed*.5+b.x,plane=this.project(x+.5+Math.cos(ang)*.9,y+.5+Math.sin(ang)*.9,height+22);
     this.ellipse(plane.x,plane.y,6*z,1.8*z,"#f4f7f7");this.line([{x:plane.x-1*z,y:plane.y-4*z},{x:plane.x+1*z,y:plane.y+4*z}],"#dfe7ea",2*z);break;
    }
    case "museum":
     height=26+extra;box(.1,.12,.8,.76,0,4,"#cfc5a8");box(.18,.2,.64,.6,4,height-13,"#efe6cf");
     for(let k=0;k<4;k++)this.line([this.project(x+.24+k*.17,y+.82,4),this.project(x+.24+k*.17,y+.82,height-9)],dark?"#5d5a4e":"#fffaf0",2.2*z);
     this.gable(x+.14,y+.16,.72,.68,height-9,9,dark?"#6b5d48":"#b89a6a",polys);break;
    case "university":
     height=40+extra;box(.1,.14,.8,.72,0,height-20,"#d9a27e");details(.1,.14,.8,.72,height-20);
     this.gable(x+.08,y+.12,.84,.76,height-20,7,dark?"#5d4037":"#9c5f48",polys);
     box(.4,.4,.2,.2,height-18,18,"#e6c3a3");{const t=this.project(x+.5,y+.6,height-6);this.ellipse(t.x,t.y,3*z,3*z,"#fff7df")}break;
    case "metro_station":
     height=14+extra;box(.1,.2,.8,.6,0,6,"#7d8ea8");
     this.poly([this.project(x+.1,y+.2,height),this.project(x+.9,y+.2,height),this.project(x+.9,y+.8,8),this.project(x+.1,y+.8,8)],dark?"#3a4558":"#a9c3ee","#dbe7ff",.8*z);
     {const t=this.project(x+.5,y+.86,10);this.ellipse(t.x,t.y,6*z,5.5*z,"#2c4f8f");this.text("M",t.x,t.y,8.5*z,"#fff")}
     polys.push(this.plate(x+.1,y+.2,x+.9,y+.8,height));break;
    default:{
     const h={school:24,bank:32,mini_mart:20,fire_station:23,police_station:29,construction_hq:26,hospital:34,waste_plant:24,mall:37,cyber_hub:42}[b.id]||24;height=h+extra;
     box(.14,.15,.71,.68,0,height);details(.14,.15,.71,.68,height);
     box(.11,.12,.77,.74,height,2.2);
     box(.25,.28,.29,.25,height+2.2,3.8,"#9bb0a5");
     if(b.id==="school"||b.id==="bank"){const f=this.project(x+.2,y+.2,height+2.2);this.line([f,{x:f.x,y:f.y-13*z}],"#e9efe6",1.3*z);this.poly([{x:f.x,y:f.y-13*z},{x:f.x+8*z,y:f.y-10.5*z},{x:f.x,y:f.y-8*z}],b.id==="bank"?"#ffd36e":"#ff8f7a")}
     if(b.id==="mini_mart"||b.id==="mall"){
      for(let i=0;i<5;i++)box(.16+i*.13,.81,.13,.12,6,2,i%2?"#f6e3bb":"#b45b54");
     }else{
      const t=this.project(x+.5,y+.88,height*.64);
      const symbol={school:"A",bank:"$",fire_station:"▲",police_station:"★",construction_hq:"▰",hospital:"✚",waste_plant:"♻",cyber_hub:"⌘"}[b.id];
      if(symbol){this.ellipse(t.x,t.y,6*z,5.5*z,b.id==="hospital"?"#a85251":"#344d50");this.text(symbol,t.x,t.y-.3*z,8.5*z,"#fff8df")}
     }break;
    }
   }
  }
  if(b.left<=0){
   const tier=CONFIG.tier(b.level),t=this.project(x+.5,y+.5,height+8);
   for(let k=0;k<tier;k++){const cx=t.x+(k-(tier-1)/2)*9*z;this.poly([{x:cx,y:t.y-4*z},{x:cx+3.4*z,y:t.y},{x:cx,y:t.y+4*z},{x:cx-3.4*z,y:t.y}],"#ffd36e","#7a5a1c",.8*z)}
   if(b.spec)this.ellipse(t.x,t.y-(tier?8:0)*z,2.6*z,2.6*z,b.spec==="a"?"#ffb38a":"#9ae4cb");
  }
  this.hits.push({building:b,polys:sprite?polys:[deck,...polys],sprite});return height;
 }
 drawSprite(art,meta,x,y,scale=1){
  const c=this.project(x+.5,y+.5),z=this.camera.zoom*scale;
  const box={art,x:c.x-meta.ax*z,y:c.y-meta.ay*z,w:meta.w*z,h:meta.h*z};
  this.ctx.drawImage(art,box.x,box.y,box.w,box.h);
  return box;
 }
 spritePath(id,frame){return asset("img/bld/"+id+"/"+frame+".webp")}
 buildingFrame(b,rot){return String(b.level).padStart(2,"0")+"_"+rot}
 cityFrame(b,w){
  if(!SPRITES[b.id]||b.left>0)return null;
  return b.id==="road"?this.roadFrame(b,w):this.buildingFrame(b,this.facing(b,w));
 }
 spritePreview(b,w){
  const frame=this.cityFrame(b,w);
  return frame?this.spritePath(b.id,frame):null;
 }
 preloadCity(w){
  const urls=new Set();
  for(const b of w.buildings){
   if(b.id==="road")continue;
   const frame=this.cityFrame(b,w);
   if(!frame)continue;
   const url=this.spritePath(b.id,frame);
   if(urls.has(url))continue;
   urls.add(url);this.requestSprite(b.id,frame);
  }
  return [...urls];
 }
 requestSprite(id,frame){
  const key=id+"/"+frame;let s=this.sprites.get(key);
  if(!s){s={img:new Image(),state:0};s.img.onload=()=>{s.state=1};s.img.onerror=()=>{s.state=-1};s.img.src=this.spritePath(id,frame);this.sprites.set(key,s)}
  return s;
 }
 // Trả về ảnh khi sẵn sàng, null khi đang tải, false khi lỗi.
 sprite(id,frame,dark=false){
  const s=this.requestSprite(id,frame);
  if(s.state<1)return s.state?false:null;
  if(!dark)return s.img;
  if(!s.dark){
   const c=s.dark=document.createElement("canvas"),g=c.getContext("2d");c.width=s.img.width;c.height=s.img.height;
   g.drawImage(s.img,0,0);g.globalCompositeOperation="source-atop";g.fillStyle="#0a1524b0";g.fillRect(0,0,c.width,c.height);
  }
  return s.dark;
 }
 // Góc quay 0–3 (cửa hướng +x, −y, −x, +y). Chưa xoay tay thì cửa tự quay ra con đường kề bên.
 facing(b,w){
  if(Number.isInteger(b.rot))return b.rot&3;
  const road=(dx,dy)=>lookup(w,b.x+dx,b.y+dy)?.id==="road";
  return road(1,0)?0:road(0,1)?3:road(0,-1)?1:road(-1,0)?2:0;
 }
 progress(x,y,value,color){
  const g=this.ctx,z=this.camera.zoom;g.fillStyle="#142420e9";g.fillRect(x-15*z,y-3*z,30*z,6*z);g.fillStyle=color;g.fillRect(x-14*z,y-2*z,28*z*value,4*z);
 }
 crisis(c,height){
  const d=CONFIG.crises[c.id],z=this.camera.zoom,g=this.ctx,t=this.elapsed,p=this.project(c.x+.5,c.y+.5,height+2),s=this.project(c.x+.5,c.y+.5,height+29+Math.sin(t*4)*2);
  const puff=(i,col,speed=1)=>{const f=(t*speed+i*.36)%1;this.ellipse(p.x+Math.sin(i*3+t)*f*12*z,p.y-f*36*z,(3+f*6)*z,(2+f*4.5)*z,col)};
  const flash=.8+.18*Math.sin(t*6),fx=(key,x,y,w,h)=>GameArt.draw(g,"vfx-incidents-weather",key,x,y,w*z,h*z);
  if(c.id==="fire"&&fx("flame",p.x,p.y-5*z,24*flash,25*flash)){
   fx("smoke-dark",p.x+Math.sin(t)*4*z,p.y-(24+(t%1)*6)*z,17,13);
  }else if(c.id==="blackout"&&fx("arc",p.x,p.y-7*z,20*flash,23*flash)){
  }else if(c.id==="water_leak"&&fx("water-spray",p.x,p.y-5*z,28*flash,18*flash)){
  }else if(c.id==="collapse"&&fx("smoke-dark",p.x,p.y-(10+(t%1)*4)*z,24,20)){
  }else if(c.id==="trash_pile"&&fx("fumes",p.x,p.y-(10+(t%1)*4)*z,24,20)){
  }else if(c.id==="flu_outbreak"&&fx("medical",p.x,p.y-8*z,18*flash,18*flash)){
  }else if(c.id==="cyber_attack"&&fx("interference",p.x,p.y-9*z,22*flash,22*flash)){
  }else if(c.id==="fire"){
   for(let i=0;i<4;i++)puff(i,"#24302bb5",.6);
   for(let i=0;i<4;i++){const x=p.x+(i-1.5)*5*z,y=p.y+4*z,dy=(12+Math.sin(t*13+i*2)*5)*z;this.poly([{x:x-4*z,y},{x:x+Math.sin(t*8+i)*3*z,y:y-dy},{x:x+4*z,y}],i%2?"#ffc35d":"#ff7651")}
  }else if(c.id==="blackout"){
   const a=5+Math.sin(t*13)*3;this.line([{x:p.x+4*z,y:p.y-18*z},{x:p.x-a*z,y:p.y-9*z},{x:p.x+2*z,y:p.y-9*z},{x:p.x-4*z,y:p.y+1*z}],"#ffe083",2*z);
  }else if(c.id==="water_leak"){
   for(let i=0;i<9;i++){const f=(t*1.5+i*.12)%1,side=i%2?1:-1;this.ellipse(p.x+side*f*18*z,p.y-(Math.sin(f*Math.PI)*23+1)*z,(1.2+f)*z,2*z,"#86e7ff")}
  }else if(c.id==="collapse"||c.id==="trash_pile"){
   for(let i=0;i<5;i++)puff(i,c.id==="collapse"?"#cbc3a582":"#9fae5899",.6);
  }else if(c.id==="traffic_jam"){
   for(let i=0;i<2;i++)this.ellipse(p.x+(i*2-1)*7*z,p.y+4*z,6*z,3*z,(Math.floor(t*8)+i)%2?"#fe8685":"#8bbfff");
  }else if(c.id==="flu_outbreak"){
   for(let i=0;i<4;i++){const a=t+i*1.57;this.text("✚",p.x+Math.cos(a)*13*z,p.y+Math.sin(a)*7*z,7*z,"#ffc2b7")}
  }else{
   for(let i=0;i<5;i++)this.text((i+Math.floor(t*9))%2?"1":"0",p.x+((i*7)%19-9)*z,p.y-(i*4+3)*z,8*z,"#a3ffc2");
  }
  const r=this.markerRadius(),ay=s.y;
  if(!GameArt.draw(g,"markers-crisis",c.id,s.x,ay+2,2*r+6)){
  this.poly([{x:s.x-4*z,y:ay+r-2},{x:s.x,y:ay+r+5},{x:s.x+4*z,y:ay+r-2}],"#263631");
  this.ellipse(s.x,ay,r+1,r+1,d.color);this.ellipse(s.x,ay,r-.6,r-.6,"#263631");
  this.text(d.icon,s.x,ay,r*1.2,d.color);
  }
  if(c.progress>0)this.progress(s.x,ay-r-6,c.progress,"#b9efa3");
  this.hits.push({crisis:c,x:s.x,y:ay,r:Math.max(22,r+4)});
 }
 bubble(b,height){
  const z=this.camera.zoom,t=this.elapsed,p=this.project(b.x+.5,b.y+.5,height+24+Math.sin(t*3+b.x)*3),r=this.markerRadius();
  const look={coin:["#ffd36e","#7a5a1c","V"],know:["#9ae4cb","#1d5a4a","✦"],gem:["#ffe5a5","#75451e","🏅"]}[b.kind];
  if(!GameArt.draw(this.ctx,"markers-rewards",b.kind,p.x,p.y,2*r+5)){
  this.ellipse(p.x,p.y+r+5*z,r*.6,r*.22,"#14262155");
  this.ellipse(p.x,p.y,r+2,r+2,"#fff8dc");this.ellipse(p.x,p.y,r,r,look[0]);this.ellipse(p.x-r*.3,p.y-r*.35,r*.28,r*.18,"#ffffffaa");
  if(b.kind==="gem"&&this.prestigeIcon.naturalWidth){
   this.ctx.drawImage(this.prestigeIcon,p.x-r,p.y-r,2*r,2*r);
  }else this.text(look[2],p.x,p.y+.5,r*1.1,look[1]);
  }
  this.hits.push({bubble:b,x:p.x,y:p.y,r:Math.max(22,r+6)});
 }
 markerRadius(){return Math.max(this.width<=780?16:13,13*this.camera.zoom)}
 // Cư dân và xe cộ đi lại trên đường (chỉ để trang trí).
 npc(n){
  const t=this.elapsed,z=this.camera.zoom,p=this.project(n.x+.51,n.y+.51),d=CONFIG.npcs[n.type],color=d.color;
  const a=n.path[Math.min(n.segment,n.path.length-2)],b=n.path[Math.min(n.segment+1,n.path.length-1)];
  const dx=(b?.x??0)-(a?.x??0),dy=(b?.y??0)-(a?.y??0),side=dx<0||dy<0?"rear":"front";
  const mode=n.phase==="repair"?"repair":CREW_TRANSPORT[n.level-1],wide=mode==="repair"?16:9+3*n.level;
  const painted=GameArt.draw(this.ctx,"crew-"+CREW_ART[n.type],mode+"-"+side,p.x,p.y+3*z,wide*z,16*z,{ground:true,mirror:!!dy});
  if(!painted){
  this.ellipse(p.x,p.y+1.7*z,(n.level+2)*z,2.6*z,"#1e352c99");
  if(n.level===1){
   const bob=n.phase==="repair"?0:Math.sin(t*15)*1.35*z;
   this.line([{x:p.x-1*z,y:p.y-4*z},{x:p.x-2*z,y:p.y+bob}],"#283e38",1.3*z);this.line([{x:p.x+1*z,y:p.y-4*z},{x:p.x+2*z,y:p.y-bob}],"#283e38",1.3*z);
   this.ellipse(p.x,p.y-5*z,3.2*z,4*z,color);this.ellipse(p.x,p.y-9*z,2.8*z,2.7*z,"#f5e6bf");
  }else{
   const h=n.level<=3?5:8+1.5*(n.level-4),width=n.level<=3?5:7+(n.level-4)*2;
   for(const side of [-1,1])this.ellipse(p.x+side*width*.74*z,p.y+1.4*z,2.3*z,2.2*z,"#253332");
   this.block(n.x+.36,n.y+.39,n.level<=3?.29:.39,.24,1,h,color);
   if(n.level===2)this.ellipse(p.x,p.y-6*z,2.4*z,2.5*z,"#e8e1b6");
   if(n.level===3)this.ellipse(p.x+2*z,p.y-6*z,2.5*z,2.5*z,"#c5e0d3");
   if(n.level>=4){this.ellipse(p.x-1*z,p.y-(h+1)*z,2.7*z,1.5*z,"#d9ecd6");if(n.phase!=="return")this.ellipse(p.x+2*z,p.y-(h+2)*z,2*z,1.4*z,Math.floor(t*9)%2?"#ff907e":"#a6c6ff")}
  }
  }
  if(n.phase==="repair"){
   const phase=t*10%1;
   this.ellipse(p.x+(7+7*phase)*z,p.y-(6+8*phase)*z,1.7*z,1.2*z,"#ffe7a4");
  }
 }
 contains(point,poly){
  let found=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)found=!found;
  }return found;
 }
 containsSprite(point,box){
  const u=(point.x-box.x)/box.w,v=(point.y-box.y)/box.h;
  if(u<0||v<0||u>=1||v>=1)return false;
  if(!this.hitContext){
   const canvas=document.createElement("canvas");canvas.width=canvas.height=1;
   this.hitContext=canvas.getContext("2d",{willReadFrequently:true});
  }
  const g=this.hitContext,im=box.art;
  g.clearRect(0,0,1,1);g.drawImage(im,Math.floor(u*im.width),Math.floor(v*im.height),1,1,0,0,1,1);
  return g.getImageData(0,0,1,1).data[3]>48;
 }
 hit(point,observe=true,markers=true){
  let closest=null,best=Infinity;
  if(markers)for(let i=this.hits.length-1;i>=0;i--){
   const hit=this.hits[i];
   if(!hit.crisis&&!(observe&&hit.bubble))continue;
   const distance=Math.hypot(hit.x-point.x,hit.y-point.y);
   if(distance<=hit.r&&(distance<best||distance===best&&hit.crisis)){closest=hit;best=distance}
  }
  if(closest)return closest;
  if(observe)for(let i=this.hits.length-1;i>=0;i--){const hit=this.hits[i];if(hit.citizen&&Math.hypot(hit.x-point.x,hit.y-point.y)<=hit.r)return hit}
  for(let i=this.hits.length-1;i>=0;i--){const hit=this.hits[i];if(hit.building&&(hit.sprite?this.containsSprite(point,hit.sprite):hit.polys.some(poly=>this.contains(point,poly))))return hit}
  return null;
 }
 districtPreview(w,id,x,y,moving,heights){
  const layout=w.buildings.map(b=>b.id+":"+coord(b.x,b.y)+":"+(b.left>0?0:1)).join("|"),
   key=[id,x,y,moving?.x,moving?.y,layout].join(";");
  if(this.districtPlan?.world!==w||this.districtPlan.key!==key){
   const candidate={id,x,y,left:0};
   this.districtPlan={world:w,key,tiles:Districts.preview(w,candidate,moving)};
  }
  const g=this.ctx,z=this.camera.zoom;
  for(const tile of this.districtPlan.tiles){
   const positive=tile.labels.some(l=>l.good);
   this.poly(this.plate(tile.x+.05,tile.y+.05,tile.x+.95,tile.y+.95,.8),positive?"#85d6a066":"#f6a29466",positive?"#aaf1b6":"#ffc1b1",1.5);
   const anchor=this.project(tile.x+.5,tile.y+.5,(heights.get(coord(tile.x,tile.y))||0)+14);
   tile.labels.forEach(({text,good},i)=>{
    const size=Math.max(10,12*z),ty=anchor.y-i*(size+5);
    g.font=canvasFont(size,800);const width=g.measureText(text).width+10;
    g.fillStyle=good?"#244a3a":"#713931";g.beginPath();g.roundRect(anchor.x-width/2,ty-size*.62,width,size+4,4);g.fill();
    this.text(text,anchor.x,ty,size,good?"#e0fbea":"#ffe9e0");
   });
  }
 }
 render(dt){
  this.elapsed+=dt;
  if(this.target){
   const t=this.target,c=this.camera,blend=Math.min(1,dt*(t.zoom?6:10));
   c.x+=(t.x-c.x)*blend;c.y+=(t.y-c.y)*blend;if(t.zoom)c.zoom+=(t.zoom-c.zoom)*blend;
   if(Math.hypot(c.x-t.x,c.y-t.y)<.4&&(!t.zoom||Math.abs(c.zoom-t.zoom)<.003)){c.x=t.x;c.y=t.y;if(t.zoom)c.zoom=t.zoom;this.target=null}
  }
  const w=this.sim.social.world,own=this.sim.world,g=this.ctx,z=this.camera.zoom;
  const night=clamp((Math.cos(own.timeOfDay*Math.PI*2)-.02)*1.37,0,1);
  g.setTransform(this.dpr,0,0,this.dpr,0,0);this.ambient(night,own.weather,w);this.groundLayer(w);this.hits=[];
  if(night>.18)for(const b of w.buildings)if(b.id==="road")this.effects.street(b,night,w.crises.some(c=>c.id==="blackout"&&distance(c,b)<=1));
  EventMap.draw(this,w,this.sim.events);
  const jobs=[],heights=new Map();
  for(let x=0;x<16;x++)for(let y=0;y<16;y++){
   const b=lookup(w,x,y);if(b&&b.id!=="road")jobs.push({x,y,draw:()=>heights.set(coord(x,y),this.building(b,w,night))});
   else if(!b){
    const hash=(x*31+y*43+x*y*13)%113;
    if((!unlocked(w,x,y)&&hash%7<2)||(unlocked(w,x,y)&&hash%17===3))jobs.push({x,y,draw:()=>this.tree(x+.53,y+.57,hash%3,.62+hash%5*.1)});
   }
  }
  this.life.update(w,dt);
  for(const a of this.life.agents)jobs.push({x:a.x+.05,y:a.y+.05,draw:()=>this.life.draw(a,night)});
  for(const n of w.npcs)jobs.push({x:n.x+.1,y:n.y+.1,draw:()=>this.npc(n)});
  jobs.sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);for(const job of jobs)job.draw();
  if(night>.01){g.fillStyle="rgba(27,50,110,"+night*.37+")";g.fillRect(0,0,this.width,this.height)}
  if(own.weather==="heat"){g.fillStyle="#eb9e4820";g.fillRect(0,0,this.width,this.height)}
  if(this.hover&&inside(this.hover.x,this.hover.y)){
   const {x,y}=this.hover,mode=this.ui?.tool,standing=lookup(w,x,y);
   if(["build","move","demo"].includes(mode)&&this.sim.social.viewMode==="own"){
    const valid=mode==="demo"?standing&&this.sim.canAlter(standing):mode==="move"&&!this.ui.moving?!!standing:!this.sim.placement(mode==="move"?this.ui.moving.id:this.ui.selection,x,y,this.ui.moving);
    this.poly(this.plate(x+.035,y+.035,x+.965,y+.965,1),valid?"#bfff7955":"#ff7e6960",valid?"#e0ffa2":"#ffc0aa",1.9);
    if(valid&&(mode==="build"||mode==="move"&&this.ui.moving))this.districtPreview(w,mode==="build"?this.ui.selection:this.ui.moving.id,x,y,this.ui.moving,heights);
   }else if(standing)this.poly(this.plate(x,y,x+1,y+1,.8),null,"#def2bfaa",1.2);
  }
  if(this.guide&&w===own){
   const {x,y}=this.guide,pulse=.5+.5*Math.sin(this.elapsed*5);
   this.poly(this.plate(x+.03,y+.03,x+.97,y+.97,1),"rgba(209,251,139,"+(.18+.3*pulse)+")","#f2ffd0",2+pulse*1.5);
   const a=this.project(x+.5,y+.5,26+pulse*8);this.poly([{x:a.x-7,y:a.y-9},{x:a.x+7,y:a.y-9},{x:a.x,y:a.y+3}],"#f2ffd0","#233a2c",1.2);
  }
  this.life.overlay();
  for(const c of w.crises)this.crisis(c,heights.get(coord(c.x,c.y))||0);
  if(w===own)for(const b of w.bubbles)if(!w.crises.some(c=>c.x===b.x&&c.y===b.y))this.bubble(b,heights.get(coord(b.x,b.y))||0);
  for(const p of this.sim.particles)if((p.world||own)===w){
   const a=this.project(p.x+.5,p.y+.5,(heights.get(coord(p.x|0,p.y|0))||7)+15+p.life*24);
   g.globalAlpha=Math.min(1,(1.45-p.life)*2);this.text(p.text,a.x+1,a.y+1,Math.max(12,13*z),"#18372d");this.text(p.text,a.x,a.y,Math.max(12,13*z),p.color);g.globalAlpha=1;
  }
  if(own.weather==="storm"){
   g.fillStyle="#293f571b";g.fillRect(0,0,this.width,this.height);g.beginPath();
   for(let i=0;i<165;i++){
    const h=this.height+40,a=(i*164.53+this.elapsed*101)%(this.width+30)-15,b=(i*89.167+this.elapsed*(380+(i%4)*33))%h-20;
    if(i%6===0&&GameArt.draw(g,"vfx-incidents-weather","rain",a+3,b+8,8,17))continue;
    g.moveTo(a,b);g.lineTo(a+6,b+13+(i%3)*3);
   }
   g.strokeStyle="#b7def05e";g.lineWidth=.82;g.stroke();
   const f=this.elapsed%12;if(!this.sim.reduceEffects&&(f<.13||(f>.23&&f<.31))){g.fillStyle="#bdd9ff32";g.fillRect(0,0,this.width,this.height)}
  }
  if(!this.sim.reduceEffects)this.effects.render(w,heights);
 }
 thumbnail(id){
  if(SPRITES[id])return this.spritePath(id,"thumb");
  const canvas=document.createElement("canvas");canvas.width=112;canvas.height=94;
  const saved={ctx:this.ctx,camera:this.camera,hits:this.hits};this.ctx=canvas.getContext("2d");this.camera={x:56,y:70,zoom:id==="metro_wonder"?.58:["tech_tower","wind_farm","airport","office_tower","university"].includes(id)?.66:.79};this.hits=[];
  const b=makeBuilding(id,0,0),w=makeWorld(id==="road"?[b,makeBuilding("road",1,0),makeBuilding("road",0,-1)]:[b]);
  if(id==="road")this.roads(w);else this.building(b,w,0);
  Object.assign(this,saved);return canvas.toDataURL();
 }
}
