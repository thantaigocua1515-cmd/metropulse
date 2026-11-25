"use strict";

const UICommunity={
 communityState(){
  const code=this.sim.cloud?.account?.code||"";
  if(this.community?.code!==code){
   let seen={};
   try{const saved=JSON.parse(localStorage.getItem("mp-chat-read:"+code));if(saved&&typeof saved==="object")seen=saved}catch(_){}
   this.community={code,activity:{world:null,dms:[]},seen,channel:"world",messages:[],activityAt:0,chatAt:0};
  }
  return this.community;
 },
 communityOnline(){return !!(navigator.onLine&&this.sim.cloud?.online&&this.sim.cloud.account)},
 chatUnread(){
  const {activity,seen}=this.communityState();
  return Number(!!activity.world&&activity.world!==seen.world)+activity.dms.filter(d=>d.id!==seen[d.code]).length;
 },
 pollCommunity(){
  const state=this.communityState(),open=this.dialogType==="chat",now=Date.now(),status=document.getElementById("chat-status");
  if(document.hidden)return;
  if(!this.communityOnline()){
   if(status)status.textContent="Đang ngoại tuyến hoặc chưa đăng nhập. Hãy kết nối để trò chuyện.";
   document.querySelectorAll("#chat-form input,#chat-form button").forEach(el=>el.disabled=true);
   return;
  }
  if(open&&status?.textContent.startsWith("Đang ngoại tuyến")){
   status.textContent="";
   document.querySelectorAll("#chat-form input,#chat-form button").forEach(el=>el.disabled=false);
  }
  if(now>=state.activityAt){
   state.activityAt=now+(open?7000:30000);
   this.sim.cloud.api("/chat/activity").then(activity=>{
    state.activity=activity;
    if(this.community===state&&this.dialogType==="chat")this.renderChatContacts();
   }).catch(()=>{});
  }
  if(open&&now>=state.chatAt)this.loadChat();
 },
 openChat(channel="world"){
  const state=this.communityState();
  state.channel=channel;state.messages=[];state.activityAt=0;state.chatAt=0;
  const online=this.communityOnline();
  this.open("chat","CỘNG ĐỒNG","Trò chuyện",'<nav id="chat-contacts" class="tabs" aria-label="Kênh trò chuyện"></nav>'+
   '<div id="chat-log" class="chat-log" role="log" aria-label="Tin nhắn"></div><p id="chat-status" role="status"></p>'+
   '<form id="chat-form" class="chat-compose"><input name="message" aria-label="Tin nhắn" maxlength="240" placeholder="Viết tin nhắn…" required'+(!online?" disabled":"")+'><button class="primary"'+(!online?" disabled":"")+'>Gửi</button></form>',true);
  this.renderChatContacts();this.pollCommunity();
 },
 renderChatContacts(){
  const el=document.getElementById("chat-contacts");if(!el)return;
  const {activity,channel,seen}=this.communityState(),friends=this.sim.social.friends().filter(f=>f.cloud);
  const contacts=new Map(friends.map(f=>[f.id,{code:f.id,name:f.name}]));
  for(const d of activity.dms)contacts.set(d.code,d);
  const tab=(code,name,id)=>this.btn("chat-open",htm(name)+(id&&id!==seen[code]?" · ●":""),{id:code,cls:channel===code?"active":""});
  const html=tab("world","Thế giới",activity.world)+[...contacts.values()].map(d=>tab(d.code,d.name,d.id)).join("");
  if(el._mp!==html){el._mp=html;el.innerHTML=html}
 },
 async loadChat(){
  const state=this.communityState(),channel=state.channel;
  state.chatAt=Date.now()+5000;
  const status=document.getElementById("chat-status");
  try{
   const {messages}=await this.sim.cloud.api("/chat?channel="+encodeURIComponent(channel));
   const log=document.getElementById("chat-log");
   if(this.community!==state||state.channel!==channel||!log)return;
   if(status?.dataset.pollError){status.textContent="";delete status.dataset.pollError}
   const tail=messages.at(-1)?.id;
   if(tail!==state.messages.at(-1)?.id||!log.innerHTML){
    log.innerHTML=messages.map(m=>'<p class="chat-message'+(m.from===state.code?" mine":"")+'"><b>'+htm(m.name)+'</b> <small>'+
     new Date(m.createdAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+'</small><br>'+htm(m.text)+'</p>').join("")||'<p class="empty">Chưa có tin nhắn.</p>';
    log.scrollTop=log.scrollHeight;
   }
   state.messages=messages;
   const other=messages.findLast(m=>m.from!==state.code);
   if(other&&state.seen[channel]!==other.id){
    state.seen[channel]=other.id;
    try{localStorage.setItem("mp-chat-read:"+state.code,JSON.stringify(state.seen))}catch(_){}
    this.renderChatContacts();
   }
  }catch(error){if(this.community===state&&state.channel===channel&&status){status.dataset.pollError="1";status.textContent=error.message}}
 },
 async sendChat(form){
  if(!this.communityOnline())return;
  const button=form.querySelector("button"),input=form.elements.message,state=this.communityState(),channel=state.channel;
  const status=document.getElementById("chat-status");
  if(button.disabled)return;
  button.disabled=true;status.textContent="";
  try{
   await this.sim.cloud.api("/chat",{method:"POST",body:{channel,text:input.value}});
   input.value="";
   if(this.community===state&&state.channel===channel)await this.loadChat();
  }catch(error){status.textContent=error.message}
  finally{button.disabled=false}
 },
 async coopDialog(code,act=""){
  const s=this.sim;
  if(!this.communityOnline()){this.toast("Cần kết nối máy chủ để cùng làm nhiệm vụ.");return}
  if(this.coopBusy)return;
  this.coopBusy=true;
  if(!act)this.open("coop","NHIỆM VỤ BẠN BÈ","Chung tay xây phố",'<p class="muted">Đang tải mục tiêu tuần…</p>');
  try{
   const send=act==="assist",claim=act==="claim";
   if(send){
    await s.cloud.api("/assist",{method:"POST",body:{code}});this.toast("Đã gửi quà vào hộp thư của bạn.");
   }else if(claim){
    const {coins}=await s.cloud.api("/coop/"+encodeURIComponent(code)+"/claim",{method:"POST"});
    this.toast(s.grant({coins}));s.storage.save();
   }
   const r=await s.cloud.api("/coop/"+encodeURIComponent(code));
   if(this.dialogType!=="coop")return;
   this.open("coop","NHIỆM VỤ BẠN BÈ","Chung tay xây phố",
    '<p>Cùng <b>'+htm(r.name)+'</b> gửi quà chi viện. Mỗi người phải góp ít nhất một lần. Mỗi người chỉ tính một lượt mỗi ngày; cần tổng cộng 3 lượt.</p>'+
    '<div class="row"><div class="grow"><b>Bạn: '+r.mine+' · Bạn bè: '+r.theirs+'</b><small>Hết hạn '+new Date(r.end).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})+' (giờ Việt Nam) · Thưởng '+fmt(r.reward)+' Vàng/người</small>'+this.bar((r.mine+r.theirs)/3)+'</div></div>'+
    '<div class="actions">'+this.btn("coop-assist","Gửi quà chi viện",{id:code})+this.btn("coop-claim",r.claimed?"Đã nhận":"Nhận thưởng",{id:code,cls:"primary",disabled:r.claimed||!r.done})+'</div>');
  }catch(error){
   if(!act&&this.dialogType==="coop")this.open("coop","NHIỆM VỤ BẠN BÈ","Chung tay xây phố",'<p role="status">'+htm(error.message)+'</p>');
   else this.toast(error.message);
  }finally{this.coopBusy=false}
 }
};
Object.assign(UIController.prototype,UICommunity);
