"use strict";
const crypto=require("node:crypto");
const express=require("express");
const QRCode=require("qrcode");
const {sha,newToken,hashPassword,verifyPassword}=require("./auth");

const OWNER="owner",COOKIE="__Host-mp_admin",MINUTE=60000,IDLE=30*MINUTE,ABSOLUTE=12*60*MINUTE;
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const dummy={salt:"0".repeat(32),hash:"0".repeat(128)};
const fail=(status,message)=>Object.assign(new Error(message),{status});
const wrap=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next);
const refused=()=>fail(401,"Thông tin xác thực không hợp lệ.");
const base32=bytes=>{
 let out="",bits=0,value=0;
 for(const byte of bytes){
  value=(value<<8)|byte;bits+=8;
  while(bits>=5){bits-=5;out+=alphabet[(value>>bits)&31]}
 }
 return bits?out+alphabet[(value<<(5-bits))&31]:out;
};
function totp(secret,step){
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
 const h=crypto.createHmac("sha1",Buffer.from(secret,"hex")).update(counter).digest();
 return (h.readUInt32BE(h.at(-1)&15)&0x7fffffff)%1000000;
}
const codeBuffer=value=>Buffer.from(String(value).padStart(6,"0"));
function matchedStep(secret,value,now=Date.now()){
 if(typeof value!=="string"||!/^\d{6}$/.test(value))return null;
 const step=Math.floor(now/30000),actual=Buffer.from(value);
 let match=null;
 for(const offset of [-1,0,1])if(crypto.timingSafeEqual(actual,codeBuffer(totp(secret,step+offset))))match=step+offset;
 return match;
}
const validPassword=password=>typeof password==="string"&&password.length>=14&&Buffer.byteLength(password)<=256;
const candidate=password=>typeof password==="string"&&Buffer.byteLength(password)<=256?password:"";
const passwordPolicy=password=>{if(!validPassword(password))throw fail(400,"Dùng mật khẩu dài ít nhất 14 ký tự (tối đa 256 byte).")};
const newCodes=()=>Array.from({length:10},()=>crypto.randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g).join("-"));
const recoveryHash=code=>typeof code==="string"&&/^[a-f0-9]{4}(?:-[a-f0-9]{4}){7}$/i.test(code)?sha(code.replaceAll("-","").toUpperCase()):null;
const tokenHash=token=>typeof token==="string"&&tokenPattern.test(token)?sha(token):null;
const cookieOptions={httpOnly:true,secure:true,sameSite:"strict",path:"/"};
const cookieValue=req=>(req.get("cookie")||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
const boundedName=name=>typeof name==="string"&&/^[a-zA-Z0-9_.-]{3,40}$/.test(name)?name:null;
function adminOrigin(){
 const configured=process.env.ADMIN_ORIGIN||(process.env.VERCEL_PROJECT_PRODUCTION_URL?"https://"+process.env.VERCEL_PROJECT_PRODUCTION_URL:"");
 if(!configured)return null;
 try{
  const url=new URL(configured);
  return url.protocol==="https:"&&!url.username&&!url.password&&url.pathname==="/"&&!url.search&&!url.hash?url.origin:null;
 }catch{return null}
}
function checkOrigin(req){
 const origin=req.get("origin");
 const expected=adminOrigin()||(!process.env.VERCEL&&process.env.NODE_ENV!=="production"&&/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(req.get("host"))?"http://"+req.get("host"):null);
 if(!expected||origin!==expected||req.get("sec-fetch-site")==="cross-site")throw fail(403,"Yêu cầu không hợp lệ.");
}
async function issueSetupToken(db){
 const token=newToken(),now=new Date(),expiresAt=new Date(+now+30*MINUTE);
 try{
  const result=await db.collection("admins").updateOne({_id:OWNER,username:{$exists:false}},{$set:{
   setupHash:sha(token),setupExpiresAt:expiresAt,setupSecret:crypto.randomBytes(20).toString("hex")
  }},{upsert:true});
  if(!result.modifiedCount&&!result.upsertedCount)throw fail(409,"Quản trị viên đã được thiết lập.");
 }catch(error){if(error.code===11000)throw fail(409,"Quản trị viên đã được thiết lập.");throw error}
 return {token,expiresAt};
}
async function setupQR(secret){
 const key=base32(Buffer.from(secret,"hex"));
 const uri="otpauth://totp/MetroPulse:Owner?secret="+key+"&issuer=MetroPulse&algorithm=SHA1&digits=6&period=30";
 return {key,qr:await QRCode.toDataURL(uri,{margin:2,width:240,errorCorrectionLevel:"M"})};
}
async function throttle(db,key,now){
 const bucket=db.collection("adminRateLimits"),id=sha(key);
 const windowEndsAt=new Date(+now+30*MINUTE);
 const delay={$cond:[{$gte:["$n",5]},{$min:[15*MINUTE,{$multiply:[1000,{$pow:[2,{$min:[10,"$n"]}]}]}]},0]};
 const pipeline=[
  {$set:{n:{$cond:[{$gt:["$resetAt",now]},{$cond:[{$gt:["$lockedUntil",now]},"$n",{$add:["$n",1]}]},1]},
   resetAt:{$cond:[{$gt:["$resetAt",now]},"$resetAt",windowEndsAt]},alreadyLocked:{$and:[{$gt:["$resetAt",now]},{$gt:["$lockedUntil",now]}]}}},
  {$set:{lockedUntil:{$cond:["$alreadyLocked","$lockedUntil",{$add:[now,delay]}]},expiresAt:"$resetAt"}},
  {$unset:"alreadyLocked"}
 ];
 let entry;
 try{entry=await bucket.findOneAndUpdate({_id:id},pipeline,{upsert:true,returnDocument:"after"})}
 catch(error){if(error.code!==11000)throw error;entry=await bucket.findOneAndUpdate({_id:id},pipeline,{returnDocument:"after"})}
 return !!entry&&entry.lockedUntil<=now;
}
async function rate(req,accountKey){
 const db=req.adminDb,now=new Date();
 const scope=accountKey===OWNER||accountKey==="unknown"?"login":accountKey;
 if(!await throttle(db,scope+":ip:"+(req.ip||"local"),now)||!await throttle(db,"account:"+accountKey,now))throw fail(429,"Thử quá nhiều lần. Vui lòng đợi rồi thử lại.");
}
async function audit(req,action,target,before=null,after=null){
 await req.adminDb.collection("adminAudit").insertOne({
  actor:req.admin?.username||"owner",action,target,before,after,ip:req.ip||"local",at:new Date()
 });
}
async function startSession(req,res,admin){
 const token=newToken(),now=new Date(),absoluteExpiresAt=new Date(+now+ABSOLUTE);
 await req.adminDb.collection("adminSessions").insertOne({_id:sha(token),epoch:admin.epoch,createdAt:now,absoluteExpiresAt,expiresAt:new Date(+now+IDLE)});
 res.cookie(COOKIE,token,{...cookieOptions,maxAge:ABSOLUTE});
}
async function useSecondFactor(db,admin,code,{totpOnly=false}={}){
 const step=matchedStep(admin.totpSecret,code),admins=db.collection("admins");
 if(step!==null) return !!(await admins.updateOne({_id:OWNER,epoch:admin.epoch,lastTotp:{$lt:step}},{$set:{lastTotp:step}})).modifiedCount;
 if(totpOnly)return false;
 const hash=recoveryHash(code);
 if(!hash)return false;
 let entry=null;
 const actual=Buffer.from(hash,"hex");
 for(const h of admin.recovery)if(crypto.timingSafeEqual(Buffer.from(h,"hex"),actual))entry=h;
 return !!entry&&!!(await admins.updateOne({_id:OWNER,epoch:admin.epoch,recovery:entry},{$pull:{recovery:entry}})).modifiedCount;
}
async function revoke(req,res,changes={}){
 const db=req.adminDb,{epoch}=req.admin;
 const result=await db.collection("admins").updateOne({_id:OWNER,epoch},{$inc:{epoch:1},$set:{totpPending:null,...changes,updatedAt:new Date()}});
 if(!result.modifiedCount)throw refused();
 await db.collection("adminSessions").deleteMany({epoch:{$lte:epoch}});
 res.clearCookie(COOKIE,cookieOptions);
}
function adminRouter(getDb,register){
 const router=express.Router();
 router.use((req,res,next)=>{
  res.set({"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer",
   "Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"});
  if(!["GET","HEAD"].includes(req.method))try{checkOrigin(req)}catch(error){return next(error)}
  req.adminDb=getDb();
  if(!req.adminDb)return next(fail(503,"Bảng điều hành tạm thời không khả dụng."));
  next();
 });
 router.use(express.json({limit:"24kb"}));
 const lookupSetup=async req=>{
  const hash=tokenHash(req.body?.token);
  if(!hash)throw refused();
  const selector={_id:OWNER,username:{$exists:false},setupHash:hash,setupExpiresAt:{$gt:new Date()}};
  const admin=await req.adminDb.collection("admins").findOne(selector);
  if(!admin)throw refused();
  return {admin,selector};
 };
 router.post("/setup/start",wrap(async(req,res)=>{
  await rate(req,"setup");
  const {admin}=await lookupSetup(req);
  res.json(await setupQR(admin.setupSecret));
 }));
 router.post("/setup",wrap(async(req,res)=>{
  await rate(req,"setup");
  const {admin,selector}=await lookupSetup(req),{username,password,code}=req.body;
  if(!boundedName(username))throw fail(400,"Tên đăng nhập gồm 3–40 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.");
  passwordPolicy(password);
  const step=matchedStep(admin.setupSecret,code);
  if(step===null)throw refused();
  const codes=newCodes(),pass=await hashPassword(password),now=new Date();
  const owner={username,usernameLower:username.toLowerCase(),pass,totpSecret:admin.setupSecret,lastTotp:step,recovery:codes.map(recoveryHash),epoch:1,createdAt:now,updatedAt:now};
  selector.setupExpiresAt={$gt:now};
  const result=await req.adminDb.collection("admins").updateOne(selector,{$set:owner,$unset:{setupHash:1,setupSecret:1,setupExpiresAt:1}});
  if(!result.modifiedCount)throw refused();
  req.admin=owner;await audit(req,"admin.setup",OWNER);await startSession(req,res,owner);
  res.status(201).json({username,codes});
 }));
 router.post("/login",wrap(async(req,res)=>{
  const {username,password,code}=req.body||{};
  const owner=await req.adminDb.collection("admins").findOne({_id:OWNER,username:{$exists:true}});
  const name=boundedName(username)?.toLowerCase(),same=!!name&&name===owner?.usernameLower;
  await rate(req,same?OWNER:"unknown");
  const verified=await verifyPassword(candidate(password),same?owner.pass:dummy);
  if(!same||!verified||!await useSecondFactor(req.adminDb,owner,code)){
   await audit(req,"admin.login.failed",OWNER);
   throw refused();
  }
  req.admin=owner;await audit(req,"admin.login",OWNER);await startSession(req,res,owner);
  res.json({username:owner.username});
 }));
 router.use(wrap(async(req,res,next)=>{
  const now=new Date(),hash=tokenHash(cookieValue(req)),db=req.adminDb;
  if(!hash)throw refused();
  const session=await db.collection("adminSessions").findOne({_id:hash,expiresAt:{$gt:now},absoluteExpiresAt:{$gt:now}});
  const owner=session&&await db.collection("admins").findOne({_id:OWNER,epoch:session.epoch,username:{$exists:true}});
  if(!owner)throw refused();
  const nextExpiry=new Date(Math.min(+now+IDLE,+session.absoluteExpiresAt));
  if(+nextExpiry>+session.expiresAt)await db.collection("adminSessions").updateOne({_id:hash,expiresAt:{$gt:now}},{$max:{expiresAt:nextExpiry}});
  req.admin=owner;req.adminSession=hash;next();
 }));
 router.get("/session",(req,res)=>res.json({username:req.admin.username}));
 router.post("/logout",wrap(async(req,res)=>{
  await req.adminDb.collection("adminSessions").deleteOne({_id:req.adminSession});
  await audit(req,"admin.logout",OWNER);
  res.clearCookie(COOKIE,cookieOptions).json({ok:true});
 }));
 router.post("/logout-all",wrap(async(req,res)=>{
  await revoke(req,res);await audit(req,"admin.logout-all",OWNER);res.json({ok:true});
 }));
 const reauth=async(req,code)=>{
  await rate(req,"reauth");
  if(!await verifyPassword(candidate(req.body?.current),req.admin.pass)||code!==undefined&&!await useSecondFactor(req.adminDb,req.admin,code,{totpOnly:true}))throw refused();
 };
 router.post("/password",wrap(async(req,res)=>{
  passwordPolicy(req.body?.password);
  await reauth(req,req.body?.code??null);
  await revoke(req,res,{pass:await hashPassword(req.body.password)});
  await audit(req,"admin.password",OWNER);res.json({ok:true});
 }));
 router.post("/totp/start",wrap(async(req,res)=>{
  await reauth(req);
  const secret=crypto.randomBytes(20).toString("hex");
  const request=newToken();
  await req.adminDb.collection("admins").updateOne({_id:OWNER,epoch:req.admin.epoch},{$set:{totpPending:{
   hash:sha(request),secret,expiresAt:new Date(Date.now()+10*MINUTE),session:req.adminSession
  }}});
  res.json({...await setupQR(secret),request});
 }));
 router.post("/totp/reset",wrap(async(req,res)=>{
  const {totpPending:p}=req.admin,{request,code,newCode}=req.body||{};
  await rate(req,"reauth");
  const hash=tokenHash(request);
  if(!p||p.session!==req.adminSession||p.expiresAt<=new Date()||!hash||
   !crypto.timingSafeEqual(Buffer.from(p.hash,"hex"),Buffer.from(hash,"hex")))throw refused();
  const step=matchedStep(p.secret,newCode);
  if(step===null)throw refused();
  if(!await verifyPassword(candidate(req.body?.current),req.admin.pass)||!await useSecondFactor(req.adminDb,req.admin,code,{totpOnly:true}))throw refused();
  const codes=newCodes();
  await revoke(req,res,{totpSecret:p.secret,lastTotp:step,recovery:codes.map(recoveryHash),totpPending:null});
  await audit(req,"admin.totp.reset",OWNER);res.json({codes});
 }));
 register(router,{audit,wrap,fail});
 router.use((req,res)=>res.status(404).json({error:"Không tìm thấy chức năng."}));
 router.use((error,req,res,next)=>{
  if(res.headersSent)return next(error);
  const status=error.status>=400&&error.status<=599?error.status:500;
  if(status>=500)console.error("Admin API error",req.method,req.path,error.code||error.name);
  res.status(status).json({error:status>=500?"Bảng điều hành tạm thời không khả dụng.":error.type==="entity.parse.failed"?"Dữ liệu không hợp lệ.":error.message});
 });
 return router;
}

module.exports={adminRouter,adminOrigin,issueSetupToken,totp,matchedStep};
