"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoMemoryServer}=require("mongodb-memory-server");
const db=require("../server/db"),{createApp}=require("../server/index");

let mongo,server,base;
const call=async(path,{method="GET",token,body}={})=>{
 const res=await fetch(base+"/api"+path,{method,headers:{...(body?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json()};
};
const city=(level=1,extra=[])=>({version:2,profile:{mayorName:"Thử Nghiệm",level,xp:0,coins:500,prestige:10,knowledge:0,happiness:104,helpsGiven:2},
 world:{buildings:[{id:"road",x:7,y:7,level:1,left:0},{id:"house_small",x:7,y:8,level:2,left:0},...extra]},progress:{stats:{peakIncome:12}},friends:[],lastSavedAt:Date.now()});

test.before(async()=>{
 mongo=await MongoMemoryServer.create();await db.connect(mongo.getUri(),"metropulse_test");
 server=createApp(()=>db.db).listen(0);base="http://127.0.0.1:"+server.address().port;
});
test.after(async()=>{server.close();await db.close();await mongo.stop()});

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

test("bạn bè, chi viện, hộp thư và bảng xếp hạng",async()=>{
 const a=(await call("/auth/guest",{method:"POST",body:{}})).data,b=(await call("/auth/guest",{method:"POST",body:{}})).data;
 await call("/save",{method:"PUT",token:a.token,body:{rev:0,data:city(3,[{id:"apartment",x:6,y:8,level:3,left:0}])}});
 assert.equal((await call("/friends",{method:"POST",token:a.token,body:{code:b.account.code}})).status,404);
 await call("/save",{method:"PUT",token:b.token,body:{rev:0,data:city()}});
 assert.equal((await call("/friends",{method:"POST",token:a.token,body:{code:a.account.code}})).status,400);
 const add=await call("/friends",{method:"POST",token:a.token,body:{code:b.account.code.toLowerCase()}});
 assert.equal(add.status,201);assert.equal(add.data.city[1],b.account.code);assert.equal(add.data.city[7].length,2);
 assert.equal((await call("/friends",{token:a.token})).data.cities.length,1);
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
 await call("/friends/"+b.account.code,{method:"DELETE",token:a.token});
 assert.equal((await call("/friends",{token:a.token})).data.cities.length,0);
 await call("/save",{method:"DELETE",token:a.token});
 assert.deepEqual((await call("/save",{token:a.token})).data,{rev:0,data:null});
});
