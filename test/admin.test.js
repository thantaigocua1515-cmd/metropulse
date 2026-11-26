"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoMemoryServer}=require("mongodb-memory-server"),{MongoClient}=require("mongodb");
const {createApp}=require("../server/index");
const {issueSetupToken,totp,matchedStep}=require("../server/admin-auth");
const {heartbeat,overview}=require("../server/analytics");
const {sha}=require("../server/auth");
const {backfill}=require("../scripts/admin-backfill-analytics");

const ownerPassword="Đủ dài và chỉ dùng thử 2026";
const authCode=(secret,now=Date.now())=>String(totp(secret,Math.floor(now/30000))).padStart(6,"0");
let memory,client,db,server,base,cookie;
test.before(async()=>{
 memory=await MongoMemoryServer.create();client=await MongoClient.connect(memory.getUri());db=client.db("admin_test");
 server=createApp(()=>db).listen(0,"127.0.0.1");
 await new Promise(resolve=>server.once("listening",resolve));
 base="http://127.0.0.1:"+server.address().port;
});
test.after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await client?.close();await memory?.stop()});
const request=async(path,{method="GET",body,session,origin=base,token,ip,fetchSite}={})=>{
 const r=await fetch(base+"/api"+path,{method,headers:{...(origin?{Origin:origin}:{}),...(body?{"Content-Type":"application/json"}:{}),
  ...(fetchSite?{"Sec-Fetch-Site":fetchSite}:{}),
  ...(session?{Cookie:session}:{}),...(token?{Authorization:"Bearer "+token}:{}),...(ip?{"X-Forwarded-For":ip}:{})},body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:r.status===204?{}:await r.json(),headers:r.headers};
};
const admin=(path,opts={})=>request("/admin"+path,{session:cookie,...opts});
const sessionFrom=r=>r.headers.get("set-cookie")?.split(";")[0];
const initialCity={version:2,profile:{mayorName:"Tân Thành",cityName:"Cồn Xanh",level:1,xp:1,coins:500,prestige:10,knowledge:0},
 world:{buildings:[{id:"road",x:7,y:7,level:1,left:0}]},progress:{stats:{}}};

test("TOTP matches RFC 6238 SHA-1 test vector with six displayed digits",()=>{
 const secret=Buffer.from("12345678901234567890").toString("hex");
 assert.equal(totp(secret,1),287082);
 assert.equal(matchedStep(secret,"287082",59000),1);
 assert.equal(matchedStep(secret,"287082",120000),null);
});

test("admin accepts configured, default and same-host Vercel origins but rejects cross-site requests",async t=>{
 for(const key of ["ADMIN_ORIGIN","VERCEL_PROJECT_PRODUCTION_URL","VERCEL"]){
  const previous=process.env[key];
  t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous});
 }
 delete process.env.ADMIN_ORIGIN;
 process.env.VERCEL_PROJECT_PRODUCTION_URL="metro-project.vercel.app";
 process.env.VERCEL="1";
 const defaultOrigin="https://metropulse-nu.vercel.app",sameHost=base.replace("http:","https:");
 const mutate=async(origin,fetchSite)=>(await request("/admin/logout",{method:"POST",origin,fetchSite})).status;
 assert.equal(await mutate(defaultOrigin),401);
 process.env.ADMIN_ORIGIN="https://admin.example.com";
 for(const origin of [defaultOrigin,"https://admin.example.com","https://metro-project.vercel.app",sameHost]){
  assert.equal(await mutate(origin,"same-origin"),401);
  assert.equal(await mutate(origin,"cross-site"),403);
 }
 assert.equal(await mutate("https://other.example.com"),403);
 assert.equal(await mutate(base),403);
 delete process.env.VERCEL;
 assert.equal(await mutate(sameHost),403);
});

test("owner setup, Origin, session expiry, one-use recovery and cross-IP lockout",async()=>{
 assert.equal((await request("/admin/overview")).status,401);
 assert.match((await fetch(base+"/admin/")).headers.get("content-security-policy"),/frame-ancestors 'none'/);
 assert.equal((await fetch(base+"/admin/")).headers.get("cache-control"),"no-store");
 let {token}=await issueSetupToken(db);
 assert.equal((await request("/admin/setup/start",{method:"POST",body:{token},origin:"https://evil.invalid"})).status,403);
 const pending=await db.collection("admins").findOne({_id:"owner"});
 assert.equal(pending.setupHash,sha(token));
 await db.collection("admins").updateOne({_id:"owner"},{$set:{setupExpiresAt:new Date(0)}});
 assert.equal((await request("/admin/setup/start",{method:"POST",body:{token}})).status,401);
 ({token}=await issueSetupToken(db));
 const start=await request("/admin/setup/start",{method:"POST",body:{token}});
 assert.equal(start.status,200);assert.match(start.data.qr,/^data:image\/png;base64,/);
 const secret=(await db.collection("admins").findOne({_id:"owner"})).setupSecret;
 const body={token,username:"OwnerTest",password:ownerPassword,code:authCode(secret)};
 const outcomes=await Promise.all([request("/admin/setup",{method:"POST",body,ip:"192.0.2.1"}),request("/admin/setup",{method:"POST",body,ip:"192.0.2.2"})]);
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[201,401]);
 const created=outcomes.find(r=>r.status===201),codes=created.data.codes;
 cookie=sessionFrom(created);
 for(const value of ["Secure","HttpOnly","SameSite=Strict","Path=/"])assert.ok(created.headers.get("set-cookie").includes(value));
 const owner=await db.collection("admins").findOne({_id:"owner"});
 assert.equal(owner.setupHash,undefined);assert.equal(owner.setupSecret,undefined);
 assert.ok(owner.pass.hash);assert.equal(owner.recovery.length,10);assert.ok(!owner.recovery.includes(codes[0]));
 await assert.rejects(issueSetupToken(db),error=>error.status===409);
 assert.equal((await admin("/session")).status,200);
 assert.equal((await admin("/logout-all",{method:"POST",origin:null,body:{}})).status,403);
 const live=await request("/admin/login",{method:"POST",body:{username:body.username,password:ownerPassword,code:codes[0]}});
 assert.equal(live.status,200);
 const reused=()=>request("/admin/login",{method:"POST",body:{username:body.username,password:ownerPassword,code:codes[0]},ip:"192.0.2.5"});
 assert.equal((await reused()).status,401);
 const replay=await request("/admin/login",{method:"POST",body:{username:body.username,password:ownerPassword,code:body.code},ip:"192.0.2.6"});
 assert.equal(replay.status,401);
 const other=sessionFrom(live),hash=sha(other.split("=")[1]);
 await db.collection("adminSessions").updateOne({_id:hash},{$set:{expiresAt:new Date(0)}});
 assert.equal((await admin("/session",{session:other})).status,401);
 await db.collection("adminSessions").updateOne({_id:hash},{$set:{expiresAt:new Date(Date.now()+60000),absoluteExpiresAt:new Date(0)}});
 assert.equal((await admin("/session",{session:other})).status,401);
 const wrong=ip=>request("/admin/login",{method:"POST",body:{username:"OwnerTest",password:"Wrong password",code:"000000"},ip});
 assert.equal((await wrong("192.0.2.7")).status,401);
 assert.equal((await wrong("192.0.2.8")).status,429);
 assert.equal((await wrong("192.0.2.9")).status,429);
 assert.equal((await admin("/session")).status,200);
});

test("owner manages resources, events, moderation, and all sessions without exposing secrets",async()=>{
 const credentials={username:"player_test",password:"not-real-123"};
 const signup=await request("/auth/signup",{method:"POST",body:credentials});
 assert.equal(signup.status,201);
 const {token,account:{code}}=signup.data,basePath="/users/"+code;
 const save=await request("/save",{method:"PUT",body:{rev:0,data:initialCity},token});
 assert.equal(save.status,200);
 assert.equal((await admin("/users?q=player_test")).data.total,1);
 const detail=(await admin(basePath)).data;
 assert.equal(detail.save.resources.coins,500);
 assert.ok(!JSON.stringify(detail).includes(sha(token)));
 const resources=await admin(basePath+"/resources",{method:"PATCH",body:{rev:save.data.rev,resources:{coins:4000,level:2}}});
 assert.equal(resources.status,200);
 const conflict=await request("/save",{method:"PUT",body:{rev:save.data.rev,data:initialCity},token});
 assert.deepEqual([conflict.status,conflict.data.adminEdited],[409,true]);
 const edited=await request("/save",{token});
 assert.equal(edited.data.data.profile.coins,4000);assert.equal(edited.data.adminRev,resources.data.rev);
 const chat=await request("/chat",{method:"POST",body:{text:"Xin chào mọi người",channel:"world"},token});
 assert.equal(chat.status,201);
 assert.equal((await admin("/chat/"+chat.data.message.id,{method:"PATCH",body:{hidden:true}})).status,200);
 assert.equal((await request("/chat",{token})).data.messages.length,0);
 assert.equal((await admin(basePath+"/ban",{method:"POST",body:{banned:true}})).status,200);
 assert.equal((await request("/chat",{token})).status,401);
 assert.equal((await request("/auth/login",{method:"POST",body:credentials})).status,401);
 assert.equal((await admin(basePath+"/ban",{method:"POST",body:{banned:false}})).status,200);
 assert.equal((await request("/auth/login",{method:"POST",body:credentials})).status,200);
 const event={kind:"flash",template:"rush-hour",name:"Tân Thành về đêm",start:"2026-08-04T10:00:00Z",end:"2026-08-04T12:00:00Z",enabled:true,multiplier:2,rewards:[20,40,80]};
 assert.equal((await admin("/events/pho-dem",{method:"PUT",body:{...event,multiplier:9}})).status,400);
 assert.equal((await admin("/events/pho-dem",{method:"PUT",body:event})).status,200);
 const eventConfig=await request("/events/config");
 assert.equal(eventConfig.data.rows[0]._id,"pho-dem");assert.match(eventConfig.headers.get("cache-control"),/max-age=60/);
 assert.equal((await admin(basePath,{method:"DELETE",body:{confirm:"wrong"}})).status,400);
 assert.equal((await admin(basePath,{method:"DELETE",body:{confirm:code}})).status,200);
 assert.equal((await admin(basePath)).status,404);
 assert.ok((await admin("/audit")).data.rows.some(r=>r.action==="user.resources"&&r.before.coins===500&&r.after.coins===4000));
 assert.equal((await admin("/logout-all",{method:"POST",body:{}})).status,200);
 assert.equal((await admin("/session")).status,401);
});

test("presence deduplicates accounts across devices and aggregates activity, retention and concurrent usage",async()=>{
 const first=new Date("2026-11-01T09:00:00Z"),day=86400000;
 const account={code:"MP-COHORT",createdAt:first};
 const pulse=(device,session,who,time)=>heartbeat(db,{device:device.repeat(32),session:session.repeat(32),account:who},new Date(time));
 await pulse("a","1",account,+first);await pulse("b","2",account,+first+day);
 await pulse("c","3",account,+first+7*day);
 const last=+first+30*day;
 await pulse("d","4",account,last);await pulse("d","4",account,last+60000);
 await pulse("e","5",account,last+62000);
 await pulse("f","6",null,last+63000);
 const d=await overview(db,30,new Date(last+64000));
 assert.deepEqual([d.online,d.dau,d.wau,d.mau],[2,2,2,2]);
 assert.ok(d.averageSeconds>0);
 assert.deepEqual(d.cohorts.find(c=>c.day==="2026-11-01"),{day:"2026-11-01",size:1,d1:1,d7:1,d30:1});
 assert.ok(d.ccu.some(c=>c.value===1));
 assert.equal((await overview(db,1,new Date(last+220000))).online,0);
});

test("historical backfill adds last activity idempotently without fabricating simultaneous users",async()=>{
 const now=new Date(),day=86400000,code="MP-HISTORY";
 await db.collection("players").insertOne({code,createdAt:new Date(+now-8*day),lastSeenAt:new Date(+now-day)});
 assert.equal(await backfill(db,now),1);
 assert.equal(await backfill(db,now),0);
 const rows=await db.collection("playDays").find({player:"p:"+code}).toArray();
 assert.equal(rows.length,1);
 assert.equal(rows[0].source,"lastSeenAt");
 assert.equal(await db.collection("playSessions").countDocuments({player:"p:"+code}),0);
});
