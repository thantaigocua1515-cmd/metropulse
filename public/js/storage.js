"use strict";

class StorageManager {
 static freshProgress(){
  return {
   stats:{crisesSolved:0,buildingsBuilt:0,roadsBuilt:0,peakIncome:0,peakPop:0,npcLevel:1,policies:0,news500:false,upgrades:0,maxBuildingLevel:1,coinsEarned:0,bubbles:0,
    research:0,specs:0,bestCombo:0,fastSolves:0,decisions:0,hires:0,helps:0,dailyDone:0,loginDays:0,playTime:0},
   story:{chapter:0,claimed:[],seen:[],done:false},tutorial:{step:0,done:false},daily:{date:"",quests:[],bonus:false},
   login:{lastDate:"",streak:0},achievements:{},research:{},decision:null,lastDecision:"",rankIndex:0
  };
 }
 static fresh(){
  const buildings=[];
  for(let x=5;x<=10;x++)buildings.push(makeBuilding("road",x,7));
  for(let y=5;y<=10;y++)if(y!==7)buildings.push(makeBuilding("road",8,y));
  buildings.push(makeBuilding("house_small",7,8),makeBuilding("power_plant",6,6),makeBuilding("water_tower",9,8));
  return {
   version:2,
   profile:{mayorId:"MP-"+Math.floor(1000+Math.random()*9000),mayorName:"Thị trưởng Mới",cityName:"Bình Minh",avatar:CONFIG.avatars.fallback,level:1,xp:0,coins:CONFIG.starterCoins,prestige:10,knowledge:0,happiness:100,combo:0,helpsGiven:0,dailyHelpsLeft:5,lastHelpResetDate:today()},
   world:makeWorld(buildings),progress:this.freshProgress(),friends:[],lastSavedAt:0,sound:true,musicEnabled:true,musicVolume:.35
  };
 }
 // Kiểm tra và chuẩn hóa một bản lưu (từ trình duyệt hoặc máy chủ). Trả về null nếu không hợp lệ.
 static normalize(val){
  const fallback=this.fresh();
  try{
   if(!val||!val.profile||!Number.isFinite(val.profile.coins)||!Number.isFinite(val.profile.xp)||!Number.isSafeInteger(val.profile.level)||val.profile.level<1||val.profile.level>100000||
      !Array.isArray(val.world?.buildings)||val.world.buildings.length>256||val.world.buildings.some(b=>!Object.hasOwn(CONFIG.buildings,b?.id)||!Number.isInteger(b.x)||!Number.isInteger(b.y)||!inside(b.x,b.y)))return null;
   const base=fallback.progress,legacy=val.milestones,source=val.progress||{};
   const progress={...base,...source,
    stats:{...base.stats,...legacy?.stats,...source.stats},story:{...base.story,...source.story},tutorial:{...base.tutorial,...source.tutorial},
    daily:{...base.daily,...source.daily},login:{...base.login,...source.login},achievements:{...source.achievements},research:{...source.research}};
   if(legacy&&!val.progress){
    progress.tutorial.done=true;
    progress.stats.maxBuildingLevel=Math.max(1,...val.world.buildings.map(b=>b.level||1));
   }
   for(const key of ["claimed","seen"])if(!Array.isArray(progress.story[key]))progress.story[key]=[];
   if(!Array.isArray(progress.daily.quests))progress.daily.quests=[];
   const world=makeWorld(val.world.buildings,val.profile.level,val.world);
   for(const key of ["buffs","bubbles","npcs","crises"])if(!Array.isArray(world[key]))world[key]=[];
   const profile={...fallback.profile,...val.profile};
   if(!Number.isFinite(profile.knowledge))profile.knowledge=0;
   if(!CONFIG.avatars.pick.includes(profile.avatar))profile.avatar=CONFIG.avatars.fallback;
   return {...fallback,...val,version:2,profile,world,progress,friends:Array.isArray(val.friends)?val.friends:[],milestones:undefined};
  }catch(_){return null}
 }
 static load(){
  try{
   const raw=localStorage.getItem(CONFIG.key)||localStorage.getItem(CONFIG.legacyKey);
   const data=raw&&this.normalize(JSON.parse(raw));
   if(data)return {...data,restored:true};
  }catch(_){}
  return this.fresh();
 }
 constructor(sim){this.sim=sim;this.available=true;this.erasing=false}
 serialize(){
  const {profile,world,progress,social,audio,reduceEffects}=this.sim;
  return JSON.parse(JSON.stringify({version:2,profile,world,progress,friends:social.friends(),lastSavedAt:Date.now(),sound:audio.enabled,musicEnabled:audio.musicEnabled,musicVolume:audio.musicVolume,reduceEffects},
   (key,value)=>key==="index"||key==="_metros"||key==="_airport"?undefined:value));
 }
 save(){
  if(this.erasing)return true;
  try{
   localStorage.setItem(CONFIG.key,JSON.stringify(this.serialize()));
   this.available=true;this.sim.cloud?.queue();return true;
  }catch(_){this.available=false;this.sim.cloud?.queue();return false}
 }
 offlineCap(){return (8+this.sim.tech("offline")+Math.min(2,this.sim.metrics.banks))*3600}
 offline(lastSavedAt){
  if(!Number.isFinite(lastSavedAt)||lastSavedAt<=0)return null;
  const {sim}=this,cap=this.offlineCap(),rate=.6+.05*sim.tech("offline");
  const seconds=Math.min((Date.now()-lastSavedAt)/1000,cap);if(seconds<60)return null;
  const m=sim.measure(sim.world),coins=Math.max(0,Math.floor(m.income*seconds*rate)),know=Math.floor(m.know*seconds*.5);
  sim.profile.coins+=coins;sim.profile.knowledge+=know;this.save();return {coins,know,seconds,cap,rate};
 }
 async reset(){
  try{
   this.erasing=true;localStorage.removeItem(CONFIG.key);localStorage.removeItem(CONFIG.legacyKey);
   await this.sim.cloud?.wipe();location.reload();return true;
  }catch(_){this.erasing=false;return false}
 }
}
