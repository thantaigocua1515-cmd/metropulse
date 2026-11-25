"use strict";

const EventCalendar=(()=>{
 const day=86400000,offset=7*3600000,epoch=2440588,tau=2*Math.PI,rad=Math.PI/180;
 const civil=ms=>Math.floor((ms+offset)/day),instant=n=>n*day-offset;
 const solar=(y,m,d)=>Math.floor(Date.UTC(y,m-1,d)/day);
 const moon=k=>{
  const t=k/1236.85,t2=t*t,t3=t2*t;
  const mean=2415020.75933+29.53058868*k+.0001178*t2-.000000155*t3+.00033*Math.sin((166.56+132.87*t-.009173*t2)*rad);
  const a=(359.2242+29.10535608*k-.0000333*t2-.00000347*t3)*rad;
  const b=(306.0253+385.81691806*k+.0107306*t2+.00001236*t3)*rad;
  const f=(21.2964+390.67050646*k-.0016528*t2-.00000239*t3)*rad;
  const shift=(.1734-.000393*t)*Math.sin(a)+.0021*Math.sin(2*a)-.4068*Math.sin(b)+.0161*Math.sin(2*b)-.0004*Math.sin(3*b)+.0104*Math.sin(2*f)-
   .0051*Math.sin(a+b)-.0074*Math.sin(a-b)+.0004*Math.sin(2*f+a)-.0004*Math.sin(2*f-a)-.0006*Math.sin(2*f+b)+.0010*Math.sin(2*f-b)+.0005*Math.sin(a+2*b);
  const correction=t< -11?.001+.000839*t+.0002261*t2-.00000845*t3-.000000081*t*t3:-.000278+.000265*t+.000262*t2;
  return Math.floor(mean+shift-correction+.5+7/24);
 };
 const sun=j=>{
  const t=(j-.5-7/24-2451545)/36525,t2=t*t;
  const m=(357.52910+35999.05030*t-.0001559*t2-.00000048*t*t2)*rad;
  const l=(280.46645+36000.76983*t+.0003032*t2+(1.9146-.004817*t-.000014*t2)*Math.sin(m)+(.019993-.000101*t)*Math.sin(2*m)+.00029*Math.sin(3*m))*rad;
  return Math.floor(((l%tau+tau)%tau)*12/tau);
 };
 const month11=y=>{
  const k=Math.floor((solar(y,12,31)+epoch-2415021)/29.530588853),n=moon(k);
  return sun(n)>=9?moon(k-1):n;
 };
 const lunarMonth=(year,month)=>{
  const a=month11(year-1),b=month11(year);
  const k=Math.floor(.5+(a-2415021.076998695)/29.530588853);
  let offset=(month+1)%12;
  if(b-a>365){
   let i=1;while(i<13&&sun(moon(k+i))!==sun(moon(k+i+1)))i++;
   if(offset>=i)offset++;
  }
  return moon(k+offset)-epoch;
 };
 const seasons=year=>{
  const tet=lunarMonth(year,1),moon=lunarMonth(year,8)+14;
  return [
   {id:"tet",start:tet,end:tet+7},
   {id:"trung-thu",start:moon-2,end:moon+3},
   {id:"quoc-khanh",start:solar(year,9,2),end:solar(year,9,6)},
   {id:"giang-sinh",start:solar(year,12,21),end:solar(year+1,1,5)}
  ];
 };
 const weekly=["pho-xanh","cho-phien","xom-vui"];
 const active=ms=>{
  const n=civil(ms),year=new Date(n*day).getUTCFullYear(),range=[...seasons(year-1),...seasons(year),...seasons(year+1)];
  const current=range.find(e=>e.start<=n&&n<e.end);
  if(current)return current;
  const monday=n-((n+3)%7+7)%7,week=Math.floor(monday/7);
  let start=monday,end=monday+7;
  for(const e of range){
   if(e.end>start&&e.end<=n)start=e.end;
   if(e.start>n&&e.start<end)end=e.start;
  }
  return {id:weekly[(week%weekly.length+weekly.length)%weekly.length],start,end};
 };
 return {civil,instant,active,seasons,weekly};
})();

const EventContent={
 tet:{name:"Tết Nguyên Đán",points:"Lộc xuân",skin:"Cổng Mai Vàng",icon:"✿",tone:"#a83d32",who:"mai",line:"Xuân đến rồi! Cùng bà con dựng phố mới và mang lộc đầu năm về Bình Minh nhé.",jobs:[
  ["buildingsBuilt",2,"Dựng phố đón xuân"],["roadsBuilt",4,"Mở đường về quê"],["upgrades",3,"Tân trang phố Tết"],["bubbles",5,"Hái lộc đầu năm"],["crisesSolved",2,"Giữ Tết bình yên"],["dailyDone",2,"Chúc Tết hàng xóm"]
 ]},
 "trung-thu":{name:"Tết Trung Thu",points:"Ánh trăng",skin:"Cổng Đèn Ông Sao",icon:"✦",tone:"#78538c",who:"hanh",line:"Tối rằm, bọn trẻ sẽ rước đèn qua phố. Nhờ Thị trưởng giúp chuẩn bị đường rước đèn nhé!",jobs:[
  ["roadsBuilt",5,"Đường rước đèn"],["buildingsBuilt",2,"Điểm hẹn ngắm trăng"],["upgrades",2,"Thắp sáng phố nhỏ"],["bubbles",6,"Gom quà đêm rằm"],["crisesSolved",2,"Rước đèn an toàn"],["dailyDone",2,"Mâm cỗ đoàn viên"]
 ]},
 "quoc-khanh":{name:"Quốc Khánh 2/9",points:"Sao vàng",skin:"Quảng Trường Cờ Đỏ",icon:"★",tone:"#a34235",who:"mai",line:"Ngày Quốc Khánh, mình cùng treo cờ và chuẩn bị những tuyến phố đẹp nhất cho bà con.",jobs:[
  ["roadsBuilt",6,"Tuyến phố cờ hoa"],["buildingsBuilt",3,"Không gian cho cộng đồng"],["upgrades",2,"Sửa sang quảng trường"],["bubbles",4,"Góp quỹ khu phố"],["crisesSolved",2,"Giữ lễ hội thông suốt"],["dailyDone",2,"Ngày hội toàn dân"]
 ]},
 "giang-sinh":{name:"Giáng Sinh & Năm Mới",points:"Bông tuyết",skin:"Cây Chúc Năm Mới",icon:"❄",tone:"#426c69",who:"hanh",line:"Phố sắp lên đèn đón năm mới. Cùng chuẩn bị quà và một buổi tối ấm áp cho cư dân nào.",jobs:[
  ["upgrades",3,"Phố đèn mùa đông"],["buildingsBuilt",2,"Góc trú đông"],["roadsBuilt",4,"Đường tới chợ đêm"],["bubbles",6,"Gói quà cuối năm"],["crisesSolved",2,"Đêm hội yên vui"],["dailyDone",2,"Lời chúc năm mới"]
 ]},
 "pho-xanh":{name:"Tuần Phố Xanh",points:"Lá non",skin:"Vườn Lá Non",icon:"❋",tone:"#537557",who:"hanh",line:"Bà con muốn phố có thêm chỗ nghỉ chân. Tuần này mình cùng làm mới từng góc nhỏ nhé.",jobs:[
  ["buildingsBuilt",2,"Góc phố mới"],["roadsBuilt",3,"Lối đi bộ"],["upgrades",2,"Nâng chất khu dân cư"],["bubbles",4,"Quỹ phố xanh"],["crisesSolved",1,"Phố sạch, phố an toàn"],["dailyDone",1,"Một ngày sống xanh"]
 ]},
 "cho-phien":{name:"Tuần Chợ Phiên",points:"Phiếu chợ",skin:"Sạp Chợ Phiên",icon:"◆",tone:"#92734c",who:"mai",line:"Các tiểu thương đang mở chợ phiên. Họ cần thêm đường, gian hàng và một đội hỗ trợ.",jobs:[
  ["roadsBuilt",4,"Lối vào chợ"],["buildingsBuilt",2,"Dựng gian hàng"],["upgrades",2,"Chợ thêm khang trang"],["bubbles",5,"Thu phiếu chợ"],["crisesSolved",1,"Chợ vận hành tốt"],["dailyDone",1,"Gian hàng của ngày"]
 ]},
 "xom-vui":{name:"Tuần Xóm Vui",points:"Dấu tay",skin:"Sân Chơi Xóm Vui",icon:"♥",tone:"#926572",who:"hanh",line:"Tổ dân phố mời mọi người góp sức cho một tuần thật vui. Chỉ cần vài việc nhỏ, cả xóm cùng hưởng.",jobs:[
  ["crisesSolved",2,"Chung tay giúp xóm"],["roadsBuilt",3,"Nối lối xóm làng"],["buildingsBuilt",2,"Thêm một chỗ gặp nhau"],["upgrades",2,"Sửa sang khu phố"],["bubbles",4,"Khen ngợi từ cư dân"],["dailyDone",1,"Việc tốt trong ngày"]
 ]}
};

class SeasonalEvents {
 static aliases={trungthu:"trung-thu",quockhanh:"quoc-khanh",giangsinh:"giang-sinh",christmas:"giang-sinh",midautumn:"trung-thu",national:"quoc-khanh"};
 static statNames={buildingsBuilt:"Hoàn thành công trình",roadsBuilt:"Xây ô đường",upgrades:"Nâng cấp công trình",bubbles:"Nhặt túi thưởng",crisesSolved:"Giải quyết sự cố",dailyDone:"Nhận thưởng nhiệm vụ ngày"};
 static tiers=[{need:20,reward:{coins:180}},{need:40,reward:{coins:350,prestige:2}},{need:60,reward:{coins:550,prestige:3},skin:true}];
 constructor(sim,force=""){
  this.sim=sim;
  const id=Object.hasOwn(SeasonalEvents.aliases,force)?SeasonalEvents.aliases[force]:force;
  this.force=id==="weekly"||Object.hasOwn(EventContent,id)?id:"";
  this.preview={};this.refresh();
 }
 get data(){return this.force?this.preview:(this.sim.progress.events??={})}
 refresh(){
  const now=Date.now(),day=EventCalendar.civil(now);
  if(this.day===day)return;
  this.day=day;
  const current=EventCalendar.active(now);
  const id=this.force==="weekly"?EventCalendar.weekly.find(id=>id===current.id)||EventCalendar.weekly[0]:this.force||current.id;
  this.event=this.force?{id,start:day,end:day+7}:current;
  this.def=EventContent[this.event.id];
  const key=this.event.id+":"+this.event.start,data=this.data;
  data.skins??={};
  if(data.key!==key||!data.base||!Array.isArray(data.quests)||!Array.isArray(data.tiers)){
   Object.assign(data,{key,base:Object.fromEntries(this.def.jobs.map(([stat])=>[stat,this.sim.stats[stat]||0])),quests:[],tiers:[]});
  }
 }
 get points(){return this.data.quests.length*10}
 get skin(){return Object.hasOwn(this.data.skins,this.data.selected)&&Object.hasOwn(EventContent,this.data.selected)?this.data.selected:""}
 countdown(){
  const mins=Math.max(0,Math.ceil((EventCalendar.instant(this.event.end)-Date.now())/60000));
  return (mins>=1440?Math.floor(mins/1440)+"n ":"")+String(Math.floor(mins/60)%24).padStart(2,"0")+"g "+String(mins%60).padStart(2,"0")+"p";
 }
 quest(id){
  const [stat,goal,name]=this.def.jobs[id],cur=clamp((this.sim.stats[stat]||0)-(this.data.base[stat]||0),0,goal),claimed=this.data.quests.includes(id);
  return {id,cur,goal,name,text:SeasonalEvents.statNames[stat],done:cur>=goal,claimed};
 }
 claimQuest(id){
  this.refresh();
  if(!Number.isInteger(id)||!this.def.jobs[id])return false;
  const q=this.quest(id);
  if(!q.done||q.claimed)return false;
  this.data.quests.push(id);this.sim.audio.play("money");
  if(!this.force)this.sim.storage.save();
  return true;
 }
 claimTier(id){
  this.refresh();
  const tier=SeasonalEvents.tiers[id],data=this.data;
  if(!Number.isInteger(id)||!tier||this.points<tier.need||data.tiers.includes(id))return false;
  data.tiers.push(id);
  if(tier.skin){data.skins[this.event.id]=true;data.selected=this.event.id}
  if(!this.force){this.sim.grant(tier.reward);this.sim.storage.save()}
  this.sim.audio.play("done");return true;
 }
 selectSkin(id){
  if(id&&(!Object.hasOwn(this.data.skins,id)||!Object.hasOwn(EventContent,id)))return;
  this.data.selected=id;if(!this.force)this.sim.storage.save();
 }
}

class EventMap {
 static colors={tet:["#bd4f49","#ffd476"],"trung-thu":["#a85890","#ffc75c"],"quoc-khanh":["#c2443e","#ffda6b"],"giang-sinh":["#357466","#f7d5a1"],
  "pho-xanh":["#689470","#e8cf82"],"cho-phien":["#bb8163","#f8dca4"],"xom-vui":["#9e6681","#edc6cf"]};
 static shape(r,id,x,y,z,large){
  const [color,accent]=this.colors[id],line=(pts,c,w)=>r.line(pts.map(([a,b])=>({x:x+a*z,y:y+b*z})),c,w*z);
  const poly=(pts,c)=>r.poly(pts.map(([a,b])=>({x:x+a*z,y:y+b*z})),c);
  const dot=(a,b,rx,ry,c)=>r.ellipse(x+a*z,y+b*z,rx*z,ry*z,c);
  const star=(a,b,rad,c)=>poly(Array.from({length:10},(_,i)=>{
   const t=i*Math.PI/5-Math.PI/2,n=i%2?rad*.44:rad;return [a+Math.cos(t)*n,b+Math.sin(t)*n];
  }),c);
  dot(0,0,7,2.7,"#29342961");
  if(id==="quoc-khanh"){
   line([[0,0],[0,-23]],"#70625b",1.6);poly([[.8,-22],[14,-19],[14,-10],[.8,-13]],color);star(7,-16,3.5,accent);
   if(large){line([[-10,0],[-10,-16]],"#78655b",1.1);poly([[-10,-16],[-20,-14],[-20,-7],[-10,-9]],color);star(-15,-11,2.3,accent)}
  }else if(id==="tet"||id==="pho-xanh"){
   dot(0,-1,4.5,2.4,"#9c6459");line([[0,-2],[0,-13],[-4,-18]],"#78634d",2);
   line([[0,-9],[5,-14]],"#78634d",1.2);
   for(let i=0;i<7;i++){
    const a=(i*7)%15-7,b=-12-(i*3)%10;
    dot(a,b,3,2.4,id==="tet"?(i%2?accent:"#ed9f9d"):color);
    if(id==="tet")dot(a,b,.9,.9,"#ad6354");
   }
   if(large){line([[-12,0],[-12,-17],[12,-17],[12,0]],color,2.6);line([[-16,-18],[0,-23],[16,-18]],accent,2)}
  }else if(id==="trung-thu"){
   line([[0,0],[0,-19],[5,-19],[5,-16]],"#82685a",1.4);
   dot(5,-12,5,5,color);star(5,-12,5,accent);line([[5,-8],[5,-5]],color,1.2);
   if(large){line([[-11,0],[-11,-20],[11,-20],[11,0]],color,2.2);star(0,-21,7,accent)}
  }else if(id==="giang-sinh"){
   line([[0,-1],[0,-20]],"#846758",2);
   for(let i=0;i<3;i++)poly([[0,-24+i*4],[-4-i*2,-12+i*4],[4+i*2,-12+i*4]],i===1?"#5a947b":color);
   for(let i=0;i<5;i++)dot((i*5)%11-5,-7-i*2,1.1,1.1,i%2?accent:"#d17b77");
   star(0,-24,large?4:2.7,accent);
  }else{
   line([[-7,0],[-7,-13],[7,-13],[7,0]],"#816857",1.3);
   poly([[-10,-13],[-6,-18],[6,-18],[10,-13]],color);
   for(let i=-1;i<=1;i++)dot(i*4,-11,2,2,accent);
   if(large){poly([[-9,-1],[-9,-6],[9,-6],[9,-1]],color);line([[-8,-7],[8,-7]],accent,1.6)}
  }
 }
 static draw(r,w,events){
  if(w!==r.sim.world||!events?.event)return;
  const id=events.event.id,z=r.camera.zoom;
  let gate=null;
  for(const b of w.buildings){
   if(b.id!=="road")continue;
   if(!gate||Math.abs(b.x-8)+Math.abs(b.y-7)<Math.abs(gate.x-8)+Math.abs(gate.y-7))gate=b;
   if((b.x*3+b.y*7)%4)continue;
   const p=r.project(b.x+.87,b.y+.18,1);
   this.shape(r,id,p.x,p.y,z,false);
  }
  if(gate&&(events.skin||!EventCalendar.weekly.includes(id))){
   const p=r.project(gate.x+.28,gate.y+.78,1);
   this.shape(r,events.skin||id,p.x,p.y,z*1.4,true);
  }
 }
}
