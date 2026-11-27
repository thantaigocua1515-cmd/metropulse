"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {test}=require("node:test");
const vm=require("node:vm");
const {inspectSave}=require("../server/game");

const source=["config","core","storage","simulation"].map(name=>
 fs.readFileSync(path.join(__dirname,"../public/js",name+".js"),"utf8")).join("\n");
const {CONFIG,StorageManager,SimulationEngine}=vm.runInNewContext(source+"\n;({CONFIG,StorageManager,SimulationEngine})");

test("the game clock is independent of render quality and pauses in a hidden tab",()=>{
 let callback,visibility,now=0,simulated=0,renders=0,refreshes=0;
 const document={hidden:false,addEventListener(type,fn){assert.equal(type,"visibilitychange");visibility=fn}};
 const start=vm.runInNewContext(source+"\nSimulationEngine.prototype.start",{
  document,requestAnimationFrame(fn){callback=fn;return 1},cancelAnimationFrame(){callback=null}
 });
 const sim={tick(dt){simulated+=dt},prog:{refresh(){}},storage:{save(){}}};
 const advance=(frames)=>{for(let i=0;i<frames;i++){now+=1000/60;callback(now)}};
 let fps=60;
 start.call(sim,{frameRate:()=>fps,render(){renders++}},{refresh(){refreshes++}});
 advance(61);
 assert.ok(Math.abs(simulated-1)<.051);assert.equal(renders,61);assert.ok(refreshes<=5);
 fps=15;advance(60);
 assert.ok(Math.abs(simulated-2)<.051);assert.equal(renders,76);
 document.hidden=true;visibility();assert.equal(callback,null);
 const prior=simulated;
 now+=60000;document.hidden=false;visibility();advance(1);
 assert.equal(simulated,prior);
});

test("the starter budget covers the tutorial and city foundations",()=>{
 const {road,house_small,power_plant,water_tower}=CONFIG.buildings;
 assert.ok(house_small.price+2*road.price<=CONFIG.starterCoins);
 assert.ok(power_plant.price+water_tower.price<=CONFIG.starterCoins);
 for(let level=1;level<=16;level++)assert.ok(CONFIG.xpNext(level+1)>CONFIG.xpNext(level));
 for(const b of Object.values(CONFIG.buildings)){
  if(b.unlock>=7&&b.income>0)assert.ok(b.price/b.income>=300,b.id+" payback is under five minutes");
 }
});

test("an existing city's money, mayor XP and upgraded buildings survive the new curves",()=>{
 const saved=JSON.parse(JSON.stringify(StorageManager.fresh()));
 Object.assign(saved.profile,{level:10,xp:3240,coins:253421,prestige:119,knowledge:795});
 saved.world.unlockedRadius=CONFIG.radius(10);
 saved.world.buildings.push({id:"mall",x:9,y:9,level:7,left:0});
 const data=StorageManager.normalize(saved);
 const s=new SimulationEngine(data,{play(){}});
 assert.deepEqual(JSON.parse(JSON.stringify(s.profile)),saved.profile);
 assert.equal(s.world.buildings.find(b=>b.id==="mall").level,7);
 assert.equal(inspectSave(saved).error,undefined);
 s.gainXP(CONFIG.xpNext(10)-saved.profile.xp);
 assert.equal(s.profile.level,11);
 assert.equal(s.profile.xp,0);
 assert.equal(s.world.unlockedRadius,CONFIG.radius(11));
});

test("mayor progression continues past the former cloud limit and awards five-level milestones",()=>{
 const data=StorageManager.fresh(),s=new SimulationEngine(data,{play(){}});
 Object.assign(s.profile,{level:499,xp:0});
 const prestige=s.profile.prestige;
 s.gainXP(CONFIG.xpNext(499),false);
 assert.equal(s.profile.level,500);
 assert.equal(s.profile.prestige,prestige+15);
 assert.equal(s.profile.materials.steel,12);
 s.gainXP(CONFIG.xpNext(500),false);
 assert.equal(s.profile.level,501);
 assert.ok(CONFIG.xpNext(501)>CONFIG.xpNext(500));
 const saved=JSON.parse(JSON.stringify(data));
 assert.equal(StorageManager.normalize(saved).profile.level,501);
 assert.equal(inspectSave(saved).error,undefined);
 assert.equal(CONFIG.mayorReward(505).materials.chip,4);
});

test("advanced upgrades reserve supplies, survive a reload and finish at the scheduled time",()=>{
 const data=StorageManager.fresh(),s=new SimulationEngine(data,{play(){}});
 s.storage={save(){}};
 const b=s.world.buildings.find(b=>b.id==="water_tower");
 Object.assign(s.profile,{level:15,coins:1e12});
 b.level=10;b.left=0;
 assert.match(s.upgrade(b),/cấp 16/);
 s.profile.level=16;
 assert.match(s.upgrade(b),/Thiếu vật liệu/);
 s.addMaterials({steel:10,glass:10,chip:10});
 assert.equal(s.upgrade(b),"");
 assert.equal(b.level,10);
 assert.ok(b.upgradeReadyAt>Date.now());
 assert.equal(s.profile.materials.steel,7);
 assert.match(s.upgrade(b),/đang được nâng cấp/);
 const raw=JSON.parse(JSON.stringify(data));
 assert.equal(inspectSave(raw).error,undefined);
 const restored=StorageManager.normalize(raw),resumed=new SimulationEngine(restored,{play(){}});
 const next=restored.world.buildings.find(b=>b.id==="water_tower");
 assert.equal(next.upgradeReadyAt,b.upgradeReadyAt);
 next.upgradeReadyAt=Date.now()-1;
 resumed.social={tick(){}};
 resumed.crisis={tickOwn(){}};
 resumed.tick(.05);
 assert.equal(next.level,11);
 assert.equal(next.upgradeReadyAt,undefined);
 assert.equal(resumed.stats.upgrades,1);
 assert.equal(CONFIG.tier(next.level),3);
 assert.equal(CONFIG.tierGate(15),21);
 assert.equal(CONFIG.tierGate(20),26);
 assert.ok(CONFIG.upgradeSeconds(24)>CONFIG.upgradeSeconds(10));
});

test("cloud saves accept tier VI at level 26, but reject impossible levels and malformed inventory",()=>{
 const data=StorageManager.fresh();
 const b=data.world.buildings.find(b=>b.id==="water_tower");
 b.level=25;
 data.profile.level=25;
 assert.match(inspectSave(data).error,/Cấp công trình/);
 data.profile.level=26;
 assert.equal(inspectSave(data).error,undefined);
 b.level++;
 assert.match(inspectSave(data).error,/Công trình/);
 b.level=25;
 data.profile.materials={steel:-1};
 assert.match(inspectSave(data).error,/Kho vật liệu/);
});
