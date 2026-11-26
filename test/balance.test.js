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
