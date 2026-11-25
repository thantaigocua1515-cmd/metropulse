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
