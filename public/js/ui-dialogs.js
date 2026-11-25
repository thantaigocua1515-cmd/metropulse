"use strict";

// Các hộp thoại của giao diện.
const UIDialogs = {
 eventBanner(own){
  const el=this.nodes["event-banner"]??=document.getElementById("event-banner"),e=this.sim.events;
  el.hidden=!own||!e;
  if(el.hidden)return;
  const flash=this.sim.flash?.def?this.sim.flash:null;
  const claimable=event=>event.def.jobs.some((_,i)=>{const q=event.quest(i);return q.done&&!q.claimed})||
   event.tiers.some((t,i)=>event.points>=t.need&&!event.data.tiers.includes(i));
  const ready=claimable(e)||flash&&claimable(flash);
  this.html("event-banner",this.btn("event-open",'<span class="event-mark" aria-hidden="true" data-event-art="'+e.event.id+'">'+e.def.icon+'</span><span><b>'+e.def.name+'</b><small>'+e.countdown()+(e.force?" · Xem thử":"")+(flash?" · "+flash.def.name:"")+'</small></span>'+(ready?'<sup aria-label="Có thưởng">!</sup>':""),{cls:"event-button",title:"Xem sự kiện và phần thưởng"}));
  el.style.setProperty("--event-tone",e.def.tone);
 },
 currentEvent(){return this.eventTab==="flash"&&this.sim.flash?.def?this.sim.flash:this.sim.events},
 eventDialog(){
  const e=this.currentEvent(),def=e.def,c=CONTENT.cast[def.who],jobs=def.jobs.map((_,i)=>e.quest(i));
  const tabs=this.sim.flash?.def?'<div class="tabs">'+this.btn("event-tab",this.sim.events.def.name,{id:"season",cls:e.flash?"":"active"})+
   this.btn("event-tab",this.sim.flash.def.name,{id:"flash",cls:e.flash?"active":""})+'</div>':'<p class="muted">Sự kiện ngắn: Giờ Cao Điểm 18:00–20:00 ngày thường; Chợ Cuối Tuần từ 08:00 thứ Bảy đến hết Chủ nhật (giờ Việt Nam).</p>';
  const quests=this.orderedProgress(jobs,q=>q).map(({st:q})=>'<div class="row'+(q.claimed?" dim":"")+'"><div class="grow"><b>'+q.name+'</b><small>'+q.text+' · '+q.cur+'/'+q.goal+' · +10 '+def.points+'</small>'+this.bar(q.cur/q.goal)+'</div>'+
   this.btn("event-quest",q.claimed?"Đã nhận":q.done?"Nhận điểm":"Đang làm",{id:q.id,cls:q.done?"primary":"",disabled:!q.done||q.claimed})+'</div>').join("");
  const rewards=this.orderedProgress(e.tiers.map((t,i)=>({...t,i})),t=>({claimed:e.data.tiers.includes(t.i),done:e.points>=t.need})).map(({item:t,st})=>
   '<div class="row'+(st.claimed?" dim":"")+'"><div class="grow"><b>'+t.need+' '+def.points+'</b><small>'+this.reward(t.reward)+(t.skin?' · Trang trí '+def.skin:"")+'</small></div>'+
   this.btn("event-tier",st.claimed?"Đã nhận":st.done?"Nhận thưởng":"Chưa mở",{id:t.i,cls:st.done?"primary":"",disabled:!st.done||st.claimed})+'</div>').join("");
  const skins=Object.keys(e.data.skins).filter(id=>Object.hasOwn(EventContent,id));
  this.open("event",e.force?"XEM THỬ · KHÔNG LƯU THƯỞNG":e.flash?"SỰ KIỆN NGẮN":"LỄ HỘI BÌNH MINH",def.name,
   tabs+'<div class="event-intro" style="--event-tone:'+def.tone+'">'+this.portrait(def.who)+'<div><b>'+c.name+'</b><p>'+def.line+'</p></div></div>'+
   '<div class="event-track"><b>'+e.points+'/60 '+def.points+'</b><small>Còn '+e.countdown()+' · giờ Việt Nam</small>'+this.bar(e.points/60)+'</div>'+
   '<h4>Nhiệm vụ sự kiện</h4>'+quests+'<h4>Mốc phần thưởng</h4>'+rewards+
   (skins.length?'<h4>Trang trí đã mở khóa</h4><div class="actions">'+this.btn("event-skin","Mặc định",{id:"",cls:e.skin?"":"primary"})+
    skins.map(id=>this.btn("event-skin",EventContent[id].skin,{id,cls:e.skin===id?"primary":""})).join("")+'</div>':""),true);
 },
 tabbar(group,items){
  return '<div class="tabs">'+items.map(([id,label,count])=>this.btn("tab",label+(count?'<sup>'+count+'</sup>':""),{id:group,arg:id,cls:this.tabs[group]===id?"active":""})).join("")+'</div>';
 },
 teams(){
  const s=this.sim,rows=s.world.buildings.filter(b=>CONFIG.npcs[b.id]).map(b=>{
   const d=CONFIG.buildings[b.id],team=CONFIG.npcs[b.id],v=CONFIG.vehicles[b.teamLevel-1],key=coord(b.x,b.y),rank=CONFIG.rank(b.missions),next=CONFIG.ranks.find(r=>r[0]>b.missions);
   return '<div class="row">'+this.face(team.avatar,htm(team.icon),team.color)+'<div class="grow"><b>'+team.captain+' · '+team.name+'</b><small>'+CONFIG.buildingName(b)+' · Ô '+String.fromCharCode(65+b.x)+(b.y+1)+(b.spec?' · ✦ '+CONFIG.specs.svc[b.spec][0]:'')+'</small><small>'+(b.left>0?"Đang xây":'Xe cấp '+b.teamLevel+' · '+v.name+' · '+fmt(v.speed,1)+' ô/giây · sửa '+fmt(v.repair*rank[2],1)+' giây · '+(b.crew-s.crisis.busy(b))+'/'+b.crew+' rảnh')+'</small><small class="mint">Quân hàm: '+rank[1]+' · '+b.missions+' nhiệm vụ'+(next?' (còn '+(next[0]-b.missions)+' để lên '+next[1]+')':'')+'</small></div><div class="actions col">'+
    this.btn("team-up",b.teamLevel===5?"Xe tối đa":"Nâng xe · "+fmt(Math.ceil(250*b.teamLevel**1.4))+" V",{id:key,disabled:b.teamLevel===5||b.left>0})+
    this.btn("team-hire",b.crew===3?"Đủ 3 người":"Tuyển · "+this.prestigeAmount(b.crew+1),{id:key,disabled:b.crew===3||b.left>0})+'</div></div>';
  }).join("");
  this.open("teams","ĐỘI PHẢN ỨNG","Quản lý đội NPC",'<p class="muted">Nâng cấp phương tiện để đến nhanh, sửa nhanh. Đội càng làm nhiều nhiệm vụ càng lên quân hàm và sửa nhanh hơn. Mỗi trụ sở có tối đa 3 nhân sự.</p>'+(rows||'<p class="empty">Hãy xây một trụ sở dịch vụ (Trạm Điện lực, Tháp Nước, Trạm Cứu hỏa…) để có đội điều phối.</p>'));
 },
 policies(){
  const w=this.sim.world;
  const rows=Object.entries(CONFIG.policies).map(([id,p])=>{
   const delay=w.policyCooldowns[id]||0,isOn=w.activePolicy?.id===id;
   return '<div class="row"><div class="grow"><b>'+p.name+'</b><small>'+p.desc+'</small><small>'+p.duration+' giây · hồi '+p.cooldown+' giây'+(p.cost?' · '+this.prestigeAmount(p.cost):' · miễn phí')+'</small></div>'+
    this.btn("policy",isOn?"Còn "+Math.ceil(w.activePolicy.left)+" giây":delay?"Hồi "+Math.ceil(delay)+" giây":"Ban hành",{id,cls:"primary",disabled:!!w.activePolicy||delay>0||this.sim.profile.prestige<p.cost})+'</div>';
  }).join("");
  this.open("policies","TÒA THỊ CHÍNH","Sắc lệnh Thị trưởng",'<p class="muted">Chỉ một sắc lệnh có hiệu lực tại một thời điểm.</p>'+rows);
 },
 missions(){
  const s=this.sim,prog=s.prog,badges=prog.badges(),tab=this.tabs.missions;
  let body=this.tabbar("missions",[["story","Cốt truyện",badges.story],["daily","Hằng ngày",badges.daily+badges.login],["ach","Thành tựu",badges.ach],["legacy","Di sản",badges.legacy]]);
  if(tab==="legacy")body+=this.legacyPanel();
  else if(tab==="story"){
   const current=prog.chapter();
   body+='<div class="timeline">'+CONTENT.chapters.map((c,i)=>{
    const state=s.progress.story.done||i<s.progress.story.chapter?"done":i===s.progress.story.chapter?"now":"lock";
    return '<span class="'+state+'" title="'+c.title+'">'+(state==="done"?"✓":i+1)+'</span>';
   }).join("")+'</div>';
   if(current){
    const done=current.quests.filter(q=>s.progress.story.claimed.includes(q.id)).length;
    body+='<div class="chapter"><div><div class="eyebrow">'+current.subtitle+'</div><h3>'+current.title+'</h3><small>Thưởng hoàn thành chương: '+this.reward(current.reward)+'</small></div>'+this.btn("replay","Xem lại lời dẫn",{id:current.id,cls:"ghost"})+'</div>'+this.bar(done/current.quests.length)+
     this.orderedProgress(current.quests,q=>prog.questState(q)).map(({item:q,st})=>{
      return '<div class="row'+(st.claimed?" dim":"")+'"><div class="grow">'+this.objectiveText(q,st)+this.bar(st.cur/st.goal,st.done?"":"blue")+'<small>'+fmt(st.cur)+' / '+fmt(st.goal)+' · '+this.reward(q)+'</small></div>'+
       this.btn("claim",st.claimed?"Đã nhận":st.done?"Nhận thưởng":"Đang làm",{id:q.id,cls:st.done&&!st.claimed?"primary":"",disabled:!st.done||st.claimed})+'</div>';
     }).join("");
   }else body+='<div class="chapter"><div><div class="eyebrow">Hậu truyện</div><h3>Bình Minh — đô thị kiểu mẫu</h3><small>Bạn đã hoàn thành cả 6 chương. Thành tựu, nhiệm vụ ngày và bảng xếp hạng vẫn đang chờ.</small></div></div>'+
    CONTENT.chapters.map(c=>'<div class="row dim"><div class="grow"><b>'+c.title+'</b><small>'+c.subtitle+'</small></div>'+this.btn("replay","Xem lại",{id:c.id,cls:"ghost"})+'</div>').join("");
  }else if(tab==="daily"){
   const login=prog.loginState(),level=s.profile.level;
   body+='<h4>Điểm danh · chuỗi '+(login.available?login.streak-1:login.streak)+' ngày</h4><div class="calendar">'+CONTENT.login.map((r,i)=>{
    const state=i<login.day||(!login.available&&i===login.day)?"done":i===login.day?"now":"";
    return '<div class="day '+state+'"><small>Ngày '+(i+1)+'</small><b>'+(i===6?"🎁":r.coins?"V":r.know?"✦":this.icon("prestige"))+'</b><small>'+this.reward(prog.loginReward(i)).replaceAll(" · ","<br>")+'</small></div>';
   }).join("")+'</div>'+this.btn("claim-login",login.available?"Điểm danh hôm nay":"Đã điểm danh · quay lại ngày mai",{cls:"primary block",disabled:!login.available})+
   '<h4>Nhiệm vụ hôm nay <small class="muted">làm mới sau '+s.social.resetTime()+'</small></h4>'+
   this.orderedProgress(s.progress.daily.quests,item=>prog.dailyState(item)).map(({st})=>{
    return '<div class="row'+(st.claimed?" dim":"")+'"><div class="grow"><b>'+st.text+'</b>'+this.bar(st.cur/st.goal,st.done?"":"blue")+'<small>'+st.cur+' / '+st.goal+' · '+this.reward(CONTENT.dailyReward(level))+'</small></div>'+
     this.btn("claim-daily",st.claimed?"Đã nhận":st.done?"Nhận thưởng":"Đang làm",{id:st.id,cls:st.done&&!st.claimed?"primary":"",disabled:!st.done||st.claimed})+'</div>';
   }).join("")+
   '<div class="row chest"><div class="grow"><b>🎁 Rương hoàn thành cả 3 nhiệm vụ</b><small>'+this.reward(CONTENT.dailyBonus(level))+'</small></div>'+this.btn("claim-bonus",s.progress.daily.bonus?"Đã mở":"Mở rương",{cls:"primary",disabled:!prog.dailyBonusReady()})+'</div>';
  }else{
   body+='<div class="grid">'+this.orderedProgress(CONTENT.achievements,a=>prog.achState(a)).map(({item:a,st})=>{
    const reward=CONTENT.achievementReward(Math.min(2,st.tier));
    return '<div class="card'+(st.complete?" dim":"")+'"><div class="medals">'+[0,1,2].map(i=>'<i class="'+(i<st.tier?"on":"")+'"></i>').join("")+'</div><b>'+a.name+'</b><small>'+(st.complete?"Đã đạt mọi bậc":st.desc)+'</small>'+
     (st.complete?"":this.bar(st.value/st.goal)+'<small>'+fmt(Math.min(st.value,st.goal))+' / '+fmt(st.goal)+' · '+this.reward(reward)+'</small>'+this.btn("claim-ach",st.claimable?"Nhận thưởng":"Chưa đạt",{id:a.id,cls:st.claimable?"primary":"",disabled:!st.claimable}))+'</div>';
   }).join("")+'</div>';
  }
  this.open("missions","HÀNH TRÌNH THỊ TRƯỞNG","Nhiệm vụ",body,true);
 },
 legacyPanel(){
  const legacy=this.sim.legacy;
  if(!legacy?.unlocked)return '<p class="empty">Di sản mở ở cấp Thị trưởng 16. Hãy hoàn thành các chương để tiến tới cột mốc này.</p>';
  const contracts=legacy.planStates(),planDone=contracts.every(q=>q.done);
  const plan={type:"plan",id:"",name:"Quy hoạch mới #"+(legacy.data.round+1)+" · "+legacy.plan.name,done:planDone,
   reward:legacy.planReward,detail:'<ul class="legacy-contracts">'+contracts.map(q=>'<li>'+q.name+' <b>'+fmt(q.cur)+' / '+fmt(q.goal)+'</b></li>').join("")+'</ul>'};
  const entries=[plan,...legacy.rankStates().map(r=>({...r,type:"rank",detail:this.bar(r.cur/r.goal)+'<small>'+fmt(Math.min(r.cur,r.goal))+' / '+fmt(r.goal)+' điểm đô thị</small>'})),
   ...legacy.familyStates().map(r=>({...r,type:"family",name:(r.done?"★ ":"☆ ")+r.name,detail:'<small>Thành thạo dòng công trình · đạt cấp '+CONFIG.maxLevel+'</small>'}))];
  return '<div class="legacy-panel"><p class="muted">Chinh phục danh hiệu đô thị, sưu tập sao thành thạo và tiếp tục với các đợt Quy hoạch mới. Tiến độ mỗi đợt bắt đầu khi nhận thưởng đợt trước.</p>'+
   this.orderedProgress(entries,r=>r).map(({st:r})=>'<div class="row'+(r.claimed?" dim":"")+'"><div class="grow"><b>'+r.name+'</b>'+r.detail+'<small>'+this.reward(r.reward)+'</small></div>'+
   this.btn("claim-legacy",r.claimed?"Đã nhận":r.done?"Nhận thưởng":"Đang làm",{id:r.id,arg:r.type,cls:r.done?"primary":"",disabled:!r.done||r.claimed})+'</div>').join("")+'</div>';
 },
 research(){
  const s=this.sim,R=CONTENT.research;
  const cols=R.branches.map(branch=>'<div class="branch"><h4 style="color:'+branch.color+'">'+branch.name+'</h4>'+branch.techs.map((t,i)=>{
   const tech=R.all.find(x=>x.id===t.id),level=s.tech(t.id),block=s.researchBlock(tech),max=level>=R.maxLevel,locked=tech.prev&&!s.tech(tech.prev);
   return (i?'<div class="link'+(locked?"":" on")+'"></div>':"")+'<div class="tech'+(locked?" locked":"")+(max?" max":"")+'"><div class="pips">'+[0,1,2].map(k=>'<i class="'+(k<level?"on":"")+'" style="--c:'+branch.color+'"></i>').join("")+'</div><b>'+t.name+'</b><small>'+t.desc+'</small>'+
    (level?'<small class="mint">Đang có: '+t.unit.replace(/\d+/,n=>n*level)+'</small>':"")+
    this.btn("study",max?"Tối đa":locked?"🔒 Chưa mở":"Nghiên cứu · "+fmt(R.cost(tech,level))+" ✦",{id:t.id,cls:block?"":"primary",disabled:!!block,title:block})+'</div>';
  }).join("")+'</div>').join("");
  this.open("research","VIỆN QUY HOẠCH","Cây nghiên cứu",'<p class="muted">Tri thức hiện có: <b class="teal">'+fmt(Math.floor(s.profile.knowledge))+' ✦</b> · sinh ra <b class="teal">+'+fmt(s.metrics.know*60,1)+'/phút</b>. Xây Trường học, Đại học, Bảo tàng hoặc thu túi ✦ trên bản đồ để có thêm.</p><div class="tree">'+cols+'</div>',true);
 },
 decision(){
  const s=this.sim,pending=s.progress.decision,event=pending&&CONTENT.decisions.find(d=>d.id===pending.id);if(!event)return;
  const c=CONTENT.cast[event.who];
  this.open("decision","THƯ GỬI THỊ TRƯỞNG",event.title,'<div class="letter-body">'+this.portrait(event.who)+'<div><b>'+c.name+'</b><small>'+c.role+'</small><p>'+event.text+'</p></div></div><div class="choices">'+event.options.map((o,i)=>{
   const cost=s.decisionCost(o),money=cost?(cost>0?"+":"−")+fmt(Math.abs(cost))+" Vàng · ":"";
   return this.btn("decide",'<b>'+o.label+'</b><small>'+money+o.hint+'</small>',{id:i,disabled:cost<0&&s.profile.coins<-cost,cls:"choice"});
  }).join("")+'</div>');
 },
 socials(){
  const s=this.sim,tab=this.tabs.social,cloud=s.cloud,online=!!cloud?.online;
  let body=this.tabbar("social",[["friends","Bạn bè"],["rank","Xếp hạng"],["codes","Mã thành phố"]]);
  if(tab==="friends"){
   if(online&&!this.friendsSynced){this.friendsSynced=true;cloud.syncFriends().then(()=>{if(this.dialogType==="social"&&this.tabs.social==="friends")this.socials()}).catch(()=>{})}
   const list=s.social.friends().map(f=>'<div class="row">'+this.face(f.avatar,f.level)+'<div class="grow"><b>'+htm(f.name)+(f.cloud?' <span class="tag">trực tuyến</span>':String(f.id).startsWith("MP-MAU")?' <span class="tag muted">mẫu</span>':'')+'</b><small>'+f.id+' · Cấp '+f.level+' · '+(f.world.crises.length?'<span class="warn">'+f.world.crises.length+' sự cố cần chi viện</span>':'đang yên ổn')+'</small></div><div class="actions">'+
    (String(f.id).startsWith("MP-MAU")?"":this.btn("unfriend","Xóa",{id:f.id,cls:"ghost"}))+
    (online&&f.cloud?this.btn("chat-open","Nhắn tin",{id:f.id})+this.btn("coop-open","Nhiệm vụ chung",{id:f.id}):"")+
    this.btn("visit","Thăm",{id:f.id,cls:"primary"})+'</div></div>').join("");
   body+='<p class="muted">Còn <b id="help-left">'+s.profile.dailyHelpsLeft+'/5</b> lượt chi viện · làm mới sau <b id="help-timer">'+s.social.resetTime()+'</b>. Mỗi lượt: 250 Vàng × cấp bạn, 40 XP và '+this.prestigeAmount(2)+(online?"; bạn bè trực tuyến còn nhận được quà cảm ơn":"")+'.</p>'+
    (online?'<div class="inline"><input id="friend-code" maxlength="12" placeholder="Nhập mã thành phố, ví dụ MP-7K2QF9" autocomplete="off">'+this.btn("add-friend","Kết bạn",{cls:"primary"})+'</div><p id="friend-message" role="status"></p>':"")+list;
  }else if(tab==="rank"){
   const stats=[["score","Điểm đô thị",""],["assets","Tổng tài sản"," V"],["happiness","Hạnh phúc","%"],["helpsGiven","Nghĩa hiệp"," lượt"]],unit=stats.find(x=>x[0]===this.rank)[2];
   body+='<div class="tabs sub">'+this.btn("rank","Bạn bè",{arg:"friends",cls:this.rankScope==="friends"?"active":""})+this.btn("rank","Toàn máy chủ",{arg:"global",cls:this.rankScope==="global"?"active":"",disabled:!online,title:online?"":"Cần kết nối máy chủ"})+'<span class="sep"></span>'+stats.map(([id,title])=>this.btn("rank",title,{id,cls:this.rank===id?"active":""})).join("")+'</div>';
   let rows;
   if(this.rankScope==="global"&&online){
    const key=this.rank;
    if(this.globalRows?.stat!==key){
     this.globalRows={stat:key,rows:null};
     cloud.leaderboard(key).then(r=>{this.globalRows={stat:key,rows:r.rows,me:r.me};if(this.dialogType==="social"&&this.tabs.social==="rank")this.socials()}).catch(()=>{this.globalRows={stat:key,rows:[],error:true}});
    }
    rows=this.globalRows.rows?this.globalRows.rows.map((f,i)=>({...f,place:i+1,me:f.code===cloud.account?.code,id:f.code})):null;
    if(rows&&this.globalRows.me&&!rows.some(r=>r.me))rows.push({...this.globalRows.me,me:true,id:this.globalRows.me.code});
   }else rows=s.social.rankings(this.rank).map((f,i)=>({place:i+1,name:f.name,level:f.level,id:f.id,score:f.score,me:!!f.me,avatar:f.avatar}));
   body+=rows?rows.map(f=>'<div class="row'+(f.me?" me":"")+'"><span class="badge place p'+Math.min(4,f.place)+'">'+f.place+'</span>'+this.avatar(f.avatar,"mini")+'<div class="grow"><b>'+htm(f.name)+(f.me?' <span class="tag">Bạn</span>':'')+'</b><small>Cấp '+f.level+' · '+f.id+'</small></div><b class="gold">'+fmt(f.score)+unit+'</b></div>').join("")||'<p class="empty">Chưa có dữ liệu xếp hạng.</p>':'<p class="empty">Đang tải bảng xếp hạng…</p>';
  }else{
   body+=(online?'<p class="muted">Mã kết bạn trực tuyến của bạn: <b class="mint">'+cloud.account.code+'</b> — gửi mã này cho bạn bè để họ thăm thành phố thật của bạn.</p>':'<p class="muted">Đang chơi ngoại tuyến: dùng mã Base64 bên dưới để chia sẻ thành phố.</p>')+
    '<label for="export-code"><b>Xuất mã thành phố (ngoại tuyến)</b></label><textarea id="export-code" rows="3" readonly>'+s.social.export()+'</textarea>'+this.btn("copy","Sao chép mã",{cls:"primary"})+
    '<label for="import-code"><b>Nhập mã kết bạn</b></label><textarea id="import-code" rows="3" maxlength="28000" placeholder="Dán mã Base64 của bạn bè"></textarea>'+this.btn("import","Nhập và kết bạn",{cls:"primary"})+'<p id="code-message" role="status"></p>';
  }
  this.open("social","KẾT NỐI ĐÔ THỊ","Bạn bè & Bảng xếp hạng",body,true);
 },
 importCode(){
  const input=document.getElementById("import-code"),feedback=document.getElementById("code-message");
  try{const friend=this.sim.social.import(input.value);feedback.className="mint";feedback.textContent="Đã kết bạn với "+friend.name+".";input.value=""}
  catch(error){feedback.className="warn";feedback.textContent=error.message}
 },
 async addFriend(){
  const input=document.getElementById("friend-code"),feedback=document.getElementById("friend-message"),code=input.value.trim().toUpperCase();
  if(!code){feedback.className="warn";feedback.textContent="Hãy nhập mã thành phố.";return}
  try{const friend=await this.sim.cloud.addFriend(code);this.socials();this.toast("Đã kết bạn với "+friend.name+".")}
  catch(error){feedback.className="warn";feedback.textContent=error.message}
 },
 profileDialog(){
  const s=this.sim,p=s.profile,st=s.stats,m=s.metrics,cloud=s.cloud,tab=this.tabs.profile,rank=CONFIG.cityRank(m.score,p.level);
  let body=this.tabbar("profile",[["me","Hồ sơ"],["account","Tài khoản"],["settings","Cài đặt"]]);
  if(tab==="me"){
   const hours=Math.floor(st.playTime/3600),minutes=Math.floor(st.playTime/60)%60;
   const cells=[["Điểm đô thị",fmt(m.score)],["Thu nhập cao nhất",fmt(st.peakIncome,1)+" V/s"],["Dân số cao nhất",fmt(st.peakPop)],["Sự cố đã xử lý",fmt(st.crisesSolved)],["Chuỗi tốt nhất","×"+st.bestCombo],["Công trình đã xây",fmt(st.buildingsBuilt)],["Lượt nâng cấp",fmt(st.upgrades)],["Túi thuế đã thu",fmt(st.bubbles)],["Cấp nghiên cứu",st.research+" / 36"],["Lượt chi viện",fmt(p.helpsGiven)],["Ngày điểm danh",fmt(st.loginDays)],["Thời gian chơi",hours+" giờ "+minutes+" phút"]];
   body+='<div class="hero">'+this.face(p.avatar,p.level)+'<div class="grow"><h3>'+htm(p.mayorName)+'</h3><small>'+rank.name+' '+htm(p.cityName)+' · Mã '+p.mayorId+'</small>'+
    (rank.next?this.bar(m.score/rank.next[0])+'<small>Còn '+fmt(Math.max(0,rank.next[0]-m.score))+' điểm đô thị để thành «'+rank.next[1]+'»</small>':'<small class="mint">Danh hiệu cao nhất!</small>')+'</div></div>'+
    '<div class="inline"><input id="mayor-name" maxlength="40" value="'+htm(p.mayorName)+'" aria-label="Tên Thị trưởng"><input id="city-name" maxlength="24" value="'+htm(p.cityName)+'" aria-label="Tên thành phố">'+this.btn("save-name","Lưu tên",{cls:"primary"})+'</div>'+
    '<h4>Chân dung Thị trưởng</h4><div class="avatar-grid">'+CONFIG.avatars.pick.map(n=>'<button type="button" data-act="avatar" data-id="'+n+'" title="'+CONFIG.avatars.roles[n-1]+'" aria-label="'+CONFIG.avatars.roles[n-1]+'" aria-pressed="'+(p.avatar===n)+'"'+(p.avatar===n?' class="active"':"")+'>'+this.avatar(n)+'</button>').join("")+'</div>'+
    '<div class="statgrid">'+cells.map(([k,v])=>'<div><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>';
  }else if(tab==="account"){
   if(!cloud?.enabled)body+='<p class="empty">Bạn đang mở trò chơi trực tiếp từ tệp. Tiến độ được lưu trong trình duyệt. Chạy máy chủ (npm start) để dùng lưu đám mây, bảng xếp hạng toàn cầu và kết bạn trực tuyến.</p>';
   else if(cloud.status==="expired")body+='<p class="empty">Phiên đăng nhập đã hết hạn (có thể do đổi mật khẩu ở thiết bị khác). Thành phố vẫn được lưu trên trình duyệt này.</p><div class="actions">'+this.btn("auth","Đăng nhập lại",{id:"relogin",cls:"primary"})+'</div>';
   else if(!cloud.online)body+='<p class="empty">Không kết nối được máy chủ. Trò chơi vẫn tự lưu trên trình duyệt và sẽ đồng bộ lại khi tải lại trang.</p>';
   else{
    const a=cloud.account,field=(id,label,type,auto,hint="")=>'<label>'+label+'<input id="'+id+'" '+(type==="password"?'type="password" maxlength="72"':'maxlength="20" autocapitalize="none" spellcheck="false"')+' autocomplete="'+auto+'" placeholder="'+hint+'"></label>';
    body+='<div class="row"><div class="grow"><b>'+(a.username?"Tài khoản: "+htm(a.username):"Tài khoản khách")+'</b><small>Mã thành phố: <span class="mint">'+a.code+'</span> · '+(cloud.lastSync?"đồng bộ lần cuối "+new Date(cloud.lastSync).toLocaleTimeString("vi-VN"):"chưa đồng bộ trong phiên này")+'</small></div>'+this.btn("sync","Đồng bộ ngay",{cls:"primary"})+'</div>';
    if(a.username){
     body+='<p class="muted">Đăng nhập tên này trên thiết bị khác để chơi tiếp thành phố của bạn.</p><h4>Đổi mật khẩu</h4><form class="authbox" data-auth="password">'+
      field("auth-current","Mật khẩu hiện tại","password","current-password")+field("auth-pass","Mật khẩu mới","password","new-password","Từ 6 ký tự")+field("auth-again","Nhập lại mật khẩu mới","password","new-password")+
      '<div class="actions"><button type="submit" class="primary">Đổi mật khẩu</button>'+this.btn("auth","Đăng xuất",{id:"logout",cls:"danger"})+'</div><small>Đổi mật khẩu sẽ đăng xuất tài khoản khỏi các thiết bị khác.</small><p id="auth-message" role="status"></p></form>';
    }else{
     const mode=this.tabs.account==="login"?"login":"register";
     body+='<p class="muted">Tài khoản khách chỉ gắn với trình duyệt này. Tạo tài khoản để giữ thành phố khi đổi máy hoặc xóa dữ liệu trình duyệt.</p>'+
      '<div class="tabs sub">'+this.btn("tab","Tạo tài khoản",{id:"account",arg:"register",cls:mode==="register"?"active":""})+this.btn("tab","Đăng nhập tài khoản có sẵn",{id:"account",arg:"login",cls:mode==="login"?"active":""})+'</div>'+
      '<form class="authbox" data-auth="'+mode+'">'+field("auth-user","Tên đăng nhập","text","username","3–20 ký tự: chữ, số, dấu chấm, gạch dưới")+field("auth-pass","Mật khẩu","password",mode==="register"?"new-password":"current-password","Từ 6 ký tự")+
      (mode==="register"?field("auth-again","Nhập lại mật khẩu","password","new-password"):"")+
      '<div class="actions"><button type="submit" class="primary">'+(mode==="register"?"Tạo tài khoản & giữ thành phố này":"Đăng nhập")+'</button></div>'+
      '<small>'+(mode==="register"?"Thành phố hiện tại sẽ được gắn vào tài khoản mới.":"Thành phố của tài khoản sẽ thay cho thành phố khách đang chơi trên trình duyệt này.")+'</small><p id="auth-message" role="status"></p></form>';
    }
   }
  }else{
   const volume=Math.round(s.audio.musicVolume*100);
   body+='<div class="row"><div class="grow"><b>Hiệu ứng âm thanh</b><small>Âm thanh khi xây dựng, nhận thưởng và thao tác.</small></div>'+this.btn("sound",s.audio.enabled?"Đang bật · Tắt":"Đang tắt · Bật")+'</div>'+
    '<div class="row"><div class="grow"><b>Nhạc nền</b><small>Turning Pages — Kanto Daydream</small></div>'+this.btn("music",s.audio.musicEnabled?"Đang bật · Tắt":"Đang tắt · Bật")+'</div>'+
    '<div class="row music-volume"><label for="music-volume">Âm lượng nhạc nền</label><input id="music-volume" type="range" min="0" max="100" value="'+volume+'"><output id="music-volume-value" for="music-volume">'+volume+'%</output></div>'+
    '<div class="row"><div class="grow"><b>Giảm hiệu ứng</b><small>Tắt rung nảy, pháo giấy, hiệu ứng thu thưởng và chớp sáng.</small></div>'+this.btn("reduce-effects",s.reduceEffects?"Đang bật · Tắt":"Đang tắt · Bật")+'</div>'+
    '<div class="row"><div class="grow"><b>Hướng dẫn tân thủ</b><small>Xem lại các bước làm quen cùng thư ký Mai.</small></div>'+this.btn("replay-tutorial","Xem lại")+'</div>'+
    '<div class="row"><div class="grow"><b>Cẩm nang Thị trưởng</b><small>Giải thích mọi hệ thống trong trò chơi.</small></div>'+this.btn("help","Mở cẩm nang")+'</div>'+
    '<div class="row"><div class="grow"><b>Chơi lại từ đầu</b><small>Xóa toàn bộ tiến độ.</small></div>'+this.btn("reset","Xóa bản lưu",{cls:"danger"})+'</div>';
  }
  this.open("profile","THỊ TRƯỞNG","Hồ sơ & Cài đặt",body,true);
 },
 async auth(kind){
  const cloud=this.sim.cloud,feedback=document.getElementById("auth-message"),value=id=>document.getElementById(id)?.value||"";
  const say=(text,ok=false)=>{const el=document.getElementById("auth-message");if(el){el.className=ok?"mint":"warn";el.textContent=text}else this.toast(text)};
  if(this.authBusy)return;
  try{
   if(kind==="relogin"){cloud.relogin();return}
   if(kind==="logout"){this.authBusy=true;await cloud.logout();return}
   const user=value("auth-user").trim(),pass=value("auth-pass");
   const problem=(kind!=="password"&&AuthGate.rules.user(user))||AuthGate.rules.pass(pass)||(kind!=="login"&&pass!==value("auth-again")?"Hai lần nhập mật khẩu chưa khớp.":"");
   if(problem){say(problem);return}
   this.authBusy=true;say("Đang xử lý…",true);
   if(kind==="register"){await cloud.register(user,pass);cloud.flush(true);this.profileDialog();this.toast("Đã tạo tài khoản. Thành phố của bạn được giữ trên máy chủ.")}
   else if(kind==="password"){await cloud.password(value("auth-current"),pass);this.profileDialog();this.toast("Đã đổi mật khẩu.")}
   else await cloud.login(user,pass);
  }catch(error){say(error.message)}
  finally{this.authBusy=false}
 },
 loginDialog(){
  const prog=this.sim.prog,login=prog.loginState();
  this.open("login","ĐIỂM DANH HẰNG NGÀY",login.available?"Chào mừng trở lại, Thị trưởng!":"Hẹn gặp lại ngày mai",'<p class="muted">Điểm danh liên tục 7 ngày để mở Rương Thị trưởng. Lỡ một ngày, chuỗi sẽ quay lại ngày 1.</p><div class="calendar">'+CONTENT.login.map((r,i)=>{
   const state=i<login.day||(!login.available&&i===login.day)?"done":i===login.day?"now":"";
   return '<div class="day '+state+'"><small>Ngày '+(i+1)+'</small><b>'+(i===6?"🎁":r.coins?"V":r.know?"✦":this.icon("prestige"))+'</b><small>'+this.reward(prog.loginReward(i)).replaceAll(" · ","<br>")+'</small></div>';
  }).join("")+'</div><div class="actions">'+this.btn("claim-login",login.available?"Nhận quà ngày "+(login.day+1):"Đã nhận hôm nay",{cls:"primary",disabled:!login.available})+this.btn("missions","Nhiệm vụ hôm nay",{id:"daily"})+'</div>',true);
 },
 mailDialog(){
  const rows=this.mail.map(g=>'<div class="row"><div class="grow"><b>'+htm(g.fromName)+' đã chi viện thành phố của bạn</b><small>'+new Date(g.createdAt).toLocaleString("vi-VN")+'</small></div><b class="gold">+'+fmt(g.coins)+' V</b></div>').join("");
  this.open("mail","HỘP THƯ","Quà cảm ơn từ bạn bè",(rows||'<p class="empty">Hộp thư trống.</p>')+'<div class="actions">'+this.btn("mail-claim","Nhận tất cả",{cls:"primary",disabled:!this.mail.length})+'</div>');
 },
 async claimMail(){
  try{
   const r=await this.sim.cloud.claimMail();this.mail=[];this.close();
   if(r.coins){this.sim.earn(r.coins);this.sim.audio.play("money");this.sim.storage.save();this.toast("Nhận "+fmt(r.coins)+" Vàng từ "+r.count+" lượt chi viện của bạn bè.")}
  }catch(error){this.toast(error.message)}
  this.refresh();
 },
 levelUp(level){
  const fresh=Object.values(CONFIG.buildings).filter(d=>d.unlock===level),grew=CONFIG.radius(level)>CONFIG.radius(level-1),gates={5:"Mở tiến hóa bậc II (công trình lên cấp 4–6)",10:"Mở tiến hóa bậc III (công trình lên cấp 7–10)"}[level];
  if(!this.sim.reduceEffects)GameArt.celebration();
  const confetti=this.sim.reduceEffects?"":'<span class="level-confetti" aria-hidden="true">'+Array.from({length:18},(_,i)=>'<i data-confetti-art="confetti-'+["clay","blue","sage","gold"][i%4]+'" style="--x:'+((i*31)%96)+'%;--drift:'+((i*13)%75-37)+'px;--angle:'+(90+i*33)+'deg;--delay:'+(i%6*.045)+'s"></i>').join("")+'</span>';
  this.open("level","THĂNG CẤP","Thị trưởng cấp "+level+"!",'<div class="levelup level-celebration">'+confetti+'<span class="profile-level big"><b>'+level+'</b><small>CẤP</small></span><p>Thưởng: <b class="gold">+'+fmt(150*level)+' Vàng</b> · <b class="mint">'+this.prestigeAmount("+5")+'</b></p></div>'+
   (level===CONFIG.utilityXP.level?'<p class="mint">Giữ đủ điện và nước để kiếm thêm '+CONFIG.utilityXP.perSecond*60+' XP/phút khi chơi, đến cấp 5.</p>':"")+
   (grew?'<div class="row"><div class="grow"><b>Mở rộng địa giới</b><small>Bản đồ nới thêm một vòng đất: '+CONFIG.radius(level)*2+' × '+CONFIG.radius(level)*2+' ô.</small></div></div>':"")+
   (gates?'<div class="row"><div class="grow"><b>Bậc tiến hóa mới</b><small>'+gates+'.</small></div></div>':"")+
   (fresh.length?'<h4>Bản vẽ mới</h4><div class="unlocks">'+fresh.map(d=>'<div><img src="'+this.thumbs[d.id]+'" alt=""><b>'+d.name+'</b><small>'+d.desc+'</small></div>').join("")+'</div>':"")+
   '<div class="actions">'+this.btn("welcome","Tiếp tục xây dựng",{cls:"primary"})+'</div>');
 },
 offline(result){
  this.open("offline","THU NHẬP NGOẠI TUYẾN","Chào mừng trở lại!",'<p>Thành phố đã tự vận hành trong <b>'+timer(result.seconds)+'</b> (trần '+Math.round(result.cap/3600)+' giờ). Bạn nhận <b class="gold">+'+fmt(result.coins)+' Vàng</b>'+(result.know?' và <b class="teal">+'+fmt(result.know)+' Tri thức</b>':'')+' với hiệu suất ngoại tuyến '+Math.round(result.rate*100)+'%.</p><p class="muted">Nghiên cứu «Quỹ dự trữ đô thị» và xây Ngân hàng để nâng trần ngoại tuyến.</p><div class="actions">'+this.btn("welcome","Vào thành phố",{cls:"primary"})+'</div>');
 },
 help(section){
  const pages={
   start:["Bắt đầu",'<p>Bạn là Thị trưởng mới của thị trấn Bình Minh. Ngân sách tăng mỗi giây; hãy dùng Vàng để <b>xây</b> và <b>nâng cấp</b> công trình, giữ cho cư dân hạnh phúc và xử lý sự cố kịp thời.</p><ul><li><b>Xây dựng:</b> mở Kho bản vẽ, chọn công trình rồi chạm ô đất sáng xanh. Với Đường nhựa, kéo để vẽ liên tiếp.</li><li><b>Túi thuế:</b> thỉnh thoảng công trình nổi túi Vàng, ✦ Tri thức hoặc '+this.icon("prestige")+' Uy tín — chạm để thu.</li><li><b>Nhiệm vụ:</b> làm theo cốt truyện 6 chương để mở khóa dần mọi hệ thống.</li><li><b>Phím tắt:</b> B Xây dựng · N Nhiệm vụ · R Nghiên cứu · F Bạn bè · Esc hủy · +/− thu phóng.</li></ul>'],
   build:["Công trình & Quy hoạch",'<ul><li><b>10 cấp, 3 bậc:</b> mỗi cấp +35% thu nhập (nhà thêm dân, trạm thêm sản lượng). Lên cấp 4 và cấp 7 công trình <b>tiến hóa</b> đổi tên, cần Thị trưởng cấp 5 và 10.</li><li><b>Chuyên môn hóa:</b> đạt cấp 5, mỗi công trình chọn một trong hai hướng — không đổi lại được.</li><li><b>Nối đường:</b> công trình có thu nhập mà không kề đường bị −20%.</li><li><b>Công viên:</b> nhà và cửa hàng kề công viên +10% (tối đa +20%).</li><li><b>Dân cư ↔ Thương mại:</b> cửa hàng kề nhà +5% mỗi nhà (tối đa +15%). Ga Metro +15% cho cửa hàng trong 2 ô.</li><li><b>Ô nhiễm:</b> nhà kề Trạm Điện lực hoặc Trạm Xử lý Rác làm giảm Hạnh phúc.</li><li><b>Điện, nước:</b> thiếu nguồn làm giảm Hạnh phúc và tăng nguy cơ sự cố.</li></ul>'],
   crisis:["Sự cố & Đội NPC",'<ul><li>Sự cố sinh ra từ <b>áp lực hạ tầng</b>: thiếu điện/nước, thời tiết, rác, mật độ thương mại…</li><li>Bấm thẻ cảnh báo hoặc biểu tượng trên bản đồ để <b>điều phối</b>. Đội chạy theo đường nhựa; đi ngoài đường rất chậm.</li><li>Xử lý trước ngưỡng nguy hiểm để giữ <b>chuỗi phản ứng</b>: thêm XP và Uy tín.</li><li><b>Nâng xe</b> để đi và sửa nhanh hơn; <b>tuyển thêm người</b> để xử lý nhiều sự cố cùng lúc.</li><li><b>Quân hàm:</b> đội làm 5 / 15 / 40 nhiệm vụ sẽ lên Lành nghề / Tinh nhuệ / Huyền thoại, sửa nhanh hơn tới 35%.</li><li>Hỏa hoạn lan sau 45 giây; mất điện chặn xây dựng xung quanh.</li></ul>'],
   grow:["Tri thức, Sắc lệnh & Thư",'<ul><li><b>Tri thức ✦</b> sinh từ Trường học, Đại học, Bảo tàng, Trung tâm An ninh Mạng, Tháp Công nghệ. Dùng ở <b>Viện Quy hoạch</b> để nghiên cứu 12 công nghệ.</li><li><b>Sắc lệnh:</b> ba hiệu ứng mạnh có thời hạn, mỗi lúc chỉ một sắc lệnh.</li><li><b>Thư quyết định:</b> cư dân và đối tác gửi đề nghị; mỗi lựa chọn có lợi và hại riêng.</li><li><b>Danh hiệu đô thị:</b> Điểm đô thị (dân số, thu nhập, cấp công trình) nâng Bình Minh từ Thị trấn lên Đô thị huyền thoại.</li></ul>'],
   daily:["Mỗi ngày & Bạn bè",'<ul><li><b>Điểm danh</b> 7 ngày liên tục để mở Rương Thị trưởng.</li><li><b>3 nhiệm vụ ngày</b> làm mới lúc nửa đêm; xong cả ba mở thêm rương.</li><li><b>Thành tựu</b> có 3 bậc, thưởng Uy tín.</li><li><b>Thu nhập ngoại tuyến:</b> thành phố vẫn thu tiền khi bạn vắng mặt (trần 8 giờ, nâng được).</li><li><b>Bạn bè:</b> thăm thành phố bạn, chi viện tối đa 5 lượt/ngày để nhận thưởng. Khi kết nối máy chủ, bạn có thể kết bạn bằng mã, xem xếp hạng toàn máy chủ và nhận quà cảm ơn.</li></ul>']
  };
  this.helpPage=pages[section]?section:"start";
  this.open("help","CẨM NANG THỊ TRƯỞNG",pages[this.helpPage][0],'<div class="tabs">'+Object.entries(pages).map(([id,[title]])=>this.btn("help",title,{id,cls:id===this.helpPage?"active":""})).join("")+'</div><div class="guide">'+pages[this.helpPage][1]+'</div>',true);
 }
};
Object.assign(UIController.prototype,UIDialogs);
