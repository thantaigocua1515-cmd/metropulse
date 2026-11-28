"use strict";
const {ObjectId}=require("mongodb");
const {CONFIG,inspectSave}=require("./game");
const events=require("./event-config");
const liveops=require("./liveops");
const history=require("./save-history");
const {overview}=require("./analytics");

const projection={code:1,name:1,username:1,summary:1,coins:1,createdAt:1,lastSeenAt:1,bannedAt:1};
const gameFields=["coins","prestige","knowledge","level"];
const dateSort={at:-1,_id:-1};
const pageOf=q=>Math.min(10000,Math.max(1,Number.parseInt(q,10)||1));
const codeOf=code=>/^MP-[A-Z0-9]{4,8}$/.test(code);
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const label=message=>({id:String(message._id),from:message.from,to:message.to,name:message.name,text:message.text,createdAt:message.createdAt,hiddenAt:message.hiddenAt||null});
module.exports=function adminData(router,{audit,wrap,fail}){
 const c=(req,name)=>req.adminDb.collection(name);
 const findPlayer=async(req,fields=projection)=>{
  const code=req.params.code,player=codeOf(code)&&await c(req,"players").findOne({code},{projection:fields});
  if(!player)throw fail(404,"Không tìm thấy người chơi.");
  return player;
 };
 router.get("/overview",wrap(async(req,res)=>{
  const days=[1,7,30].includes(Number(req.query.days))?Number(req.query.days):1;
  const [analytics,users]=await Promise.all([overview(req.adminDb,days),c(req,"players").estimatedDocumentCount()]);
  res.json({...analytics,users});
 }));
 router.get("/users",wrap(async(req,res)=>{
  const q=String(req.query.q||"").trim().slice(0,40),page=pageOf(req.query.page),size=25;
  const sort=req.query.sort==="new"?"createdAt":req.query.sort==="level"?"summary.level":"lastSeenAt";
  const players=c(req,"players"),pattern=q?new RegExp(escaped(q),"i"):null;
  const query=pattern?{$or:[{code:q.toUpperCase()},{usernameLower:q.toLowerCase()},{name:pattern},{username:pattern}]}:{};
  const [rows,total]=await Promise.all([
   players.find(query,{projection}).sort({[sort]:-1,_id:-1}).skip((page-1)*size).limit(size).toArray(),
   players.countDocuments(query)
  ]);
  res.json({rows,total,page,size});
 }));
 router.get("/users/:code",wrap(async(req,res)=>{
  const p=await findPlayer(req,{...projection,tokens:1});
  const [save,revisions]=await Promise.all([
   c(req,"saves").findOne({_id:p._id},{projection:{"data.profile":1,"data.world.buildings.id":1,rev:1,updatedAt:1}}),
   history.list(req.adminDb,p._id)
  ]);
  const {tokens,...player}=p,profile=save?.data?.profile;
  res.json({player,rev:save?.rev||0,revisions,sessions:(tokens||[]).map(({createdAt})=>({createdAt})),
   save:profile?{rev:save.rev,updatedAt:save.updatedAt,buildings:save.data.world.buildings.filter(b=>b.id!=="road").length,
    roads:save.data.world.buildings.filter(b=>b.id==="road").length,cityName:profile.cityName,
    resources:Object.fromEntries(gameFields.map(key=>[key,profile[key]??0]))}:null});
 }));
 router.post("/users/:code/save-history/:revision/restore",wrap(async(req,res)=>{
  const p=await findPlayer(req,{code:1,skinPacks:1}),source=Number(req.params.revision),rev=req.body?.rev;
  if(!Number.isSafeInteger(source)||source<1||!Number.isSafeInteger(rev)||rev<0)throw fail(400,"Phiên bản không hợp lệ.");
  const db=req.adminDb,saves=c(req,"saves"),now=new Date();
  const next=await history.transaction(db,async session=>{
   const current=await saves.findOne({_id:p._id},{session});
   if((current?.rev||0)!==rev)throw fail(409,"Bản lưu đã đổi. Hãy tải lại thông tin.");
   const old=await history.get(db,p._id,source,session);
   if(!old)throw fail(404,"Bản lưu lịch sử không còn.");
   const data=old.data;
   data.profile.mayorId=p.code;
   if(!liveops.owns(p,data.profile.skin??"default"))data.profile.skin="default";
   data.lastSavedAt=+now;
   const check=inspectSave(data);
   if(check.error)throw fail(409,check.error);
   const next=rev+1;
   const result=await c(req,"players").updateOne({_id:p._id,deletingAt:{$exists:false}},{$set:{name:check.name,summary:check.summary,coins:check.coins,city:check.city,updatedAt:now}},{session});
   if(!result.matchedCount)throw fail(404,"Không tìm thấy người chơi.");
   await history.archive(db,current,"restore",now,session);
   await saves.updateOne({_id:p._id},{$set:{data,rev:next,adminRev:next,updatedAt:now}},{upsert:true,session});
   await audit(req,"user.save.restore",p.code,history.describe(current),{sourceRev:source,rev:next,level:data.profile.level},session);
   return next;
  });
  res.json({rev:next});
 }));
 router.patch("/users/:code/resources",wrap(async(req,res)=>{
  const p=await findPlayer(req),saves=c(req,"saves");
  const changes=req.body?.resources,rev=req.body?.rev,keys=Object.keys(changes||{});
  if(!Number.isSafeInteger(rev))throw fail(409,"Bản lưu đã đổi. Hãy tải lại thông tin.");
  if(!keys.length||keys.some(key=>!gameFields.includes(key)||typeof changes[key]!=="number"||!Number.isFinite(changes[key])))throw fail(400,"Giá trị tài nguyên không hợp lệ.");
  const now=new Date(),next=rev+1;
  await history.transaction(req.adminDb,async session=>{
   const save=await saves.findOne({_id:p._id},{session});
   if(!save?.data)throw fail(409,"Người chơi chưa có bản lưu để chỉnh sửa.");
   if(rev!==save.rev)throw fail(409,"Bản lưu đã đổi. Hãy tải lại thông tin.");
   const before=Object.fromEntries(keys.map(key=>[key,save.data.profile[key]??0])),data=structuredClone(save.data);
   Object.assign(data.profile,changes);
   if(keys.includes("level")){
    if(!Number.isSafeInteger(changes.level)||changes.level<1)throw fail(400,"Cấp Thị trưởng không hợp lệ.");
    data.profile.xp=Math.min(data.profile.xp,CONFIG.xpNext(changes.level)-1);
    data.world.unlockedRadius=CONFIG.radius(changes.level);
   }
   const checked=inspectSave(data);
   if(checked.error)throw fail(400,checked.error);
   await c(req,"players").updateOne({_id:p._id},{$set:{summary:checked.summary,coins:checked.coins,city:checked.city,updatedAt:now}},{session});
   await history.archive(req.adminDb,save,"admin",now,session);
   await saves.updateOne({_id:p._id,rev},{$set:{data,rev:next,adminRev:next,updatedAt:now}},{session});
   await audit(req,"user.resources",p.code,before,changes,session);
  });
  res.json({rev:next});
 }));
 router.post("/users/:code/ban",wrap(async(req,res)=>{
  const p=await findPlayer(req),banned=req.body?.banned;
  if(typeof banned!=="boolean")throw fail(400,"Trạng thái tài khoản không hợp lệ.");
  const change=banned?{$set:{bannedAt:new Date(),tokens:[]}}:{$unset:{bannedAt:1}};
  const result=await c(req,"players").updateOne({_id:p._id,deletingAt:{$exists:false}},change);
  if(!result.matchedCount)throw fail(404,"Không tìm thấy người chơi.");
  if(banned)await c(req,"playSessions").updateMany({player:"p:"+p.code},{$set:{seenAt:new Date(0)}});
  await audit(req,banned?"user.ban":"user.unban",p.code,{banned:!!p.bannedAt},{banned});
  res.json({ok:true});
 }));
 router.post("/users/:code/revoke",wrap(async(req,res)=>{
  const p=await findPlayer(req,{code:1,tokens:1});
  await c(req,"players").updateOne({_id:p._id},{$set:{tokens:[]}});
  await audit(req,"user.revoke",p.code,{sessions:p.tokens?.length||0},{sessions:0});
  res.json({ok:true});
 }));
 router.delete("/users/:code",wrap(async(req,res)=>{
  const p=await findPlayer(req);
  if(req.body?.confirm!==p.code)throw fail(400,"Nhập chính xác mã thành phố để xóa tài khoản.");
  const now=new Date();
  await history.transaction(req.adminDb,async session=>{
   await c(req,"players").updateOne({_id:p._id},{$set:{bannedAt:now,deletingAt:now,tokens:[]}},{session});
   const saves=c(req,"saves"),save=await saves.findOne({_id:p._id},{session});
   await history.archive(req.adminDb,save,"delete",now,session);
   await saves.deleteOne({_id:p._id},{session});
  });
  const player="p:"+p.code;
  await Promise.all([
   c(req,"gifts").deleteMany({$or:[{to:p._id},{fromCode:p.code}]}),
   c(req,"serverMailClaims").deleteMany({player:p._id}),c(req,"serverMail").deleteMany({to:p._id}),
   c(req,"chatMessages").deleteMany({$or:[{from:p.code},{to:p.code}]}),c(req,"players").updateMany({friends:p.code},{$pull:{friends:p.code}}),
   c(req,"playSessions").deleteMany({player}),c(req,"playDays").deleteMany({player}),c(req,"playIdentities").deleteOne({_id:player})
  ]);
  await c(req,"players").deleteOne({_id:p._id});
  await audit(req,"user.delete",p.code,{createdAt:p.createdAt,banned:!!p.bannedAt});
  res.json({ok:true});
 }));
 router.get("/chat",wrap(async(req,res)=>{
  const page=pageOf(req.query.page),code=req.query.code,query=code?(codeOf(code)?{$or:[{from:code},{to:code}]}:{_id:null}):{};
  const rows=await c(req,"chatMessages").find(query).sort({createdAt:-1,_id:-1}).skip((page-1)*25).limit(26).toArray();
  res.json({rows:rows.slice(0,25).map(label),page,more:rows.length>25});
 }));
 router.patch("/chat/:id",wrap(async(req,res)=>{
  if(!/^[\da-f]{24}$/i.test(req.params.id)||typeof req.body?.hidden!=="boolean")throw fail(400,"Dữ liệu tin nhắn không hợp lệ.");
  const hidden=req.body.hidden,change=hidden?{$set:{hiddenAt:new Date()}}:{$unset:{hiddenAt:1}};
  const old=await c(req,"chatMessages").findOneAndUpdate({_id:new ObjectId(req.params.id)},change,{returnDocument:"before"});
  if(!old)throw fail(404,"Không tìm thấy tin nhắn.");
  await audit(req,"chat.visibility",req.params.id,{hidden:!!old.hiddenAt},{hidden});
  res.json({ok:true});
 }));
 router.get("/events",wrap(async(req,res)=>res.json({rows:await events.read(req.adminDb)})));
 router.put("/events/:id",wrap(async(req,res)=>{
  const event=events.parse(req.params.id,req.body);
  if(!event)throw fail(400,"Cấu hình sự kiện không hợp lệ. Kiểm tra mẫu, thời gian, phần thưởng và hệ số.");
  const collection=c(req,"eventConfigs"),old=await collection.findOne({_id:event._id});
  if(!old&&await collection.countDocuments()>=100)throw fail(409,"Đã đạt giới hạn 100 cấu hình sự kiện.");
  await collection.replaceOne({_id:event._id},event,{upsert:true});
  await audit(req,"event.update",event._id,old,event);
  res.json({event});
 }));
 router.delete("/events/:id",wrap(async(req,res)=>{
  const old=await c(req,"eventConfigs").findOneAndDelete({_id:req.params.id});
  if(!old)throw fail(404,"Không tìm thấy cấu hình.");
  await audit(req,"event.reset",req.params.id,old);
  res.json({ok:true});
 }));
 router.get("/audit",wrap(async(req,res)=>{
  const page=pageOf(req.query.page);
  const rows=await c(req,"adminAudit").find().sort(dateSort).skip((page-1)*25).limit(26).toArray();
  res.json({rows:rows.slice(0,25),page,more:rows.length>25});
 }));
 liveops.adminRoutes(router,{audit,wrap});
};
