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
  this.queued.add(key);this.sim.pending.push({type:"scene",key,title:chapter.title,subtitle:chapter.subtitle,lines,...extra});
 }
 seen(key){if(!this.p.story.seen.includes(key))this.p.story.seen.push(key);this.sim.storage.save()}
 refresh(){
  const s=this.sim,chapter=this.chapter();
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
  while(picks.length<3&&pool.length){seed=seed*1103515245+12345>>>0;picks.push(pool.splice(seed%pool.length,1)[0])}
  d.date=date;d.bonus=false;d.quests=picks.map(([id,,key,goal])=>({id,base:this.sim.stats[key]||0,goal:goal(level),claimed:false}));
 }
 dailyState(item){
  const [id,text,key]=CONTENT.dailyPool.find(q=>q[0]===item.id),cur=clamp((this.sim.stats[key]||0)-item.base,0,item.goal);
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
  return {story,daily,ach,research,login:this.loginState().available?1:0,missions:story+daily+ach};
 }
}
