"use strict";
const express=require("express");
const {sha,newToken,newCode,hashPassword,verifyPassword,limiter}=require("./auth");
const {CONFIG,inspectSave,publicCity,cleanName}=require("./game");
const community=require("./community");
const liveops=require("./liveops");
const history=require("./save-history");
const events=require("./event-config"),{heartbeat}=require("./analytics");

const STATS=["score","assets","happiness","helpsGiven"];
const today=()=>new Date().toISOString().slice(0,10);
const fail=(status,message,extra)=>Object.assign(Error(message),{status,extra});
const wrap=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next);
const avatarOf=p=>p.summary?.avatar||CONFIG.avatars.fallback;
const account=p=>({code:p.code,name:p.name,username:p.username||null,createdAt:p.createdAt});

module.exports=function routes(getDb){
 const router=express.Router();
 router.use((req,res,next)=>{res.set("Cache-Control","no-store");next()});
 const players=()=>getDb().collection("players"),saves=()=>getDb().collection("saves"),gifts=()=>getDb().collection("gifts");
 const authLimit=limiter(20,10*60000),nameLimit=limiter(10,10*60000),guestLimit=limiter(30,60*60000),saveLimit=limiter(40,60000),socialLimit=limiter(120,60000);
 const ip=req=>req.ip||"local";

 router.use((req,res,next)=>{if(!getDb())return next(fail(503,"Máy chủ chưa kết nối được cơ sở dữ liệu."));next()});
 router.get("/health",(req,res)=>res.json({ok:true,time:Date.now()}));
 router.get("/events/config",wrap(async(req,res)=>{
  res.set("Cache-Control","public, max-age=60, stale-if-error=300").json({rows:await events.read(getDb())});
 }));
 router.get("/announcements",wrap(async(req,res)=>res.json({rows:await liveops.announcements(getDb())})));
 const bearer=req=>/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get("authorization")||"")?.[1];
 router.post("/presence",wrap(async(req,res)=>{
  const {device,session}=req.body||{},token=bearer(req);
  const id=/^[a-f0-9]{32}$/;
  if(typeof device!=="string"||typeof session!=="string"||!id.test(device)||!id.test(session))throw fail(400,"Phiên không hợp lệ.");
  const now=Date.now(),window=Math.floor(now/60000),limits=getDb().collection("presenceLimits");
  const key=window+":"+sha(ip(req));
  let bucket;
  try{bucket=await limits.findOneAndUpdate({_id:key},{$inc:{hits:1},$setOnInsert:{expiresAt:new Date((window+2)*60000)}},{upsert:true,returnDocument:"after"})}
  catch(error){if(error.code!==11000)throw error;bucket=await limits.findOneAndUpdate({_id:key},{$inc:{hits:1}},{returnDocument:"after"})}
  if(!bucket||bucket.hits>120)throw fail(429,"Đồng bộ quá nhanh.");
  const account=token&&await players().findOne({"tokens.hash":sha(token),bannedAt:{$exists:false}},{projection:{code:1,createdAt:1}});
  if(req.get("authorization")&&!account)throw fail(401,"Phiên đăng nhập đã hết hạn.");
  if(!await heartbeat(getDb(),{device,session,account},new Date(now)))throw fail(400,"Phiên không hợp lệ.");
  res.status(204).end();
 }));

 const issueToken=async id=>{
  const token=newToken();
  // Giữ tối đa 5 phiên đăng nhập gần nhất cho mỗi người chơi.
  const issued=await players().updateOne({_id:id,bannedAt:{$exists:false}},{$push:{tokens:{$each:[{hash:sha(token),createdAt:new Date()}],$slice:-5}}});
  if(!issued.modifiedCount)throw fail(401,"Sai tên đăng nhập hoặc mật khẩu.");
  return token;
 };
 // Kiểm tra tên đăng nhập và mật khẩu mới; trả về dữ liệu đã chuẩn hóa.
 const credentials=body=>{
  const {username,password}=body||{};
  if(typeof username!=="string"||!/^[a-zA-Z0-9_.]{3,20}$/.test(username))throw fail(400,"Tên đăng nhập gồm 3–20 chữ cái, số, dấu chấm hoặc gạch dưới.");
  checkPassword(password);
  return {username,password};
 };
 const checkPassword=password=>{if(typeof password!=="string"||password.length<6||password.length>72)throw fail(400,"Mật khẩu cần từ 6 đến 72 ký tự.")};
 const taken=error=>error.code===11000&&error.keyPattern?.usernameLower;
 const createPlayer=async(extra={})=>{
  for(let attempt=0;attempt<5;attempt++){
   const now=new Date(),doc={...extra,code:newCode(),name:"Thị trưởng Mới",tokens:[],friends:[],coins:0,city:[],summary:{level:1,score:0,assets:0,happiness:100,helpsGiven:0,pop:0},createdAt:now,updatedAt:now,lastSeenAt:now};
   try{const r=await players().insertOne(doc);return {...doc,_id:r.insertedId}}
   catch(error){if(taken(error))throw fail(409,"Tên đăng nhập đã có người dùng.");if(error.code!==11000)throw error}
  }
  throw fail(500,"Không tạo được mã thành phố.");
 };
 const enter=async player=>({token:await issueToken(player._id),account:account(player),...await liveops.recordLogin(getDb(),player)});

 router.post("/auth/guest",wrap(async(req,res)=>{
  if(!guestLimit(ip(req)))throw fail(429,"Tạo quá nhiều tài khoản. Hãy thử lại sau.");
  res.status(201).json(await enter(await createPlayer()));
 }));
 // Đăng ký tài khoản mới ngay từ màn hình chào (không cần phiên khách trước đó).
 router.post("/auth/signup",wrap(async(req,res)=>{
  if(!authLimit(ip(req)))throw fail(429,"Thao tác quá nhanh. Hãy đợi vài phút.");
  const {username,password}=credentials(req.body);
  const player=await createPlayer({username,usernameLower:username.toLowerCase(),pass:await hashPassword(password)});
  res.status(201).json(await enter(player));
 }));
 router.post("/auth/login",wrap(async(req,res)=>{
  const {username,password}=req.body||{};
  if(typeof username!=="string"||typeof password!=="string")throw fail(400,"Thiếu tên đăng nhập hoặc mật khẩu.");
  if(!authLimit(ip(req))||!nameLimit(username.trim().toLowerCase().slice(0,40)))throw fail(429,"Thử đăng nhập quá nhiều lần. Hãy đợi vài phút.");
  const player=await players().findOne({usernameLower:username.trim().toLowerCase()});
  if(!player||player.bannedAt||!(await verifyPassword(password,player.pass)))throw fail(401,"Sai tên đăng nhập hoặc mật khẩu.");
  res.json(await enter(player));
 }));

 // Từ đây trở xuống cần đăng nhập bằng token.
 router.use(wrap(async(req,res,next)=>{
  const header=req.get("authorization")||"",token=header.startsWith("Bearer ")?header.slice(7):"";
  if(!token)throw fail(401,"Chưa đăng nhập.");
  const player=await players().findOne({"tokens.hash":sha(token),bannedAt:{$exists:false}},{projection:{pass:0,tokens:0}});
  if(!player)throw fail(401,"Phiên đăng nhập đã hết hạn.");
  req.player=player;req.tokenHash=sha(token);next();
 }));

 router.get("/me",wrap(async(req,res)=>{
  await players().updateOne({_id:req.player._id},{$set:{lastSeenAt:new Date()}});
  res.json({account:account(req.player),...await liveops.recordLogin(getDb(),req.player)});
 }));
 router.patch("/me",wrap(async(req,res)=>{
  const name=cleanName(req.body?.name,40);if(!name)throw fail(400,"Tên không hợp lệ.");
  await players().updateOne({_id:req.player._id},{$set:{name}});res.json({ok:true,name});
 }));
 router.post("/auth/register",wrap(async(req,res)=>{
  if(!authLimit(ip(req)))throw fail(429,"Thao tác quá nhanh. Hãy đợi vài phút.");
  const {username,password}=credentials(req.body);
  if(req.player.username)throw fail(409,"Tài khoản này đã có tên đăng nhập.");
  try{await players().updateOne({_id:req.player._id},{$set:{username,usernameLower:username.toLowerCase(),pass:await hashPassword(password)}})}
  catch(error){if(taken(error))throw fail(409,"Tên đăng nhập đã có người dùng.");throw error}
  res.json({account:account({...req.player,username})});
 }));
 // Đổi mật khẩu: cần mật khẩu hiện tại; các thiết bị khác bị đăng xuất.
 router.post("/auth/password",wrap(async(req,res)=>{
  if(!authLimit(ip(req)))throw fail(429,"Thao tác quá nhanh. Hãy đợi vài phút.");
  if(!req.player.username)throw fail(400,"Tài khoản khách chưa có mật khẩu.");
  const {current,password}=req.body||{};checkPassword(password);
  const stored=await players().findOne({_id:req.player._id},{projection:{pass:1}});
  if(typeof current!=="string"||!(await verifyPassword(current,stored?.pass)))throw fail(403,"Mật khẩu hiện tại không đúng.");
  await players().updateOne({_id:req.player._id},{$set:{pass:await hashPassword(password),tokens:[{hash:req.tokenHash,createdAt:new Date()}]}});
  res.json({ok:true});
 }));
 router.post("/auth/logout",wrap(async(req,res)=>{
  await players().updateOne({_id:req.player._id},{$pull:{tokens:{hash:req.tokenHash}}});res.json({ok:true});
 }));

 router.get("/save",wrap(async(req,res)=>{
  const save=await saves().findOne({_id:req.player._id});
  res.json(save?{rev:save.rev,data:save.data,updatedAt:save.updatedAt,...(save.adminRev?{adminRev:save.adminRev}:{})}:{rev:0,data:null});
 }));
 router.put("/save",wrap(async(req,res)=>{
  if(!saveLimit(String(req.player._id)))throw fail(429,"Đồng bộ quá nhanh.");
  const {rev,data,confirmRegression}=req.body||{},check=inspectSave(data);
  if(check.error)throw fail(400,check.error);
  if(!liveops.owns(req.player,data.profile.skin??"default"))throw fail(403,"Bạn chưa sở hữu bộ skin này.");
  const conflict=latest=>fail(409,"Bản lưu trên máy chủ đã thay đổi từ thiết bị khác.",{
   rev:latest?.rev||0,...(rev<latest?.adminRev?{adminEdited:true}:{})
  });
  const id=req.player._id,now=new Date();
  const result=await history.transaction(getDb(),async session=>{
   const current=await saves().findOne({_id:id},{session}),serverRev=current?.rev||0;
   if(!Number.isSafeInteger(rev)||rev!==serverRev)throw conflict(current);
   if(current?.data&&CONFIG.saveRegresses(CONFIG.saveProgress(current.data),CONFIG.saveProgress(data))&&confirmRegression!==true)
    throw fail(409,"Bản lưu này có ít tiến độ hơn bản trên máy chủ.",{rev:serverRev,regression:true});
   const next=serverRev+1;
   const player=await players().updateOne({_id:id,bannedAt:{$exists:false},"tokens.hash":req.tokenHash},
    {$set:{name:check.name,summary:check.summary,city:check.city,coins:check.coins,updatedAt:now,lastSeenAt:now}},{session});
   if(!player.matchedCount)throw fail(401,"Phiên đăng nhập đã hết hạn.");
   await history.archive(getDb(),current,confirmRegression===true?"replace":"sync",now,session);
   await saves().updateOne({_id:id},{$set:{rev:next,data,updatedAt:now}},{upsert:true,session});
   return {rev:next,updatedAt:now};
  });
  res.json(result);
 }));
 router.delete("/save",wrap(async(req,res)=>{
  const {rev,confirm}=req.body||{};
  if(confirm!=="reset")throw fail(400,"Cần xác nhận bắt đầu lại từ đầu.");
  const id=req.player._id,now=new Date();
  const next=await history.transaction(getDb(),async session=>{
   const current=await saves().findOne({_id:id},{session}),currentRev=current?.rev||0;
   if(rev!==currentRev)throw fail(409,"Bản lưu đã đổi. Hãy tải lại trước khi đặt lại.",{rev:currentRev,adminEdited:rev<current?.adminRev});
   const player=await players().updateOne({_id:id,bannedAt:{$exists:false},"tokens.hash":req.tokenHash},
    {$set:{summary:{level:1,score:0,assets:0,happiness:100,helpsGiven:0,pop:0},city:[],coins:0,updatedAt:now}},{session});
   if(!player.matchedCount)throw fail(401,"Phiên đăng nhập đã hết hạn.");
   await history.archive(getDb(),current,"reset",now,session);
   const next=currentRev+1;
   await saves().updateOne({_id:id},{$set:{data:null,rev:next,adminRev:next,updatedAt:now}},{upsert:true,session});
   return next;
  });
  res.json({ok:true,rev:next});
 }));

 router.get("/leaderboard",wrap(async(req,res)=>{
  const stat=STATS.includes(req.query.stat)?req.query.stat:"score",field="summary."+stat;
  const top=await players().find({"summary.level":{$gte:1},city:{$exists:true,$ne:[]}},{projection:{code:1,name:1,summary:1}}).sort({[field]:-1,_id:1}).limit(30).toArray();
  const row=p=>({code:p.code,name:p.name,level:p.summary.level,avatar:avatarOf(p),score:p.summary[stat]||0});
  let me=null;
  if(!top.some(p=>p.code===req.player.code)&&req.player.city?.length){
   const mine=req.player.summary?.[stat]||0,place=1+await players().countDocuments({[field]:{$gt:mine},city:{$exists:true,$ne:[]}});
   me={...row(req.player),place};
  }
  res.json({stat,rows:top.map(row),me});
 }));

 const findCity=async code=>{
  if(typeof code!=="string"||!/^MP-[A-Z0-9]{4,8}$/.test(code))throw fail(400,"Mã thành phố không đúng định dạng (ví dụ MP-7K2QF9).");
  const friend=await players().findOne({code},{projection:{code:1,name:1,summary:1,city:1,coins:1}});
  if(!friend||!friend.city?.length)throw fail(404,"Không tìm thấy thành phố với mã này.");
  return friend;
 };
 router.get("/friends",wrap(async(req,res)=>{
  const codes=(req.player.friends||[]).slice(0,50);
  const list=codes.length?await players().find({code:{$in:codes},city:{$exists:true,$ne:[]}},{projection:{code:1,name:1,summary:1,city:1,coins:1}}).toArray():[];
  res.json({cities:list.map(publicCity),avatars:Object.fromEntries(list.map(p=>[p.code,avatarOf(p)]))});
 }));
 router.post("/friends",wrap(async(req,res)=>{
  if(!socialLimit(String(req.player._id)))throw fail(429,"Thao tác quá nhanh.");
  const code=String(req.body?.code||"").trim().toUpperCase();
  if(code===req.player.code)throw fail(400,"Đây là mã thành phố của bạn.");
  const friend=await findCity(code);
  if((req.player.friends||[]).length>=50&&!req.player.friends.includes(code))throw fail(400,"Danh sách bạn bè đã đủ 50 thành phố.");
  await players().updateOne({_id:req.player._id},{$addToSet:{friends:code}});
  res.status(201).json({city:publicCity(friend),avatar:avatarOf(friend)});
 }));
 router.delete("/friends/:code",wrap(async(req,res)=>{
  await players().updateOne({_id:req.player._id},{$pull:{friends:String(req.params.code).toUpperCase()}});res.json({ok:true});
 }));

 // Chi viện: người được giúp nhận quà cảm ơn trong hộp thư. Tối đa 5 lượt/ngày cho mỗi người gửi.
 router.post("/assist",wrap(async(req,res)=>{
  const friend=await findCity(String(req.body?.code||"").trim().toUpperCase());
  if(friend.code===req.player.code)throw fail(400,"Không thể tự chi viện.");
  const day=today();
  const slot=await players().updateOne({_id:req.player._id,$or:[{"assist.day":{$ne:day}},{"assist.count":{$lt:5}}]},
   [{$set:{assist:{$cond:[{$eq:["$assist.day",day]},{day,count:{$add:["$assist.count",1]}},{day,count:1}]}}}]);
  if(!slot.modifiedCount)throw fail(429,"Đã hết 5 lượt chi viện hôm nay.");
  const coins=100*(friend.summary?.level||1);
  await gifts().insertOne({to:friend._id,fromCode:req.player.code,fromName:req.player.name,coins,createdAt:new Date(),claimedAt:null});
  res.status(201).json({ok:true,coins});
 }));
 router.get("/mailbox",wrap(async(req,res)=>{
  const [list,mail]=await Promise.all([
   gifts().find({to:req.player._id,claimedAt:null},{projection:{fromName:1,fromCode:1,coins:1,createdAt:1}}).sort({createdAt:-1}).limit(50).toArray(),
   liveops.mailbox(getDb(),req.player)
  ]);
  res.json({...mail,gifts:list.map(g=>({id:String(g._id),fromName:g.fromName,fromCode:g.fromCode,coins:g.coins,createdAt:g.createdAt}))});
 }));
 router.post("/mailbox/:id/claim",wrap(async(req,res)=>res.json(await liveops.claim(getDb(),req.player,req.tokenHash,req.params.id))));
 router.post("/mailbox/claim",wrap(async(req,res)=>{
  const list=await gifts().find({to:req.player._id,claimedAt:null},{projection:{coins:1}}).limit(50).toArray();
  if(!list.length)return res.json({coins:0,count:0});
  const result=await gifts().updateMany({_id:{$in:list.map(g=>g._id)},claimedAt:null},{$set:{claimedAt:new Date()}});
  // Chỉ cộng đúng số quà vừa đổi trạng thái, tránh nhận hai lần khi bấm liên tiếp.
  const claimed=result.modifiedCount===list.length?list:list.slice(0,result.modifiedCount);
  res.json({coins:claimed.reduce((sum,g)=>sum+g.coins,0),count:claimed.length});
 }));
 community(router,{getDb,players,gifts,fail,wrap});

 router.use((req,res)=>res.status(404).json({error:"Không tìm thấy đường dẫn API."}));
 // eslint-disable-next-line no-unused-vars
 router.use((error,req,res,next)=>{
  const status=error.status||(error.type==="entity.too.large"?413:error.type==="entity.parse.failed"?400:500);
  if(status>=500)console.error("[api]",req.method,req.path,status===503?error.message:error);
  res.status(status).json({error:status>=500&&status!==503?"Máy chủ gặp lỗi. Hãy thử lại sau.":status===413?"Bản lưu quá lớn.":error.message,...error.extra});
 });
 return router;
};
