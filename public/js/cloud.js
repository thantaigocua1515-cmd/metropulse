"use strict";

// Kết nối máy chủ: tài khoản, lưu đám mây, bạn bè, bảng xếp hạng, hộp thư quà.
class CloudClient {
 constructor(){
  this.enabled=location.protocol!=="file:";this.tokenKey="metropulse_token";this.token=null;
  try{this.token=localStorage.getItem(this.tokenKey)}catch(_){}
  this.online=false;this.account=null;this.rev=0;this.dirty=false;this.busy=false;this.status="offline";this.lastSync=0;this.sim=null;
 }
 async api(path,{method="GET",body,timeout=9000,keepalive=false}={}){
  const control=new AbortController(),timer=setTimeout(()=>control.abort(),timeout);
  try{
   const headers={};if(body)headers["Content-Type"]="application/json";if(this.token)headers.Authorization="Bearer "+this.token;
   const res=await fetch("api"+path,{method,headers,keepalive,signal:control.signal,body:body?JSON.stringify(body):undefined});
   const data=await res.json().catch(()=>({}));
   if(!res.ok){const error=Error(data.error||"Máy chủ từ chối yêu cầu.");error.status=res.status;error.data=data;throw error}
   return data;
  }catch(error){
   if(error.name==="AbortError"||error instanceof TypeError){const offline=Error("Không kết nối được máy chủ.");offline.status=0;throw offline}
   throw error;
  }finally{clearTimeout(timer)}
 }
 setToken(token){this.token=token;try{if(token)localStorage.setItem(this.tokenKey,token);else localStorage.removeItem(this.tokenKey)}catch(_){}}
 async session(){
  if(this.token){
   try{this.account=(await this.api("/me")).account;return}
   catch(error){if(error.status!==401)throw error;this.setToken(null)}
  }
  const r=await this.api("/auth/guest",{method:"POST",body:{}});this.setToken(r.token);this.account=r.account;
 }
 // Trả về bản lưu trên máy chủ (nếu có) để so sánh với bản lưu trong trình duyệt.
 async init(){
  if(!this.enabled)return null;
  try{
   await this.api("/health",{timeout:2500});await this.session();this.online=true;this.status="synced";
   const r=await this.api("/save");this.rev=r.rev||0;return r.data?r:null;
  }catch(_){this.online=false;this.status="offline";return null}
 }
 attach(sim){
  this.sim=sim;sim.cloud=this;
  if(this.online&&this.account){sim.profile.mayorId=this.account.code;this.dirty=true}
  setInterval(()=>this.flush(),15000);
 }
 queue(){this.dirty=true}
 async flush(force=false,keepalive=false){
  if(!this.online||!this.sim||this.busy||(!this.dirty&&!force)||this.sim.storage.erasing)return false;
  this.busy=true;this.dirty=false;this.status="syncing";
  try{
   const data=this.sim.storage.serialize();data.friends=data.friends.filter(f=>f.cloud||!String(f.id).startsWith("MP-MAU"));
   const body={rev:this.rev,data};
   const r=await this.api("/save",{method:"PUT",body,keepalive:keepalive&&JSON.stringify(body).length<60000});
   this.rev=r.rev;this.status="synced";this.lastSync=Date.now();return true;
  }catch(error){
   // Thiết bị khác đã lưu bản mới hơn: thiết bị đang chơi sẽ ghi đè ở lần đồng bộ kế tiếp.
   if(error.status===409&&error.data?.rev){this.rev=error.data.rev;this.status="syncing"}else this.status=error.status===0?"offline":"error";
   this.dirty=true;return false;
  }finally{this.busy=false}
 }
 async wipe(){if(this.online)try{await this.api("/save",{method:"DELETE"})}catch(_){}}
 async register(username,password){const r=await this.api("/auth/register",{method:"POST",body:{username,password}});this.account=r.account;return r.account}
 swap(save){
  this.sim.storage.erasing=true;
  try{if(save?.data)localStorage.setItem(CONFIG.key,JSON.stringify(save.data));else localStorage.removeItem(CONFIG.key);localStorage.removeItem(CONFIG.legacyKey)}catch(_){}
  location.reload();
 }
 async login(username,password){
  await this.flush(true);
  const r=await this.api("/auth/login",{method:"POST",body:{username,password}});this.setToken(r.token);this.account=r.account;
  this.swap(await this.api("/save"));
 }
 async logout(){
  await this.flush(true);try{await this.api("/auth/logout",{method:"POST",body:{}})}catch(_){}
  this.setToken(null);this.swap(null);
 }
 async rename(name){if(this.online)try{await this.api("/me",{method:"PATCH",body:{name}})}catch(_){}}
 async leaderboard(stat){return this.api("/leaderboard?stat="+encodeURIComponent(stat))}
 async addFriend(code){const r=await this.api("/friends",{method:"POST",body:{code}});return this.sim.social.upsertCloud(r.city)}
 async syncFriends(){
  if(!this.online)return;
  const r=await this.api("/friends");
  for(const city of r.cities)try{this.sim.social.upsertCloud(city)}catch(_){}
 }
 async removeFriend(code){if(this.online)try{await this.api("/friends/"+encodeURIComponent(code),{method:"DELETE"})}catch(_){}}
 assist(friend){if(this.online&&friend.cloud)this.api("/assist",{method:"POST",body:{code:friend.id}}).catch(()=>{})}
 async mailbox(){return this.online?(await this.api("/mailbox")).gifts:[]}
 async claimMail(){return this.api("/mailbox/claim",{method:"POST",body:{}})}
}
