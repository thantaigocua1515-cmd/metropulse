"use strict";

const day=86400000,offset=7*3600000,keep=7*day;
const dayNumber=ms=>Math.floor((ms+offset)/day);
const weekStart=ms=>{
 const n=dayNumber(ms);
 return new Date((n-((n+3)%7+7)%7)*day-offset);
};
const foul=value=>/(?:^|[^\p{L}\p{N}])(?:đéo|địt|lồn|cặc)(?:$|[^\p{L}\p{N}])/iu.test(value)||
 /(?:^|[^a-z0-9])(?:dit\s+me|du\s+ma|dmm|vcl|fuck|shit)(?:$|[^a-z0-9])/i.test(value.normalize("NFD").replace(/\p{M}/gu,"").replace(/đ/gi,"d"));
const maxLength=240;
const messageText=raw=>{
 if(typeof raw!=="string")return null;
 const text=raw.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu," ").replace(/\s+/g," ").trim();
 return text&&[...text].length<=maxLength&&!foul(text)?text:null;
};

module.exports=function community(router,{getDb,players,gifts,fail,wrap}){
 const messages=()=>getDb().collection("chatMessages"),claims=()=>getDb().collection("coopClaims");
 const newest={createdAt:-1,_id:-1},codeOf=raw=>typeof raw==="string"?raw.trim().toUpperCase():"";
 const pair=(a,b)=>[a,b].sort().join(":");
 const friend=async(player,raw)=>{
  const code=codeOf(raw);
  if(!/^MP-[A-Z0-9]{4,8}$/.test(code)||code===player.code)throw fail(400,"Hãy chọn một thành phố bạn bè.");
  const other=await players().findOne({code,bannedAt:{$exists:false}},{projection:{code:1,name:1,friends:1}});
  if(!other||!((player.friends||[]).includes(code)||(other.friends||[]).includes(player.code)))throw fail(403,"Chỉ mở cho bạn bè đã kết nối.");
  return other;
 };
 const channel=async(player,code)=>{
  if(code===undefined||code==="world")return {room:"world",to:null};
  const other=await friend(player,code);
  return {room:pair(player.code,other.code),to:other.code};
 };
 const recent=()=>({$gte:new Date(Date.now()-keep)});
 const named=player=>messageText(player.name)||"Thị trưởng";
 const row=m=>({id:String(m._id),from:m.from,name:m.name,text:m.text,createdAt:m.createdAt});
 router.get("/chat/activity",wrap(async(req,res)=>{
  const {code}=req.player;
  const [world,dms]=await Promise.all([
   messages().findOne({room:"world",from:{$ne:code},createdAt:recent(),hiddenAt:{$exists:false}},{sort:newest,projection:{_id:1}}),
   messages().aggregate([
    {$match:{to:code,createdAt:recent(),hiddenAt:{$exists:false}}},{$sort:newest},{$group:{_id:"$from",latest:{$first:"$_id"},name:{$first:"$name"},createdAt:{$first:"$createdAt"}}},
    {$sort:{createdAt:-1}},{$limit:50}
   ]).toArray()
  ]);
  res.json({world:world?String(world._id):null,dms:dms.map(d=>({code:d._id,id:String(d.latest),name:d.name}))});
 }));
 router.get("/chat",wrap(async(req,res)=>{
  const {room}=await channel(req.player,req.query.channel);
  const result=await messages().find({room,createdAt:recent(),hiddenAt:{$exists:false}}).sort(newest).limit(40).toArray();
  res.json({messages:result.reverse().map(row)});
 }));
 router.post("/chat",wrap(async(req,res)=>{
  const {room,to}=await channel(req.player,req.body?.channel);
  const text=messageText(req.body?.text);
  if(!text)throw fail(400,"Tin nhắn cần 1–240 ký tự và không chứa từ ngữ thô tục.");
  const now=new Date(),slot=await players().updateOne({_id:req.player._id,bannedAt:{$exists:false},$or:[{chatAt:{$exists:false}},{chatAt:{$lte:new Date(+now-2000)}}]},{$set:{chatAt:now}});
  if(!slot.modifiedCount)throw fail(429,"Chờ 2 giây trước khi gửi tin nhắn tiếp theo.");
  const message={room,to,from:req.player.code,name:named(req.player),text,createdAt:now};
  const {insertedId}=await messages().insertOne(message);
  res.status(201).json({message:row({...message,_id:insertedId})});
 }));

 const goal=async(player,raw)=>{
  const other=await friend(player,raw),start=weekStart(Date.now()),end=new Date(+start+7*day);
  const key=+start+":"+pair(player.code,other.code)+":"+player.code;
  const [rows,claimed]=await Promise.all([
   gifts().find({createdAt:{$gte:start,$lt:end},$or:[{to:player._id,fromCode:other.code},{to:other._id,fromCode:player.code}]},
    {projection:{fromCode:1,createdAt:1}}).limit(80).toArray(),
   claims().findOne({_id:key},{projection:{_id:1}})
  ]);
  const count=code=>new Set(rows.filter(r=>r.fromCode===code).map(r=>dayNumber(+r.createdAt))).size;
  const mine=count(player.code),theirs=count(other.code);
  return {key,code:other.code,name:other.name,mine,theirs,end,done:mine>0&&theirs>0&&mine+theirs>=3,claimed:!!claimed,reward:400};
 };
 router.get("/coop/:code",wrap(async(req,res)=>{
  const {key,...progress}=await goal(req.player,req.params.code);
  res.json(progress);
 }));
 router.post("/coop/:code/claim",wrap(async(req,res)=>{
  const {key,done,claimed,reward}=await goal(req.player,req.params.code);
  if(!done||claimed)throw fail(409,claimed?"Bạn đã nhận thưởng tuần này.":"Chưa hoàn thành mục tiêu chung.");
  try{await claims().insertOne({_id:key,createdAt:new Date()})}
  catch(error){if(error.code===11000)throw fail(409,"Bạn đã nhận thưởng tuần này.");throw error}
  res.json({coins:reward});
 }));
};
