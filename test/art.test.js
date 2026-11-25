const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "../public");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = read("js/art-data.js");

test("all static HUD symbols and the prestige medal have an atlas frame", () => {
  const data = vm.runInNewContext(manifest + "\nART_DATA");
  const ids = [...read("img/hud.svg").matchAll(/<symbol id="([^"]+)"/g)].map(([, id]) => id);
  assert.deepEqual(Object.keys(data.hud).sort(), ids.concat("prestige").sort());
  for (const [group, frames] of Object.entries({...data.groups, hud: data.hud})) {
    assert.ok(fs.existsSync(path.join(root, "img/art", group + ".webp")), group);
    assert.ok(Object.values(frames).every(([name, x, y, w, h]) => name === group && x >= 0 && y >= 0 && w > 0 && h > 0), group);
  }
});

test("atlas renderer stays lazy, keeps the fallback while loading, and anchors mirrored sprites", () => {
  const pending = [], calls = [];
  const context = {
    Image: class { constructor() { pending.push(this); } },
    asset: url => url, URL,
    document: {baseURI:"https://city.example/", createElement: () => ({}), documentElement: { style: {setProperty() {}}, classList: {add() {}} }, head: {append() {}} }
  };
  const art = vm.runInNewContext(manifest + "\n" + read("js/art.js") + "\nGameArt", context);
  const g = Object.fromEntries(["save", "translate", "scale", "drawImage", "restore"].map(
    key => [key, (...args) => calls.push([key, ...args])]));
  const before = pending.length;
  assert.equal(art.draw(g, "missing", "anything", 0, 0, 25), false);
  assert.equal(pending.length, before);
  const render = () => art.draw(g, "traffic-cars", "taxi1-rear", 30, 50, 25, 20, {ground:true, mirror:true});
  assert.equal(render(), false);
  assert.equal(pending.length, before + 1);
  assert.equal(render(), false);
  assert.equal(pending.length, before + 1);
  assert.equal(art.ready("traffic-cars"), false);
  const img = pending.at(-1);
  img.naturalWidth = 100;
  assert.equal(art.ready("traffic-cars"), true);
  assert.equal(render(), true);
  assert.deepEqual(calls.slice(0, 3), [["save"], ["translate", 30, 0], ["scale", -1, 1]]);
  assert.equal(calls[3][1], img);
  assert.equal(calls[3][7] + calls[3][9], 50);
  assert.deepEqual(calls.at(-1), ["restore"]);
});

test("ground layer refreshes for camera, tile occupancy and late-loading art", () => {
  let terrainReady = false;
  const groundContext = {setTransform() {}};
  const Renderer = vm.runInNewContext(read("js/renderer.js") + "\nIsoRenderer", {
    GameArt: {ready: name => terrainReady && name === "terrain-grass"},
    document: {createElement: () => ({getContext: () => groundContext})}
  });
  const painted = [], cached = [];
  const ctx = {drawImage: (...args) => cached.push(args)};
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    canvas: {width: 780, height: 1600}, ctx, dpr: 2, camera: {x: 0, y: 0, zoom: 1},
    ground() { painted.push(this.ctx); }
  });
  const world = {unlockedRadius: 3, index: new Map()};
  const draw = () => renderer.groundLayer(world);
  draw(); draw(); draw();
  assert.deepEqual(painted, [ctx, groundContext]);
  assert.equal(cached.length, 2);
  assert.deepEqual(cached[0].slice(1), [0, 0, 390, 800]);
  terrainReady = true; draw(); draw();
  world.index.set("1,1", {}); draw(); draw();
  renderer.camera.x++; draw(); draw();
  assert.deepEqual(painted, Array.from({length: 4}, () => [ctx, groundContext]).flat());
  assert.equal(renderer.ctx, ctx);
});
