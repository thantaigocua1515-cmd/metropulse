const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

let now;
class TestClock extends Date {
  static now() { return now; }
}
const {inspectSave,publicCity}=require("../server/game");
const { CONFIG, Districts, EventCalendar, EventMap, SeasonalEvents, LegacyGoals, SimulationEngine, StorageManager, makeBuilding, makeWorld, Pathfinding, SocialManager, CrisisAndNPCManager } = vm.runInNewContext(
  ["config", "content", "core", "simulation", "storage", "events", "progression", "social", "crisis"].map(file =>
    fs.readFileSync(path.join(__dirname, "../public/js", file + ".js"), "utf8")).join("\n") +
  "\n({ CONFIG, Districts, EventCalendar, EventMap, SeasonalEvents, LegacyGoals, SimulationEngine, StorageManager, makeBuilding, makeWorld, Pathfinding, SocialManager, CrisisAndNPCManager })",
  { Date: TestClock, GameArt: { draw(ctx,group,frame) { ctx.push(frame); return true; } } }
);

test("land purchase keeps old tiles, extends routes, and round trips through public cities",()=>{
 const s=setup([makeBuilding("road",15,5)],17);
 s.profile.coins=3e6;s.addMaterials({steel:30,glass:30,chip:10});
 assert.equal(Pathfinding.route(s.world,{x:15,y:5},{x:17,y:5}),null);
 assert.equal(s.buyLand(),"");
 assert.equal(s.world.gridSize,18);
 assert.equal(s.profile.materials.steel,22);
 assert.equal(s.world.buildings[0].x,15);
 assert.equal(Pathfinding.route(s.world,{x:15,y:5},{x:17,y:5}).path.at(-1).x,17);
 assert.match(s.buyLand(),/23/);
 s.profile.level=23;
 assert.equal(s.buyLand(),"");
 s.world.buildings.push(makeBuilding("road",19,5));
 const data=s.storage.serialize(),check=inspectSave(data);
 assert.equal(check.error,undefined);
 const shared=publicCity({code:"MP-ABCD",name:"Bình Minh",summary:check.summary,city:check.city,coins:check.coins});
 const friend=SocialManager.prototype.build.call({sim:s,guessAvatar:()=>10},shared);
 assert.equal(friend.world.gridSize,20);
 assert.equal(friend.world.buildings.at(-1).x,19);
 assert.equal(StorageManager.normalize(data).world.gridSize,20);
 data.world.land=0;
 assert.match(inspectSave(data).error,/Công trình/);
});

test("advanced research, specialist skills and timed wonders spend stock and retain progress",()=>{
 const team=makeBuilding("fire_station",6,6),wonder=makeBuilding("metro_wonder",7,6,11);
 const s=setup([team,wonder],21);
 s.crisis=new CrisisAndNPCManager(s);
 s.profile.coins=5e6;s.profile.knowledge=1e4;s.profile.prestige=100;
 s.addMaterials({steel:30,glass:30,chip:10});
 s.progress.research.tax=3;
 assert.equal(s.research("tax"),"");
 assert.equal(s.tech("tax"),4);
 assert.equal(s.profile.materials.glass,26);
 assert.match(s.research("tax"),/22/);
 assert.match(s.crisis.train(team,"routing"),/5 ca/);
 team.missions=5;
 assert.equal(s.crisis.train(team,"routing"),"");
 assert.equal(team.skills.routing,1);
 assert.equal(s.profile.materials.chip,7);
 const before=s.measure(s.world).income;
 now=Date.now()||Date.parse("2026-07-14T00:00:00Z");
 assert.equal(s.startWonder(),"");
 assert.match(s.startWonder(),/đang thi công/);
 const ready=s.progress.wonder.readyAt;
 assert.equal(inspectSave(s.storage.serialize()).error,undefined);
 s.finishWonder(ready-1);
 assert.equal(s.progress.wonder.stage,0);
 s.finishWonder(ready);
 s.finishWonder(ready+1);
 assert.equal(s.progress.wonder.stage,1);
 assert.ok(s.measure(s.world).income>before);
});

function setup(buildings, level=16) {
  const data = StorageManager.fresh();
  data.profile.level = level;
  if (buildings) data.world = makeWorld(buildings, level);
  const sim = new SimulationEngine(data, { enabled: true, play() {} });
  sim.social = { friends: () => [] };
  sim.storage = new StorageManager(sim);
  sim.storage.save = () => true;
  return sim;
}

test("flash windows use Vietnam time and leave the seasonal track independent", () => {
  const original=now;
  try{
    const at=iso=>Date.parse(iso+"+07:00");
    now=at("2026-09-02T17:59:00");
    const sim=setup(),season=new SeasonalEvents(sim),flash=new SeasonalEvents(sim,"",true);
    assert.equal(season.event.id,"quoc-khanh");
    assert.equal(flash.event,null);
    now=at("2026-09-02T18:00:00");flash.refresh();
    assert.equal(flash.event.id,"rush-hour");
    assert.equal(flash.countdown(),"02g 00p");
    sim.stats.roadsBuilt+=3;
    assert.equal(flash.claimQuest(0),true);
    assert.equal(season.points,0);
    now=at("2026-09-02T20:00:00");
    assert.equal(flash.claimQuest(1),false);
    assert.equal(EventCalendar.flash(at("2026-09-05T07:59:00")),null);
    assert.equal(EventCalendar.flash(at("2026-09-05T08:00:00")).id,"weekend-market");
    assert.equal(EventCalendar.flash(at("2026-09-06T23:59:00")).id,"weekend-market");
    assert.equal(EventCalendar.flash(at("2026-09-07T00:00:00")),null);
    const count=flash.points,preview=new SeasonalEvents(sim,"weekend-market",true);
    sim.stats.buildingsBuilt+=2;assert.equal(preview.claimQuest(0),true);
    assert.equal(flash.points,count);
  }finally{now=original}
});

test("operator overrides replace the schedule and rewards without changing built-in offline defaults", () => {
  const original=now;
  try {
    now=Date.parse("2026-09-02T18:20:00+07:00");
    const sim=setup(),season=new SeasonalEvents(sim),flash=new SeasonalEvents(sim,"",true);
    sim.eventConfig=[
      {_id:"quoc-khanh",kind:"season",template:"quoc-khanh",enabled:false},
      {_id:"pho-dem",kind:"flash",template:"rush-hour",name:"Phố đêm",enabled:true,start:"2026-09-02T11:00:00Z",
       end:"2026-09-02T12:00:00Z",rewards:[20,40,80],multiplier:1.5}
    ];
    season.refresh(true);flash.refresh(true);
    assert.equal(season.event,null);
    assert.equal(flash.event.id,"pho-dem");
    assert.equal(flash.def.name,"Phố đêm");
    assert.equal(flash.countdown(),"00g 40p");
    assert.equal(flash.tiers[0].reward.coins,30);
    sim.eventConfig=[];season.refresh(true);flash.refresh(true);
    assert.equal(season.event.id,"quoc-khanh");
    assert.equal(flash.event.id,"rush-hour");
    assert.equal(flash.tiers[0].reward.coins,80);
  } finally { now=original; }
});

test("district preview and live city use the same completed, bounded neighborhoods", () => {
  const home = makeBuilding("house_small", 8, 8);
  const school = makeBuilding("school", 8, 10);
  const university = makeBuilding("university", 5, 8);
  const idleUniversity = makeBuilding("university", 9, 9, 1, 5);
  const plant = makeBuilding("power_plant", 8, 7);
  const nearShop = makeBuilding("mini_mart", 9, 8);
  const metro = makeBuilding("metro_station", 11, 8);
  const road = makeBuilding("road", 9, 7);
  const fire = makeBuilding("fire_station", 6, 8);
  const police = makeBuilding("police_station", 10, 7);
  const s = setup([home, school, university, idleUniversity, plant, nearShop, metro, road, fire, police]);
  const { world } = s;
  assert.equal(s.synergy(home).happy, -2);
  assert.ok(Math.abs(s.synergy(home).know - .018) < 1e-10);
  assert.ok(Math.abs(s.synergy(nearShop).mult - 1.05*1.15) < 1e-10);
  assert.equal(Districts.coverage(home, world, undefined, "fire")[0].value, -12);
  assert.equal(Districts.coverage(road, world, undefined, "traffic_jam")[0].value, -12);
  assert.equal(Districts.coverage(metro, world, undefined, "fire").length, 0);
  const park = makeBuilding("park", 7, 8);
  const preview = Districts.preview(world, park).find(p => p.x === home.x && p.y === home.y);
  assert.ok(preview.labels.some(label => label.good && label.text === "+2 HP"));
  const moved = Districts.preview(world, makeBuilding("power_plant", 7, 7), plant);
  assert.ok(moved.find(p => p.x === home.x && p.y === home.y).labels.some(label => label.text === "+2 HP"));
  const withPark = makeWorld([...world.buildings, park], 16);
  assert.equal(s.synergy(home, withPark).happy, 0);
  assert.ok(s.synergy(park, withPark, true).notes.some(([, label]) => label.includes("Không gian xanh")));
});

test("Vietnamese events follow lunar holidays and roll over at local midnight", () => {
  const event = iso => EventCalendar.active(Date.parse(iso)).id;
  assert.notEqual(event("2026-02-16T16:59:59Z"), "tet");
  assert.equal(event("2026-02-16T17:00:00Z"), "tet");
  assert.equal(event("2027-02-06T12:00:00+07:00"), "tet");
  assert.equal(event("2025-10-06T12:00:00+07:00"), "trung-thu");
  assert.equal(event("2026-09-25T12:00:00+07:00"), "trung-thu");
  assert.equal(event("2026-09-02T00:00:00+07:00"), "quoc-khanh");
  assert.equal(event("2027-01-01T12:00:00+07:00"), "giang-sinh");
  const a = event("2026-03-02T00:00:00+07:00"), b = event("2026-03-09T00:00:00+07:00");
  assert.ok(EventCalendar.weekly.includes(a) && EventCalendar.weekly.includes(b) && a !== b);
});

test("event quest and tier claims are one-time; rollover preserves cosmetics; debug awards do not persist", () => {
  now = Date.parse("2026-02-17T00:00:00+07:00");
  const s = setup();
  const e = new SeasonalEvents(s);
  assert.equal(e.claimQuest(0), false);
  for (const [key, goal] of e.def.jobs) s.stats[key] += goal;
  for (let i = 0; i < 6; i++) assert.equal(e.claimQuest(i), true);
  assert.equal(e.claimQuest(0), false);
  assert.equal(e.points, 60);
  assert.equal(e.claimTier(2), true);
  assert.equal(e.claimTier(2), false);
  assert.equal(s.profile.materials.steel,6);
  assert.equal(e.skin, "tet");
  const save = StorageManager.normalize(s.storage.serialize());
  assert.equal(save.progress.events.skins.tet, true);
  now = Date.parse("2026-02-24T00:00:00+07:00");
  e.refresh();
  assert.equal(e.points, 0);
  assert.equal(e.skin, "tet");
  const preview = new SeasonalEvents(s, "trung-thu");
  const balance = s.profile.coins;
  for (const [key, goal] of preview.def.jobs) s.stats[key] += goal;
  for (let i = 0; i < 6; i++) assert.equal(preview.claimQuest(i), true);
  assert.equal(preview.claimTier(2), true);
  assert.equal(s.profile.coins, balance);
  assert.equal(s.profile.materials.steel,6);
  assert.equal(s.progress.events.skins["trung-thu"], undefined);
});

test("market stalls render only as a selected reward, not as automatic event props", () => {
  now = Date.parse("2026-11-28T12:00:00+07:00");
  const s = setup([makeBuilding("road",8,8),makeBuilding("road",9,7)]);
  s.events = new SeasonalEvents(s);
  s.flash = new SeasonalEvents(s,"",true);
  assert.equal(s.events.event.id,"cho-phien");
  assert.equal(s.flash.event.id,"weekend-market");
  const mapFrames = [], renderer = {ctx:mapFrames,sim:s,camera:{zoom:1},project:(x,y)=>({x,y})};
  EventMap.draw(renderer,s.world,s.events);
  assert.deepEqual(mapFrames,[]);
  s.events.data.skins["cho-phien"] = true;
  s.events.selectSkin("cho-phien");
  EventMap.draw(renderer,s.world,s.events);
  assert.deepEqual(mapFrames.splice(0),["cho-phien-large"]);
  s.events.selectSkin("");
  s.events = new SeasonalEvents(s,"pho-xanh");
  EventMap.draw(renderer,s.world,s.events);
  assert.deepEqual(mapFrames.splice(0),["pho-xanh-small","pho-xanh-small"]);
});

test("legacy masters existing cities, claims once, and rotates a clean repeatable plan", () => {
  const s = setup([makeBuilding("house_small", 8, 8, CONFIG.maxLevel)]);
  const legacy = new LegacyGoals(s);
  assert.equal(legacy.claim("family", "house_small"), true);
  assert.equal(legacy.claim("family", "house_small"), false);
  s.metrics.score = CONFIG.heritageRanks[0][0];
  assert.equal(legacy.claim("rank", "0"), true);
  assert.equal(legacy.claim("rank", "0"), false);
  assert.equal(legacy.claim("plan", ""), false);
  s.metrics.synergyTiles = 6;
  s.stats.bubbles = 9;
  s.stats.dailyDone = 2;
  assert.equal(legacy.claim("plan", ""), true);
  assert.equal(legacy.data.round, 1);
  assert.equal(legacy.planStates().find(q => q.key === "bubbles").cur, 0);
  assert.equal(legacy.claim("plan", ""), false);
});
