"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

// node tools/balance-sim.js [--seed=42] [--session=60] [--days=14] [--date=2026-01-12] [--json]
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.slice(2).split("=")));
const seed=Number(args.seed??42),session=Number(args.session??60)*60,days=Number(args.days??14);
if(!Number.isSafeInteger(seed)||!Number.isInteger(session)||session<0||session>=86400||!Number.isInteger(days)||days<1)
 throw new Error("Use an integer seed, 0 (continuous) or <1440 session minutes, and positive days.");
let random=seed>>>0,now=Date.parse((args.date??"2026-01-12")+"T12:00:00+07:00");
if(!Number.isFinite(now))throw new Error("Use --date=YYYY-MM-DD.");
const math=Object.create(Math);
math.random=()=>{random=(Math.imul(1664525,random)+1013904223)>>>0;return random/2**32};
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
const context=vm.createContext({Math:math,Date:Clock,TextEncoder,TextDecoder,btoa,atob});
for(const file of ["config","content","core","simulation","crisis","social","storage","progression","tutorial","events"])
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../public/js",file+".js"),"utf8"),context,{filename:file+".js"});
const simulate=vm.runInContext(`(advance, session, days) => {
 const s=new SimulationEngine(StorageManager.fresh(),{play(){},enabled:false}),w=s.world,p=s.profile;
 s.storage=new StorageManager(s);s.storage.save=()=>true;
 s.crisis=new CrisisAndNPCManager(s);s.social=new SocialManager(s,[]);s.prog=new ProgressionManager(s);
 s.events=new SeasonalEvents(s);s.legacy=new LegacyGoals(s);
 const tutorial=new TutorialManager(s,{nodes:{coach:{hidden:true}},pinCommands(){},setTool(){},toast(){}});
 let time=0,wall=0,nextPlan=0,nextSupport=0,idle=null,previous=p.level;
 const levels=[],economy=[],stretches=[],cheap={},actions={},offline=[],events={};
 const snapshot=()=>({level:p.level,active:time,wall,gold:Math.floor(p.coins),prestige:Math.floor(p.prestige),
  knowledge:Math.floor(p.knowledge),income:+s.metrics.income.toFixed(1),xp:p.xp,synergyTiles:s.metrics.synergyTiles});
 const start=snapshot();
 const tick=()=>{s.tick(1);advance(1);time++;wall++;s.pending.length=0};
 const observe=()=>{if(p.level!==previous){levels.push(snapshot());previous=p.level}};
 const tracked=(key,price,delta,repeatable)=>{
  actions[key]=(actions[key]||0)+1;
  if(price<=s.metrics.income*5&&(!repeatable||!delta||price<=delta*90)){
   const a=cheap[key]??={count:0,first:snapshot(),price};a.count++;
  }
 };
 const build=(id,t)=>{if(s.build(id,t.x,t.y))return false;
  const d=CONFIG.buildings[id];tracked(id,d.price,d.income,id!=="road"&&d.income>0);return true};
 // The visual UI walkthrough is tested separately. Here perform its real city
 // operations, with a few seconds for each prompt, and reuse its staged incident/reward.
 s.prog.seen("c1_intro");
 for(let i=0;i<12;i++)tick();
 build("house_small",tutorial.freeTile());for(let i=0;i<8;i++)tick();
 build("road",{x:5,y:6});build("road",{x:5,y:5});tutorial.stage();
 for(const crisis of w.crises)s.crisis.dispatch(crisis,w);
 for(let i=0;i<65&&w.crises.length;i++)tick();
 tutorial.coin();if(w.bubbles.length)s.collect(w.bubbles[0].uid);
 tutorial.finish();observe();
 const early={house_small:3,mini_mart:1,apartment:1,fire_station:1,police_station:1,school:1,night_market:1,park:1,
  construction_hq:1,hospital:1,waste_plant:1,office_tower:1,solar_plant:1,cyber_hub:1,metro_station:1,
  tech_tower:1,university:1,trade_port:1,wind_farm:1,metro_wonder:1,stadium:1,museum:1,airport:1};
 const roadsNear=(x,y)=>steps.filter(([dx,dy])=>lookup(w,x+dx,y+dy)?.id==="road").length;
 const corridor=t=>t.x%4===0||t.y%4===3;
 const vacant=()=>{const out=[];for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(!unlocked(w,x,y)||lookup(w,x,y))continue;
  if(w.crises.some(c=>c.id==="blackout"&&distance(c,{x,y})<=1))continue;
  out.push({x,y,roads:roadsNear(x,y),center:Math.abs(x-7.5)+Math.abs(y-7.5)});
 }return out};
 const has=id=>w.buildings.filter(b=>b.id===id).length;
 const plan=()=>{
  const m=s.metrics,tiles=vacant(),frontier=tiles.filter(t=>t.roads),roadTiles=frontier.filter(t=>!corridor(t)),candidates=[];
  const vacantKeys=new Set(tiles.map(t=>coord(t.x,t.y)));
  const add=(id,score,test=()=>true)=>{
   const d=CONFIG.buildings[id];if(p.level<d.unlock)return;
   const options=roadTiles.filter(test);if(!options.length||m.construction>=2)return;
   const risk=t=>d.group==="res"&&steps.some(([dx,dy])=>["power_plant","waste_plant"].includes(lookup(w,t.x+dx,t.y+dy)?.id))?50:0;
   const nearby=t=>Districts.effects({id,x:t.x,y:t.y},w).filter(e=>e.value>0&&e.id!=="customers").length;
   const slot=options.map(t=>({...t,pref:risk(t)+t.center+.2*t.roads-.25*nearby(t)})).sort((a,b)=>a.pref-b.pref)[0];
   candidates.push({price:d.price,score,run:()=>build(id,slot)});
  };
  const growth=p.level<5?4:p.level<10?7:10;
  for(const [id,n] of Object.entries(early))if(has(id)<n)add(id,70+(id==="house_small"?15:0)-CONFIG.buildings[id].unlock*2);
  const power= m.ps-m.pd,water=m.ws-m.wd;
  if(power<8&&w.buildings.filter(b=>b.left>0&&CONFIG.buildings[b.id].power>0).length===0)
   add(p.level>=11?"wind_farm":p.level>=7?"solar_plant":"power_plant",96);
  if(water<7&&!w.buildings.some(b=>b.left>0&&b.id==="water_tower"))add("water_tower",99);
  if(m.waste>15&&p.level>=5&&!w.buildings.some(b=>b.left>0&&CONFIG.buildings[b.id].waste<0))
   add(p.level>=6?"waste_plant":"park",91);
  const best=Object.values(CONFIG.buildings).filter(d=>d.group==="com"&&d.unlock<=p.level).sort((a,b)=>b.income-a.income)[0];
  if(best&&has(best.id)<growth&&power+best.power>=0&&water+best.water>=0)add(best.id,49);
  const counts={};
  for(const b of w.buildings){
   if(s.upgradeBlock(b)||b.level>(p.level<5?2:p.level<10?4:9))continue;
   const d=CONFIG.buildings[b.id],cost=s.upgradeCost(b),delta=d.income*.35;
   const utilities=d.power>0&&power<8||d.water>0&&water<7;
   const key=b.id+"/"+b.level;if((counts[key]=(counts[key]||0)+1)>1)continue;
   const prog=s.stats.upgrades<5?18:s.stats.maxBuildingLevel<5&&p.level>=6&&b.level>=3?16:0;
   const score=(utilities?86:delta?41:15)+prog+Math.min(12,delta*400/cost);
   candidates.push({price:cost,score,run:()=>{
    if(s.upgrade(b))return false;
    tracked("upgrade:"+b.id,cost,delta,true);if(b.level>=CONFIG.specLevel&&!b.spec)s.specialize(b,d.group==="res"?"b":"a");return true;
   }});
  }
  if(s.stats.npcLevel<2&&p.level>=4){
   const b=w.buildings.find(b=>b.left<=0&&b.id==="water_tower");
   if(b&&s.crisis.teamAction(b,"upgrade")==="")return true;
  }
  if(m.roads<14||roadTiles.length<4){
   const best=frontier.filter(corridor).map(t=>({...t,opens:steps.filter(([dx,dy])=>vacantKeys.has(coord(t.x+dx,t.y+dy))&&!roadsNear(t.x+dx,t.y+dy)).length}))
    .sort((a,b)=>b.opens-a.opens||a.center-b.center)[0];
   if(best)candidates.push({price:CONFIG.buildings.road.price,score:m.roads<14?84:85,run:()=>build("road",best)});
  }
  return candidates;
 };
 const support=()=>{
  let useful=false;
  const any=result=>{if(result)useful=true};
  for(const c of w.crises)if(!s.crisis.dispatch(c,w))useful=true;
  for(const f of s.social.friends())for(const c of f.world.crises){
   if(p.dailyHelpsLeft>0&&!s.crisis.dispatch(c,f.world,f))useful=true;
  }
  for(const b of [...w.bubbles]){s.collect(b.uid);useful=true}
  const ch=s.prog.chapter();if(ch)for(const q of ch.quests)any(s.prog.claimQuest(q.id));
  s.prog.ensureDaily();for(const q of s.progress.daily.quests)any(s.prog.claimDaily(q.id));
  any(s.prog.claimDailyBonus());any(s.prog.claimLogin());
  const event=s.events,e=events[event.event.id]??={quests:0,tiers:0};
  for(let i=0;i<event.def.jobs.length;i++)if(event.claimQuest(i)){e.quests++;useful=true}
  for(let i=0;i<SeasonalEvents.tiers.length;i++)if(event.claimTier(i)){e.tiers++;useful=true}
  if(s.legacy.unlocked){
   for(const state of s.legacy.rankStates())if(s.legacy.claim("rank",state.id))useful=true;
   for(const state of s.legacy.familyStates())if(s.legacy.claim("family",state.id))useful=true;
   any(s.legacy.claim("plan",""));
  }
  for(const a of CONTENT.achievements)any(s.prog.claimAchievement(a.id));
  if(s.progress.decision){const d=CONTENT.decisions.find(x=>x.id===s.progress.decision.id);
   const best=d.options.map((o,i)=>({i,cost:s.decisionCost(o),xp:o.xp||0})).filter(o=>-o.cost<=p.coins/3).sort((a,b)=>b.xp-a.xp||b.cost-a.cost)[0];if(best)any(s.decide(best.i));
  }
  if(p.level>=4&&!w.activePolicy){const id=s.metrics.waste>10?"green":"festival";if(!s.activate(id))useful=true}
  if(p.level>=4){const order=["tax","community","construct","trade","offline","grid","prevention","education","logistics","invest","smartroad","heroes"];
   const tech=order.map(id=>CONTENT.research.all.find(t=>t.id===id)).find(t=>!s.researchBlock(t));if(tech){s.research(tech.id);useful=true}}
  s.prog.refresh();s.pending.length=0;return useful;
 };
 const closeIdle=()=>{if(idle&&time-idle.active>=30)stretches.push({...idle,seconds:time-idle.active});idle=null};
 levels.unshift(start);
 while(p.level<17&&wall<days*86400){
  tick();observe();
  let useful=false;
  if(time>=nextSupport){useful=support();nextSupport=time+8}
  if(time>=nextPlan){
   const list=plan();
   if(list===true)useful=true;
   else{
    list.sort((a,b)=>b.score-a.score);
    const highest=list[0]?.score??0;
    const choice=list.find(a=>a.score>=highest-23&&a.price<=p.coins);
    if(choice?.run())useful=true;
    else if(!useful&&!idle&&!w.buildings.some(b=>b.left>0)&&!w.npcs.length)
     idle={active:time,level:p.level,gold:Math.floor(p.coins),nextCost:list.length?Math.min(...list.filter(a=>a.score>=highest-23).map(a=>a.price)):null};
   }
   nextPlan=time+12;
  }
  if(useful)closeIdle();observe();
  if(time%300===0)economy.push(snapshot());
  if(session&&time%session===0){
   closeIdle();const gap=86400-session,last=Date.now();if(wall+gap>=days*86400)break;
   advance(gap);wall+=gap;const reward=s.storage.offline(last);s.social.resetQuota();
   if(reward)offline.push({active:time,wall,gold:reward.coins,knowledge:reward.know});
  }
 }
 closeIdle();
 return {levels,economy,stretches,cheap,actions,offline,events,last:snapshot(),stats:s.stats};
}`,context);
const result=simulate(seconds=>{now+=seconds*1000},session,days);
if("json" in args)console.log(JSON.stringify(result,null,2));
else{
 const time=n=>[Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,"0")).join(":");
 console.table(result.levels.map(({active,wall,...row})=>({...row,active:time(active),wall:time(wall)})));
 console.log("Idle (>=30s, no useful affordable priority action):",result.stretches.length,
  "longest early:",Math.max(0,...result.stretches.filter(s=>s.level<5).map(s=>s.seconds)),"seconds");
 console.table([...result.stretches].sort((a,b)=>b.seconds-a.seconds).slice(0,5));
 console.log("Cheap actions (cost <= 5s of income; for income-producing repeats, payback <= 90s):");
 console.table(Object.entries(result.cheap).map(([id,{count,first,price}])=>({id,count,level:first.level,active:time(first.active),price})));
 console.log("Economy curve (30-minute samples; --json includes all five-minute samples and offline returns):");
 console.table(result.economy.filter(row=>row.active%1800===0).map(({active,wall,...row})=>({...row,active:time(active),wall:time(wall)})));
 console.log("Event participation:",JSON.stringify(result.events));
 console.log("Offline returns:",result.offline.length,"Final:",JSON.stringify(result.last));
}
