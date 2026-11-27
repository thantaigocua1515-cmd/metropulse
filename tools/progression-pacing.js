"use strict";

const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {execFileSync}=require("node:child_process");
const root=path.join(__dirname,".."),ref=process.argv[2];
const files=["config","core","content","storage","simulation","crisis","progression","events"];
const js=files.map(name=>{
 const file="public/js/"+name+".js";
 return ref?execFileSync("git",["show",ref+":"+file],{cwd:root,encoding:"utf8"}):fs.readFileSync(path.join(root,file),"utf8");
}).join("\n");

let now=Date.UTC(2026,0,5,12),seed=77219;
class Clock extends Date {
 constructor(...args){super(...(args.length?args:[now]))}
 static now(){return now}
}
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
const game=vm.runInNewContext(js+"\n;({CONFIG,CONTENT,SimulationEngine,StorageManager,CrisisAndNPCManager,ProgressionManager,SeasonalEvents,lookup,unlocked,steps})",
 {Date:Clock,Math:Object.assign(Object.create(Math),{random})});
const {CONFIG,CONTENT,SimulationEngine,StorageManager,CrisisAndNPCManager,ProgressionManager,SeasonalEvents,lookup,unlocked,steps}=game;
const data=StorageManager.fresh();
data.progress.tutorial.done=true;
const sim=new SimulationEngine(data,{enabled:false,play(){}});
sim.storage=new StorageManager(sim);sim.storage.save=()=>true;
sim.social={friends:()=>[],tick(){},current:null};
sim.crisis=new CrisisAndNPCManager(sim);
sim.prog=new ProgressionManager(sim);
sim.events=new SeasonalEvents(sim);
const p=sim.profile,w=sim.world,all=Object.keys(CONFIG.buildings).filter(id=>id!=="road");
const income=["mini_mart","apartment","night_market","office_tower","tech_tower","mall","airport"];
const needs={house_small:4,apartment:3,power_plant:3,water_tower:4,solar_plant:2,park:2,construction_hq:6,waste_plant:6,tech_tower:6};
const targets={20:null,30:null,50:null,L15:null,L20:null,L25:null,allMax:null};
const project=()=>w.buildings.find(b=>b.id==="house_small");
const family=()=>all.map(id=>w.buildings.find(b=>b.id===id)).filter(Boolean);
function build(){
 const counts={};
 for(const b of w.buildings)counts[b.id]=(counts[b.id]||0)+1;
 const id=all.find(k=>CONFIG.buildings[k].unlock<=p.level&&(counts[k]||0)<1)
  ||all.find(k=>CONFIG.buildings[k].unlock<=p.level&&(counts[k]||0)<(p.level<16?Math.min(3,needs[k]||1):needs[k]||1));
 if(!id)return;
 const {gridSize:size}=w;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  if(!unlocked(w,x,y)||lookup(w,x,y))continue;
  const byRoad=steps.some(([dx,dy])=>lookup(w,x+dx,y+dy)?.id==="road");
  if(!byRoad)continue;
  if(x%3===2&&sim.build("road",x,y)==="")return;
  if(sim.build(id,x,y)==="")return;
 }
}
function improve(){
 const b=project(),list=family();
 if(b.level<10&&!b.left)sim.upgrade(b);
 for(const id of income){
  const tile=list.find(t=>t.id===id);
  if(tile?.level<10&&!tile.left)sim.upgrade(tile);
 }
 if(p.level>=16){
  if(b.level<25&&!b.upgradeReadyAt)sim.upgrade(b);
  if(b.level>=15){
   const ordered=list.filter(t=>t!==b&&t.level<25&&t.left<=0).sort((a,c)=>c.level-a.level);
   for(const tile of ordered)sim.upgrade(tile);
  }
 }
 if(b.level>=5&&!b.spec)sim.specialize(b,"a");
 for(const id of ["community","prevention","education","heroes","tax","trade","offline","invest","logistics"]){
  if(sim.tech(id)<3||id==="education"&&p.level>=22)sim.research(id);
 }
 for(const team of w.buildings.filter(t=>CONFIG.npcs[t.id]&&t.left<=0)){
  if(team.teamLevel<3)sim.crisis.teamAction(team,"upgrade");
  if(team.crew<2&&p.prestige>=10)sim.crisis.teamAction(team,"hire");
 }
}
function act(hour){
 for(const c of w.crises)sim.crisis.dispatch(c,w);
 for(const b of [...w.bubbles])sim.collect(b.uid);
 if(sim.progress.decision){
  const e=CONTENT.decisions.find(d=>d.id===sim.progress.decision.id);
   const option=e.options.findIndex(o=>sim.decisionCost(o)<=p.coins);
   if(option>=0)sim.decide(option);
 }
 if(hour%30===0){
  build();improve();
  if(sim.stats.policies===0&&p.prestige>=8&&!w.activePolicy)sim.activate("green");
  for(const q of sim.prog.chapter()?.quests||[])sim.prog.claimQuest(q.id);
  for(const q of sim.progress.daily.quests)sim.prog.claimDaily(q.id);
  sim.prog.claimDailyBonus();
  if(sim.events.def){
   sim.events.def.jobs.forEach((_,i)=>sim.events.claimQuest(i));
   sim.events.tiers.forEach((_,i)=>sim.events.claimTier(i));
  }
  if(p.level>=16)sim.collectSupplies();
 }
 sim.pending.length=0;
}
const limit=Number(process.env.MP_PACING_DAYS||400),start=now;
for(let day=1;day<=limit;day++){
 now=start+(day-1)*86400000;
 if(day>1)sim.storage.offline(now-23*3600*1000);
 sim.prog.ensureDaily();sim.prog.claimLogin();
 for(let second=0;second<3600;second+=3){
  now=start+(day-1)*86400000+second*1000;
  sim.tick(3);
  if(second%6===0)act(second);
 }
 for(const level of [20,30,50])if(p.level>=level)targets[level]??=day;
 for(const level of [15,20,25])if(project().level>=level)targets["L"+level]??=day;
 const set=family();
 if(set.length===all.length&&set.every(b=>b.level===25))targets.allMax??=day;
 if(Object.values(targets).every(Boolean))break;
}
console.log(JSON.stringify({release:ref||CONFIG.assetVersion,limit,targets,stopped:{
 mayor:p.level,families:family().length,maxed:family().filter(b=>b.level===25).length,
 coins:Math.floor(p.coins),materials:p.materials,income:Math.round(sim.metrics.income),
 remaining:family().filter(b=>b.level<25).map(b=>[b.id,b.level])
}},null,2));
