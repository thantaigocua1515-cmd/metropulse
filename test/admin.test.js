"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoMemoryReplSet}=require("mongodb-memory-server"),{MongoClient}=require("mongodb");
const {createApp}=require("../server/index");
const {issueSetupToken,totp,matchedStep}=require("../server/admin-auth");
const {heartbeat,overview}=require("../server/analytics");
const {sha}=require("../server/auth");
const {backfill}=require("../scripts/admin-backfill-analytics");
const {recordLogin}=require("../server/liveops");

const ownerPassword="Đủ dài và chỉ dùng thử 2026";
const authCode=(secret,now=Date.now())=>String(totp(secret,Math.floor(now/30000))).padStart(6,"0");
let memory,client,db,server,base,cookie;
test.before(async()=>{
 memory=await MongoMemoryReplSet.create({replSet:{count:1}});client=await MongoClient.connect(memory.getUri());db=client.db("admin_test");
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

test("live announcements enforce origin and publish only active, in-window content by priority",async()=>{
 const marker="Q".repeat(43),expiry=new Date(Date.now()+900000),owner=await db.collection("admins").findOne({_id:"owner"});
 await db.collection("adminSessions").insertOne({_id:sha(marker),epoch:owner.epoch,expiresAt:expiry,absoluteExpiresAt:expiry});
 cookie="__Host-mp_admin="+marker;
 const post=(title,more={})=>admin("/announcements",{method:"POST",body:{title,body:"Tin từ ban điều hành",priority:0,active:true,...more}});
 assert.equal((await request("/admin/announcements")).status,401);
 assert.equal((await admin("/announcements",{origin:"https://other.invalid",method:"POST",body:{}})).status,403);
 assert.equal((await post("Ảnh lỗi",{image:"javascript:void(0)"})).status,400);
 const first=await post("Thông báo đầu tiên");
 assert.equal(first.status,201);
 const next=new Date(Date.now()+86400000).toISOString();
 assert.equal((await post("Thông báo tương lai",{start:next})).status,201);
 assert.equal((await post("Ưu tiên",{priority:10})).status,201);
 assert.deepEqual((await request("/announcements")).data.rows.map(r=>r.title),["Ưu tiên","Thông báo đầu tiên"]);
 assert.equal((await admin("/announcements/"+first.data.row._id,{method:"PUT",body:{
  title:"Thông báo đã sửa",body:"Ẩn",priority:100,active:false
 }})).status,200);
 assert.deepEqual((await request("/announcements")).data.rows.map(r=>r.title),["Ưu tiên"]);
 assert.equal((await admin("/announcements/"+first.data.row._id,{method:"DELETE"})).status,200);
 assert.ok(await db.collection("adminAudit").findOne({action:"announcement.delete",target:first.data.row._id}));
});

test("broadcast mail reaches future guests, targeted mail stays private and claims apply atomically",async()=>{
 const send=async(body)=>(await admin("/mail",{method:"POST",body:{title:"Quà",body:"Quà thử",...body}}));
 const broadcast=await send({target:"all",rewards:{skin:"tet",coins:135,prestige:2,knowledge:3}});
 assert.equal(broadcast.status,201);
 const create=async()=>(await request("/auth/guest",{method:"POST",body:{}})).data;
 const receiver=await create(),other=await create();
 const letter=broadcast.data.row.id,token=receiver.token;
 assert.equal(receiver.loginDays,1);
 const targeted=await send({target:"player",code:receiver.account.code,rewards:{skin:"noel"}});
 assert.equal(targeted.status,201);
 assert.equal((await send({target:"all",rewards:{coins:-1}})).status,400);
 assert.equal((await send({target:"all",expiresAt:new Date(Date.now()+86400000).toISOString(),rewards:{coins:1}})).status,400);
 assert.deepEqual((await request("/mailbox",{token:other.token})).data.letters.map(row=>row.id),[letter]);
 const claim=(id,credential=token)=>request("/mailbox/"+id+"/claim",{token:credential,method:"POST",body:{}});
 assert.equal((await claim(targeted.data.row.id,other.token)).status,404);
 const save=(rev,data)=>request("/save",{token,method:"PUT",body:{rev,data}});
 assert.equal((await save(0,{...initialCity,profile:{...initialCity.profile,skin:"tet"}})).status,403);
 assert.equal((await save(0,initialCity)).status,200);
 const results=await Promise.all([claim(letter),claim(letter.toUpperCase())]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const after=await request("/save",{token});
 assert.equal(after.data.rev,2);
 assert.equal(after.data.adminRev,2);
 assert.equal(after.data.data.profile.coins,initialCity.profile.coins+135);
 assert.equal(after.data.data.profile.prestige,initialCity.profile.prestige+2);
 assert.equal(after.data.data.profile.knowledge,initialCity.profile.knowledge+3);
 assert.deepEqual((await request("/me",{token})).data.skinPacks,["tet"]);
 assert.equal((await save(2,{...after.data.data,profile:{...after.data.data.profile,skin:"tet"}})).status,200);
 assert.equal((await request("/mailbox",{token})).data.unread,1);
 assert.equal((await claim(targeted.data.row.id)).status,200);
 assert.equal((await request("/mailbox",{token})).data.unread,0);
 assert.equal((await admin("/mail")).data.rows.find(row=>row.id===letter).claims,1);
 assert.ok(await db.collection("adminAudit").findOne({action:"mail.send",target:letter}));
});

test("each new skin is locked until a player claims it from admin mail",async()=>{
 const {data:{account,token}}=await request("/auth/guest",{method:"POST",body:{}});
 const packs=["sakura","desert","jungle","ocean","steampunk"];
 const save=(rev,skin)=>request("/save",{token,method:"PUT",body:{rev,data:{...initialCity,profile:{...initialCity.profile,skin}}}});
 for(const [rev,skin] of packs.entries()){
  assert.equal((await save(rev,skin)).status,403,skin);
  const sent=await admin("/mail",{method:"POST",body:{
   title:skin,body:"Bộ skin mới",target:"player",code:account.code,rewards:{skin}
  }});
  assert.equal(sent.status,201,skin);
  const claimed=await request("/mailbox/"+sent.data.row.id+"/claim",{token,method:"POST",body:{}});
  assert.equal(claimed.status,200,skin);
  assert.deepEqual(claimed.data.skinPacks,packs.slice(0,rev+1));
  assert.equal((await save(rev,skin)).status,200,skin);
 }
});

test("Cyberpunk is granted once after seven distinct Vietnam login days, even for guests",async()=>{
 const {data:{account,token}}=await request("/auth/guest",{method:"POST",body:{}});
 const players=db.collection("players"),player=await players.findOne({code:account.code});
 const login=(value)=>recordLogin(db,player,new Date(value));
 await login("2025-12-01T16:55:00Z");
 await login("2025-12-01T16:59:00Z");
 for(const day of ["01","04","06","09"])await login("2025-12-"+day+"T17:00:00Z");
 const before=await request("/me",{token});
 assert.equal(before.data.loginDays,6);
 assert.deepEqual(before.data.skinPacks,[]);
 const last=await Promise.all([login("2025-12-15T17:00:00Z"),login("2025-12-16T17:00:00Z")]);
 assert.ok(last.every(result=>result.loginDays===7));
 assert.deepEqual((await request("/me",{token})).data.skinPacks,["cyberpunk"]);
 const {letters}=((await request("/mailbox",{token})).data);
 assert.equal(letters.filter(row=>row.id==="login-reward").length,1);
 assert.equal((await request("/mailbox/login-reward/claim",{token,method:"POST",body:{}})).status,200);
 assert.equal((await request("/mailbox/login-reward/claim",{token,method:"POST",body:{}})).status,409);
});
