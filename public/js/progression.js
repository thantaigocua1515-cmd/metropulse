"use strict";

// Cốt truyện, nhiệm vụ ngày, điểm danh, thành tựu và danh hiệu đô thị.
class ProgressionManager {
 constructor(sim){this.sim=sim;this.queued=new Set();this.notified=new Set();this.ensureDaily()}
 get p(){return this.sim.progress}
 chapter(){return this.p.story.done?null:CONTENT.chapters[this.p.story.chapter]||null}
 questState(q){
  const [cur,goal]=q.prog(this.sim),claimed=this.p.story.claimed.includes(q.id);
  return {cur:claimed?goal:cur,goal,done:claimed||cur>=goal,claimed};
 }
 scene(key,chapter,lines,extra={}){
  if(this.queued.has(key)||this.p.story.seen.includes(key))return;
  this.queued.add(key);this.sim.pending.push({type:"scene",key,chapter:chapter.id,title:chapter.title,subtitle:chapter.subtitle,lines,...extra});
 }
 seen(key){if(!this.p.story.seen.includes(key))this.p.story.seen.push(key);this.sim.storage.save()}
 refresh(){
  const s=this.sim,chapter=this.chapter();
  s.legacy?.refresh();
  this.ensureDaily();
  if(chapter){
   this.scene(chapter.id+"_intro",chapter,chapter.intro);
   for(const q of chapter.quests){
    const state=this.questState(q);
    if(state.done&&!state.claimed&&!this.notified.has(q.id)){this.notified.add(q.id);if(s.elapsed>2)s.pending.push({type:"toast",text:"Hoàn thành nhiệm vụ: "+q.name+" — vào Nhiệm vụ để nhận thưởng!"})}
   }
  }
  const rank=CONFIG.cityRank(s.metrics.score);
  if(rank.index>this.p.rankIndex){
   this.p.rankIndex=rank.index;s.profile.prestige+=3*rank.index;s.audio.play("level");
   s.say("Bình Minh được công nhận là «"+rank.name+"»! Thị trưởng nhận "+3*rank.index+" Uy tín.");
   s.pending.push({type:"toast",text:"Danh hiệu mới: "+rank.name+" · +"+3*rank.index+" Uy tín"});
  }
 }
 claimQuest(id){
  const s=this.sim,chapter=this.chapter(),q=chapter?.quests.find(x=>x.id===id);if(!q)return "";
  const state=this.questState(q);if(!state.done||state.claimed)return "";
  this.p.story.claimed.push(id);const text=s.grant(q);s.audio.play("money");
  if(chapter.quests.every(x=>this.p.story.claimed.includes(x.id))){
   const reward=s.grant(chapter.reward);
   this.scene(chapter.id+"_outro",chapter,chapter.outro,{reward,finale:this.p.story.chapter===CONTENT.chapters.length-1});
   if(this.p.story.chapter<CONTENT.chapters.length-1)this.p.story.chapter++;else this.p.story.done=true;
   s.say("Hoàn thành "+chapter.subtitle.split(" · ")[0]+": "+chapter.title+"!");
  }
  s.storage.save();return text;
 }
 // Nhiệm vụ ngày: chọn 3 nhiệm vụ theo ngày, tiến độ tính từ mốc thống kê lúc tạo.
 ensureDaily(){
  const d=this.p.daily,date=today();if(d.date===date&&d.quests.length)return;
  const level=this.sim.profile.level,pool=CONTENT.dailyPool.filter(([id])=>!(id==="d_research"&&level<4)&&!(id==="d_decide"&&level<2)&&!(id==="d_fast"&&level<2));
  let seed=[...date].reduce((a,c)=>a*31+c.charCodeAt(0)>>>0,7);const picks=[];
  if(level>=CONTENT.operationLevel)picks.push(...CONTENT.operations);
  else while(picks.length<3&&pool.length){seed=seed*1103515245+12345>>>0;picks.push(pool.splice(seed%pool.length,1)[0])}
  d.date=date;d.bonus=false;d.quests=picks.map(([id,,key,goal])=>({id,base:this.dailyValue(key),goal:goal(level),claimed:false}));
 }
 dailyValue(key){return key==="playTime"?Math.floor(this.sim.stats.playTime/60):this.sim.stats[key]||0}
 dailyState(item){
  const [id,text,key]=CONTENT.dailyPool.find(q=>q[0]===item.id)||CONTENT.operations.find(q=>q[0]===item.id),cur=clamp(this.dailyValue(key)-item.base,0,item.goal);
  return {id,text:text.replace("{n}",item.goal),cur,goal:item.goal,done:cur>=item.goal,claimed:item.claimed};
 }
 claimDaily(id){
  const item=this.p.daily.quests.find(q=>q.id===id);if(!item||item.claimed||!this.dailyState(item).done)return "";
  item.claimed=true;this.sim.stats.dailyDone++;this.sim.audio.play("money");
  const text=this.sim.grant(CONTENT.dailyReward(this.sim.profile.level));this.sim.storage.save();return text;
 }
 dailyBonusReady(){const d=this.p.daily;return !d.bonus&&d.quests.length>0&&d.quests.every(q=>q.claimed)}
 claimDailyBonus(){
  if(!this.dailyBonusReady())return "";
  this.p.daily.bonus=true;this.sim.audio.play("level");
  const text=this.sim.grant(CONTENT.dailyBonus(this.sim.profile.level));this.sim.storage.save();return text;
 }
 // Điểm danh: chuỗi 7 ngày, lỡ một ngày thì quay lại ngày 1.
 loginState(){
  const l=this.p.login,date=today(),yesterday=new Date(Date.now()-864e5).toLocaleDateString("sv-SE");
  const available=l.lastDate!==date,streak=available?(l.lastDate===yesterday?l.streak+1:1):l.streak;
  return {available,streak,day:(Math.max(1,streak)-1)%7};
 }
 loginReward(day){
  const r=CONTENT.login[day];return {coins:r.coins?r.coins*this.sim.profile.level:0,prestige:r.prestige||0,know:r.know||0};
 }
 claimLogin(){
  const state=this.loginState();if(!state.available)return "";
  const l=this.p.login;l.streak=state.streak;l.lastDate=today();this.sim.stats.loginDays++;this.sim.audio.play("level");
  const text=this.sim.grant(this.loginReward(state.day));this.sim.storage.save();return text;
 }
 achState(a){
  const tier=this.p.achievements[a.id]||0,value=a.value(this.sim)||0,goal=a.goals[Math.min(tier,2)];
  return {tier,value,goal,complete:tier>=3,claimable:tier<3&&value>=goal,desc:a.desc.replace("{n}",fmt(goal))};
 }
 claimAchievement(id){
  const a=CONTENT.achievements.find(x=>x.id===id);if(!a)return "";
  const state=this.achState(a);if(!state.claimable)return "";
  this.p.achievements[id]=state.tier+1;this.sim.audio.play("level");
  const text=this.sim.grant(CONTENT.achievementReward(state.tier));this.sim.storage.save();return text;
 }
 badges(){
  const chapter=this.chapter(),s=this.sim;
  const story=chapter?chapter.quests.filter(q=>{const st=this.questState(q);return st.done&&!st.claimed}).length:0;
  const daily=this.p.daily.quests.filter(q=>!q.claimed&&this.dailyState(q).done).length+(this.dailyBonusReady()?1:0);
  const ach=CONTENT.achievements.filter(a=>this.achState(a).claimable).length;
  const research=CONTENT.research.all.some(t=>!s.researchBlock(t))?1:0;
  const legacy=s.legacy?.ready()||0;
  return {story,daily,ach,research,legacy,login:this.loginState().available?1:0,missions:story+daily+ach+legacy};
 }
}

class LegacyGoals {
 static families=Object.values(CONFIG.buildings).filter(d=>d.id!=="road");
 static plans=[
  {name:"Khu dân cư bền vững",jobs:[["synergyTiles",6,"Ô có lợi ích quy hoạch",true],["bubbles",9,"Túi thưởng"],["dailyDone",2,"Nhiệm vụ ngày"]]},
  {name:"Khu phố an toàn",jobs:[["happiness",120,"Mức Hạnh phúc (%)",true],["crisesSolved",5,"Sự cố xử lý"],["bubbles",7,"Túi thưởng"]]},
  {name:"Kinh tế cộng đồng",jobs:[["pop",200,"Dân số",true],["dailyDone",3,"Nhiệm vụ ngày"],["bubbles",12,"Túi thưởng"]]}
 ];
 constructor(sim){
  this.sim=sim;
  const data=this.data=sim.progress.legacy??={};
  data.mastered??={};data.familyClaims??={};data.rankClaims??={};data.round??=0;data.peakScore??=0;
  for(const b of sim.world.buildings)this.recordBuilding(b);
  this.refresh();
 }
 get unlocked(){return this.sim.profile.level>=16}
 get plan(){return LegacyGoals.plans[this.data.round%LegacyGoals.plans.length]}
 refresh(){
  if(!this.unlocked)return;
  this.data.peakScore=Math.max(this.data.peakScore,this.sim.metrics.score);
  if(!this.data.base)this.nextPlan();
 }
 nextPlan(){
  this.data.base=Object.fromEntries(this.plan.jobs.filter(([, , ,live])=>!live).map(([key])=>[key,this.sim.stats[key]||0]));
 }
 recordBuilding(b){
  if(b.id!=="road"&&b.left<=0&&b.level>=CONFIG.maxLevel)this.data.mastered[b.id]=true;
 }
 rankStates(){
  return CONFIG.heritageRanks.map(([goal,name],i)=>({
   id:String(i),name,cur:this.data.peakScore,goal,claimed:!!this.data.rankClaims[i],done:this.data.peakScore>=goal,
   reward:{coins:75000*(i+1),prestige:15*(i+1)}
  }));
 }
 familyStates(){
  return LegacyGoals.families.map(({id,name})=>({
   id,name,done:!!this.data.mastered[id],claimed:!!this.data.familyClaims[id],reward:{prestige:5}
  }));
 }
 planStates(){
  return this.plan.jobs.map(([key,goal,name,live])=>{
   const cur=live?Math.floor(this.sim.metrics[key]):(this.sim.stats[key]||0)-(this.data.base?.[key]||0);
   return {key,goal,name,cur:clamp(cur,0,goal),done:cur>=goal};
  });
 }
 get planReward(){return {coins:60000,prestige:12}}
 ready(){
  return this.unlocked?this.rankStates().concat(this.familyStates()).filter(r=>r.done&&!r.claimed).length+Number(this.planStates().every(r=>r.done)):0;
 }
 claim(type,id){
  if(!this.unlocked)return false;
  this.refresh();
  let reward;
  if(type==="plan"&&this.planStates().every(r=>r.done)){
   reward=this.planReward;this.data.round++;this.nextPlan();
  }else if(type==="rank"||type==="family"){
   const state=(type==="rank"?this.rankStates():this.familyStates()).find(r=>r.id===id);
   if(!state?.done||state.claimed)return false;
   this.data[type==="rank"?"rankClaims":"familyClaims"][id]=true;reward=state.reward;
  }
  if(!reward)return false;
  this.sim.grant(reward);this.sim.audio.play("done");this.sim.storage.save();return true;
 }
}
