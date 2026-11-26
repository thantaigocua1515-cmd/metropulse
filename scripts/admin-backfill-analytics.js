"use strict";
const db=require("../server/db"),{dayOf}=require("../server/analytics");
const DAY=86400000,BATCH=250;

async function backfill(database,now){
 const today=dayOf(+now),identities=database.collection("playIdentities"),days=database.collection("playDays");
 const cursor=database.collection("players").find({lastSeenAt:{$gte:new Date(+now-60*DAY),$lte:now}},
  {projection:{code:1,createdAt:1,lastSeenAt:1}}).batchSize(BATCH);
 let ids=[],activity=[],total=0;
 const flush=async()=>{
  if(!ids.length)return;
  const [,result]=await Promise.all([identities.bulkWrite(ids,{ordered:false}),days.bulkWrite(activity,{ordered:false})]);
  total+=result.upsertedCount;ids=[];activity=[];
 };
 for await(const p of cursor){
  if(typeof p.code!=="string"||!(p.createdAt instanceof Date)||!(p.lastSeenAt instanceof Date))continue;
  const player="p:"+p.code,firstDay=dayOf(+p.createdAt),day=dayOf(+p.lastSeenAt);
  if(firstDay>day||day>today)continue;
  const expiresAt=new Date(+p.lastSeenAt+120*DAY),kind="account";
  ids.push({updateOne:{filter:{_id:player},update:{$setOnInsert:{firstDay,kind,expiresAt}},upsert:true}});
  activity.push({updateOne:{filter:{_id:day+":"+player},update:{$setOnInsert:{player,day,kind,expiresAt,source:"lastSeenAt"}},upsert:true}});
  if(ids.length>=BATCH)await flush();
 }
 await flush();
 return total;
}

if(require.main===module)(async()=>{
 if(process.argv[2]!=="--apply"||!process.env.MONGODB_URI)throw Error("Cần đặt MONGODB_URI và chỉ định --apply.");
 const database=await db.connect(process.env.MONGODB_URI,process.env.MONGODB_DB||"metropulse");
 console.log("Số bản ghi ngày hoạt động được bổ sung:",await backfill(database,new Date()));
})().catch(error=>{console.error("Không thể nhập dữ liệu hoạt động:",error.code||error.name);process.exitCode=1})
 .finally(()=>db.close());
module.exports={backfill};
