"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoMemoryReplSet}=require("mongodb-memory-server");
const db=require("../server/db"),{createApp}=require("../server/index");

let mongo,server,base;
const call=async(path,{method="GET",token,body}={})=>{
 const res=await fetch(base+"/api"+path,{method,headers:{...(body?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json()};
};
const city=(level=1,extra=[])=>({version:2,profile:{mayorName:"Thử Nghiệm",level,xp:0,coins:500,prestige:10,knowledge:0,happiness:104,helpsGiven:2},
 world:{buildings:[{id:"road",x:7,y:7,level:1,left:0},{id:"house_small",x:7,y:8,level:2,left:0},...extra]},progress:{stats:{peakIncome:12}},friends:[],lastSavedAt:Date.now()});

test.before(async()=>{
 mongo=await MongoMemoryReplSet.create({replSet:{count:1}});await db.connect(mongo.getUri(),"metropulse_test");
 server=createApp(()=>db.db).listen(0);base="http://127.0.0.1:"+server.address().port;
});
test.after(async()=>{server.close();await db.close();await mongo.stop()});

test("chat is authenticated, filtered, rate-limited and private to friends",async()=>{
 const guest=async()=>(await call("/auth/guest",{method:"POST",body:{}})).data;
 const [a,b,c]=await Promise.all([guest(),guest(),guest()]);
 const post=(token,text,channel="world")=>call("/chat",{method:"POST",token,body:{text,channel}});
 assert.equal((await call("/chat")).status,401);
 assert.equal((await post(a.token,"x".repeat(241))).status,400);
 assert.equal((await post(a.token,"Địt mẹ")).status,400);
 const world=await post(a.token,"Chúc thành phố lớn nhanh!");
 assert.equal(world.status,201);
 assert.equal((await post(a.token,"Gửi quá nhanh")).status,429);
 assert.equal((await call("/chat/activity",{token:b.token})).data.world,world.data.message.id);
 assert.equal((await call("/chat?channel="+a.account.code,{token:b.token})).status,403);
 assert.equal((await call("/save",{method:"PUT",token:a.token,body:{rev:0,data:city()}})).status,200);
 assert.equal((await call("/friends",{method:"POST",token:b.token,body:{code:a.account.code}})).status,201);
 const dm=await post(b.token,"Hẹn ở chợ cuối tuần!",a.account.code);
 assert.equal(dm.status,201);
 assert.equal((await call("/chat?channel="+b.account.code,{token:a.token})).data.messages[0].text,"Hẹn ở chợ cuối tuần!");
 assert.equal((await call("/chat/activity",{token:a.token})).data.dms[0].code,b.account.code);
 assert.equal((await call("/chat?channel="+b.account.code,{token:c.token})).status,403);
 assert.ok(!(await call("/chat",{token:c.token})).data.messages.some(m=>m.id===dm.data.message.id));
 assert.equal((await fetch(base+"/api/chat",{headers:{Authorization:"Bearer "+a.token}})).headers.get("cache-control"),"no-store");
});

test("weekly co-op counts at most one gift per sender per day and claims are atomic",async(t)=>{
 const guest=async()=>(await call("/auth/guest",{method:"POST",body:{}})).data;
 const [a,b]=await Promise.all([guest(),guest()]);
 await Promise.all([a,b].map(p=>call("/save",{method:"PUT",token:p.token,body:{rev:0,data:city()}})));
 assert.equal((await call("/friends",{method:"POST",token:a.token,body:{code:b.account.code}})).status,201);
 const endpoint="/coop/"+b.account.code;
 const claim=()=>call(endpoint+"/claim",{method:"POST",token:a.token});
 assert.equal((await claim()).status,409);
 const give=(from,to)=>call("/assist",{method:"POST",token:from.token,body:{code:to.account.code}});
 for(const [from,to] of [[a,b],[a,b],[b,a]])assert.equal((await give(from,to)).status,201);
 let progress=(await call(endpoint,{token:a.token})).data;
 assert.deepEqual([progress.mine,progress.theirs,progress.done],[1,1,false]);
 const now=Date.now(),day=86400000,weekday=(Math.floor((now+7*3600000)/day)+3)%7;
 const extra=now+(weekday===0?day:-day);
 if(weekday===0)t.mock.method(Date,"now",()=>extra);
 const receiver=await db.db.collection("players").findOne({code:b.account.code});
 await db.db.collection("gifts").insertOne({to:receiver._id,fromCode:a.account.code,createdAt:new Date(extra),coins:100,claimedAt:null});
 progress=(await call(endpoint,{token:a.token})).data;
 assert.deepEqual([progress.mine,progress.theirs,progress.done],[2,1,true]);
 const results=await Promise.all([claim(),claim()]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal(results.find(r=>r.status===200).data.coins,400);
 assert.equal((await call(endpoint,{token:a.token})).data.claimed,true);
 assert.equal((await call("/coop/"+a.account.code,{token:b.token})).data.claimed,false);
});

test("tài khoản khách, lưu và tải lại bản lưu",async()=>{
 const guest=await call("/auth/guest",{method:"POST",body:{}});
 assert.equal(guest.status,201);assert.match(guest.data.account.code,/^MP-[A-Z0-9]{6}$/);
 const token=guest.data.token;
 assert.deepEqual((await call("/save",{token})).data,{rev:0,data:null});
 const put=await call("/save",{method:"PUT",token,body:{rev:0,data:city()}});
 assert.equal(put.status,200);assert.equal(put.data.rev,1);
 const got=await call("/save",{token});
 assert.equal(got.data.rev,1);assert.equal(got.data.data.profile.mayorName,"Thử Nghiệm");
 const stale=await call("/save",{method:"PUT",token,body:{rev:0,data:city()}});
 assert.equal(stale.status,409);assert.equal(stale.data.rev,1);
 assert.equal((await call("/save",{method:"PUT",token,body:{rev:1,data:city()}})).data.rev,2);
});

test("từ chối khi thiếu token và khi bản lưu sai",async()=>{
 assert.equal((await call("/save")).status,401);
 assert.equal((await call("/save",{token:"sai"})).status,401);
 const {data:{token}}=await call("/auth/guest",{method:"POST",body:{}});
 const bad=[
  {...city(),world:{buildings:[{id:"khong_co",x:7,y:7,level:1}]}},
  city(1,[{id:"metro_wonder",x:6,y:6,level:1,left:0}]),
  city(1,[{id:"house_small",x:0,y:0,level:1,left:0}]),
  city(1,[{id:"house_small",x:7,y:8,level:1,left:0}]),
  city(1,[{id:"house_small",x:6,y:6,level:99,left:0}]),
  {...city(),profile:{...city().profile,coins:-5}}
 ];
 for(const data of bad)assert.equal((await call("/save",{method:"PUT",token,body:{rev:0,data}})).status,400);
});

test("save regressions and resets require confirmation; history is bounded and expires",async()=>{
 const {data:{token,account}}=await call("/auth/guest",{method:"POST",body:{}});
 const starter={...city(),world:{buildings:[]}},put=(rev,data,extra={})=>call("/save",{method:"PUT",token,body:{rev,data,...extra}});
 const reset=body=>call("/save",{method:"DELETE",token,body});
 assert.equal((await put(0,city(4))).status,200);
 const rejected=await put(1,starter);
 assert.equal(rejected.status,409);
 assert.equal(rejected.data.regression,true);
 assert.equal((await put(1,starter,{confirmRegression:true})).status,200);
 for(let rev=2;rev<14;rev++)assert.equal((await put(rev,city(4))).status,200);
 assert.equal((await reset({rev:14})).status,400);
 assert.equal((await reset({rev:13,confirm:"reset"})).status,409);
 assert.equal((await reset({rev:14,confirm:"reset"})).data.rev,15);
 const player=await db.db.collection("players").findOne({code:account.code}),history=db.db.collection("saveHistory");
 const rows=await history.find({player:player._id}).sort({rev:-1}).toArray();
 assert.deepEqual(rows.map(row=>row.rev),[14,13,12,11,10,9,8,7,6,5]);
 assert.equal(rows[0].reason,"reset");
 assert.equal(rows[0].data.profile.level,4);
 assert.ok(+rows[0].expiresAt>Date.now()+29*86400000);
 assert.equal((await history.indexes()).find(index=>index.key.expiresAt===1).expireAfterSeconds,0);
 assert.equal((await put(14,starter)).data.adminEdited,true);
});

test("đăng ký, đăng nhập thiết bị khác và đăng xuất",async()=>{
 const {data:{token}}=await call("/auth/guest",{method:"POST",body:{}});
 await call("/save",{method:"PUT",token,body:{rev:0,data:city()}});
 assert.equal((await call("/auth/register",{method:"POST",token,body:{username:"ab",password:"123456"}})).status,400);
 const reg=await call("/auth/register",{method:"POST",token,body:{username:"Mayor.One",password:"bimat123"}});
 assert.equal(reg.status,200);assert.equal(reg.data.account.username,"Mayor.One");
 const other=await call("/auth/guest",{method:"POST",body:{}});
 assert.equal((await call("/auth/register",{method:"POST",token:other.data.token,body:{username:"mayor.one",password:"khac1234"}})).status,409);
 assert.equal((await call("/auth/login",{method:"POST",body:{username:"mayor.one",password:"sai-mat-khau"}})).status,401);
 const login=await call("/auth/login",{method:"POST",body:{username:"MAYOR.ONE",password:"bimat123"}});
 assert.equal(login.status,200);assert.equal(login.data.account.code,reg.data.account.code);
 assert.equal((await call("/save",{token:login.data.token})).data.rev,1);
 await call("/auth/logout",{method:"POST",token:login.data.token,body:{}});
 assert.equal((await call("/me",{token:login.data.token})).status,401);
 assert.equal((await call("/me",{token})).status,200);
});

test("đăng ký trực tiếp, đổi mật khẩu và thu hồi phiên cũ",async()=>{
 assert.equal((await call("/auth/signup",{method:"POST",body:{username:"x",password:"123456"}})).status,400);
 assert.equal((await call("/auth/signup",{method:"POST",body:{username:"thi.truong",password:"123"}})).status,400);
 const made=await call("/auth/signup",{method:"POST",body:{username:"Thi.Truong",password:"matkhau1"}});
 assert.equal(made.status,201);assert.equal(made.data.account.username,"Thi.Truong");assert.match(made.data.account.code,/^MP-[A-Z0-9]{6}$/);
 assert.equal((await call("/auth/signup",{method:"POST",body:{username:"thi.truong",password:"matkhau2"}})).status,409);
 const token=made.data.token;
 assert.deepEqual((await call("/save",{token})).data,{rev:0,data:null});
 const second=(await call("/auth/login",{method:"POST",body:{username:"thi.truong",password:"matkhau1"}})).data.token;
 assert.equal((await call("/auth/password",{method:"POST",token,body:{current:"sai",password:"matkhau9"}})).status,403);
 assert.equal((await call("/auth/password",{method:"POST",token,body:{current:"matkhau1",password:"123"}})).status,400);
 assert.equal((await call("/auth/password",{method:"POST",token,body:{current:"matkhau1",password:"matkhau9"}})).status,200);
 assert.equal((await call("/me",{token})).status,200);
 assert.equal((await call("/me",{token:second})).status,401);
 assert.equal((await call("/auth/login",{method:"POST",body:{username:"thi.truong",password:"matkhau1"}})).status,401);
 assert.equal((await call("/auth/login",{method:"POST",body:{username:"thi.truong",password:"matkhau9"}})).status,200);
 const guest=(await call("/auth/guest",{method:"POST",body:{}})).data.token;
 assert.equal((await call("/auth/password",{method:"POST",token:guest,body:{current:"",password:"matkhau9"}})).status,400);
});

test("bạn bè, chi viện, hộp thư và bảng xếp hạng",async()=>{
 const a=(await call("/auth/guest",{method:"POST",body:{}})).data,b=(await call("/auth/guest",{method:"POST",body:{}})).data;
 await call("/save",{method:"PUT",token:a.token,body:{rev:0,data:city(3,[{id:"apartment",x:6,y:8,level:3,left:0}])}});
 assert.equal((await call("/friends",{method:"POST",token:a.token,body:{code:b.account.code}})).status,404);
 await call("/save",{method:"PUT",token:b.token,body:{rev:0,data:{...city(),profile:{...city().profile,avatar:25}}}});
 assert.equal((await call("/friends",{method:"POST",token:a.token,body:{code:a.account.code}})).status,400);
 const add=await call("/friends",{method:"POST",token:a.token,body:{code:b.account.code.toLowerCase()}});
 assert.equal(add.status,201);assert.equal(add.data.city[1],b.account.code);assert.equal(add.data.city[7].length,2);assert.equal(add.data.avatar,25);
 const mine=(await call("/friends",{token:a.token})).data;
 assert.equal(mine.cities.length,1);assert.deepEqual(mine.avatars,{[b.account.code]:25});
 for(let i=0;i<5;i++)assert.equal((await call("/assist",{method:"POST",token:a.token,body:{code:b.account.code}})).status,201);
 assert.equal((await call("/assist",{method:"POST",token:a.token,body:{code:b.account.code}})).status,429);
 const mail=await call("/mailbox",{token:b.token});
 assert.equal(mail.data.gifts.length,5);assert.equal(mail.data.gifts[0].fromName,"Thử Nghiệm");
 assert.deepEqual((await call("/mailbox/claim",{method:"POST",token:b.token,body:{}})).data,{coins:500,count:5});
 assert.deepEqual((await call("/mailbox/claim",{method:"POST",token:b.token,body:{}})).data,{coins:0,count:0});
 const board=await call("/leaderboard?stat=assets",{token:b.token});
 assert.equal(board.status,200);assert.ok(board.data.rows.length>=2);
 assert.ok(board.data.rows.every((r,i,list)=>!i||list[i-1].score>=r.score));
 assert.equal(board.data.rows[0].code,a.account.code);
 // Chân dung không hợp lệ hoặc thiếu thì dùng mặc định.
 assert.equal(board.data.rows[0].avatar,10);assert.equal(board.data.rows.find(r=>r.code===b.account.code).avatar,25);
 await call("/friends/"+b.account.code,{method:"DELETE",token:a.token});
 assert.equal((await call("/friends",{token:a.token})).data.cities.length,0);
 await call("/save",{method:"DELETE",token:a.token,body:{rev:1,confirm:"reset"}});
 const reset=(await call("/save",{token:a.token})).data;
 assert.deepEqual({rev:reset.rev,data:reset.data,adminRev:reset.adminRev},{rev:2,data:null,adminRev:2});
});
