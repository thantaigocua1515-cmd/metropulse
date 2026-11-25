const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "../public");
const { CONFIG, SPRITES, IsoRenderer, makeWorld, makeBuilding } = vm.runInNewContext(
  ["config", "sprites", "core", "renderer"].map(file => fs.readFileSync(path.join(root, "js", file + ".js"), "utf8")).join("\n") +
  "\n({ CONFIG, SPRITES, IsoRenderer, makeWorld, makeBuilding })"
);
const renderer = Object.create(IsoRenderer.prototype);

test("every catalog building has four sprite frames at each level and a thumbnail", () => {
  assert.deepEqual(Object.keys(SPRITES).sort(), Object.keys(CONFIG.buildings).sort());
  for (const [id, meta] of Object.entries(SPRITES)) {
    const files = fs.readdirSync(path.join(root, "img/bld", id)).sort();
    const frames = id === "road"
      ? ["corner", "cross", "end", "straight", "tee"]
      : Array.from({ length: CONFIG.maxLevel }, (_, i) => String(i + 1).padStart(2, "0"));
    assert.deepEqual(files, [...frames.flatMap(frame => [0, 1, 2, 3].map(rot => frame + "_" + rot + ".webp")), "thumb.webp"].sort(), id);
    assert.ok(meta.w > 0 && meta.h > 0, id);
    if (id !== "road") {
      assert.equal(meta.tops.length, CONFIG.maxLevel, id);
      assert.ok(meta.tops.every(angles => angles.length === 4 && angles.every(h => h > 0)), id);
    }
  }
});

test("road variants orient to their neighboring road tiles, while isolated roads have a fallback", () => {
  const ends = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  const expected = {
    cross_0: [0, 1, 2, 3],
    corner_0: [0, 3], corner_1: [0, 1], corner_2: [1, 2], corner_3: [2, 3],
    straight_0: [1, 3], straight_1: [0, 2],
    tee_0: [0, 1, 3], tee_1: [0, 1, 2], tee_2: [1, 2, 3], tee_3: [0, 2, 3],
    end_0: [1], end_1: [2], end_2: [3], end_3: [0]
  };
  const road = makeBuilding("road", 8, 8);
  assert.equal(renderer.roadFrame(road, makeWorld([road])), null);
  for (const [frame, links] of Object.entries(expected)) {
    const neighbors = links.map(i => makeBuilding("road", 8 + ends[i][0], 8 + ends[i][1]));
    assert.equal(renderer.roadFrame(road, makeWorld([road, ...neighbors])), frame);
  }
});

test("building previews use level and automatic facing unless manually rotated", () => {
  const b = makeBuilding("fire_station", 8, 8, 10);
  const w = makeWorld([b, makeBuilding("road", 8, 9)]);
  assert.equal(renderer.spritePreview(b, w), "img/bld/fire_station/10_3.webp?v="+CONFIG.assetVersion);
  b.rot = 1;
  assert.equal(renderer.spritePreview(b, w), "img/bld/fire_station/10_1.webp?v="+CONFIG.assetVersion);
  b.left = 10;
  assert.equal(renderer.spritePreview(b, w), null);
});
