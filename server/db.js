"use strict";
const {MongoClient}=require("mongodb");

let client=null,database=null,pending=null;
// Trên nền tảng serverless mỗi instance giữ pool riêng nên pool phải nhỏ; máy chủ chạy lâu dài dùng pool 20.
const serverless=!!process.env.VERCEL;

// Một MongoClient duy nhất cho cả tiến trình; các lời gọi đồng thời dùng chung một lần kết nối.
function connect(uri,name){
 if(database)return Promise.resolve(database);
 if(pending)return pending;
 const next=new MongoClient(uri,{
  appName:"metropulse",maxPoolSize:serverless?5:20,minPoolSize:serverless?0:2,maxIdleTimeMS:serverless?60000:300000,
  connectTimeoutMS:10000,socketTimeoutMS:30000,serverSelectionTimeoutMS:8000,retryWrites:true
 });
 pending=(async()=>{
  try{await next.connect();const db=next.db(name);await ensureIndexes(db);client=next;database=db;return db}
  catch(error){await next.close().catch(()=>{});throw error}
  finally{pending=null}
 })();
 return pending;
}

async function ensureIndexes(db){
 const players=db.collection("players"),gifts=db.collection("gifts"),chat=db.collection("chatMessages"),coop=db.collection("coopClaims");
 await Promise.all([
  players.createIndex({code:1},{unique:true}),
  players.createIndex({usernameLower:1},{unique:true,partialFilterExpression:{usernameLower:{$type:"string"}}}),
  players.createIndex({"tokens.hash":1}),
  players.createIndex({"summary.score":-1}),
  players.createIndex({"summary.assets":-1}),
  players.createIndex({"summary.happiness":-1}),
  players.createIndex({"summary.helpsGiven":-1}),
  gifts.createIndex({to:1,claimedAt:1}),
  gifts.createIndex({createdAt:1},{expireAfterSeconds:14*86400}),
  gifts.createIndex({to:1,fromCode:1,createdAt:1}),
  chat.createIndex({room:1,createdAt:-1,_id:-1}),
  chat.createIndex({to:1,createdAt:-1,_id:-1}),
  chat.createIndex({createdAt:1},{expireAfterSeconds:7*86400}),
  coop.createIndex({createdAt:1},{expireAfterSeconds:30*86400})
 ]);
}

async function close(){if(client)await client.close();client=null;database=null}

module.exports={connect,close,get db(){return database}};
