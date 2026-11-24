const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const script = name => fs.readFileSync(path.join(__dirname, "../public/js", name + ".js"), "utf8");
const UIController = vm.runInNewContext(["core", "ui-input", "ui"].map(script).concat("UIController").join("\n"));

test("quest tracker expands, prioritizes claimable quests, and hides during visits", () => {
  const ui = Object.create(UIController.prototype);
  const tracker = { innerHTML: "", hidden: false };
  const quests = [{ id: "claimed", name: "Đã nhận" }, { id: "pending", name: "Chưa xong" }, { id: "ready", name: "Sẵn sàng" }];
  ui.nodes = { "quest-track": tracker };
  ui.sim = {
    social: { current: null },
    progress: { story: { claimed: ["claimed"] } },
    prog: {
      chapter: () => ({ title: "Chương một", quests }),
      questState: ({ id }) => ({ claimed: id === "claimed", done: id === "ready", cur: 1, goal: 2 })
    }
  };
  ui.questOpen = false;
  ui.refresh = () => ui.questTracker({ story: 1 });
  ui.refresh();
  assert.match(tracker.innerHTML, /aria-expanded="false".*1\/3/);
  assert.doesNotMatch(tracker.innerHTML, /quest-body/);

  const toggle = { dataset: { act: "quest-toggle" } };
  ui.action(toggle);
  assert.match(tracker.innerHTML, /aria-expanded="true"/);
  assert.match(tracker.innerHTML, /data-act="claim" data-id="ready"/);
  assert.doesNotMatch(tracker.innerHTML, /Chưa xong|Đã nhận/);
  ui.action(toggle);
  assert.doesNotMatch(tracker.innerHTML, /quest-body/);

  ui.sim.social.current = { id: "friend" };
  ui.refresh();
  assert.equal(tracker.hidden, true);
  ui.sim.social.current = null;
  ui.refresh();
  assert.equal(tracker.hidden, false);
});
