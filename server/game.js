"use strict";
// Dùng chung bảng cân bằng với trình duyệt: nạp public/js/config.js trong sandbox để máy chủ
// kiểm tra bản lưu và tính điểm xếp hạng bằng đúng số liệu của trò chơi.
const fs=require("fs"),path=require("path"),vm=require("vm");

const source=fs.readFileSync(path.join(__dirname,"../public/js/config.js"),"utf8");
const CONFIG=vm.runInNewContext(source+"\n;CONFIG",{},{filename:"config.js"});

const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const num=(v,min,max)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const cleanName=(v,max)=>typeof v==="string"?v.replace(/[\u0000-\u001f<>]/g,"").trim().slice(0,max):"";

// Kiểm tra bản lưu do trình duyệt gửi lên. Trả về {error} hoặc {summary, city, name}.
function inspectSave(data){
 if(!data||typeof data!=="object")return {error:"Bản lưu không hợp lệ."};
 const p=data.profile,w=data.world;
 if(!p||!w||!Array.isArray(w.buildings)||w.buildings.length>256)return {error:"Bản lưu thiếu dữ liệu thành phố."};
 if(!int(p.level,1,Number.MAX_SAFE_INTEGER)||!num(p.coins,0,1e15)||!num(p.xp,0,Math.max(1e12,CONFIG.xpNext(p.level)))||!num(p.prestige??0,0,1e9)||!num(p.knowledge??0,0,1e12))return {error:"Hồ sơ Thị trưởng không hợp lệ."};
 if(p.materials!==undefined&&(!p.materials||typeof p.materials!=="object"||Array.isArray(p.materials)||
  Object.entries(p.materials).some(([key,value])=>!Object.hasOwn(CONFIG.materials,key)||!int(value,0,CONFIG.materialMax))))return {error:"Kho vật liệu không hợp lệ."};
 const radius=CONFIG.radius(p.level),used=new Set(),city=[];
 let assets=p.coins,levels=0,pop=0;
 for(const b of w.buildings){
  const d=b&&CONFIG.buildings[b.id];
  if(!d||!Object.hasOwn(CONFIG.buildings,b.id)||!int(b.x,0,15)||!int(b.y,0,15)||!int(b.level,1,CONFIG.maxLevel))return {error:"Công trình không hợp lệ."};
  if(b.id==="road"&&b.level!==1||b.level>CONFIG.legacyMaxLevel&&p.level<CONFIG.tierGate(b.level-1))return {error:"Cấp công trình không hợp lệ."};
  if(b.upgradeReadyAt!==undefined&&(b.id==="road"||b.left>0||b.level<CONFIG.legacyMaxLevel||b.level>=CONFIG.maxLevel||
   p.level<CONFIG.tierGate(b.level)||!int(b.upgradeReadyAt,1,Date.now()+CONFIG.upgradeSeconds(b.level)*1000+60000)))return {error:"Tiến độ nâng cấp không hợp lệ."};
  if(d.unlock>p.level||b.x<8-radius||b.x>=8+radius||b.y<8-radius||b.y>=8+radius)return {error:"Công trình nằm ngoài phạm vi cho phép của cấp hiện tại."};
  const key=b.y*16+b.x;if(used.has(key))return {error:"Hai công trình trùng một ô đất."};used.add(key);
  let value=d.price;for(let i=1;i<b.level;i++)value+=d.price*1.6**i;
  assets+=value;
  if(b.id!=="road"&&!(b.left>0)){levels+=b.level;pop+=d.pop*(1+.15*(b.level-1))}
  if(!(b.left>0))city.push([b.id,b.x,b.y,b.level]);
 }
 const happiness=Math.round(Math.min(150,Math.max(20,Number(p.happiness)||100)));
 const income=num(data.progress?.stats?.peakIncome,0,1e9)?data.progress.stats.peakIncome:0;
 const summary={
  level:p.level,assets:Math.floor(assets),happiness,helpsGiven:int(p.helpsGiven,0,1e9)?p.helpsGiven:0,
  avatar:CONFIG.avatars.pick.includes(p.avatar)?p.avatar:CONFIG.avatars.fallback,
  pop:Math.round(pop),score:Math.round(pop*2+Math.min(income,1e7)*4+levels*10)
 };
 return {summary,city,coins:Math.floor(p.coins),name:cleanName(p.mayorName,40)||"Thị trưởng"};
}

// Bộ dữ liệu thành phố công khai, cùng định dạng với mã Base64 của trò chơi.
const publicCity=player=>[1,player.code,player.name,player.summary?.level||1,Math.max(0,Math.floor(player.coins||0)),player.summary?.happiness||100,player.summary?.helpsGiven||0,player.city||[]];

module.exports={CONFIG,inspectSave,publicCity,cleanName};
