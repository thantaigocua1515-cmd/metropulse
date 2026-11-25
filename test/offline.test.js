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
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css|fonts|img)\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(refs.length > 20);
  for (const ref of refs) {
    assert.equal(new URL(ref, origin).searchParams.get("v"), version, ref);
    assert.ok(fs.existsSync(path.join(root, ref.split("?")[0])), ref);
  }
  assert.equal([...html.matchAll(/<script defer src=/g)].length, [...html.matchAll(/<script [^>]*src=/g)].length);
  assert.doesNotMatch(html, /thumb\.webp/);
});

test("Be Vietnam Pro uses local Latin and Vietnamese fonts in each weight", () => {
  const style = read("css/style.css");
  for (const weight of [400,600,800]) for (const subset of ["latin","vietnamese"]) {
    const file = "fonts/be-vietnam-pro-"+weight+"-"+subset+".woff2";
    assert.ok(style.includes("../"+file+"?v="+version), file);
    assert.equal(fs.readFileSync(path.join(root,file)).toString("ascii",0,4), "wOF2");
    if (weight===400) assert.ok(html.includes('rel="preload" href="'+file+'?v='+version+'" as="font" type="font/woff2" crossorigin'));
  }
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
    self, caches, URL, Response,
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
  const request = (endpoint, method="GET", mode="same-origin", headers=new Headers()) => {
    let result;
    events.fetch({ request: { url: origin+endpoint, method, mode, headers }, respondWith(promise) { result = promise; } });
    return result;
  };
  const sprite = "img/bld/house_small/01_0.webp?v="+version;
  const hud = "img/art/hud.webp?v="+version;
  const eventArt = "img/art/events-tet-trung-thu.webp?v="+version;
  const music = "audio/turning-pages.mp3?v="+version;
  const fonts = [400,600,800].flatMap(weight => ["latin","vietnamese"].map(subset => "fonts/be-vietnam-pro-"+weight+"-"+subset+".woff2?v="+version));
  assert.ok(fetched.includes(origin+hud));
  assert.ok(!fetched.includes(origin+eventArt));
  assert.ok(!fetched.includes(origin+music));
  assert.ok(fonts.every(font => fetched.includes(origin+font)));
  const seek = () => request(music,"GET","same-origin",new Headers({range:"bytes=1-3"}));
  assert.equal(await (await seek()).text(), "sse");
  await wait("message", { data: { type:"warm", version, urls:[sprite, eventArt, "api/auth/me?v="+version, "https://other.example/img/hud.svg?v="+version] } });
  assert.equal(fetched.filter(url => url === origin+sprite).length, 1);
  assert.ok(!fetched.some(url => url.includes("/api/") || url.includes("other.example")));
  offline = true;
  const audio = await seek();
  assert.equal(audio.status,206);
  assert.equal(audio.headers.get("content-range"),"bytes 1-3/5");
  assert.equal(await audio.text(),"sse");
  assert.equal(await (await request(sprite)).text(), "asset");
  assert.equal(await (await request(hud)).text(), "asset");
  assert.equal(await (await request(eventArt)).text(), "asset");
  for (const font of fonts) assert.equal(await (await request(font)).text(), "asset");
  assert.equal(await (await request("js/main.js?v="+version)).text(), "asset");
  assert.equal(await (await request("?event=tet", "GET", "navigate")).text(), html);
  assert.equal(request("api/health"), undefined);
  assert.equal(request("api/save"), undefined);
  assert.equal(request("api/auth/login", "POST"), undefined);
  assert.equal(request("js/main.js?v=old"), undefined);
});
