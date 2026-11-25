const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "../public");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const version = html.match(/name="mp-release" content="([^"]+)"/)[1];
const origin = "https://city.example/";

test("shell, assets, and worker share one release version", () => {
  const config = vm.runInNewContext(read("js/config.js") + "\nCONFIG");
  assert.equal(config.assetVersion, version);
  assert.ok(read("sw.js").includes('VERSION="'+version+'"'));
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css|img)\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(refs.length > 20);
  for (const ref of refs) {
    assert.equal(new URL(ref, origin).searchParams.get("v"), version, ref);
    assert.ok(fs.existsSync(path.join(root, ref.split("?")[0])), ref);
  }
  assert.equal([...html.matchAll(/<script defer src=/g)].length, [...html.matchAll(/<script [^>]*src=/g)].length);
  assert.doesNotMatch(html, /thumb\.webp/);
});

test("worker installs a complete shell, caches assets, and leaves API requests on the network", async () => {
  const events = {}, stores = new Map(), fetched = [];
  let offline = false;
  const self = {
    registration: { scope: origin }, addEventListener(name, run) { events[name] = run; },
    async skipWaiting() {}, clients: { async claim() {} }
  };
  const caches = {
    async open(key) {
      if (!stores.has(key)) stores.set(key, new Map());
      const store = stores.get(key);
      return { async match(url) { return store.get(url)?.clone(); }, async put(url, response) { store.set(url, response); } };
    },
    async has(key) { return stores.has(key); },
    async match(url, {cacheName}) { return stores.get(cacheName)?.get(url)?.clone(); },
    async keys() { return [...stores.keys()]; },
    async delete(key) { return stores.delete(key); }
  };
  vm.runInNewContext(read("sw.js"), {
    self, caches, URL,
    async fetch(input) {
      if (offline) throw Error("offline");
      const href = typeof input === "string" ? input : input.url;
      fetched.push(href);
      return href === origin ?
        new Response(html, { headers: { "content-type": "text/html" } }) : new Response("asset");
    }
  });
  const wait = (name, args) => new Promise((resolve) => events[name]({ ...args, waitUntil: resolve }));
  await caches.open("metropulse-static-old");
  await caches.open("another-app");
  await wait("install");
  await wait("activate");
  assert.deepEqual(await caches.keys(), ["another-app", "metropulse-static-"+version]);
  const request = (endpoint, method="GET", mode="same-origin") => {
    let result;
    events.fetch({ request: { url: origin+endpoint, method, mode }, respondWith(promise) { result = promise; } });
    return result;
  };
  const sprite = "img/bld/house_small/01_0.webp?v="+version;
  await wait("message", { data: { type:"warm", version, urls:[sprite, "api/auth/me?v="+version, "https://other.example/img/hud.svg?v="+version] } });
  assert.equal(fetched.filter(url => url === origin+sprite).length, 1);
  assert.ok(!fetched.some(url => url.includes("/api/") || url.includes("other.example")));
  offline = true;
  assert.equal(await (await request(sprite)).text(), "asset");
  assert.equal(await (await request("js/main.js?v="+version)).text(), "asset");
  assert.equal(await (await request("?event=tet", "GET", "navigate")).text(), html);
  assert.equal(request("api/health"), undefined);
  assert.equal(request("api/save"), undefined);
  assert.equal(request("api/auth/login", "POST"), undefined);
  assert.equal(request("js/main.js?v=old"), undefined);
});
