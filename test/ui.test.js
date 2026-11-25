const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const script = name => fs.readFileSync(path.join(__dirname, "../public/js", name + ".js"), "utf8");
const loadUI = globals => vm.runInNewContext(["config", "core", "ui-input", "ui", "ui-dialogs"].map(script).concat("UIController").join("\n"), globals);
const UIController = loadUI({});

test("incidents keep a dispatch control before assignment and only a progress portrait afterward", () => {
  const ui = Object.create(UIController.prototype);
  const w = {crises:[{uid:"fire1",id:"fire",x:5,y:7,age:3,progress:0}],npcs:[],index:new Map([[117,{id:"office_tower",level:1}]])};
  const status = {}, properties = new Map(), attributes = {};
  const child = {style: properties,setAttribute: (key,value) => { attributes[key]=value; }};
  properties.getPropertyValue = properties.get;
  properties.setProperty = properties.set;
  ui.nodes = {incidents:{children:[child]}};
  ui.sim = {social:{world:w,current:null},crisis:{teams:() => [{}]}};
  ui.incidentDock();
  assert.match(ui.nodes.incidents.innerHTML, /class="incident interactive".*data-act="dispatch" data-id="fire1"/);
  assert.match(ui.nodes.incidents.innerHTML, /data-act="incident-details" data-id="fire1"/);
  assert.match(ui.nodes.incidents.innerHTML, /<b>Cháy<\/b><small>Khu Văn phòng · F8<\/small>/);
  assert.doesNotMatch(ui.nodes.incidents.innerHTML, /Còn \d+ giây/);
  w.index.clear();
  ui.incidentDock();
  assert.match(ui.nodes.incidents.innerHTML, /<small>Ô F8<\/small>/);
  ui.refresh = () => {};
  ui.open = (type,tag,title,content) => {
    assert.equal(type,"incident");
    assert.equal(title,"Hỏa hoạn cục bộ");
    assert.match(content,/Mất toàn bộ thu nhập/);
    assert.match(content,/Còn \d+ giây/);
    assert.match(content,/data-act="quick" data-id="fire_station"/);
  };
  ui.sim.crisis.teams = () => [];
  ui.action({dataset:{act:"incident-details",id:"fire1"}});
  ui.nodes["dialog-body"] = {querySelector: () => status};
  ui.incidentDetails("fire1",true);
  assert.match(status.textContent, /Còn \d+ giây/);

  w.npcs.push({target:"fire1",phase:"out",segment:1,part:0.5,path:[{},{},{},{}]});
  ui.incidentDock();
  assert.match(ui.nodes.incidents.innerHTML, /^<button .*data-act="incident-focus".*class="incident-npc"><img/);
  assert.doesNotMatch(ui.nodes.incidents.innerHTML, /data-act="dispatch"/);
  assert.equal(properties.get("--incident-progress"), "25%");
  assert.match(attributes["aria-label"], /Đang đến · 50%/);
  const portrait = ui.nodes.incidents.innerHTML;
  w.npcs[0].phase="repair";w.crises[0].progress=.4;
  ui.incidentDock();
  assert.equal(ui.nodes.incidents.innerHTML, portrait);
  assert.equal(properties.get("--incident-progress"), "70%");
  assert.match(attributes["aria-label"], /Đang sửa · 40%/);
  ui.renderer = {focus: (x,y) => assert.deepEqual([x,y],[5,7])};
  ui.action({dataset:{act:"incident-focus",id:"fire1"}});
});

test("blueprint details show unlock requirements and district hints without selecting the building", () => {
  const ui = Object.create(loadUI({ Districts: { hint: () => "Thưởng khi cạnh nhà ở" } }).prototype);
  ui.sim = { profile: { level: 1 } };
  ui.thumb = () => "thumb.webp";
  ui.open = (type, tag, title, content) => {
    assert.equal(type, "blueprint");
    assert.equal(title, "Tiệm Tạp hóa");
    assert.match(content, /Mở khóa ở cấp 2/);
    assert.match(content, /Thưởng khi cạnh nhà ở/);
    assert.match(content, /Vàng\/giây/);
  };
  ui.select = () => assert.fail("Info must not select a blueprint");
  ui.action({ dataset: { act: "blueprint-info", id: "mini_mart" } });
});

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

test("cloud status has distinct connected and disconnected icons and accessible labels", () => {
  const ui = Object.create(UIController.prototype);
  const button = { dataset: {}, setAttribute(name, value) { this[name] = value; } };
  ui.nodes = { cloud: button };
  ui.sim = { cloud: { enabled: true, online: true, account: {}, status: "syncing" } };
  for (const [state, icon, label] of [
    ["syncing", "cloud", "Đang đồng bộ"],
    ["synced", "cloud", "Đã đồng bộ"],
    ["offline", "cloud-off", "Ngoại tuyến"],
    ["error", "cloud-off", "Lỗi đồng bộ"],
    ["expired", "cloud-off", "Hết phiên"]
  ]) {
    ui.sim.cloud.status = state;
    ui.refreshCloud();
    assert.match(button.innerHTML,new RegExp('href="img/hud\\.svg\\?v=[^#"]+#'+icon+'"'));
    assert.equal(button.dataset.state, state);
    assert.ok(button["aria-label"].includes(label));
    assert.equal(button.title, button["aria-label"]);
  }
  ui.sim.cloud = { enabled: false, online: false, account: null };
  ui.refreshCloud();
  assert.match(button.innerHTML,/href="img\/hud\.svg\?v=[^#"]+#cloud-off"/);
  assert.equal(button.title, "Tài khoản · Lưu trên máy");
});

test("prestige balances and reward amounts use the medal without replacing their text", () => {
  const ui = Object.create(UIController.prototype);
  const medal = /<img class="prestige-icon" src="img\/prestige\.svg\?v=[^"]+" alt="">/;
  assert.match(ui.resource("prestige", "Uy tín"), medal);
  const reward = ui.reward({ coins: 100, prestige: 3, know: 2 });
  assert.match(reward, medal);
  assert.match(reward, /\+3 Uy tín/);
  assert.doesNotMatch(ui.reward({ coins: 100, know: 2 }), medal);
});

test("mission and achievement tabs show ready, unfinished, then rewarded entries", () => {
  const items = ["claimed", "pending", "ready", "pending2"].map(id => ({ id, name: id }));
  const content = { chapters: [], login: [], achievements: items, dailyReward: () => ({}), dailyBonus: () => ({}), achievementReward: () => ({}) };
  const ui = Object.create(loadUI({ CONTENT: content }).prototype);
  const state = ({ id }) => ({ id, text: id, claimed: id === "claimed", done: ["claimed", "ready"].includes(id), cur: 1, goal: 2 });
  ui.tabs = {};
  ui.sim = {
    profile: { level: 1 },
    progress: { story: { claimed: ["claimed"] }, daily: { quests: items } },
    social: { resetTime: () => "" },
    prog: {
      chapter: () => ({ quests: items, reward: {} }),
      questState: state,
      dailyState: state,
      loginState: () => ({ available: false }),
      dailyBonusReady: () => false,
      badges: () => ({ daily: 1, login: 0 }),
      achState: ({ id }) => ({ claimable: id === "ready", complete: id === "claimed", goal: 2, value: 1, tier: 0 })
    }
  };
  for (const tab of ["story", "daily", "ach"]) {
    ui.tabs.missions = tab;
    let body;
    ui.open = (_type, _tag, _title, html) => { body = html; };
    ui.missions();
    assert.deepEqual([...body.matchAll(/<b>(claimed|pending|ready|pending2)<\/b>/g)].map(m => m[1]), ["ready", "pending", "pending2", "claimed"]);
    assert.deepEqual(items.map(x => x.id), ["claimed", "pending", "ready", "pending2"]);
  }
});

test("command drawer resets its idle timer and stays open while pinned", () => {
  let expire;
  const ui = Object.create(loadUI({
    document: { activeElement: null },
    setTimeout: (fn, ms) => { assert.equal(ms, 5000); expire = fn; return fn; },
    clearTimeout: fn => { if (expire === fn) expire = null; }
  }).prototype);
  const toggle = { setAttribute(name, value) { this[name] = value; } };
  const drawer = { contains: () => false };
  ui.nodes = { "rail-toggle": toggle, "command-drawer": drawer };
  ui.commandBadges = 3;
  ui.setCommands(false);
  assert.equal(drawer.inert, true);
  assert.match(toggle.innerHTML, />3<\/sup>/);
  ui.action({ dataset: { act: "rail-toggle" } });
  assert.equal(toggle["aria-expanded"], "true");
  assert.equal(drawer.inert, false);
  assert.doesNotMatch(toggle.innerHTML, /<sup/);
  const first = expire;
  ui.scheduleCommandClose();
  assert.notEqual(expire, first);
  expire();
  assert.equal(drawer.inert, true);
  ui.pinCommands(true);
  ui.setCommands(false);
  assert.equal(drawer.inert, false);
  assert.equal(expire, null);
  ui.pinCommands(false);
  expire();
  assert.equal(drawer.inert, true);
});

test("touch jitter taps, but dragging, holding, pinch and cancellation do not", () => {
  const listeners = {};
  const ui = Object.create(UIController.prototype);
  const picked = [], pans = [], zooms = [];
  ui.canvas = { addEventListener: (type, fn) => { listeners[type] = fn; }, setPointerCapture() {}, classList: { add() {}, remove() {} } };
  ui.renderer = { camera: { x: 0, y: 0, zoom: 1 }, local: e => ({ x: e.x, y: e.y }), pan: (...args) => pans.push(args), zoom: (...args) => zooms.push(args) };
  ui.tool = "look";
  ui.pointers = new Map();
  ui.pick = p => picked.push([p.x, p.y]);
  ui.wireCanvas();
  const send = (type, x, y, id = 1, timeStamp = 50) => listeners[type]({ type, x, y, timeStamp, button: 0, pointerType: "touch", pointerId: id, preventDefault() {} });
  send("pointerdown", 20, 30);
  send("pointermove", 26, 30);
  send("pointerup", 26, 30);
  assert.deepEqual(picked, [[20, 30]]);
  assert.deepEqual(pans, []);
  send("pointerdown", 20, 30);
  send("pointermove", 30, 30);
  send("pointerup", 20, 30);
  assert.deepEqual(pans, [[2, 0]]);
  send("pointerdown", 20, 30);
  send("pointerup", 20, 30, 1, 600);
  send("pointerdown", 20, 30);
  send("pointercancel", 20, 30);
  send("pointerup", 20, 30);
  send("pointerdown", 20, 30);
  send("pointerdown", 40, 30, 2);
  send("pointermove", 50, 30, 2);
  send("pointerup", 50, 30, 2);
  send("pointermove", 40, 30);
  send("pointerup", 40, 30);
  assert.deepEqual(zooms, [[1.5, 35, 30]]);
  assert.deepEqual(picked, [[20, 30]]);
  assert.equal(ui.pointers.size, 0);
});
