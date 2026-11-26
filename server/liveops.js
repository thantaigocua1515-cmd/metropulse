"use strict";
const {ObjectId}=require("mongodb");
const {dayOf}=require("./analytics");
const {inspectSave}=require("./game");

const PACKS=["tet","noel","cyberpunk"],DEFAULT="default",LOGIN_DAYS=7;
const LIMITS={coins:1e15,prestige:1e9,knowledge:1e12};
const owned=p=>(Array.isArray(p.skinPacks)?p.skinPacks:[]).filter(id=>PACKS.includes(id));
const owns=(p,id)=>id===DEFAULT||owned(p).includes(id);
const digest=p=>({skinPacks:owned(p),loginDays:p.loginDays?.length||0});
const fail=(status,message)=>Object.assign(Error(message),{status});
const idOf=value=>typeof value==="string"&&/^[a-f0-9]{24}$/i.test(value)?new ObjectId(value):null;
const trim=(value,max)=>typeof value==="string"&&value.trim().length<=max?value.trim():"";
const dateOf=value=>{
 if(value==null||value==="")return null;
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d\d:\d\d(?::\d\d(?:\.\d{3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))return false;
 const date=new Date(value);
 return Number.isFinite(+date)?date:false;
};
const imageOf=value=>{
 if(value==null||value==="")return null;
 if(typeof value!=="string"||value.length>500)return false;
 try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:false}
 catch{return false}
};

async function recordLogin(db,player,now=new Date()){
 const players=db.collection("players"),day=dayOf(+now);
 if(player.loginDays?.length>=LOGIN_DAYS||player.loginDays?.includes(day))return digest(player);
 const row=await players.findOneAndUpdate({_id:player._id,bannedAt:{$exists:false}},[
  {$set:{loginDays:{$cond:[{$gte:[{$size:{$ifNull:["$loginDays",[]]}},LOGIN_DAYS]},"$loginDays",
   {$setUnion:[{$ifNull:["$loginDays",[]]},[day]]}]}}},
  {$set:{skinPacks:{$cond:[{$gte:[{$size:"$loginDays"},LOGIN_DAYS]},{$setUnion:[{$ifNull:["$skinPacks",[]]},["cyberpunk"]]},"$skinPacks"]},
   loginRewardAt:{$cond:[{$gte:[{$size:"$loginDays"},LOGIN_DAYS]},{$ifNull:["$loginRewardAt",now]},"$loginRewardAt"]}}}
 ],{projection:{loginDays:1,skinPacks:1},returnDocument:"after"});
 return digest(row||player);
}

const inSchedule=now=>({$and:[{$or:[{start:null},{start:{$lte:now}}]},{$or:[{end:null},{end:{$gt:now}}]}]});
const publicAnnouncement=row=>({id:String(row._id),title:row.title,body:row.body,image:row.image,updatedAt:row.updatedAt});
async function announcements(db,now=new Date()){
 const rows=await db.collection("announcements").find({active:true,...inSchedule(now)}).sort({priority:-1,createdAt:-1,_id:-1}).limit(10).toArray();
 return rows.map(publicAnnouncement);
}
const eligible=(player,now)=>({$or:[{to:null},{to:player._id}],$and:[{$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}]});
const claimId=(player,mailId)=>player._id+":"+mailId;
const loginMail=player=>({
 id:"login-reward",title:"Mở khóa Cyberpunk",body:"Bạn đã đăng nhập đủ 7 ngày. Bộ skin Cyberpunk đã được thêm vào hồ sơ Thị trưởng.",
 rewards:{},createdAt:player.loginRewardAt
});
const mailRow=(mail,claimedAt=null)=>({id:String(mail._id),title:mail.title,body:mail.body,rewards:mail.rewards,createdAt:mail.createdAt,claimedAt});
async function mailbox(db,player){
 const [{rows,unread}]=await db.collection("serverMail").aggregate([
  {$match:eligible(player,new Date())},
  {$set:{claimKey:{$concat:[player._id+":",{$toString:"$_id"}]}}},
  {$lookup:{from:"serverMailClaims",localField:"claimKey",foreignField:"_id",as:"claim"}},
  {$set:{claimedAt:{$ifNull:[{$first:"$claim.claimedAt"},null]}}},
  {$facet:{
   rows:[{$sort:{claimedAt:1,createdAt:-1,_id:-1}},{$limit:50}],
   unread:[{$match:{claimedAt:null}},{$count:"count"}]
  }}
 ]).toArray();
 const letters=rows.map(row=>mailRow(row,row.claimedAt));
 let count=unread[0]?.count||0;
 if(player.loginRewardAt){
  const claim=await db.collection("serverMailClaims").findOne({_id:claimId(player,"login-reward")});
  letters.unshift({...loginMail(player),claimedAt:claim?.claimedAt||null});
  if(!claim)count++;
 }
 return {letters,unread:count};
}
async function claim(db,player,tokenHash,rawId){
 const mailId=idOf(rawId),login=rawId==="login-reward";
 if(!mailId&&!login)throw fail(404,"Không tìm thấy thư.");
 return db.client.withSession(session=>session.withTransaction(async()=>{
  const players=db.collection("players"),saves=db.collection("saves"),now=new Date();
  const filter={_id:player._id,bannedAt:{$exists:false},"tokens.hash":tokenHash};
  const current=await players.findOne(filter,{session});
  if(!current)throw fail(401,"Phiên đăng nhập đã hết hạn.");
  const row=login?(current.loginRewardAt?loginMail(current):null):
   await db.collection("serverMail").findOne({_id:mailId,...eligible(current,now)},{session});
  if(!row)throw fail(404,"Không tìm thấy thư.");
  const claims=db.collection("serverMailClaims"),key=claimId(current,login?"login-reward":mailId);
  if(await claims.findOne({_id:key},{session}))throw fail(409,"Thư đã được nhận.");
  const {rewards}=row,resources=Object.keys(LIMITS).filter(k=>rewards[k]>0);
  const save=resources.length?await saves.findOne({_id:current._id},{session}):null;
  if(resources.length&&!save)throw fail(409,"Cần lưu thành phố lên đám mây trước khi nhận tài nguyên.");
  let revision=null;
  if(save){
   for(const key of resources)save.data.profile[key]=(save.data.profile[key]??0)+rewards[key];
   const check=inspectSave(save.data);
   if(check.error)throw fail(409,"Tài nguyên vượt giới hạn của bản lưu. Hãy sử dụng bớt rồi nhận lại.");
   revision=save.rev+1;save.data.lastSavedAt=+now;
   await saves.updateOne({_id:current._id,rev:save.rev},{$set:{data:save.data,rev:revision,adminRev:revision,updatedAt:now}},{session});
   await players.updateOne(filter,{$set:{summary:check.summary,coins:check.coins,updatedAt:now}},{session});
  }
  if(rewards.skin){
   await players.updateOne(filter,{$addToSet:{skinPacks:rewards.skin}},{session});
   current.skinPacks=[...new Set([...owned(current),rewards.skin])];
  }
  await claims.insertOne({_id:key,player:current._id,mailId:mailId??null,claimedAt:now},{session});
  return {rewards,previousRev:save?.rev??null,rev:revision,adminRev:revision,claimedAt:now,...digest(current)};
 })).catch(error=>{if(error.code===11000)throw fail(409,"Thư đã được nhận.");throw error});
}

function adminRoutes(router,{audit,wrap}){
 const collection=(req,name)=>req.adminDb.collection(name);
 router.get("/announcements",wrap(async(req,res)=>{
  const rows=await collection(req,"announcements").find().sort({createdAt:-1,_id:-1}).limit(100).toArray();
  res.json({rows});
 }));
 const write=wrap(async(req,res)=>{
  const {active,priority}=req.body||{},title=trim(req.body?.title,100),body=trim(req.body?.body,2400);
  const start=dateOf(req.body?.start),end=dateOf(req.body?.end),image=imageOf(req.body?.image),now=new Date();
  if(!title||!body||typeof active!=="boolean"||!Number.isInteger(priority)||priority<0||priority>100||start===false||end===false||image===false||(start&&end&&start>=end))
   throw fail(400,"Thông báo không hợp lệ. Kiểm tra nội dung, lịch và độ ưu tiên.");
  const rows=collection(req,"announcements"),old=req.params.id?await rows.findOne({_id:idOf(req.params.id)}):null;
  if(req.params.id&&!old)throw fail(404,"Không tìm thấy thông báo.");
  const row={title,body,image,active,priority,start,end,updatedAt:now,createdAt:old?.createdAt||now};
  if(old){row._id=old._id;await rows.replaceOne({_id:old._id},row)}
  else row._id=(await rows.insertOne(row)).insertedId;
  await audit(req,old?"announcement.update":"announcement.create",String(row._id),old,row);
  res.status(old?200:201).json({row});
 });
 router.post("/announcements",write);
 router.put("/announcements/:id",write);
 router.delete("/announcements/:id",wrap(async(req,res)=>{
  const old=await collection(req,"announcements").findOneAndDelete({_id:idOf(req.params.id)});
  if(!old)throw fail(404,"Không tìm thấy thông báo.");
  await audit(req,"announcement.delete",String(old._id),old);
  res.json({ok:true});
 }));
 router.get("/mail",wrap(async(req,res)=>{
  const page=Math.min(10000,Math.max(1,Number.parseInt(req.query.page,10)||1));
  const rows=await collection(req,"serverMail").find().sort({createdAt:-1,_id:-1}).skip((page-1)*25).limit(26).toArray();
  const batch=rows.slice(0,25);
  const counts=await collection(req,"serverMailClaims").aggregate([
   {$match:{mailId:{$in:batch.map(r=>r._id)}}},{$group:{_id:"$mailId",count:{$sum:1}}}
  ]).toArray();
  const byId=new Map(counts.map(c=>[String(c._id),c.count]));
  res.json({rows:batch.map(r=>({...mailRow(r),toCode:r.toCode,expiresAt:r.expiresAt,claims:byId.get(String(r._id))||0})),more:rows.length>25,page});
 }));
 router.post("/mail",wrap(async(req,res)=>{
  const title=trim(req.body?.title,100),body=trim(req.body?.body,2400),target=req.body?.target;
  const toCode=target==="player"?trim(req.body?.code,12).toUpperCase():null,expiresAt=dateOf(req.body?.expiresAt),now=new Date(),rewards={};
  const raw=req.body?.rewards;
  if(!title||!body||!["all","player"].includes(target)||expiresAt===false||expiresAt&&(target==="all"||expiresAt<=now)||
    !raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!Object.hasOwn(LIMITS,k)&&k!=="skin"))
   throw fail(400,"Thư không hợp lệ. Kiểm tra nội dung, người nhận và hạn nhận.");
  for(const [key,limit] of Object.entries(LIMITS))if(raw[key]!==undefined){
   if(!Number.isSafeInteger(raw[key])||raw[key]<0||raw[key]>limit)throw fail(400,"Số tài nguyên không hợp lệ.");
   if(raw[key])rewards[key]=raw[key];
  }
  if(raw.skin){if(!PACKS.includes(raw.skin))throw fail(400,"Skin không hợp lệ.");rewards.skin=raw.skin}
  if(!Object.keys(rewards).length)throw fail(400,"Hãy đính kèm ít nhất một phần thưởng.");
  const recipient=toCode&&await collection(req,"players").findOne({code:toCode},{projection:{_id:1}});
  if(target==="player"&&!recipient)throw fail(404,"Không tìm thấy người chơi.");
  const row={title,body,to:recipient?._id||null,toCode,rewards,expiresAt,createdAt:now};
  row._id=(await collection(req,"serverMail").insertOne(row)).insertedId;
  await audit(req,"mail.send",String(row._id),null,row);
  res.status(201).json({row:mailRow(row)});
 }));
}

module.exports={owns,digest,recordLogin,announcements,mailbox,claim,adminRoutes};
