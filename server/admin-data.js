"use strict";
const {ObjectId}=require("mongodb");
const {CONFIG,inspectSave}=require("./game");
const events=require("./event-config");
const liveops=require("./liveops");
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
  const save=await c(req,"saves").findOne({_id:p._id},{projection:{"data.profile":1,"data.world.buildings.id":1,rev:1,updatedAt:1}});
  const {tokens,...player}=p,profile=save?.data.profile;
  res.json({player,sessions:(tokens||[]).map(({createdAt})=>({createdAt})),
   save:save?{rev:save.rev,updatedAt:save.updatedAt,buildings:save.data.world.buildings.filter(b=>b.id!=="road").length,
    roads:save.data.world.buildings.filter(b=>b.id==="road").length,cityName:profile.cityName,
    resources:Object.fromEntries(gameFields.map(key=>[key,profile[key]??0]))}:null});
 }));
 router.patch("/users/:code/resources",wrap(async(req,res)=>{
  const p=await findPlayer(req),saves=c(req,"saves"),save=await saves.findOne({_id:p._id});
  if(!save)throw fail(409,"Người chơi chưa có bản lưu để chỉnh sửa.");
  const changes=req.body?.resources,rev=req.body?.rev,keys=Object.keys(changes||{});
  if(!Number.isSafeInteger(rev)||rev!==save.rev)throw fail(409,"Bản lưu đã đổi. Hãy tải lại thông tin.");
  if(!keys.length||keys.some(key=>!gameFields.includes(key)||typeof changes[key]!=="number"||!Number.isFinite(changes[key])))throw fail(400,"Giá trị tài nguyên không hợp lệ.");
  const before=Object.fromEntries(keys.map(key=>[key,save.data.profile[key]??0]));
  Object.assign(save.data.profile,changes);
  if(keys.includes("level")){
   if(!Number.isSafeInteger(changes.level)||changes.level<1)throw fail(400,"Cấp Thị trưởng không hợp lệ.");
   save.data.profile.xp=Math.min(save.data.profile.xp,CONFIG.xpNext(changes.level)-1);
   save.data.world.unlockedRadius=CONFIG.radius(changes.level);
  }
  const checked=inspectSave(save.data);
  if(checked.error)throw fail(400,checked.error);
  const now=new Date(),next=rev+1,result=await saves.updateOne({_id:p._id,rev},{$set:{data:save.data,rev:next,adminRev:next,updatedAt:now}});
  if(!result.modifiedCount)throw fail(409,"Bản lưu đã đổi. Hãy tải lại thông tin.");
  await c(req,"players").updateOne({_id:p._id},{$set:{summary:checked.summary,coins:checked.coins,city:checked.city,updatedAt:now}});
  await audit(req,"user.resources",p.code,before,changes);
  res.json({rev:next});
 }));
 router.post("/users/:code/ban",wrap(async(req,res)=>{
  const p=await findPlayer(req),banned=req.body?.banned;
  if(typeof banned!=="boolean")throw fail(400,"Trạng thái tài khoản không hợp lệ.");
  const change=banned?{$set:{bannedAt:new Date(),tokens:[]}}:{$unset:{bannedAt:1}};
  await c(req,"players").updateOne({_id:p._id},change);
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
  await c(req,"players").updateOne({_id:p._id},{$set:{bannedAt:new Date(),tokens:[]}});
  const player="p:"+p.code;
  await Promise.all([
   c(req,"saves").deleteOne({_id:p._id}),c(req,"gifts").deleteMany({$or:[{to:p._id},{fromCode:p.code}]}),
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
