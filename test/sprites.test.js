const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "../public");
const { CONFIG, SPRITES, SKIN_SPRITES, IsoRenderer, makeWorld, makeBuilding, CityLife, STREET, streetHeading, streetPose, streetNetwork, walkRoute, streetCrewPose } = vm.runInNewContext(
  ["config", "sprites", "skin-sprites", "core", "citylife", "renderer"].map(file => fs.readFileSync(path.join(root, "js", file + ".js"), "utf8")).join("\n") +
  "\n({ CONFIG, SPRITES, SKIN_SPRITES, IsoRenderer, makeWorld, makeBuilding, CityLife, STREET, streetHeading, streetPose, streetNetwork, walkRoute, streetCrewPose })"
);
const renderer = Object.create(IsoRenderer.prototype);

test("graphics tiers limit backing pixels and idle animations without changing the view", () => {
  const r=Object.assign(Object.create(IsoRenderer.prototype),{
    canvas:{getBoundingClientRect:()=>({width:390,height:844,left:0,top:0})},
    camera:{x:160,y:400,zoom:1.3},width:390,height:844,hover:null
  });
  const run=vm.runInNewContext(["config","core","citylife","renderer"].map(file=>fs.readFileSync(path.join(root,"js",file+".js"),"utf8")).join("\n")+
    "\n;({set:IsoRenderer.prototype.setQuality,resize:IsoRenderer.prototype.resize})",{devicePixelRatio:3,localStorage:{setItem:(key,value)=>{r.saved=[key,value]}}});
  r.resize=run.resize;
  run.set.call(r,"balanced");
  assert.equal(r.canvas.width,488);
  assert.equal(r.frameRate(),30);
  r.lastView={...r.camera,hover:null};
  assert.equal(r.frameRate(),24);
  run.set.call(r,"battery");
  assert.equal(r.canvas.width,390);
  assert.equal(r.frameRate(),15);
  assert.deepEqual(r.saved,["mp-graphics","battery"]);
  assert.equal(r.camera.zoom,1.3);
  assert.equal(r.inView({x:0,y:850},20,20),true);
  assert.equal(r.inView({x:0,y:900},20,20),false);
});

test("mobile framing and marker picking favor readable, reachable city actions", () => {
  const r = Object.assign(Object.create(IsoRenderer.prototype), { width: 390, height: 800 });
  r.center();
  assert.equal(r.camera.zoom, 1.1);
  const crisis = { crisis: {}, x: 100, y: 100, r: 22 };
  const bubble = { bubble: {}, x: 124, y: 100, r: 22 };
  const building = { building: {}, polys: [] };
  r.hits = [building, bubble, crisis];
  assert.equal(r.hit({ x: 120, y: 100 }), bubble);
  assert.equal(r.hit({ x: 120, y: 100 }, false), crisis);
  assert.equal(r.hit({ x: 120, y: 100 }, false, false), null);
});

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

test("building art is anchored to a single tile at any zoom", () => {
  const calls = [], art = {};
  const r = Object.assign(Object.create(IsoRenderer.prototype), {
    project: (x,y) => ({x:x*10,y:y*10}),
    camera: {zoom:1.8},
    ctx: {drawImage: (...args) => calls.push(args)}
  });
  for (const [id, meta] of Object.entries(SPRITES)) {
    if (id === "road") continue;
    assert.ok(meta.ax > 0 && meta.ay > 0 && meta.w > meta.ax && meta.h > meta.ay, id);
    assert.ok(meta.ax <= CONFIG.tileW/2 && meta.w-meta.ax <= CONFIG.tileW/2, id);
    assert.ok(meta.h-meta.ay <= CONFIG.tileH/2+1, id);
    assert.ok(meta.tops.flat().every(top => top <= meta.ay), id);
    const box = r.drawSprite(art,meta,8,9);
    assert.deepEqual(calls.pop(),[art,box.x,box.y,box.w,box.h],id);
    assert.equal(box.x+meta.ax*r.camera.zoom,85,id);
    assert.equal(box.y+meta.ay*r.camera.zoom,95,id);
  }
});

test("each skin covers every building level and facing and fits the same single tile", () => {
  assert.deepEqual(Object.keys(SKIN_SPRITES).sort(), ["cyberpunk","noel","tet"]);
  for(const [pack,buildings] of Object.entries(SKIN_SPRITES)){
    assert.ok(fs.existsSync(path.join(root,"img/skins",pack,"badge.webp")));
    assert.deepEqual(Object.keys(buildings).sort(),Object.keys(SPRITES).filter(id=>id!=="road").sort());
    for(const [id,meta] of Object.entries(buildings)){
      assert.deepEqual(fs.readdirSync(path.join(root,"img/skins",pack,id)).sort(),fs.readdirSync(path.join(root,"img/bld",id)).sort());
      assert.ok(meta.ax<=CONFIG.tileW/2&&meta.w-meta.ax<=CONFIG.tileW/2&&meta.h-meta.ay<=CONFIG.tileH/2+1);
      assert.equal(meta.tops.length,CONFIG.maxLevel);
      assert.ok(meta.tops.every(row=>row.length===4&&row.every(top=>top>0&&top<=meta.ay)));
    }
  }
});

test("owned skin is requested only for the player's city and previews fall back on unavailable art",()=>{
  const b=makeBuilding("fire_station",8,8,10),w=makeWorld([b]);
  const calls=[];
  let state=-1,owned=false;
  const r=Object.assign(Object.create(IsoRenderer.prototype),{
    sim:{world:w,profile:{skin:"noel"},cloud:{ownsSkin:id=>owned&&id==="noel"}},
    requestSprite(id,frame,skin){calls.push([id,frame,skin]);return {state}}
  });
  assert.match(r.preloadCity(w)[0],/^img\/bld\//);
  owned=true;
  assert.match(r.preloadCity(w)[0],/^img\/skins\/noel\/fire_station\/10_0\.webp/);
  assert.match(r.spritePreview(b,w),/^img\/bld\//);
  state=1;
  assert.match(r.spritePreview(b,w),/^img\/skins\/noel\//);
  assert.match(r.spritePreview(b,makeWorld([b])),/^img\/bld\//);
  assert.deepEqual(calls.map(call=>call[2]),["default","noel","noel","noel"]);
});

test("road joins share curb and asphalt profiles and get one centered stripe", () => {
  const world = makeWorld([[8,8],[9,8],[8,9],[8,10],[6,6]].map(([x,y]) => makeBuilding("road",x,y)));
  const layers = [];
  const ctx = {
    beginPath() {this.paths=[]},
    moveTo(x,y) {this.points=[[x,y]]},
    lineTo(x,y) {this.points.push([x,y])},
    quadraticCurveTo(x,y,u,v) {this.points.push([x,y],[u,v])},
    closePath() {this.paths.push(this.points)},
    fill() {layers.push(this.paths)}
  };
  const r = Object.assign(Object.create(IsoRenderer.prototype), {ctx,project:(x,y)=>({x,y})});
  r.roads(world);
  const [sidewalks,curbs,asphalt,stripes] = layers;
  assert.equal(curbs.length,5);
  assert.equal(asphalt.length,5);
  for (const [shapes,half] of [[sidewalks,STREET.sidewalk],[curbs,.30],[asphalt,.255]]) {
    for(const [tile,x] of [[0,9.02],[1,8.98]]) {
      assert.deepEqual(shapes[tile].filter(([u])=>u===x).map(([,y])=>y).sort(),[8.5-half,8.5+half]);
    }
    for(const [tile,y] of [[0,9.02],[2,8.98]]) {
      assert.deepEqual(shapes[tile].filter(([,v])=>v===y).map(([x])=>x).sort(),[8.5-half,8.5+half]);
    }
  }
  assert.deepEqual(stripes.map(points => {
    const [x,y]=points[0], [u,v]=points[2];
    return [(x+u)/2,(y+v)/2];
  }), [[9,8.5],[8.5,9],[8.5,10]]);
});

test("right-hand vehicle turns and dead-end reversals join the next lane without a jump", () => {
  const tile={x:8,y:8},east={x:9,y:8};
  const pose=(incoming,outgoing,t)=>streetPose(tile,incoming,outgoing,t);
  assert.equal(pose(0,0,.5).y,8+STREET.lane);
  assert.equal(pose(1,1,.5).y,8-STREET.lane);
  assert.ok(pose(0,2,.5).dx>0&&pose(0,2,.5).dy>0);
  const end=pose(2,0,1),start=streetPose(east,0,0,0);
  assert.deepEqual([end.x,end.y],[start.x,start.y]);
  const turn=pose(0,1,.5);
  assert.ok(turn.x>7.5&&turn.x<8.3&&Math.abs(turn.y-8)<.001);
  assert.ok(pose(0,1,.25).dx>0&&pose(0,1,.75).dx<0);
  assert.equal(pose(0,1,1).y,8-STREET.lane);
});

test("sprite heading distinguishes rear art facing left and right on all four isometric headings", () => {
  const directions=[[1,0],[-1,0],[0,1],[0,-1]];
  for (const [rearRight, expected] of [[false,["front:false","rear:false","front:true","rear:true"]],
   [true,["front:false","rear:true","front:true","rear:false"]]]) {
    assert.deepEqual(directions.map(([dx,dy])=>{
      const {side,mirror}=streetHeading(dx,dy,rearRight);
      return side+":"+mirror;
    }),expected);
  }
});

test("walk routes connect homes to destinations and only cross a road arm at a junction", () => {
  const buildings=[
    ...[[6,8],[7,8],[8,8],[9,8],[8,7],[12,12]].map(([x,y])=>makeBuilding("road",x,y)),
    makeBuilding("house_small",7,7),makeBuilding("mini_mart",9,9),makeBuilding("mini_mart",12,13)
  ];
  const net=streetNetwork(makeWorld(buildings,16));
  const paths=net.homes.flatMap(home=>net.places.map(place=>walkRoute(home,place)).filter(Boolean));
  assert.ok(paths.length>0);
  assert.ok(paths.every(path=>Math.round(path.at(-1).x)===9));
  for(const path of paths)for(let i=1;i<path.length;i++){
    const [a,b]=[path[i-1],path[i]];
    assert.ok(a.x===b.x||a.y===b.y);
    if(Math.round(a.x)===Math.round(b.x)&&Math.round(a.y)===Math.round(b.y)&&a.x===b.x&&a.x>6.5&&a.x<8.5) {
      assert.equal(Math.round(a.x),8);
    }
  }
});

test("traffic waits behind occupied junctions and dispatch crews follow their original path", () => {
  const w=makeWorld([[7,8],[8,8],[9,8],[9,7],[10,8],[6,8]].map(([x,y])=>makeBuilding("road",x,y)),16);
  const life=new CityLife({});
  life.network=streetNetwork(w);
  const a={car:true,tile:w.buildings[1],incoming:0,exit:0,part:.81,velocity:1,speed:1,...streetPose(w.buildings[1],0,0,.81)};
  const blocker={car:true,tile:w.buildings[2],incoming:0,exit:3,part:.4,...streetPose(w.buildings[2],0,3,.4)};
  life.agents=[a,blocker];
  assert.equal(life.drive(a,w,.1,false,[]),true);
  assert.equal(a.part,.82);
  life.agents=[a];
  for(let i=0;i<8;i++)life.drive(a,w,.1,false,[]);
  assert.equal(a.tile.x,9);
  assert.notEqual(a.exit,1);
  const path=[w.buildings[1],w.buildings[2],w.buildings[3]];
  const crew={path,segment:0,part:.5,level:4,phase:"out"};
  const p=streetCrewPose(crew,w);
  assert.deepEqual([p.x,p.y],[8.5,8+STREET.lane]);
  assert.deepEqual(crew.path,path);
});
