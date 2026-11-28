"use strict";

const LIMIT=10,TTL=30*864e5;
const collection=db=>db.collection("saveHistory");
const live=(player,now=new Date())=>({player,expiresAt:{$gt:now}});
const describe=save=>save?.data?{
 rev:save.rev,updatedAt:save.updatedAt,level:save.data.profile.level,
 buildings:save.data.world.buildings.filter(b=>b.id!=="road").length
}:null;

async function archive(db,save,reason,now,session){
 if(!save?.data)return;
 const summary=describe(save);
 await collection(db).insertOne({player:save._id,...summary,reason,data:save.data,expiresAt:new Date(+now+TTL)},{session});
 const rows=await collection(db).find({player:save._id},{session,projection:{_id:1}}).sort({rev:-1}).skip(LIMIT).toArray();
 if(rows.length)await collection(db).deleteMany({_id:{$in:rows.map(row=>row._id)}},{session});
}
const list=(db,player)=>collection(db).find(live(player),{projection:{_id:0,data:0,player:0,expiresAt:0}}).sort({rev:-1}).limit(LIMIT).toArray();
const get=(db,player,rev,session)=>collection(db).findOne({...live(player),rev},{session});
const transaction=(db,fn)=>db.client.withSession(session=>session.withTransaction(()=>fn(session)));

module.exports={archive,list,get,describe,transaction};
