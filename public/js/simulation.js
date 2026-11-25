"use strict";

class SimulationEngine {
 constructor(data,audio){
  this.audio=audio;this.profile=data.profile;this.world=makeWorld(data.world.buildings,this.profile.level,data.world);
  this.progress=data.progress;this.stats=this.progress.stats;this.particles=[];this.fx=[];this.reduceEffects=data.reduceEffects===true;this.news=[];this.pending=[];this.elapsed=0;this.storage=null;
  this.utilityXP=0;
  this.metrics=this.measure(this.world);
 }
 active(w=this.world){return w.buildings.filter(b=>b.left<=0)}
 count(id,w=this.world){let n=0;for(const b of w.buildings)if(b.id===id&&b.left<=0)n++;return n}
 tech(id){return this.progress.research[id]||0}
 buff(key,w=this.world){
  let v=key==="happy"?0:1;
  for(const b of w.buffs)if(key==="happy")v+=b.happy||0;else v*=b[key]??1;
  return v;
 }
 addBuff([name,duration,income,happy,risk,build,npc]){
  const w=this.world,same=w.buffs.find(b=>b.name===name);
  if(same){same.left=duration;return}
  w.buffs.push({name,left:duration,total:duration,income,happy,risk,build,npc});
 }
 roadChain(){
  const visited=new Set();let best=0;
  for(const b of this.active())if(b.id==="road"&&!visited.has(b)){
   const stack=[b];visited.add(b);let n=0;
   while(stack.length){const r=stack.pop();n++;for(const [dx,dy] of steps){const next=lookup(this.world,r.x+dx,r.y+dy);if(next?.id==="road"&&!visited.has(next)){visited.add(next);stack.push(next)}}}
   best=Math.max(best,n);
  }return best;
 }
 // Hiệu ứng quy hoạch của một công trình: hệ số thu nhập và ghi chú hiển thị.
 synergy(b,w=this.world){
  const d=CONFIG.buildings[b.id],notes=[];let mult=1,dirty=0;
  if(b.id==="road")return {mult,notes,dirty};
  const near=[];for(const [dx,dy] of steps){const n=lookup(w,b.x+dx,b.y+dy);if(n)near.push(n)}
  if(d.income>0&&!near.some(n=>n.id==="road")){mult*=.8;notes.push(["−20%","Chưa nối đường"])}
  if(d.group==="res"||d.group==="com"){
   let parks=0;
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const n=lookup(w,b.x+dx,b.y+dy);if(n&&n.id==="park"&&n.left<=0)parks++}
   if(parks){const bonus=Math.min(2,parks)*.1;mult*=1+bonus;notes.push(["+"+Math.round(bonus*100)+"%","Kề công viên"])}
  }
  if(d.group==="com"){
   const homes=Math.min(3,near.filter(n=>n.left<=0&&CONFIG.buildings[n.id].group==="res").length);
   if(homes){mult*=1+homes*.05;notes.push(["+"+homes*5+"%","Gần khu dân cư"])}
   if((w._metros||[]).some(m=>distance(m,b)<=2)){mult*=1.15;notes.push(["+15%","Gần Ga Metro"])}
  }
  if(d.group==="res"){
   dirty=near.filter(n=>n.left<=0&&(n.id==="power_plant"||n.id==="waste_plant")).length;
   if(dirty)notes.push(["−"+dirty*2,"Hạnh phúc: kề nguồn ô nhiễm"]);
  }
  return {mult,notes,dirty};
 }
 measure(w,level=this.profile.level){
  const mine=w===this.world,T=id=>mine?this.tech(id):0;
  const m={ps:0,pd:0,ws:0,wd:0,waste:0,pop:0,happiness:100,commerce:0,roads:0,income:0,level,construction:0,know:0,score:0,banks:0,levels:0};
  const has=id=>w.crises.some(c=>c.id===id),policy=w.activePolicy?.id,grid=1+.1*T("grid");
  w._metros=w.buildings.filter(b=>b.id==="metro_station"&&b.left<=0);
  w._airport=w.buildings.some(b=>b.id==="airport"&&b.left<=0);
  let earnings=0,wonder=false,pop=0;
  for(const b of w.buildings){
   if(b.left>0){m.construction++;continue}
   const d=CONFIG.buildings[b.id];
   if(b.id==="road"){m.roads++;continue}
   const sg=CONFIG.specGroup(b.id),out=(1+.2*(b.level-1))*grid*(sg==="infra"&&b.spec==="a"?1.4:1);
   if(d.power>0)m.ps+=d.power*out;else m.pd-=d.power;
   if(d.water>0)m.ws+=d.water*out;else m.wd-=d.water;
   m.waste+=d.waste*(d.waste>0&&policy==="festival"?2:1)*(d.waste>0&&sg==="res"&&b.spec==="b"?.5:1);
   pop+=d.pop*(1+.15*(b.level-1))*(sg==="res"&&b.spec==="a"?1.4:1);
   m.happiness+=d.happy+(b.spec==="b"?{res:3,com:4,edu:5,infra:3,special:6}[sg]||0:0);
   if(d.group==="res")m.happiness-=this.synergy(b,w).dirty*2;
   m.know+=d.know*(1+.25*(b.level-1))*(sg==="edu"&&b.spec==="a"?1.5:1);
   m.commerce+=d.group==="com"?1:0;m.levels+=b.level;m.banks+=b.id==="bank"?1:0;
   earnings+=this.production(b,w);wonder||=b.id==="metro_wonder";
  }
  m.ps=Math.round(m.ps);m.ws=Math.round(m.ws);m.pop=Math.round(pop);m.waste=Math.round(m.waste);
  const mood=m.happiness+w.happyDelta-(has("trash_pile")?10:0)-(has("flu_outbreak")?8:0)-(m.ps<m.pd?6:0)-(m.ws<m.wd?6:0)+3*T("community")+(mine?this.buff("happy",w):0);
  m.happiness=clamp(mood*(policy==="green"?1.2:1),20,150);
  const globalPenalty=Math.max(.1,w.crises.reduce((f,c)=>f*(c.id==="flu_outbreak"?.75:1),1));
  m.income=(CONFIG.baseIncome+earnings)*m.happiness/100*globalPenalty*(policy==="festival"?1.5:1)*(wonder?1.2:1)*(1+.08*T("tax"))*(mine?this.buff("income",w):1);
  m.know=mine?CONFIG.baseKnowledge+m.know:0;
  m.score=Math.round(m.pop*2+m.income*4+m.levels*10);
  return m;
 }
 production(b,w=this.world){
  if(b.left>0||w.crises.some(c=>c.id==="fire"&&distance(c,b)===0))return 0;
  if((b.id==="office_tower"||b.id==="tech_tower")&&w.crises.some(c=>c.id==="cyber_attack"))return 0;
  const d=CONFIG.buildings[b.id];if(!d.income)return 0;
  const sg=CONFIG.specGroup(b.id),calm=sg==="com"&&b.spec==="b";
  const factor=w.crises.reduce((f,c)=>f*(c.id==="blackout"&&distance(c,b)<=1?.5:c.id==="traffic_jam"&&d.group==="com"&&!calm?.7:1),1);
  let value=d.income*CONFIG.scale(b.level)*Math.max(.1,factor)*this.synergy(b,w).mult;
  if(d.group==="com")value*=(b.spec==="a"?1.35:1)*(w===this.world?1+.1*this.tech("trade"):1)*(w._airport?1.1:1);
  if(sg==="res"&&b.spec==="a")value*=1.2;
  if(sg==="special"&&b.spec==="a")value*=1.3;
  return value;
 }
 say(message){this.news.unshift(message);this.news.length=Math.min(12,this.news.length)}
 float(x,y,text,color="#d1fb8b"){this.particles.push({x,y,text,color,life:0})}
 effect(kind,details={},duration=.9){
  if(this.reduceEffects)return;
  if(this.fx.length>=24)this.fx.shift();
  this.fx.push({kind,...details,age:0,duration});
 }
 rewardEffect(resource,amount,x,y,world=this.world,lift=0){
  if(amount>0)this.effect("reward",{resource,amount,x,y,world,lift},1.05);
 }
 earn(coins){this.profile.coins+=coins;if(coins>0)this.stats.coinsEarned+=coins}
 gainXP(amount,withResearch=true){
  const p=this.profile;amount=withResearch?Math.round(amount*(1+.1*this.tech("education"))):amount;p.xp+=amount;
  while(p.xp>=CONFIG.xpNext(p.level)){
   p.xp-=CONFIG.xpNext(p.level);p.level++;p.coins+=150*p.level;p.prestige+=5;this.world.unlockedRadius=CONFIG.radius(p.level);
   this.audio.play("level");this.say("Bản tin đặc biệt: "+p.mayorName+" đã đưa thành phố lên cấp "+p.level+"!");
   this.pending.push({type:"level",level:p.level});
  }
  return amount;
 }
 grant(reward,x=null,y=null){
  const p=this.profile,parts=[];
  if(reward.coins){this.earn(reward.coins);parts.push("+"+fmt(reward.coins)+" Vàng");this.rewardEffect("coin",reward.coins,x,y)}
  if(reward.prestige){p.prestige+=reward.prestige;parts.push("+"+reward.prestige+" Uy tín");this.rewardEffect("prestige",reward.prestige,x,y)}
  if(reward.know){p.knowledge+=reward.know;parts.push("+"+reward.know+" Tri thức");this.rewardEffect("brain",reward.know,x,y)}
  if(reward.xp)parts.push("+"+this.gainXP(reward.xp)+" XP");
  if(x!==null)this.float(x,y,parts[0]||"","#ffe08f");
  return parts.join(" · ");
 }
 placement(id,x,y,existing=null){
  const w=this.world,d=CONFIG.buildings[id];
  if(!d)return "Chưa chọn bản vẽ.";
  if(!unlocked(w,x,y))return "Đất chưa mở khóa. Hãy lên cấp để mở rộng.";
  if(lookup(w,x,y))return "Ô này đã có công trình.";
  if(this.profile.level<d.unlock)return "Bản vẽ mở ở cấp "+d.unlock+".";
  if(!existing&&this.profile.coins<d.price)return "Không đủ Vàng.";
  if(w.crises.some(c=>c.id==="blackout"&&distance(c,{x,y})<=1))return "Không thể xây cạnh khu vực mất điện.";
  return "";
 }
 build(id,x,y){
  const error=this.placement(id,x,y);if(error)return error;
  const d=CONFIG.buildings[id],b=makeBuilding(id,x,y,1,d.duration);this.profile.coins-=d.price;
  this.world.buildings.push(b);this.world.index.set(coord(x,y),b);this.audio.play("build");
  if(b.left>0)this.effect("dust",{x,y},.56);
  if(b.left===0)this.finish(b);
  this.storage.save();return "";
 }
 finish(b){
  b.left=0;if(b.id==="road")this.stats.roadsBuilt++;else this.stats.buildingsBuilt++;
  const d=CONFIG.buildings[b.id],xp=d.group==="res"&&this.world.crises.some(c=>c.id==="trash_pile")?0:d.xp;
  if(xp)this.float(b.x,b.y,"+"+this.gainXP(xp)+" XP");
  if(b.id!=="road"){this.say(d.name+" đã chính thức đi vào hoạt động.");this.effect("built",{x:b.x,y:b.y},.65);this.audio.play("done")}
 }
 upgradeCost(b){return Math.ceil(CONFIG.upgradeBase(b)*(1-.06*this.tech("invest")))}
 upgradeBlock(b){
  if(b.left>0)return "Hãy chờ xây xong.";
  if(b.id==="road")return "Đường nhựa không cần nâng cấp.";
  if(b.level>=CONFIG.maxLevel)return "Công trình đã đạt cấp tối đa.";
  const gate=CONFIG.tierGate(b.level);
  if(this.profile.level<gate)return "Cần Thị trưởng cấp "+gate+" để tiến hóa lên bậc "+(gate===5?"II":"III")+".";
  return "";
 }
 upgrade(b){
  const block=this.upgradeBlock(b);if(block)return block;
  const price=this.upgradeCost(b);if(this.profile.coins<price)return "Không đủ Vàng.";
  const before=CONFIG.tier(b.level);
  this.profile.coins-=price;b.level++;this.stats.upgrades++;this.stats.maxBuildingLevel=Math.max(this.stats.maxBuildingLevel,b.level);
  if(!(CONFIG.buildings[b.id].group==="res"&&this.world.crises.some(c=>c.id==="trash_pile")))this.gainXP(20*b.level);
  if(CONFIG.tier(b.level)!==before){this.say("Tiến hóa! "+CONFIG.buildings[b.id].name+" nay đã trở thành "+CONFIG.buildingName(b)+".");this.float(b.x,b.y,"★ "+CONFIG.buildingName(b),"#ffe08f")}
  else this.float(b.x,b.y,"Cấp "+b.level);
  this.effect("upgrade",{x:b.x,y:b.y,level:b.level},.85);
  this.audio.play("upgrade");
  this.storage.save();return "";
 }
 specialize(b,choice){
  if(b.left>0||b.level<CONFIG.specLevel)return "Cần công trình đạt cấp "+CONFIG.specLevel+".";
  const group=CONFIG.specGroup(b.id);if(!group||!CONFIG.specs[group]?.[choice])return "Công trình này không có chuyên môn hóa.";
  if(b.spec)return "Công trình đã được chuyên môn hóa.";
  b.spec=choice;this.stats.specs++;this.audio.play("level");this.float(b.x,b.y,"✦ "+CONFIG.specs[group][choice][0],"#9ae4cb");this.storage.save();return "";
 }
 accelerate(b){
  if(b.left<=0)return "Công trình đã hoàn thành.";
  if(this.world.crises.some(c=>c.id==="collapse"&&distance(c,b)===0))return "Cần sửa sự cố trước khi tăng tốc.";
  if(this.profile.prestige<1)return "Cần 1 Điểm Uy tín.";
  this.profile.prestige--;this.finish(b);this.audio.play("build");this.storage.save();return "";
 }
 canAlter(b){return !this.world.crises.some(c=>distance(c,b)===0)&&!this.world.npcs.some(n=>distance(n.home,b)===0)&&!this.social?.friends().some(f=>f.world.npcs.some(n=>n.assist&&distance(n.source,b)===0))}
 dropBubble(b){this.world.bubbles=this.world.bubbles.filter(z=>z.x!==b.x||z.y!==b.y)}
 demolish(b){
  if(!this.canAlter(b))return "Không thể phá khi đang có sự cố hoặc đội đang làm nhiệm vụ.";
  this.dropBubble(b);this.profile.coins+=CONFIG.buildings[b.id].price*.5;this.world.buildings.splice(this.world.buildings.indexOf(b),1);this.world.index.delete(coord(b.x,b.y));this.audio.play("build");this.storage.save();return "";
 }
 move(b,x,y){
  if(!this.canAlter(b))return "Không thể di chuyển khi đang có sự cố hoặc đội đang làm nhiệm vụ.";
  const error=this.placement(b.id,x,y,b);if(error)return error;
  this.dropBubble(b);this.world.index.delete(coord(b.x,b.y));b.x=x;b.y=y;this.world.index.set(coord(x,y),b);this.storage.save();return "";
 }
 activate(id){
  const w=this.world,p=CONFIG.policies[id];if(w.activePolicy)return "Đang có sắc lệnh hiệu lực.";
  if(w.policyCooldowns[id]>0)return "Sắc lệnh đang hồi.";
  if(this.profile.prestige<p.cost)return "Không đủ Điểm Uy tín.";
  this.profile.prestige-=p.cost;w.activePolicy={id,left:p.duration};this.stats.policies++;this.say("Thị trưởng vừa ban hành sắc lệnh: "+p.name+".");this.audio.play("level");this.storage.save();return "";
 }
 researchBlock(tech){
  const level=this.tech(tech.id);
  if(level>=CONTENT.research.maxLevel)return "Đã đạt cấp tối đa.";
  if(tech.prev&&!this.tech(tech.prev))return "Cần nghiên cứu «"+CONTENT.research.all.find(t=>t.id===tech.prev).name+"» trước.";
  if(this.profile.knowledge<CONTENT.research.cost(tech,level))return "Chưa đủ Tri thức.";
  return "";
 }
 research(id){
  const tech=CONTENT.research.all.find(t=>t.id===id);if(!tech)return "Không tìm thấy công nghệ.";
  const block=this.researchBlock(tech);if(block)return block;
  const level=this.tech(id);this.profile.knowledge-=CONTENT.research.cost(tech,level);this.progress.research[id]=level+1;this.stats.research++;
  this.say("Viện Quy hoạch công bố: "+tech.name+" đạt cấp "+(level+1)+".");this.audio.play("level");this.storage.save();return "";
 }
 spawnBubble(){
  const w=this.world;if(w.bubbles.length>=4)return;
  const spots=w.buildings.filter(b=>b.left<=0&&CONFIG.buildings[b.id].income>0&&!w.bubbles.some(z=>z.x===b.x&&z.y===b.y)&&!w.crises.some(c=>distance(c,b)===0));
  if(!spots.length)return;
  const b=spots[Math.floor(Math.random()*spots.length)],roll=Math.random();
  w.bubbles.push({uid:uid(),x:b.x,y:b.y,kind:roll<.07&&this.profile.level>=3?"gem":roll<.3&&this.profile.level>=2?"know":"coin"});
 }
 collect(id){
  const w=this.world,z=w.bubbles.find(b=>b.uid===id);if(!z)return "";
  w.bubbles.splice(w.bubbles.indexOf(z),1);this.stats.bubbles++;this.audio.play("pickup");
  const {x,y}=z;
  if(z.kind==="gem"){this.profile.prestige++;this.rewardEffect("prestige",1,x,y,w,24);if(this.reduceEffects)this.float(x,y,"+1 Uy tín","#d1fb8b");return "Cư dân gửi thư khen: +1 Uy tín."}
  if(z.kind==="know"){const n=3+Math.round(this.profile.level/2);this.profile.knowledge+=n;this.rewardEffect("brain",n,x,y,w,24);if(this.reduceEffects)this.float(x,y,"+"+n+" Tri thức","#9ae4cb");return ""}
  const coins=Math.round(Math.max(40,this.metrics.income*12));this.earn(coins);this.rewardEffect("coin",coins,x,y,w,24);if(this.reduceEffects)this.float(x,y,"+"+fmt(coins)+" Vàng","#ffe08f");return "";
 }
 decisionCost(option){return option.coins?option.coins*100*this.profile.level:0}
 decide(index){
  const pending=this.progress.decision,event=pending&&CONTENT.decisions.find(d=>d.id===pending.id);if(!event)return "Thư đã được xử lý.";
  const option=event.options[index],coins=this.decisionCost(option);
  if(coins<0&&this.profile.coins<-coins)return "Không đủ Vàng cho lựa chọn này.";
  if(coins<0)this.profile.coins+=coins;
  const text=this.grant({coins:Math.max(0,coins),prestige:option.prestige,know:option.know&&option.know+2*this.profile.level,xp:option.xp});
  if(option.buff)this.addBuff(option.buff);
  this.stats.decisions++;this.progress.lastDecision=event.id;this.progress.decision=null;this.world.decisionClock=0;
  this.say(CONTENT.cast[event.who].name+": «"+option.label+"» — quyết định của Thị trưởng đã được thông qua.");this.audio.play("money");this.storage.save();
  return [text,option.buff?"Hiệu ứng: "+option.buff[0]:""].filter(Boolean).join(" · ")||"Đã quyết định.";
 }
 tick(dt){
  const w=this.world;this.elapsed+=dt;this.stats.playTime+=dt;w.timeOfDay=(w.timeOfDay+dt/180)%1;w.weatherClock+=dt;
  if(w.weatherClock>=90){
   w.weatherClock-=90;const order=["sunny","heat","storm"];w.weather=order[(order.indexOf(w.weather)+1)%3];
   this.say({storm:"Mưa bão đang thử thách hệ thống lưới điện.",heat:"Nắng gắt! Cư dân nhắc nhau để ý đường ống và nguồn nhiệt.",sunny:"Trời quang, phố phường lại rộn ràng."}[w.weather]);
  }
  for(const id of Object.keys(w.policyCooldowns))w.policyCooldowns[id]=Math.max(0,w.policyCooldowns[id]-dt);
  if(w.activePolicy&&(w.activePolicy.left-=dt)<=0){w.policyCooldowns[w.activePolicy.id]=CONFIG.policies[w.activePolicy.id].cooldown;w.activePolicy=null}
  for(const b of w.buffs)b.left-=dt;
  if(w.buffs.some(b=>b.left<=0))w.buffs=w.buffs.filter(b=>b.left>0);
  w.speedBuff=Math.max(0,w.speedBuff-dt);w.immunity=Math.max(0,w.immunity-dt);
  if(!w.crises.some(c=>c.id==="water_leak"))w.happyDelta-=Math.sign(w.happyDelta)*Math.min(Math.abs(w.happyDelta),dt*.035);
  const speed=(this.count("construction_hq")?.9:1)*(w.activePolicy?.id==="overtime"?.65:1)*(1-.1*this.tech("construct"))*this.buff("build");
  for(const b of w.buildings){
   if(b.left<=0){b.age+=dt;continue}
   if(w.crises.some(c=>c.id==="collapse"&&distance(c,b)===0))continue;
   b.left-=dt/speed;if(b.left<=0)this.finish(b);
  }
  const m=this.metrics=this.measure(w),p=this.profile;
  p.coins+=m.income*dt;p.knowledge+=m.know*dt;p.happiness=m.happiness;
  this.stats.peakIncome=Math.max(this.stats.peakIncome,m.income);this.stats.peakPop=Math.max(this.stats.peakPop,m.pop);
  if(!this.stats.news500&&m.income>=500){this.stats.news500=true;this.say(p.mayorName+" vừa vượt mốc 500 Vàng/giây!")}
  const guided=this.progress.tutorial.done;
  if(guided&&p.level===CONFIG.utilityXP.level&&m.ps>=m.pd&&m.ws>=m.wd){
   this.utilityXP+=dt*CONFIG.utilityXP.perSecond;
   const earned=Math.floor(this.utilityXP);
   if(earned){this.utilityXP-=earned;this.gainXP(earned,false)}
  }
  if(guided&&(w.bubbleClock+=dt)>=CONFIG.bubbleInterval){w.bubbleClock=0;this.spawnBubble()}
  if(guided&&!this.progress.decision&&p.level>=2&&(w.decisionClock+=dt)>=CONFIG.decisionInterval){
   w.decisionClock=0;const pool=CONTENT.decisions.filter(d=>d.id!==this.progress.lastDecision),event=pool[Math.floor(Math.random()*pool.length)];
   this.progress.decision={id:event.id};this.say("Thư mới gửi Thị trưởng: "+event.title+".");this.audio.play("mail");
  }
  this.crisis.tickOwn(dt);this.social.tick(dt);
  this.particles=this.particles.filter(q=>(q.life+=dt)<1.45);
  if(this.fx.length)this.fx=this.reduceEffects?[]:this.fx.filter(q=>(q.age+=dt)<q.duration);
 }
 start(renderer,ui){
  let last=performance.now(),hud=1,save=0,mission=1;
  const frame=now=>{
   const dt=clamp((now-last)/1000,0,.1);last=now;this.tick(dt);renderer.render(dt);
   hud+=dt;save+=dt;mission+=dt;if(mission>=.8){this.prog.refresh();mission=0}if(hud>=.18){ui.refresh();hud=0}if(save>=5){this.storage.save();save=0}
   requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
 }
}
