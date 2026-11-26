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
   const res=await fetch("api"+path,{method,headers,keepalive,cache:"no-store",signal:control.signal,body:body?JSON.stringify(body):undefined});
   const data=await res.json().catch(()=>({}));
   if(!res.ok){const error=Error(data.error||"Máy chủ từ chối yêu cầu.");error.status=res.status;error.data=data;throw error}
   return data;
  }catch(error){
   if(error.name==="AbortError"||error instanceof TypeError){const offline=Error("Không kết nối được máy chủ.");offline.status=0;throw offline}
   throw error;
  }finally{clearTimeout(timer)}
 }
 setToken(token){this.token=token;try{if(token)localStorage.setItem(this.tokenKey,token);else localStorage.removeItem(this.tokenKey)}catch(_){}}
 adopt(r){this.setToken(r.token);this.account=r.account}
 async guest(){this.adopt(await this.api("/auth/guest",{method:"POST",body:{}}))}
 async signup(username,password){this.adopt(await this.api("/auth/signup",{method:"POST",body:{username,password}}))}
 async signin(username,password){this.adopt(await this.api("/auth/login",{method:"POST",body:{username,password}}))}
 // Kiểm tra máy chủ và phiên đã lưu. Chưa có phiên hợp lệ thì account vẫn là null để màn hình chào hỏi người chơi.
 async init(health){
  if(!this.enabled||!navigator.onLine)return null;
  try{
   if(health){if(!await health)return null}
   else await this.api("/health",{timeout:8000});
   this.online=true;
   if(this.token)try{this.account=(await this.api("/me")).account}catch(error){if(error.status!==401)throw error;this.setToken(null)}
   return this.account?await this.pull():null;
  }catch(_){this.online=false;this.status="offline";return null}
 }
 // Trả về bản lưu trên máy chủ (nếu có) để so sánh với bản lưu trong trình duyệt.
 async pull(){
  try{const r=await this.api("/save");this.rev=r.rev||0;this.status="synced";return r.data?r:null}
  catch(_){this.online=false;this.status="offline";return null}
 }
 attach(sim){
  this.sim=sim;sim.cloud=this;
  if(this.online&&this.account){sim.profile.mayorId=this.account.code;this.dirty=true}
  setInterval(()=>this.flush(),15000);
  if(this.enabled){
   const refresh=()=>{if(!document.hidden)this.refreshEventConfig()};
   const pulse=()=>{if(!document.hidden)this.presence()};
   refresh();pulse();setInterval(refresh,120000);setInterval(pulse,60000);
   document.addEventListener("visibilitychange",()=>{refresh();pulse()});
   addEventListener("online",()=>{refresh();pulse()});
   addEventListener("offline",()=>this.applyEventConfig([]));
  }
 }
 async refreshEventConfig(){
  if(!navigator.onLine)return;
  try{
   const response=await fetch("api/events/config",{signal:AbortSignal.timeout(5000)});
   if(!response.ok)return;
   const {rows}=await response.json();
   if(navigator.onLine&&Array.isArray(rows))this.applyEventConfig(rows);
  }catch(_){}
 }
 applyEventConfig(rows){
  if(JSON.stringify(rows)===JSON.stringify(this.sim.eventConfig))return;
  this.sim.eventConfig=rows;
  for(const event of [this.sim.events,this.sim.flash])event?.refresh(true);
 }
 async presence(){
  const now=Date.now();
  if(!navigator.onLine||!globalThis.crypto?.getRandomValues||now-(this.lastPulse||0)<30000)return;
  const makeId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
  if(!this.deviceId)try{
   this.deviceId=localStorage.getItem("mp-play-device")||makeId();localStorage.setItem("mp-play-device",this.deviceId);
  }catch(_){this.deviceId||=makeId()}
  if(now-(this.lastPulse||0)>150000||!this.playId)this.playId=makeId();
  this.lastPulse=now;
  try{await this.api("/presence",{method:"POST",body:{device:this.deviceId,session:this.playId},timeout:5000})}catch(_){}
 }
 knownAdminRevision(){
  try{return Number(localStorage.getItem("mp-admin-rev:"+this.account?.code))||0}catch(_){return 0}
 }
 rememberAdminRevision(rev){
  if(this.account&&rev)try{localStorage.setItem("mp-admin-rev:"+this.account.code,String(rev))}catch(_){}
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
   if(error.status===409&&error.data?.adminEdited){
    try{this.swap(await this.api("/save"));return false}catch(_){this.status="offline";this.dirty=true;return false}
   }
   // Thiết bị khác đã lưu bản mới hơn: thiết bị đang chơi sẽ ghi đè ở lần đồng bộ kế tiếp.
   if(error.status===409&&error.data?.rev){this.rev=error.data.rev;this.status="syncing"}
   else if(error.status===401){this.online=false;this.status="expired"}
   else this.status=error.status===0?"offline":"error";
   this.dirty=true;return false;
  }finally{this.busy=false}
 }
 async wipe(){if(this.online)try{await this.api("/save",{method:"DELETE"})}catch(_){}}
 async register(username,password){const r=await this.api("/auth/register",{method:"POST",body:{username,password}});this.account=r.account;return r.account}
 swap(save){
  this.sim.storage.erasing=true;
  this.rememberAdminRevision(save?.adminRev);
  try{if(save?.data)localStorage.setItem(CONFIG.key,JSON.stringify(save.data));else localStorage.removeItem(CONFIG.key);localStorage.removeItem(CONFIG.legacyKey)}catch(_){}
  location.reload();
 }
 async login(username,password){
  await this.flush(true);await this.signin(username,password);
  this.swap(await this.api("/save"));
 }
 async password(current,password){return this.api("/auth/password",{method:"POST",body:{current,password}})}
 // Phiên hết hạn (ví dụ đổi mật khẩu ở thiết bị khác): giữ bản lưu trên máy, mở lại màn hình đăng nhập.
 relogin(){this.sim.storage.save();this.setToken(null);location.reload()}
 async logout(){
  await this.flush(true);try{await this.api("/auth/logout",{method:"POST",body:{}})}catch(_){}
  this.setToken(null);this.swap(null);
 }
 async rename(name){if(this.online)try{await this.api("/me",{method:"PATCH",body:{name}})}catch(_){}}
 async leaderboard(stat){return this.api("/leaderboard?stat="+encodeURIComponent(stat))}
 async addFriend(code){const r=await this.api("/friends",{method:"POST",body:{code}});return this.sim.social.upsertCloud(r.city,r.avatar)}
 async syncFriends(){
  if(!this.online)return;
  const r=await this.api("/friends");
  for(const city of r.cities)try{this.sim.social.upsertCloud(city,r.avatars?.[city[1]])}catch(_){}
 }
 async removeFriend(code){if(this.online)try{await this.api("/friends/"+encodeURIComponent(code),{method:"DELETE"})}catch(_){}}
 assist(friend){if(this.online&&friend.cloud)this.api("/assist",{method:"POST",body:{code:friend.id}}).catch(()=>{})}
 async mailbox(){return this.online?(await this.api("/mailbox")).gifts:[]}
 async claimMail(){return this.api("/mailbox/claim",{method:"POST",body:{}})}
}
