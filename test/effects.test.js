const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const { CONFIG, CityEffects, CrisisAndNPCManager, SimulationEngine, StorageManager } = vm.runInNewContext(
  ["config", "content", "core", "simulation", "crisis", "storage", "effects"].map(file =>
    fs.readFileSync(path.join(__dirname, "../public/js", file + ".js"), "utf8")).join("\n") +
  "\n({ CONFIG, CityEffects, CrisisAndNPCManager, SimulationEngine, StorageManager })"
);

function setup(data = StorageManager.fresh()) {
  const sounds = [];
  const sim = new SimulationEngine(data, { enabled: true, play: kind => sounds.push(kind) });
  sim.storage = new StorageManager(sim);
  sim.storage.save = () => true;
  sim.social = { current: null, friends: () => [], tick() {} };
  sim.crisis = new CrisisAndNPCManager(sim);
  return { sim, sounds };
}

test("building, upgrading, collecting, and repairing queue short effects and play the matching sound", () => {
  const { sim, sounds } = setup();
  const { world } = sim;
  assert.equal(sim.build("house_small", 6, 8), "");
  const b = world.buildings.at(-1);
  assert.equal(sim.fx.at(-1).kind, "dust");
  sim.finish(b);
  assert.equal(sim.fx.at(-1).kind, "built");
  sim.profile.coins += CONFIG.upgradeBase(b);
  assert.equal(sim.upgrade(b), "");
  assert.equal(sim.fx.at(-1).kind, "upgrade");
  const effects = Object.create(CityEffects.prototype);
  effects.r = { sim };
  sim.fx.at(-1).age = .24;
  sim.fx.splice(0, 2);
  assert.ok(effects.bounce(b) > 1);
  for (const [kind, resource] of [["coin", "coin"], ["gem", "prestige"], ["know", "brain"]]) {
    world.bubbles.push({ uid: kind, kind, x: b.x, y: b.y });
    sim.collect(kind);
    assert.equal(sim.fx.at(-1).resource, resource);
    assert.ok(sim.fx.at(-1).amount > 0);
  }
  sim.crisis.spawn(world, "water_leak", b, false);
  sim.crisis.resolve(world.crises.at(-1), world, null);
  assert.ok(sim.fx.some(e => e.kind === "repair" && e.world === world));
  for (const kind of ["build", "done", "upgrade", "pickup", "repair"]) assert.ok(sounds.includes(kind), kind);
  sim.tick(1.1);
  assert.equal(sim.fx.length, 0);
});

test("reduce effects is saved and restored without suppressing the actual rewards", () => {
  const { sim } = setup();
  sim.reduceEffects = true;
  const save = StorageManager.normalize(sim.storage.serialize());
  const restored = setup(save).sim;
  const before = restored.profile.coins;
  restored.grant({ coins: 30, prestige: 2, know: 4 });
  assert.equal(restored.reduceEffects, true);
  assert.equal(restored.profile.coins, before + 30);
  assert.equal(restored.fx.length, 0);
});

test("skin effects draw only near visible completed buildings and cap fireworks",()=>{
  const runs={flowers:0,snow:0,strokes:0};
  const ctx={save(){},restore(){},drawImage(){runs.flowers++},fillRect(){runs.snow++},
    beginPath(){},moveTo(){},lineTo(){},stroke(){runs.strokes++}};
  const effect=Object.assign(Object.create(CityEffects.prototype),{
    flower:{},r:{ctx,width:390,height:800,camera:{zoom:1},elapsed:0,project:(x,y)=>({x:x*20,y:y*20})}
  });
  const a={x:0,y:0,left:0},visible={buildings:[a,{x:1,y:1,left:1},{x:99,y:99,left:0}]};
  const heights=new Map([[0,20],[17,20],[1683,20]]);
  effect.skin("noel",visible,heights);
  assert.equal(runs.snow,2);
  effect.skin("tet",{buildings:[...visible.buildings,a,a]},heights);
  assert.deepEqual(runs,{flowers:6,snow:2,strokes:4});
});

test("level four gains steady XP from adequately supplied utilities during play", () => {
  const data = StorageManager.fresh();
  data.profile.level = 4;
  data.progress.tutorial.done = true;
  const { sim } = setup(data);
  sim.tick(1);
  assert.equal(sim.profile.xp, CONFIG.utilityXP.perSecond);
  const tower = sim.world.buildings.find(b => b.id === "water_tower");
  tower.left = 20;
  sim.tick(1);
  assert.equal(sim.profile.xp, CONFIG.utilityXP.perSecond);
  tower.left = 0;
  sim.gainXP(CONFIG.xpNext(4) - sim.profile.xp);
  sim.tick(1);
  assert.equal(sim.profile.level, 5);
  assert.equal(sim.profile.xp, 0);
});

test("new city skins draw their own stamps, scale with quality and cull unfinished and offscreen buildings",()=>{
  const draws=[];
  const ctx={save(){},restore(){},drawImage(stamp,...box){draws.push({stamp,box,alpha:this.globalAlpha})}};
  const effect=Object.assign(Object.create(CityEffects.prototype),{
    stamp:kind=>kind,r:{ctx,width:390,height:800,camera:{zoom:1},elapsed:1,
      quality:{skinStamps:128,skinLayers:3},project:(x,y)=>({x:x*20,y:y*20})}
  });
  const world={buildings:[{x:0,y:0,left:0},{x:1,y:1,left:1},{x:99,y:99,left:0}]};
  const heights=new Map([[0,20],[17,20],[1683,20]]);
  const expected={cyberpunk:["neon","hologram"],sakura:["petal","petal"],desert:["sand","sand"],
    jungle:["firefly","leaf"],ocean:["bubble","bubble"],steampunk:["steam","spark"]};
  for(const [pack,[primary,secondary]] of Object.entries(expected)){
    effect.skin(pack,world,heights,1);
    assert.deepEqual(draws.splice(0).map(d=>d.stamp),[primary,secondary,secondary],pack);
  }
  effect.skin("jungle",world,heights,0);
  const daytime=draws.splice(0)[0].alpha;
  effect.skin("jungle",world,heights,1);
  assert.ok(draws.splice(0)[0].alpha>daytime);
  effect.r.quality={skinStamps:28,skinLayers:1};
  effect.skin("steampunk",world,heights);
  assert.deepEqual(draws.splice(0).map(d=>d.stamp),["steam"]);
  effect.r.quality={skinStamps:1,skinLayers:3};
  effect.skin("ocean",world,heights);
  assert.equal(draws.splice(0).length,1);
  effect.skin("default",world,heights);
  assert.equal(draws.length,0);
});
