"use strict";
class CrisisAndNPCManager {
 constructor(sim){this.sim=sim}
 candidates(w,m){
  const live=w.buildings.filter(b=>b.left<=0&&b.id!=="road"),work=w.buildings.filter(b=>b.left>0);
  const homes=live.filter(b=>CONFIG.buildings[b.id].group==="res"),commercial=live.filter(b=>CONFIG.buildings[b.id].group==="com");
  const industry=live.filter(b=>CONFIG.buildings[b.id].group==="com"||["power_plant","waste_plant","tech_tower","trade_port"].includes(b.id));
  const net=live.filter(b=>["office_tower","tech_tower"].includes(b.id));
  const sunny=w.weather==="heat",storm=w.weather==="storm",p=w.activePolicy?.id;
  const supply=id=>this.sim.count(id,w)>0,mine=w===this.sim.world,T=id=>mine?this.sim.tech(id):0;
  const stable=Math.max(.5,.8**w.buildings.filter(b=>b.spec==="b"&&b.left<=0&&CONFIG.specGroup(b.id)==="infra").length);
  const guard=id=>w.buildings.some(b=>b.id===CONFIG.crises[id].hq&&b.left<=0&&b.spec==="b")?.7:1;
  const general=(p==="green"?.5:1)*(mine?(1-.08*T("prevention"))*this.sim.buff("risk",w):1);
  return [
   ["blackout",(m.ps<m.pd?.37:0)+(storm?.22:0),live.filter(b=>CONFIG.buildings[b.id].power<0), (p==="overtime"?1.25:1)*(supply("solar_plant")||supply("wind_farm")?.55:1)*stable],
   ["water_leak",(m.ws<m.wd?.37:0)+(sunny?.25:0),live.filter(b=>CONFIG.buildings[b.id].water<0),stable],
   ["collapse",work.length?.15+Math.min(.14,work.length*.035)+(storm?.18:0)+(p==="overtime"?.1:0):0,work,p==="overtime"?1.25:1],
   ["traffic_jam",m.commerce>=2&&m.roads/Math.max(1,live.length)<.9?.31:0,w.buildings.filter(b=>b.id==="road"&&commercial.some(c=>distance(c,b)<=1)).concat(commercial),(supply("police_station")?.65:1)*(supply("metro_station")?.5:1)*(1-.2*T("smartroad"))],
   ["fire",(industry.some(b=>b.age>45)?.17:0)+(sunny?.21:0),industry.length?industry:live,supply("fire_station")?.63:1],
   ["trash_pile",m.pop>=40&&m.waste>15?.34:0,homes,1],
   ["flu_outbreak",m.level>=5&&!w.immunity&&(m.happiness<85||m.waste>15)?.26:0,homes,supply("hospital")?.55:1],
   ["cyber_attack",net.length&&m.level>=7?.24:0,net,supply("cyber_hub")?.65:1]
  ].map(([id,risk,targets,factor])=>({id,risk:risk*factor*guard(id)*general,targets}));
 }
 spawn(w,id,target,notify){
  if(!target||w.crises.some(c=>distance(c,target)===0))return false;
  const c={id,uid:uid(),x:target.x,y:target.y,age:0,progress:0,spread:false,late:false};
  w.crises.push(c);if(notify){this.sim.say(CONFIG.crises[id].news);this.sim.audio.play("alarm");this.sim.storage?.save()}return true;
 }
 roll(w,m){
  if(w.crises.length>=(m.level>=10?4:3)||w.buildings.filter(b=>b.id!=="road").length<3)return;
  const choices=this.candidates(w,m).filter(z=>z.risk>0&&m.level>=CONFIG.buildings[CONFIG.crises[z.id].hq].unlock&&!w.crises.some(c=>c.id===z.id));
  for(const z of choices.sort((a,b)=>b.risk-a.risk)){
   const roll=Math.random();
   if(roll>=z.risk)continue;
   const options=z.targets.filter(b=>!w.crises.some(c=>distance(c,b)===0));
   const target=options[Math.floor(Math.random()*options.length)];
   const coverage=target&&(z.id==="fire"||z.id==="traffic_jam")?Districts.coverage(target,w,undefined,z.id)[0]:null;
   if(coverage&&roll>=z.risk*(1+coverage.value/100))continue;
   if(this.spawn(w,z.id,target,true))break;
  }
 }
 friendRoll(friend,initial=false){
  const w=friend.world,m=this.sim.measure(w,friend.level);
  const goal=initial&&friend.level<=6?1:2;
  const relaxed=[{id:"blackout",targets:w.buildings.filter(b=>b.id!=="road"&&b.id!=="power_plant")},{id:"water_leak",targets:w.buildings.filter(b=>b.id!=="road"&&b.id!=="water_tower")}];
  const variants=this.candidates(w,m).filter(z=>z.risk>0&&CONFIG.buildings[CONFIG.crises[z.id].hq].unlock<=friend.level).concat(relaxed);
  const order=initial?[relaxed[friend.level%2],...variants.filter(z=>z.id!==relaxed[friend.level%2].id)]:variants.sort((a,b)=>String(a.id).localeCompare(b.id));
  const start=initial?0:Math.floor(Math.random()*order.length);
  for(let i=0;i<order.length&&w.crises.length<goal;i++){
   const z=order[(i+start)%order.length];if(w.crises.some(c=>c.id===z.id))continue;
   const options=z.targets.filter(b=>!w.crises.some(c=>distance(c,b)===0));
   this.spawn(w,z.id,options[Math.floor(Math.random()*options.length)],false);
  }
 }
 teams(hq){return this.sim.active().filter(b=>b.id===hq)}
 busy(b){
  return this.sim.world.npcs.filter(n=>distance(n.home,b)===0).length+
   this.sim.social.friends().reduce((sum,f)=>sum+f.world.npcs.filter(n=>n.assist&&distance(n.source,b)===0).length,0);
 }
 dispatch(c,w,friend=null){
  const s=this.sim,d=CONFIG.crises[c.id];if(!w.crises.includes(c))return "Sự cố đã được xử lý.";
  if(w.npcs.some(n=>n.target===c.uid&&n.phase!=="return"))return "Đội đang xử lý sự cố này.";
  if(friend){s.social.resetQuota();if(s.profile.dailyHelpsLeft<=0)return "Đã hết 5 lượt chi viện hôm nay."}
  const all=this.teams(d.hq),free=all.filter(b=>this.busy(b)<b.crew);
  if(!all.length)return "Cần xây "+CONFIG.buildings[d.hq].name+" để điều phối "+d.npc+"!";
  if(!free.length)return "Tất cả nhân sự của đội đang làm nhiệm vụ.";
  const homes=friend?[
   ...w.buildings.filter(b=>b.id===d.hq&&b.left<=0),
   ...w.buildings.filter(b=>b.id==="road"&&steps.filter(([dx,dy])=>lookup(w,b.x+dx,b.y+dy)?.id==="road").length===1),
   ...w.buildings.filter(b=>b.id==="road")
  ]:free;
  let routes=homes.map(home=>({home,route:Pathfinding.route(w,home,c)})).filter(p=>p.route);
  if(friend&&!routes.length){
   const entry=w.buildings.filter(b=>b.id!=="road"&&distance(b,c)>0).filter(b=>steps.some(([dx,dy])=>unlocked(w,b.x+dx,b.y+dy)&&!lookup(w,b.x+dx,b.y+dy)));
   routes=entry.map(home=>({home,route:Pathfinding.route(w,home,c)})).filter(p=>p.route);
  }
  if(!routes.length)return "Không có lối đến sự cố. Hãy mở đường hoặc di chuyển công trình.";
  if(friend&&routes.some(r=>r.home.id===d.hq))routes=routes.filter(r=>r.home.id===d.hq);
  else if(friend&&routes.some(r=>distance(r.home,c)>1))routes=routes.filter(r=>distance(r.home,c)>1);
  routes.sort((a,b)=>a.route.cost-b.route.cost||distance(a.home,c)-distance(b.home,c));
  const {home,route}=routes[0],source=friend?free.sort((a,b)=>b.teamLevel-a.teamLevel)[0]:home;
  w.npcs.push({type:d.hq,assist:!!friend,source:{x:source.x,y:source.y},home:{x:home.x,y:home.y},level:source.teamLevel,target:c.uid,boost:source.spec==="a"?1.25:1,rank:CONFIG.rank(source.missions)[2],
   routing:source.skills?.routing||0,fieldwork:source.skills?.fieldwork||0,
   phase:"out",path:route.path,segment:0,part:0,x:home.x,y:home.y,repair:0});
  if(friend)s.profile.dailyHelpsLeft--;
  s.storage.save();return route.offroad?"Đã điều phối · Thiếu đường nối, đội di chuyển chậm.":"Đã điều phối "+d.npc+".";
 }
 teamAction(b,what){
  const s=this.sim;
  if(!CONFIG.npcs[b.id]||b.left>0)return "Trụ sở chưa hoạt động.";
  if(what==="hire"){
   if(b.crew>=3)return "Đội đã đủ 3 người.";
   const cost=b.crew+1;if(s.profile.prestige<cost)return "Không đủ Điểm Uy tín.";
   s.profile.prestige-=cost;b.crew++;
  }else{
   if(b.teamLevel>=5)return "Phương tiện đã đạt cấp tối đa.";
   const cost=250*b.teamLevel**1.4;if(s.profile.coins<Math.ceil(cost))return "Không đủ Vàng.";
   s.profile.coins-=Math.ceil(cost);b.teamLevel++;s.stats.npcLevel=Math.max(s.stats.npcLevel,b.teamLevel);
  }if(what==="hire")s.stats.hires++;s.audio.play("level");s.storage.save();return "";
 }
 skillState(b,id){
  const s=this.sim,{mayor,missions}=CONFIG.specialist,level=b.skills?.[id]||0,goal=missions[level],materials={chip:level+1},prestige=4+level*3;
  const block=!CONFIG.npcs[b.id]||b.left>0?"Trụ sở chưa hoạt động.":!goal?"Đã đạt cấp tối đa.":s.profile.level<mayor?"Cần Thị trưởng cấp "+mayor+".":b.missions<goal?"Cần hoàn thành "+goal+" ca điều phối.":s.profile.prestige<prestige?"Không đủ Uy tín.":!s.hasMaterials(materials)?"Không đủ vật liệu.":"";
  return {level,goal,materials,prestige,block};
 }
 train(b,id){
  if(!Object.hasOwn(CONFIG.specialist.skills,id))return "Không tìm thấy kỹ năng.";
  const {level,materials,prestige,block}=this.skillState(b,id);if(block)return block;
  const s=this.sim,skills=b.skills??={};
  skills[id]=level+1;s.profile.prestige-=prestige;s.spendMaterials(materials);
  s.audio.play("level");s.storage.save();return "";
 }
 resolve(c,w,friend,n=null){
  const s=this.sim,p=s.profile,d=CONFIG.crises[c.id],hero=1+.15*s.tech("heroes");
  const squad=n&&lookup(s.world,n.source.x,n.source.y);if(squad&&squad.id===n.type)squad.missions++;
  w.crises.splice(w.crises.indexOf(c),1);
  let xp=Math.round(d.xp*hero),coins=friend?0:Math.round((d.coins+s.metrics.income*8)*hero),rep=d.prestige;
  if(friend){
   const factor=s.count("trade_port")?1.25:1;
   xp=40*factor;coins=250*friend.level*factor;rep=2*factor;p.helpsGiven++;s.stats.helps++;s.cloud?.assist(friend);
   s.say("Đội chi viện đã giúp "+friend.name+" xử lý "+d.name.toLowerCase()+"!");
  }else{
   if(!c.late){p.combo++;s.stats.fastSolves++;s.stats.bestCombo=Math.max(s.stats.bestCombo,p.combo);if(p.combo%3===0)rep++;if(p.combo>=3)xp=Math.round(xp*1.2)}
   const b=lookup(w,c.x,c.y);
   if(c.id==="water_leak")w.happyDelta=Math.min(50,w.happyDelta+8);
   if(c.id==="collapse"&&b){if(c.late)p.coins-=CONFIG.buildings[b.id].price*.1;b.left*=.8}
   if(c.id==="traffic_jam")w.speedBuff=30;
   if(c.id==="flu_outbreak")w.immunity=180;
   s.stats.crisesSolved++;s.say(d.name+" đã được xử lý."+(!c.late&&p.combo>=2?" Chuỗi phản ứng nhanh ×"+p.combo+"!":""));
  }
  xp=s.gainXP(xp);s.earn(coins);p.prestige+=rep;s.audio.play("repair");
  if(!friend||s.social.current===friend){
   s.effect("repair",{x:c.x,y:c.y,world:w},.82);
   s.rewardEffect("coin",coins,c.x,c.y,w);
   s.rewardEffect("prestige",rep,c.x,c.y,w);
   const first=s.particles.length;s.float(c.x,c.y,"+"+xp+" XP");if(coins)s.float(c.x+.18,c.y+.7,"+"+fmt(coins)+" Vàng","#ffe08f");
   for(let i=first;i<s.particles.length;i++)s.particles[i].world=w;
  }
  s.storage.save();
 }
 reRoute(n,w,c){
  const point=n.path[n.segment],next=Pathfinding.route(w,point,n.phase==="return"?n.home:c);
  if(!next)return false;n.path=next.path;n.segment=0;n.part=0;n.x=point.x;n.y=point.y;return true;
 }
 advance(n,w,dt,c){
  let budget=dt,attempts=0;
  while(budget>1e-6&&n.segment<n.path.length-1&&attempts++<6){
   const a=n.path[n.segment],b=n.path[n.segment+1],tile=lookup(w,b.x,b.y),end=n.segment===n.path.length-2;
   if(!end&&tile&&tile.id!=="road"){
    if(!this.reRoute(n,w,c))n.blocked=true;
    else n.blocked=false;
    return;
   }
   n.blocked=false;
   const jam=w.crises.some(z=>z.id==="traffic_jam"&&distance(z,b)===0&&n.target!==z.uid);
   const s=this.sim,speed=CONFIG.vehicles[n.level-1].speed*(tile&&(tile.id==="road"||end)?1:.3+.12*s.tech("smartroad"))*(jam?.4:1)*(s.world.speedBuff>0?1.25:1)*(n.boost||1)*(1+.1*s.tech("logistics"))*(1+.08*(n.routing||0))*s.buff("npc");
   const used=Math.min(budget,(1-n.part)/speed);budget-=used;n.part+=used*speed;
   n.x=a.x+(b.x-a.x)*n.part;n.y=a.y+(b.y-a.y)*n.part;
   if(n.part>=1-1e-6){n.segment++;n.part=0;n.x=b.x;n.y=b.y}
  }
 }
 tickWorld(w,dt,friend=null){
  for(const c of [...w.crises]){
   const d=CONFIG.crises[c.id],before=c.age;c.age+=dt;
   if(!c.late&&c.age>=d.danger){c.late=true;if(!friend)this.sim.profile.combo=0}
   if(!friend&&c.id==="water_leak"&&Math.floor(before/5)!==Math.floor(c.age/5))w.happyDelta=Math.max(-130,w.happyDelta-2);
   if(c.id==="fire"&&!c.spread&&c.age>=45&&w.crises.length<3){
    c.spread=true;
    const adjacent=steps.map(([dx,dy])=>lookup(w,c.x+dx,c.y+dy)).filter(b=>b&&b.id!=="road"&&!w.crises.some(z=>distance(z,b)===0));
    if(adjacent.length&&Math.random()<.72)this.spawn(w,"fire",adjacent[Math.floor(Math.random()*adjacent.length)],!friend);
   }
  }
  for(const n of [...w.npcs]){
   const c=w.crises.find(c=>c.uid===n.target);
   if(n.phase==="out"&&c){
    this.advance(n,w,dt,c);
    if(n.segment===n.path.length-1)n.phase="repair";
   }else if(n.phase==="repair"&&c){
    n.repair+=dt*(1+.1*(n.fieldwork||0));c.progress=clamp(n.repair/(CONFIG.vehicles[n.level-1].repair*(n.rank||1)/(n.boost||1)),0,1);
    if(c.progress>=1){
     n.phase="return";const route=Pathfinding.route(w,c,n.home);n.path=route?.path||[{x:c.x,y:c.y}];n.segment=0;n.part=0;
     this.resolve(c,w,friend,n);
    }
   }else if(n.phase==="return"){
    if(n.path.length===1&&distance(n,n.home)>0){n.blocked=!this.reRoute(n,w,null);continue}
    this.advance(n,w,dt,null);
    if(n.segment===n.path.length-1)w.npcs.splice(w.npcs.indexOf(n),1);
   }else w.npcs.splice(w.npcs.indexOf(n),1);
  }
 }
 tickOwn(dt){
  const {world:w,metrics:m}=this.sim;
  if(this.sim.progress.tutorial.done&&(w.crisisClock+=dt)>=CONFIG.crisisInterval){w.crisisClock-=CONFIG.crisisInterval;this.roll(w,m)}
  this.tickWorld(w,dt);
 }
}
