"use strict";

// Kết nối máy chủ: tài khoản, lưu đám mây, bạn bè, bảng xếp hạng, hộp thư quà.
class CloudClient {
 constructor(){
  this.enabled=location.protocol!=="file:";this.tokenKey="metropulse_token";this.token=null;
  this.saveCode=null;
  try{
   const value=localStorage.getItem(this.tokenKey);
   if(value?.startsWith("{"))({token:this.token,code:this.saveCode}=JSON.parse(value));
   else this.token=value;
  }catch(_){}
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
 setToken(token,code=null){
  this.token=token;this.saveCode=token?code:null;
  try{if(token)localStorage.setItem(this.tokenKey,JSON.stringify({token,code}));else localStorage.removeItem(this.tokenKey)}catch(_){}
 }
 adopt(r){this.account=r.account;this.setToken(r.token,r.account.code);this.confirmOwnership(r)}
 confirmOwnership(r){
  if(!Array.isArray(r.skinPacks)||!this.account)return;
  this.ownership={skinPacks:r.skinPacks,loginDays:r.loginDays||0};
  try{localStorage.setItem("mp-ownership:"+this.account.code,JSON.stringify(this.ownership))}catch(_){}
 }
 ownsSkin(id){return id==="default"||Object.hasOwn(SKIN_SPRITES,id)&&Array.isArray(this.ownership?.skinPacks)&&this.ownership.skinPacks.includes(id)}
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
   if(this.token)try{const r=await this.api("/me");this.account=r.account;this.setToken(this.token,r.account.code);this.confirmOwnership(r)}catch(error){if(error.status!==401)throw error;this.setToken(null)}
   return this.account?await this.pull():null;
  }catch(_){this.online=false;this.status="offline";return null}
 }
 // Trả về bản lưu trên máy chủ (nếu có) để so sánh với bản lưu trong trình duyệt.
 async pull(){
  try{
   const r=await this.api("/save");
   if(r.data&&!StorageManager.normalize(r.data))throw Error("Không đọc được bản lưu máy chủ.");
   this.rev=r.rev||0;this.remote=r;this.status="synced";return r;
  }
  catch(_){this.online=false;this.status="offline";return null}
 }
 attach(sim){
  this.sim=sim;sim.cloud=this;
  if(!this.account&&this.token&&sim.profile.mayorId)try{
   this.ownership=JSON.parse(localStorage.getItem("mp-ownership:"+sim.profile.mayorId));
  }catch(_){}
  if(!this.ownsSkin(sim.profile.skin))sim.profile.skin="default";
  if(this.saveCode)sim.profile.mayorId=this.saveCode;
  if(this.online&&this.account)this.dirty=true;
  setInterval(()=>{if(!document.hidden)this.flush()},15000);
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
 metaKey(suffix){return StorageManager.key(this.saveCode)+":"+suffix}
 readMeta(suffix){try{return JSON.parse(localStorage.getItem(this.metaKey(suffix)))}catch(_){return null}}
 writeMeta(suffix,value){
  try{if(value==null)localStorage.removeItem(this.metaKey(suffix));else localStorage.setItem(this.metaKey(suffix),JSON.stringify(value))}catch(_){}
 }
 selectBoot(local,remote){
  this.baseRev=local._cloudBase;
  const saved=this.readMeta("conflict");
  if(!remote){if(saved?.local)this.hold(saved.local,saved.remote,false);return local}
  const data=remote.data&&StorageManager.normalize(remote.data);
  if((remote.adminRev||0)>(local._cloudBase||0)){
   if(local.restored)this.writeMeta("previous-local",local);
   this.writeMeta("conflict",null);
   this.baseRev=remote.rev;this.writeMeta("base",remote.rev);
   return data||StorageManager.fresh();
  }
  if(saved?.local){
   this.hold(saved.local,remote,false);
   return local;
  }
  if(!data){this.baseRev=remote.rev;return local}
  const useCloud=()=>{this.baseRev=remote.rev;return data};
  if(!local.restored)return useCloud();
  const a=CONFIG.saveProgress(local),b=CONFIG.saveProgress(data);
  if(CONFIG.saveAdvanced(a)!==CONFIG.saveAdvanced(b))return CONFIG.saveAdvanced(a)?local:useCloud();
  if(CONFIG.saveAdvanced(a)){
   if(local._cloudBase===remote.rev&&!CONFIG.saveRegresses(b,a))return local;
   const same=JSON.stringify([local.profile,local.world.buildings,local.progress])===JSON.stringify([data.profile,data.world.buildings,data.progress]);
   if(!same){this.hold(local,remote,false);return local}
  }
  return (local.lastSavedAt||0)>(data.lastSavedAt||0)?local:useCloud();
 }
 hold(local,remote,show=true){
  this.conflict={local,remote};this.status="conflict";
  this.writeMeta("conflict",this.conflict);
  if(show)this.ui?.saveConflict();
 }
 async fetchConflict(local,show=true){
  this.hold(local,null,false);
  try{
   const remote=await this.api("/save");
   if((remote.adminRev||0)>this.rev){
    this.writeMeta("previous-local",local);this.swap(remote);return;
   }
   if(remote.data&&!StorageManager.normalize(remote.data))throw Error("Không đọc được bản lưu máy chủ.");
   this.hold(local,remote,show);
  }catch(_){if(show)this.ui?.saveConflict()}
 }
 async resolveConflict(choice){
  if(!this.conflict||this.busy)return;
  this.busy=true;
  const {local,remote}=this.conflict;
  try{
   if(!remote){await this.fetchConflict(local);return}
   if(choice==="cloud"){this.writeMeta("previous-local",local);this.swap(remote);return}
   if(choice!=="local"&&choice!=="replace")return;
   const regression=CONFIG.saveRegresses(CONFIG.saveProgress(remote.data),CONFIG.saveProgress(local));
   if(regression&&choice!=="replace")return;
   const data=this.payload(local),r=await this.api("/save",{method:"PUT",body:{rev:remote.rev,data,confirmRegression:regression}});
   this.swap({...r,data,adminRev:remote.adminRev});
  }catch(error){
   if(error.status===409)await this.fetchConflict(local);
   throw error;
  }finally{this.busy=false}
 }
 payload(data){
  const {restored,_cloudBase,...payload}=data;
  payload.friends=(data.friends||[]).filter(f=>f.cloud||!String(f.id).startsWith("MP-MAU"));
  return payload;
 }
 queue(){this.dirty=true}
 async flush(force=false,keepalive=false){
  if(!this.online||!this.sim||this.busy||this.conflict||(!this.dirty&&!force)||this.sim.storage.erasing)return false;
  this.busy=true;this.dirty=false;this.status="syncing";
  try{
   const data=this.payload(this.sim.storage.serialize());
   if(this.remote?.data&&CONFIG.saveRegresses(CONFIG.saveProgress(this.remote.data),CONFIG.saveProgress(data))){
    this.hold(data,this.remote);return false;
   }
   const body={rev:this.rev,data};
   const r=await this.api("/save",{method:"PUT",body,keepalive:keepalive&&JSON.stringify(body).length<60000});
   this.rev=r.rev;this.remote={...r,data,adminRev:this.remote?.adminRev};
   this.baseRev=r.rev;this.writeMeta("base",r.rev);
   this.status="synced";this.lastSync=Date.now();return true;
  }catch(error){
   if(error.status===409){await this.fetchConflict(this.payload(this.sim.storage.serialize()));return false}
   else if(error.status===401){this.online=false;this.status="expired"}
   else this.status=error.status===0?"offline":"error";
   this.dirty=true;return false;
  }finally{this.busy=false}
 }
 async wipe(){
  if(!this.saveCode)return;
  if(!this.online||this.busy||this.conflict)throw Error("Cần kết nối máy chủ và xử lý xung đột trước khi đặt lại.");
  const r=await this.api("/save",{method:"DELETE",body:{rev:this.rev,confirm:"reset"}});
  this.writeMeta("base",r.rev);
 }
 async register(username,password){const r=await this.api("/auth/register",{method:"POST",body:{username,password}});this.account=r.account;return r.account}
 swap(save){
  this.sim.storage.erasing=true;
  this.writeMeta("conflict",null);
  this.writeMeta("base",save.rev);
  try{
   const key=StorageManager.key(this.saveCode);
   if(save.data)localStorage.setItem(key,JSON.stringify({...save.data,_cloudBase:save.rev}));else localStorage.removeItem(key);
  }catch(_){}
  location.reload();
 }
 async login(username,password){
  if(this.busy)throw Error("Đang đồng bộ thành phố. Hãy thử lại.");
  this.sim.storage.save();
  this.sim.storage.erasing=true;
  try{await this.signin(username,password);location.reload()}
  catch(error){this.sim.storage.erasing=false;throw error}
 }
 async password(current,password){return this.api("/auth/password",{method:"POST",body:{current,password}})}
 // Phiên hết hạn (ví dụ đổi mật khẩu ở thiết bị khác): giữ bản lưu trên máy, mở lại màn hình đăng nhập.
 relogin(){this.sim.storage.save();this.setToken(null);location.reload()}
 async logout(){
  if(this.busy)throw Error("Đang đồng bộ thành phố. Hãy thử lại.");
  this.sim.storage.save();this.sim.storage.erasing=true;
  try{await this.api("/auth/logout",{method:"POST",body:{}})}catch(_){}
  this.setToken(null);location.reload();
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
 async announcements(){return (await this.api("/announcements",{timeout:5000})).rows||[]}
 async mailbox(){return this.online?await this.api("/mailbox"):{gifts:[],letters:[]}}
 async claimMail(){return this.api("/mailbox/claim",{method:"POST",body:{}})}
 async claimLetter(letter){
  const resources=["coins","prestige","knowledge"].filter(key=>letter.rewards[key]);
  if((resources.length||letter.rewards.materials)&&!await this.flush(true))throw Error("Chưa lưu được thành phố. Hãy thử nhận lại.");
  if(this.busy)throw Error("Đang đồng bộ thành phố. Hãy thử lại.");
  this.busy=true;
  try{
   const r=await this.api("/mailbox/"+encodeURIComponent(letter.id)+"/claim",{method:"POST",body:{}});
   this.confirmOwnership(r);
   if(r.rev!=null){
    if(this.rev!==r.previousRev){await this.fetchConflict(this.sim.storage.serialize());return r}
    for(const key of resources)this.sim.profile[key]=(this.sim.profile[key]??0)+r.rewards[key];
    if(r.rewards.materials)this.sim.addMaterials(r.rewards.materials);
    this.rev=r.rev;
    this.remote={rev:r.rev,data:this.sim.storage.serialize(),updatedAt:r.claimedAt,adminRev:r.adminRev};
    this.baseRev=r.rev;this.writeMeta("base",r.rev);
    this.sim.storage.save();
   }
   return r;
  }finally{this.busy=false}
 }
}
