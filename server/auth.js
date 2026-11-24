"use strict";
const crypto=require("crypto");

const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const newToken=()=>crypto.randomBytes(32).toString("base64url");
const ALPHABET="23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const newCode=()=>"MP-"+Array.from(crypto.randomBytes(6),b=>ALPHABET[b%ALPHABET.length]).join("");

function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){
 return new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve({salt,hash:key.toString("hex")})));
}
async function verifyPassword(password,stored){
 if(!stored?.salt||!stored.hash)return false;
 const {hash}=await hashPassword(password,stored.salt),a=Buffer.from(hash,"hex"),b=Buffer.from(stored.hash,"hex");
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

// Giới hạn tần suất đơn giản trong bộ nhớ theo khóa (IP hoặc người chơi).
function limiter(max,windowMs){
 const hits=new Map();
 setInterval(()=>{const now=Date.now();for(const [k,v] of hits)if(v.reset<now)hits.delete(k)},windowMs).unref();
 return key=>{
  const now=Date.now(),entry=hits.get(key);
  if(!entry||entry.reset<now){hits.set(key,{count:1,reset:now+windowMs});return true}
  return ++entry.count<=max;
 };
}

module.exports={sha,newToken,newCode,hashPassword,verifyPassword,limiter};
