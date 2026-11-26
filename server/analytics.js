"use strict";
const {sha}=require("./auth");
const MINUTE=60000,DAY=1440*MINUTE,OFFSET=7*60*MINUTE,ACTIVE=150000,KEEP=120*DAY;
const dayOf=ms=>Math.floor((ms+OFFSET)/DAY);
const anonPattern=/^[a-f0-9]{32}$/;
const playersOnly={kind:"account"};

const activeFilter=now=>({seenAt:{$gt:new Date(+now-ACTIVE)}});
async function online(db,now){
 const rows=await db.collection("playSessions").aggregate([
  {$match:activeFilter(now)},{$group:{_id:"$player"}},{$count:"count"}
 ]).toArray();
 return rows[0]?.count||0;
}
async function heartbeat(db,{device,session,account},now=new Date()){
 if(!anonPattern.test(device)||!anonPattern.test(session))return false;
 const player=account?"p:"+account.code:"g:"+sha(device);
 const kind=account?"account":"anonymous",day=dayOf(+now),expiresAt=new Date(+now+KEEP);
 const id=sha(player+":"+device+":"+session);
 const sessions=db.collection("playSessions");
 let previous;
 try{
  previous=await sessions.findOneAndUpdate({_id:id,$or:[{seenAt:{$exists:false}},{seenAt:{$lte:new Date(+now-MINUTE/2)}}]},[
   {$set:{player,kind,seenAt:now,expiresAt,duration:{$add:[{$ifNull:["$duration",0]},
    {$cond:[{$and:[{$lte:["$seenAt",now]},{$gte:["$seenAt",new Date(+now-ACTIVE)]}]},{$subtract:[now,"$seenAt"]},0]}]}}}
  ],{upsert:true,returnDocument:"before"});
 }catch(error){if(error.code===11000)return true;throw error}
 const dayId=day+":"+player;
 if(!previous||dayOf(+previous.seenAt)!==day){
  await Promise.all([
   db.collection("playIdentities").updateOne({_id:player},{$min:{firstDay:dayOf(+(account?.createdAt||now))},$set:{kind,expiresAt}},{upsert:true}),
   db.collection("playDays").updateOne({_id:dayId},{$setOnInsert:{player,day,kind,expiresAt}},{upsert:true})
  ]);
 }
 const minute=Math.floor(+now/MINUTE),minutes=db.collection("playMinutes");
 const claimed=await minutes.updateOne({_id:minute},{$setOnInsert:{expiresAt:new Date(+now+32*DAY)}},{upsert:true});
 if(claimed.upsertedCount)await minutes.updateOne({_id:minute},{$set:{online:await online(db,now)}});
 return true;
}

async function overview(db,days,now=new Date()){
 const end=dayOf(+now),latest=Math.floor(+now/MINUTE),start=end-29;
 const span=days===1?24:days===7?168:720;
 const bucketSize=days===1?15:60,firstBucket=Math.floor(latest/bucketSize)-Math.ceil(span*60/bucketSize)+1;
 const active=db.collection("playDays"),identities=db.collection("playIdentities");
 const newest=db.collection("players").aggregate([
  {$match:{createdAt:{$gte:new Date(start*DAY-OFFSET)}}},
  {$group:{_id:{$floor:{$divide:[{$add:[{$toLong:"$createdAt"},OFFSET]},DAY]}},count:{$sum:1}}}
 ]).toArray();
 const [ccu,activity,samples,signups,cohorts,length]=await Promise.all([
  online(db,now),
  active.aggregate([
   {$match:{day:{$gte:start,$lte:end}}},
   {$group:{_id:"$player",last:{$max:"$day"}}},
   {$group:{_id:null,dau:{$sum:{$cond:[{$eq:["$last",end]},1,0]}},wau:{$sum:{$cond:[{$gte:["$last",end-6]},1,0]}},mau:{$sum:1}}}
  ]).toArray(),
  db.collection("playMinutes").aggregate([
   {$match:{_id:{$gte:firstBucket*bucketSize,$lte:latest},online:{$type:"number"}}},
   {$group:{_id:{$floor:{$divide:["$_id",bucketSize]}},count:{$max:"$online"}}}
  ]).toArray(),
  newest,
  identities.aggregate([
   {$match:{firstDay:{$gte:end-59,$lte:end},...playersOnly}},
   {$lookup:{from:"playDays",let:{player:"$_id",day:"$firstDay"},pipeline:[
    {$match:{$expr:{$and:[{$eq:["$player","$$player"]},{$in:[{$subtract:["$day","$$day"]},[1,7,30]]}]}}},
    {$project:{_id:0,offset:{$subtract:["$day","$$day"]}}}
   ],as:"returns"}},
   {$group:{_id:"$firstDay",size:{$sum:1},d1:{$sum:{$cond:[{$in:[1,"$returns.offset"]},1,0]}},
    d7:{$sum:{$cond:[{$in:[7,"$returns.offset"]},1,0]}},d30:{$sum:{$cond:[{$in:[30,"$returns.offset"]},1,0]}}}},
   {$sort:{_id:-1}}
  ]).toArray(),
  db.collection("playSessions").aggregate([
   {$match:{seenAt:{$gte:new Date(+now-30*DAY)},duration:{$gte:0}}},
   {$group:{_id:null,ms:{$avg:"$duration"}}}
  ]).toArray()
 ]);
 const measurements=new Map(samples.map(v=>[v._id,v.count])),registrations=new Map(signups.map(v=>[v._id,v.count]));
 return {online:ccu,dau:activity[0]?.dau||0,wau:activity[0]?.wau||0,mau:activity[0]?.mau||0,averageSeconds:Math.round((length[0]?.ms||0)/1000),
  ccu:Array.from({length:Math.floor(latest/bucketSize)-firstBucket+1},(_,i)=>({at:(firstBucket+i)*bucketSize*MINUTE,value:measurements.get(firstBucket+i)??null})),
  signups:Array.from({length:30},(_,i)=>({at:(start+i)*DAY-OFFSET,value:registrations.get(start+i)||0})),
  cohorts:cohorts.map(({_id,size,d1,d7,d30})=>({day:new Date(_id*DAY).toISOString().slice(0,10),size,d1:end-_id>=1?d1:null,d7:end-_id>=7?d7:null,d30:end-_id>=30?d30:null}))
 };
}
module.exports={heartbeat,overview,dayOf};
