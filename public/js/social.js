"use strict";
class SocialStorageAdapter {
 constructor(data){this.records=data}
 list(){return this.records}
 add(friend){if(this.records.some(f=>f.id===friend.id))throw Error("Thành phố này đã có trong danh sách.");if(this.records.length>=50)throw Error("Danh sách đã đủ 50 thành phố.");this.records.push(friend)}
 static code(data){
  const bytes=new TextEncoder().encode(JSON.stringify(data));let binary="";
  for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);
 }
 static decode(code){
  if(typeof code!=="string"||code.length>28000||!(/^[a-zA-Z0-9+/]+={0,2}$/.test(code)))throw Error("Mã Base64 không hợp lệ.");
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Uint8Array.from(atob(code),ch=>ch.charCodeAt(0))))}
  catch(_){throw Error("Không đọc được mã thành phố. Hãy sao chép lại mã đầy đủ.")}
 }
}

class SocialManager {
 constructor(sim,saved){
  this.sim=sim;const list=saved.filter(f=>f&&Array.isArray(f.world?.buildings)).map(f=>({...f,world:makeWorld(f.world.buildings,f.level,f.world)}));
  this.adapter=new SocialStorageAdapter([...this.samples().filter(m=>!list.some(f=>f.id===m.id)),...list]);
  for(const f of this.friends())if(!Number.isInteger(f.avatar))f.avatar=this.guessAvatar(f.id);
  this.current=null;this.viewMode="own";
  for(const f of this.friends())if(!f.seeded){this.sim.crisis.friendRoll(f,true);f.seeded=true}
 }
 friends(){return this.adapter.list()}
 // Bạn bè nhập bằng mã Base64 không kèm chân dung: chọn cố định theo mã thành phố.
 guessAvatar(id){
  const sample=/^MP-MAU-([1-5])$/.exec(id);if(sample)return [32,6,25,18,26][sample[1]-1];
  let h=0;for(const ch of String(id))h=(h*31+ch.charCodeAt(0))>>>0;
  return CONFIG.avatars.pick[h%CONFIG.avatars.pick.length];
 }
 samples(){
  const profiles=[
   ["An Nhiên",3,7400,108,4,6,7],["Minh Khôi",5,19800,117,8,8,6],
   ["Hải Vân",7,38500,125,13,7,8],["Gia Linh",10,91200,133,18,9,7],["Thiên Lam",14,235000,144,27,8,9]
  ];
  return profiles.map(([name,level,coins,happiness,helpsGiven,row,col],i)=>{
   const r=CONFIG.radius(level),lo=8-r,hi=7+r,buildings=[],taken=new Set();
   const put=(id,x,y)=>{const k=coord(x,y);if(x<lo||x>hi||y<lo||y>hi||taken.has(k))return;taken.add(k);const b=makeBuilding(id,x,y,id==="road"?1:1+(x*3+y*5+i)%Math.min(7,1+Math.floor(level/2)));b.age=100;buildings.push(b)};
   for(let x=lo+1;x<=hi-1;x++)put("road",x,row);
   for(let y=lo+1;y<=hi-1;y++)put("road",col,y);
   if(level>=7)for(let x=col-4;x<=col+3;x++)put("road",x,row+3);
   const slots=[];
   for(const b of [...buildings])for(const [dx,dy] of steps){
    const x=b.x+dx,y=b.y+dy;
    if(x<lo||x>hi||y<lo||y>hi||taken.has(coord(x,y))||slots.some(s=>s.x===x&&s.y===y))continue;
    slots.push({x,y});
   }
   slots.sort((a,b)=>distance(a,{x:col,y:row})-distance(b,{x:col,y:row})||((a.x*13+a.y*17+i*11)%19)-((b.x*13+b.y*17+i*11)%19));
   const common=["house_small","power_plant","water_tower","mini_mart","house_small","apartment","fire_station"];
   const advanced=["night_market","police_station","park","construction_hq","hospital","waste_plant","school","office_tower","solar_plant","mall","bank","cyber_hub","metro_station","tech_tower","university","trade_port","wind_farm","metro_wonder","stadium","museum"];
   const layout=[...common,...advanced.filter(id=>CONFIG.buildings[id].unlock<=level),...Array.from({length:i+1},(_,j)=>["house_small","apartment","mini_mart","water_tower"][(i+j)%4])];
   layout.forEach((id,j)=>{if(slots[j])put(id,slots[j].x,slots[j].y)});
   return {id:"MP-MAU-"+(i+1),avatar:[32,6,25,18,26][i],name,level,coins,happiness,helpsGiven,clock:0,seeded:false,world:makeWorld(buildings,level)};
  });
 }
 resetQuota(){
  const p=this.sim.profile,date=today();
  if(p.lastHelpResetDate!==date){p.lastHelpResetDate=date;p.dailyHelpsLeft=5}
 }
 resetTime(){
  const next=new Date();next.setHours(24,0,0,0);const seconds=Math.max(0,Math.ceil((next-Date.now())/1000));
  return String(Math.floor(seconds/3600)).padStart(2,"0")+":"+String(Math.floor(seconds/60)%60).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
 }
 visit(id){this.current=this.friends().find(f=>f.id===id)||null;this.viewMode=this.current?"friend":"own";return this.current}
 own(){this.current=null;this.viewMode="own"}
 get world(){return this.current?.world||this.sim.world}
 tick(dt){
  this.resetQuota();
  for(const friend of this.friends()){
   this.sim.crisis.tickWorld(friend.world,dt,friend);
   if((friend.clock+=dt)>=48){friend.clock-=48;this.sim.crisis.friendRoll(friend)}
  }
 }
 export(){
  const {profile:p,world:w}=this.sim;
  return SocialStorageAdapter.code([1,p.mayorId,p.mayorName,p.level,Math.max(0,Math.floor(p.coins)),Math.round(p.happiness),p.helpsGiven,w.buildings.map(b=>[b.id,b.x,b.y,b.level])]);
 }
 // Dựng thành phố bạn bè từ bộ dữ liệu [phiên bản, mã, tên, cấp, vàng, hạnh phúc, lượt chi viện, bố cục].
 build(data,extra={}){
  const within=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  if(!Array.isArray(data)||data.length!==8)throw Error("Định dạng mã thành phố không được hỗ trợ.");
  const [ver,id,name,level,coins,happiness,helpsGiven,layout]=data;
  if(ver!==1||typeof id!=="string"||!/^MP-[A-Z0-9]{4,8}$/.test(id)||typeof name!=="string"||!name.trim()||name.length>40||
     !within(level,1,100000)||!within(coins,0,Number.MAX_SAFE_INTEGER)||!within(happiness,20,150)||
     !within(helpsGiven,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(layout)||layout.length>256)throw Error("Hồ sơ thành phố không hợp lệ.");
  if(id===this.sim.profile.mayorId)throw Error("Đây là mã thành phố của bạn.");
  const grid={unlockedRadius:CONFIG.radius(level)},used=new Set(),buildings=[];
  for(const item of layout){
   if(!Array.isArray(item)||item.length!==4)throw Error("Bố cục công trình không hợp lệ.");
   const [type,x,y,l]=item;
   if(typeof type!=="string"||!Object.hasOwn(CONFIG.buildings,type)||!within(x,0,15)||!within(y,0,15)||!within(l,1,CONFIG.maxLevel)||
      CONFIG.buildings[type].unlock>level||!unlocked(grid,x,y)||used.has(coord(x,y)))throw Error("Bố cục công trình không hợp lệ.");
   used.add(coord(x,y));const b=makeBuilding(type,x,y,l);b.age=100;buildings.push(b);
  }
  return {id,name:name.trim(),avatar:this.guessAvatar(id),level,coins,happiness,helpsGiven,clock:0,seeded:true,...extra,world:makeWorld(buildings,level)};
 }
 import(code){
  const friend=this.build(SocialStorageAdapter.decode(code.trim()));
  this.adapter.add(friend);this.sim.crisis.friendRoll(friend,true);this.sim.storage.save();return friend;
 }
 // Thêm hoặc cập nhật thành phố bạn bè lấy từ máy chủ.
 upsertCloud(data,avatar){
  const fresh=this.build(data,Number.isInteger(avatar)?{cloud:true,avatar}:{cloud:true}),old=this.friends().find(f=>f.id===fresh.id);
  if(!old){this.adapter.add(fresh);this.sim.crisis.friendRoll(fresh,true);this.sim.storage.save();return fresh}
  Object.assign(old,{name:fresh.name,avatar:fresh.avatar,level:fresh.level,coins:fresh.coins,happiness:fresh.happiness,helpsGiven:fresh.helpsGiven,cloud:true});
  if(this.current!==old&&!old.world.npcs.length){old.world=fresh.world;this.sim.crisis.friendRoll(old,true)}
  return old;
 }
 remove(id){
  const list=this.friends(),i=list.findIndex(f=>f.id===id);if(i<0||this.current===list[i]||list[i].world.npcs.length)return false;
  list.splice(i,1);this.sim.storage.save();return true;
 }
 rankings(stat){
  const p=this.sim.profile;
  const entries=[{id:p.mayorId,name:p.mayorName,avatar:p.avatar,level:p.level,coins:p.coins,happiness:p.happiness,helpsGiven:p.helpsGiven,world:this.sim.world,me:true},...this.friends()];
  const value=e=>stat==="score"?(e.me?this.sim.metrics.score:this.sim.measure(e.world,e.level).score):stat==="assets"?e.coins+e.world.buildings.reduce((sum,b)=>sum+CONFIG.buildings[b.id].price*(1+Array.from({length:b.level-1},(_,i)=>1.6**(i+1)).reduce((a,b)=>a+b,0)),0):e[stat];
  return entries.map(e=>({...e,score:value(e)})).sort((a,b)=>b.score-a.score||b.level-a.level);
 }
}
