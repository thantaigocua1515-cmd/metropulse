"use strict";

const SHADOW_BLUEPRINTS={
 grid:{name:"Bộ điều áp Hắc Kim",desc:"+10% sản lượng điện",price:16000,corruption:8},
 trade:{name:"Mạng phân phối Mật Tuyến",desc:"+8% thu nhập thành phố",price:22000,corruption:12}
};

class ShadowEconomy {
 constructor(sim){this.sim=sim}
 data(){return this.sim.progress.shadow??={tax:false,corruption:0,clock:0,cooldown:0,blueprints:{},market:null,exposed:0}}
 covered(tile){
  return this.sim.world.buildings.some(b=>b.id==="police_station"&&b.left<=0&&distance(tile,b)<=3);
 }
 candidate(metrics){
  const w=this.sim.world;
  const poor=w.buildings.filter(b=>b.left<=0&&b.level<=3&&CONFIG.buildings[b.id].group==="res"&&
   (metrics.happiness<95||Districts.effects(b,w).some(e=>e.id==="road"||e.id==="pollution")));
  return poor.find(b=>poor.some(other=>other!==b&&distance(other,b)<=3)&&(this.data().tax||!this.covered(b)));
 }
 setTax(high){
  this.data().tax=high;this.sim.storage.save();
  return high?"Đã tăng thuế. Thu nhập tăng nhưng khu nghèo dễ xuất hiện chợ đen.":"Đã trở lại mức thuế chuẩn.";
 }
 expose(){
  const s=this.sim,d=this.data();
  d.market=null;d.exposed++;d.cooldown=2;d.corruption=Math.max(0,d.corruption-12);
  s.profile.prestige=Math.max(0,s.profile.prestige-15);s.world.happyDelta=Math.max(-60,s.world.happyDelta-24);
  s.say("Báo chí phanh phui chợ đen! Thành phố mất Uy tín và Hạnh phúc.");
  s.pending.push({type:"toast",text:"Báo chí phanh phui chợ đen · −15 Uy tín"});
 }
 risk(){return clamp(this.data().corruption*.009,0,.9)}
 tick(dt,metrics,draw=Math.random){
  const s=this.sim,d=this.data();
  if(d.market){
   const site=lookup(s.world,d.market.x,d.market.y);
   if(!site||CONFIG.buildings[site.id].group!=="res"){d.market=null;s.storage.save()}
  }
  d.clock+=dt;
  if(d.clock<180)return;
  d.clock%=180;
  if(d.cooldown>0){d.cooldown--;d.corruption=Math.max(0,d.corruption-4);return}
  if(d.market?.tolerated){
   d.corruption=Math.min(100,d.corruption+8);
   if(draw()<this.risk())this.expose();
   else d.market.ready=true;
  }else if(!d.market){
   const site=this.candidate(metrics);
   if(!site)return;
   d.market={x:site.x,y:site.y,tolerated:false,ready:false};
   s.say("Băng nhóm đã mở chợ đen ở một khu dân cư nghèo.");
   s.pending.push({type:"toast",text:"Có chợ đen mới · Mở Sắc lệnh → Kinh tế ngầm"});
  }
  s.storage.save();
 }
 tolerate(){
  const d=this.data();
  if(!d.market||d.market.tolerated)return "";
  d.market.tolerated=true;d.market.ready=true;d.corruption=Math.min(100,d.corruption+12);
  this.sim.storage.save();return "Đã dung túng chợ đen. Tham nhũng tăng.";
 }
 crackdown(){
  const d=this.data();
  if(!d.market||!this.covered(d.market))return "Cần Đồn Công an hoạt động cách khu chợ tối đa 3 ô.";
  d.market=null;d.cooldown=2;d.corruption=Math.max(0,d.corruption-15);
  this.sim.storage.save();return "Công an đã giải tán băng nhóm và chợ đen.";
 }
 fee(){return Math.min(5000000,Math.max(10000,Math.round(this.sim.metrics.income*180)))}
 collect(){
  const s=this.sim,d=this.data();
  if(!d.market?.tolerated||!d.market.ready)return "";
  d.market.ready=false;d.corruption=Math.min(100,d.corruption+4);
  const reward=s.grant({coins:this.fee()},d.market.x,d.market.y);
  s.storage.save();return "Tiền phế: "+reward;
 }
 buy(id){
  const s=this.sim,d=this.data(),item=Object.hasOwn(SHADOW_BLUEPRINTS,id)&&SHADOW_BLUEPRINTS[id];
  if(!d.market?.tolerated||!item||d.blueprints[id])return "";
  if(s.profile.coins<item.price)return "Không đủ Vàng.";
  s.profile.coins-=item.price;d.blueprints[id]=true;d.corruption=Math.min(100,d.corruption+item.corruption);
  s.storage.save();return "Đã mua bản vẽ "+item.name+".";
 }
 draw(r,w){
  const d=this.data();
  if(!d.market||!lookup(w,d.market.x,d.market.y))return;
  const p=r.project(d.market.x+.5,d.market.y+.5,2),z=r.camera.zoom;
  if(!r.inView(p,45,20))return;
  r.poly(r.plate(d.market.x+.05,d.market.y+.05,d.market.x+.95,d.market.y+.95,1),"#b56bb562","#e9b8f5",1.6);
  r.ellipse(p.x,p.y+7*z,30*z,8*z,"#352441");
  r.text("CHỢ ĐEN",p.x,p.y+7*z,8*z,"#fbd8ff");
 }
}
