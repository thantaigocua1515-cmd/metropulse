"use strict";

const ELECTION_TOPICS={
 power:{name:"Điện",value:m=>m.ps,score:m=>m.pd?m.ps/m.pd:1,step:20,pledge:"Thắp sáng từng khu phố",task:"Tăng công suất điện",hold:"Đủ điện cho thành phố",attack:"Đương kim Thị trưởng để dân thiếu điện"},
 water:{name:"Nước",value:m=>m.ws,score:m=>m.wd?m.ws/m.wd:1,step:15,pledge:"Nước sạch đến mọi nhà",task:"Tăng sản lượng nước",hold:"Đủ nước cho thành phố",attack:"Đương kim Thị trưởng để dân thiếu nước"},
 happiness:{name:"Hạnh phúc",value:m=>m.happiness,score:m=>m.happiness/100,step:8,pledge:"Thành phố đáng sống",task:"Nâng mức hạnh phúc",hold:"Giữ hạnh phúc đạt mục tiêu",attack:"Chính quyền đã để mức hạnh phúc xuống thấp"}
};
const CHALLENGERS=["Nguyễn Minh An","Trần Ngọc Lan","Lê Quang Huy","Phạm Thu Hà"];
const TERM_DAYS=30;

class MayorElections {
 constructor(sim){this.sim=sim}
 data(){return this.sim.progress.elections??={day:0,clock:0,shortages:{},campaign:null,term:null,result:null,protest:null}}
 tick(dt,metrics){
  const d=this.data();
  d.clock+=dt;
  while(d.clock>=180){
   d.clock-=180;d.day++;
   this.newDay(metrics);
  }
 }
 announce(text){
  this.sim.say(text);
  this.sim.pending.push({type:"toast",text});
 }
 newDay(metrics){
  const d=this.data(),s=this.sim;
  const ranked=Object.entries(ELECTION_TOPICS).map(([id,t])=>[id,t.score(metrics)]).sort((a,b)=>a[1]-b[1]);
  for(const [id,score] of ranked)d.shortages[id]=score<1?(d.shortages[id]||0)+1:0;
  if(d.term)this.checkPromises(metrics);
  if(d.protest&&d.day>=d.protest.until)d.protest=null;
  if(d.day%TERM_DAYS===25){
   const [weak]=ranked[0],name=CHALLENGERS[Math.floor(d.day/TERM_DAYS)%CHALLENGERS.length];
   d.campaign={name,weak,days:d.shortages[weak],vote:d.day+5,pledges:[]};
   this.announce(name+" ra tranh cử · Mở Sắc lệnh → Bầu cử Thị trưởng.");
  }
  if(d.day%TERM_DAYS===0){
   const broken=d.term?.missions.filter(m=>m.status==="failed").length||0;
   if(broken){
    const homes=s.world.buildings.filter(b=>CONFIG.buildings[b.id].group==="res"&&b.left<=0);
    const tile=homes[0]||s.world.buildings[0]||{x:8,y:8};
    d.protest={x:tile.x,y:tile.y,until:d.day+4,broken};
    this.announce("Cư dân biểu tình vì "+broken+" lời hứa thất hẹn ở nhiệm kỳ trước.");
   }
   this.vote(metrics);
  }
  s.storage.save();
 }
 slogan(){
  const c=this.data().campaign;
  if(!c)return "";
  const topic=ELECTION_TOPICS[c.weak],city=this.sim.profile.cityName;
  return c.days?topic.attack+" "+c.days+" ngày liền! "+city+" cần một lựa chọn mới.":
   "Đừng chủ quan: "+topic.name+" vẫn là điểm yếu nhất. "+city+" có thể làm tốt hơn!";
 }
 select(id){
  const d=this.data(),c=d.campaign;
  if(!c||!Object.hasOwn(ELECTION_TOPICS,id))return "";
  const index=c.pledges.indexOf(id);
  if(index>=0)c.pledges.splice(index,1);
  else if(c.pledges.length<2)c.pledges.push(id);
  else return "Chỉ có thể cam kết tối đa 2 lời hứa.";
  this.sim.storage.save();return "";
 }
 support(metrics){
  const c=this.data().campaign;
  if(!c)return 0;
  const weakness=clamp(ELECTION_TOPICS[c.weak].score(metrics),0,1);
  return Math.round(clamp(26+weakness*17+clamp(metrics.happiness/100,0,1)*10+c.pledges.length*9,0,90));
 }
 vote(metrics){
  const s=this.sim,d=this.data(),c=d.campaign;
  if(!c)return;
  const support=this.support(metrics),win=!!c.pledges.length&&support>=50;
  const reward=win?s.grant({coins:1500*s.profile.level,prestige:10}):"";
  d.result={day:d.day,name:c.name,support,win,reward};
  d.term=win?{deadline:d.day+27,missions:c.pledges.map(id=>{
   const t=ELECTION_TOPICS[id],base=t.value(metrics),target=id==="happiness"?Math.min(150,Math.ceil(base)+t.step):Math.ceil(base)+t.step;
   return {id,target,days:0,stage:1,status:"active"};
  })}:null;
  d.campaign=null;
  this.announce(win?"Thắng cử với "+support+"% phiếu · "+reward:"Thất cử trước "+c.name+" · Quản lý thành phố đến kỳ bầu cử tiếp theo.");
 }
 checkPromises(metrics){
  const d=this.data();
  for(const mission of d.term.missions){
   if(mission.status!=="active")continue;
   const t=ELECTION_TOPICS[mission.id],value=t.value(metrics);
   if(mission.stage===1){
    if(value>=mission.target)mission.stage=2;
   }else{
    const steady=mission.id==="happiness"?value>=mission.target:t.score(metrics)>=1&&value>=mission.target;
    mission.days=steady?mission.days+1:0;
    if(mission.days>=2){mission.status="done";this.announce("Đã giữ lời hứa: "+t.pledge+".")}
   }
   if(mission.status==="active"&&d.day>=d.term.deadline){
    mission.status="failed";this.announce("Đã quá hạn lời hứa: "+t.pledge+".");
   }
  }
 }
 draw(r){
  const site=this.data().protest;
  if(!site)return;
  const p=r.project(site.x+.5,site.y+.5),z=r.camera.zoom;
  if(!r.inView(p,45,20))return;
  r.poly(r.plate(site.x+.04,site.y+.04,site.x+.96,site.y+.96,1),"#f8a27362","#ffd4a1",1.6);
  r.ellipse(p.x,p.y+7*z,30*z,8*z,"#5d4136");
  r.text("BIỂU TÌNH",p.x,p.y+7*z,8*z,"#ffddaa");
 }
}
