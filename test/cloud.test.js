"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");

function setup(){
 const disk=new Map(),localStorage={getItem:key=>disk.get(key)||null,setItem:(key,value)=>disk.set(key,value),removeItem:key=>disk.delete(key)};
 let reloads=0;
 const source=["config","core","storage","cloud"].map(name=>fs.readFileSync(path.join(__dirname,"../public/js",name+".js"),"utf8")).join("\n");
 const {CloudClient,StorageManager,CONFIG}=vm.runInNewContext(source+"\n;({CloudClient,StorageManager,CONFIG})",{localStorage,location:{protocol:"https:",reload:()=>reloads++}});
 const city=(level,code,lastSavedAt)=>{const d=StorageManager.fresh();Object.assign(d.profile,{level,mayorId:code});return {...d,lastSavedAt}};
 return {disk,CloudClient,StorageManager,CONFIG,city,reloads:()=>reloads};
}

test("local cities and trusted legacy migration are scoped to one account or guest",()=>{
 const {disk,CloudClient,StorageManager,CONFIG,city}=setup(),a="MP-AAAAAA",b="MP-BBBBBB";
 disk.set(CONFIG.key,JSON.stringify(city(9,a,1)));
 disk.set(StorageManager.key(b),JSON.stringify(city(5,b,2)));
 assert.equal(StorageManager.load(a).profile.level,9);
 assert.equal(StorageManager.load(b).profile.level,5);
 assert.equal(StorageManager.load().profile.level,1);
 assert.equal(StorageManager.load("MP-CCCCCC").profile.level,1);
 const cloud=new CloudClient();cloud.setToken("first",a);
 const offline=new CloudClient();
 assert.equal(offline.saveCode,a);
 offline.setToken(null);
 assert.equal(new CloudClient().saveCode,null);
});

test("boot prefers a progressed city to a newer starter and asks when progressed branches diverge",()=>{
 const {CloudClient,city}=setup(),cloud=new CloudClient(),code="MP-AAAAAA";
 const remote={rev:5,data:city(6,code,100)};
 assert.equal(cloud.selectBoot({...city(1,code,200),restored:true},remote).profile.level,6);
 const local={...city(8,code,200),restored:true,_cloudBase:4};
 assert.equal(cloud.selectBoot(local,remote).profile.level,8);
 assert.equal(cloud.conflict.remote.rev,5);
 assert.equal(cloud.readMeta("conflict").local.profile.level,8);
 const other=new CloudClient();
 other.selectBoot(local,{...remote,adminRev:6,rev:6});
 assert.equal(other.conflict,undefined);
 assert.equal(other.readMeta("previous-local").profile.level,8);
});

test("409 fetches and retains both versions; only a new explicit choice can write",async()=>{
 const {CloudClient,city,reloads}=setup(),cloud=new CloudClient(),code="MP-AAAAAA";
 const local=city(6,code,200),remote={rev:4,data:city(9,code,100)},calls=[];
 cloud.online=true;cloud.rev=3;
 cloud.sim={storage:{serialize:()=>local,erasing:false}};
 cloud.api=async(path,options)=>{
  calls.push(options?.method||"GET");
  if(calls.length===1)throw Object.assign(Error("Conflict"),{status:409,data:{rev:4}});
  if(!options)return remote;
  assert.equal(options.body.rev,4);
  assert.equal(options.body.confirmRegression,true);
  return {rev:5};
 };
 assert.equal(await cloud.flush(true),false);
 assert.equal(await cloud.flush(true),false);
 assert.equal(cloud.rev,3);
 assert.equal(cloud.conflict.local.profile.level,6);
 assert.equal(cloud.conflict.remote.data.profile.level,9);
 await cloud.resolveConflict("local");
 assert.deepEqual(calls,["PUT","GET"]);
 await cloud.resolveConflict("replace");
 assert.deepEqual(calls,["PUT","GET","PUT"]);
 assert.equal(reloads(),1);
});
