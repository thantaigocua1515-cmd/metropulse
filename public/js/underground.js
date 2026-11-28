"use strict";

const BURIED={
 water:["Ống nước","#50c9f1",110,1],power:["Cáp điện","#ffd579",140,1],metro:["Tuyến Metro","#dc9aff",400,9],
 relic:["Di tích cổ","#f0c376"],aquifer:["Mạch nước ngầm","#68dfeb"],gas:["Túi khí độc","#b2e973"],soil:["Đất ổn định","#718a90"]
};
const DEEP_FOUNDATION=new Set(["office_tower","tech_tower","metro_wonder"]);

class Underground {
 constructor(sim){this.sim=sim;this.cache=null}
 data(){
  const {profile,progress}=this.sim;
  const d=progress.underground;
  if(d&&Number.isInteger(d.seed)&&d.surveys&&d.foundations&&d.lines)return d;
  let seed=2166136261;
  for(const ch of String(profile.mayorId))seed=Math.imul(seed^ch.charCodeAt(0),16777619);
  return progress.underground={seed:seed>>>0,surveys:{},foundations:{},lines:{}};
 }
 tile(x,y){
  let v=this.data().seed^Math.imul(x+1,1597334677)^Math.imul(y+1,3812015801);
  v=Math.imul(v^(v>>>16),2246822507)>>>0;
  const n=v%100;
  return n<9?"relic":n<25?"aquifer":n<34?"gas":"soil";
 }
 known(x,y){const data=this.data(),key=coord(x,y);return !!(data.surveys[key]||data.foundations[key])}
 survey(x,y){
  const s=this.sim,d=this.data(),key=coord(x,y);
  if(!unlocked(s.world,x,y)||this.known(x,y))return "Ô này không cần khảo sát thêm.";
  if(s.profile.coins<250)return "Cần 250 Vàng để khảo sát.";
  s.profile.coins-=250;d.surveys[key]=true;s.storage.save();
  return "Đã khảo sát: "+BURIED[this.tile(x,y)][0]+".";
 }
 lay(kind,x,y){
  const s=this.sim,d=this.data(),key=coord(x,y);
  if(!["water","power","metro"].includes(kind)||!unlocked(s.world,x,y))return "Ô đất chưa sẵn sàng.";
  if(this.lines(s.world)[kind].has(key))return "Đã có đoạn tuyến tại ô này.";
  const [, ,cost,level]=BURIED[kind];
  if(s.profile.level<level)return "Cần Thị trưởng cấp "+level+".";
  if(s.profile.coins<cost)return "Không đủ Vàng.";
  s.profile.coins-=cost;(d.lines[kind]??={})[key]=true;
  this.cache=null;s.storage.save();return "Đã đặt "+BURIED[kind][0].toLowerCase()+".";
 }
 dedicate(b){
  const s=this.sim;
  if(!this.data().relic||b?.id!=="museum"||b.left>0)return "Cần di tích đã khai quật và Bảo tàng Thành phố đã xây xong.";
  if(s.world.buildings.some(site=>site.id==="museum"&&site.relicMuseum))return "Thành phố đã có Bảo tàng Di sản.";
  b.relicMuseum=true;s.storage.save();return "Bảo tàng Di sản đã mở cửa.";
 }
 excavate(b,level=b.level){
  if(!DEEP_FOUNDATION.has(b.id)&&!(b.id==="apartment"&&level>=5)&&level<11)return;
  const s=this.sim,d=this.data(),key=coord(b.x,b.y);
  if(d.foundations[key])return;
  const kind=this.tile(b.x,b.y),prepared=!!d.surveys[key];
  d.foundations[key]=true;
  if(kind==="relic"){
   d.relic=true;s.say("Phát hiện di tích cổ! Chọn một Bảo tàng Thành phố trong lớp ngầm để mở Bảo tàng Di sản.");
   s.pending.push({type:"toast",text:"Đã khai quật di tích cổ · Mở Bảo tàng Di sản"});
  }else if(!prepared&&(kind==="aquifer"||kind==="gas")){
   const near=s.world.buildings.filter(other=>other!==b&&other.id!=="road"&&other.left<=0&&distance(other,b)<=1);
   let affected=0;
   for(const other of [...near,b]){
    if(s.crisis?.spawn(s.world,"collapse",other,false))affected++;
    if(affected===2||affected&&near.length===1)break;
   }
   if(affected){
    s.say("Sụt lún do đào trúng "+BURIED[kind][0].toLowerCase()+"! Điều đội xây dựng để khắc phục.");
    s.pending.push({type:"toast",text:"Sụt lún công trình · Hãy điều đội xây dựng"});
   }
  }else if(prepared&&kind!=="soil")s.say("Đội thi công đã gia cố nền theo kết quả khảo sát.");
 }
 lines(world){
  const d=this.data(),key=world.buildings.filter(b=>b.id==="road"||b.id==="metro_station"&&b.left<=0).map(b=>coord(b.x,b.y)+":"+b.id).join(",");
  if(this.cache?.key===key)return this.cache.lines;
  const water=new Set(),power=new Set(),metro=new Set(),lines={water,power,metro};
  for(const b of world.buildings)if(b.id==="road"){
   water.add(coord(b.x,b.y));power.add(coord(b.x,b.y));
  }
  const stations=world.buildings.filter(b=>b.id==="metro_station"&&b.left<=0);
  for(let i=1;i<stations.length;i++){
   let {x,y}=stations[i-1];const to=stations[i];
   metro.add(coord(x,y));
   while(x!==to.x){x+=Math.sign(to.x-x);metro.add(coord(x,y))}
   while(y!==to.y){y+=Math.sign(to.y-y);metro.add(coord(x,y))}
  }
  for(const kind of Object.keys(lines))for(const packed of Object.keys(d.lines[kind]||{}))lines[kind].add(Number(packed));
  this.cache={key,lines};return lines;
 }
 draw(r,world){
  const g=r.ctx,z=r.camera.zoom,lines=this.lines(world),selected=r.hover;
  g.fillStyle="#102b35";g.fillRect(0,0,r.width,r.height);
  for(let x=0;x<world.gridSize;x++)for(let y=0;y<world.gridSize;y++){
   const p=r.project(x+.5,y+.5);if(!r.inView(p,35,24))continue;
   const live=unlocked(world,x,y),known=live&&this.known(x,y),type=known?this.tile(x,y):null;
   r.poly(r.plate(x,y,x+1,y+1),!live?"#1b333b":type&&type!=="soil"?BURIED[type][1]+"45":lookup(world,x,y)?"#3c5860":"#2a464f",
    selected?.x===x&&selected?.y===y?"#f1ffd5":"#66868b72",selected?.x===x&&selected?.y===y?1.8:.55);
   if(type&&type!=="soil")r.text({relic:"◆",aquifer:"≈",gas:"!"}[type],p.x,p.y-2,12*z,BURIED[type][1]);
  }
  let i=0;
  for(const [kind,set] of Object.entries(lines)){
   const offset=[.34,.5,.66][i++];g.beginPath();
   for(const cell of set){
    const x=cell%CONFIG.size,y=Math.floor(cell/CONFIG.size),p=r.project(x+offset,y+offset);
    if(!r.inView(p,45,26))continue;
    g.moveTo(p.x-z,p.y);g.lineTo(p.x+z,p.y);
    for(const [dx,dy] of [[1,0],[0,1]])if(x+dx<world.gridSize&&y+dy<world.gridSize&&set.has(coord(x+dx,y+dy))){
     const q=r.project(x+offset+dx,y+offset+dy);g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);
    }
   }
   g.lineCap="round";g.lineWidth=(kind==="metro"?3:1.8)*z;g.strokeStyle=BURIED[kind][1];g.stroke();g.lineCap="butt";
  }
 }
}
