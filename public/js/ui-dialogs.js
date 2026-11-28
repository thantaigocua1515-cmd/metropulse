"use strict";

const MAYOR_SKINS={
 default:["Mặc định","Kiến trúc Bình Minh nguyên bản."],
 tet:["Tết","Đèn lồng, hoa mai lấp lánh và pháo hoa nhỏ."],
 noel:["Noel","Mái nhà phủ tuyết và tuyết rơi nhẹ."],
 cyberpunk:["Cyberpunk","Ánh neon xanh tím chớp nhẹ cùng tia sáng hologram."],
 sakura:["Sakura","Mái tím mận và cánh hoa anh đào rơi quanh nhà."],
 desert:["Sa Mạc","Đá sa thạch, chậu xương rồng và những vệt cát bay nhẹ."],
 jungle:["Rừng Xanh","Mái xanh, lá rơi và đom đóm sáng rõ hơn về đêm."],
 ocean:["Đại Dương","Mái xanh biển, cụm san hô và bong bóng nổi lên quanh nhà."],
 steampunk:["Steampunk","Mái đồng, ống hơi và những tia lửa nhỏ."]
};

// Các hộp thoại của giao diện.
const UIDialogs = {
 eventBanner(own){
  const el=this.nodes["event-banner"]??=document.getElementById("event-banner"),season=this.sim.events?.def?this.sim.events:null;
  const flash=this.sim.flash?.def?this.sim.flash:null,e=season||flash;
  el.hidden=!own||!e;
  if(el.hidden)return;
  const claimable=event=>event.def.jobs.some((_,i)=>{const q=event.quest(i);return q.done&&!q.claimed})||
   event.tiers.some((t,i)=>event.points>=t.need&&!event.data.tiers.includes(i));
  const ready=claimable(e)||flash&&claimable(flash);
  this.html("event-banner",this.btn("event-open",'<span class="event-mark" aria-hidden="true" data-event-art="'+(e.event.template||e.event.id)+'">'+e.def.icon+'</span><span><b>'+htm(e.def.name)+'</b><small>'+e.countdown()+(e.force?" · Xem thử":"")+(season&&flash?" · "+htm(flash.def.name):"")+'</small></span>'+(ready?'<sup aria-label="Có thưởng">!</sup>':""),{cls:"event-button",title:"Xem sự kiện và phần thưởng"}));
  el.style.setProperty("--event-tone",e.def.tone);
 },
 currentEvent(){
  const {flash,events}=this.sim;
  return flash?.def&&(this.eventTab==="flash"||!events?.def)?flash:events?.def?events:null;
 },
 eventDialog(){
  const e=this.currentEvent();if(!e){if(this.dialogType==="event")this.close();return}
  const def=e.def,c=CONTENT.cast[def.who],jobs=def.jobs.map((_,i)=>e.quest(i));
  const tabs=this.sim.events?.def&&this.sim.flash?.def?'<div class="tabs">'+this.btn("event-tab",htm(this.sim.events.def.name),{id:"season",cls:e.flash?"":"active"})+
   this.btn("event-tab",htm(this.sim.flash.def.name),{id:"flash",cls:e.flash?"active":""})+'</div>':'<p class="muted">Sự kiện ngắn: Giờ Cao Điểm 18:00–20:00 ngày thường; Chợ Cuối Tuần từ 08:00 thứ Bảy đến hết Chủ nhật (giờ Việt Nam).</p>';
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
    this.btn("team-hire",b.crew===3?"Đủ 3 người":"Tuyển · "+this.prestigeAmount(b.crew+1),{id:key,disabled:b.crew===3||b.left>0})+
    this.btn("specialists","Kỹ năng",{id:key,disabled:b.left>0})+'</div></div>';
  }).join("");
  this.open("teams","ĐỘI PHẢN ỨNG","Quản lý đội NPC",'<p class="muted">Nâng cấp phương tiện để đến nhanh, sửa nhanh. Đội càng làm nhiều nhiệm vụ càng lên quân hàm và sửa nhanh hơn. Mỗi trụ sở có tối đa 3 nhân sự.</p>'+(rows||'<p class="empty">Hãy xây một trụ sở dịch vụ (Trạm Điện lực, Tháp Nước, Trạm Cứu hỏa…) để có đội điều phối.</p>'));
 },
 specialists(b){
  const s=this.sim,key=coord(b.x,b.y);
  const rows=Object.entries(CONFIG.specialist.skills).map(([id,name])=>{
   const {level,goal,materials,prestige,block}=s.crisis.skillState(b,id);
   return '<div class="row"><div class="grow"><b>'+name+' · '+level+'/3</b><small>'+(id==="routing"?"+8% tốc độ di chuyển mỗi cấp":"+10% tốc độ khắc phục mỗi cấp")+'</small>'+
    (goal?'<small>'+b.missions+'/'+goal+' ca · '+prestige+' Uy tín · '+this.materialCost(materials)+'</small>':"")+
    (block?'<small>'+htm(block)+'</small>':"")+'</div>'+
    this.btn("train-specialist","Đào tạo",{id:key,arg:id,cls:"primary",disabled:!!block})+'</div>';
  }).join("");
  this.open("specialists","ĐỘI PHẢN ỨNG","Kỹ năng chuyên viên",'<p class="muted">'+CONFIG.buildings[b.id].name+' · Kỹ năng áp dụng từ lần điều phối tiếp theo.</p>'+rows+this.btn("teams","Về danh sách đội"));
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
   (level>=CONTENT.operationLevel?'<p class="muted">Nhiệm vụ vận hành cho thêm XP theo cấp Thị trưởng, không cần xây hay phá công trình.</p>':"")+
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
   const tech=R.all.find(x=>x.id===t.id),level=s.tech(t.id),block=s.researchBlock(tech),max=level>=R.maxLevel,locked=tech.prev&&!s.tech(tech.prev),advanced=R.advanced[level-3];
   return (i?'<div class="link'+(locked?"":" on")+'"></div>':"")+'<div class="tech'+(locked?" locked":"")+(max?" max":"")+'"><div class="pips">'+Array.from({length:R.maxLevel},(_,k)=>'<i class="'+(k<level?"on":"")+'" style="--c:'+branch.color+'"></i>').join("")+'</div><b>'+t.name+'</b><small>'+t.desc+'</small>'+
    (level?'<small class="mint">Đang có: '+t.unit.replace(/\d+/,n=>n*level)+'</small>':"")+
    (advanced?'<small>Cấp '+(level+1)+' · Thị trưởng '+advanced.mayor+' · '+this.materialCost(advanced.materials)+'</small>'+(block?'<small>'+htm(block)+'</small>':""):"")+
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
  let body=this.tabbar("profile",[["me","Hồ sơ"],["skin","Skin"],["inventory","Vật liệu"],["account","Tài khoản"],["settings","Cài đặt"]]);
  if(tab==="me"){
   const hours=Math.floor(st.playTime/3600),minutes=Math.floor(st.playTime/60)%60;
   const cells=[["Điểm đô thị",fmt(m.score)],["Thu nhập cao nhất",fmt(st.peakIncome,1)+" V/s"],["Dân số cao nhất",fmt(st.peakPop)],["Sự cố đã xử lý",fmt(st.crisesSolved)],["Chuỗi tốt nhất","×"+st.bestCombo],["Công trình đã xây",fmt(st.buildingsBuilt)],["Lượt nâng cấp",fmt(st.upgrades)],["Túi thuế đã thu",fmt(st.bubbles)],["Cấp nghiên cứu",st.research+" / "+(CONTENT.research.all.length*CONFIG.researchMax)],["Lượt chi viện",fmt(p.helpsGiven)],["Ngày điểm danh",fmt(st.loginDays)],["Thời gian chơi",hours+" giờ "+minutes+" phút"]];
   body+='<div class="hero">'+this.face(p.avatar,p.level)+'<div class="grow"><h3>'+htm(p.mayorName)+'</h3><small>'+rank.name+' '+htm(p.cityName)+' · Mã '+p.mayorId+'</small>'+
    (rank.next?this.bar(m.score/rank.next[0])+'<small>Còn '+fmt(Math.max(0,rank.next[0]-m.score))+' điểm đô thị để thành «'+rank.next[1]+'»</small>':'<small class="mint">Danh hiệu cao nhất!</small>')+'</div></div>'+
    '<div class="inline"><input id="mayor-name" maxlength="40" value="'+htm(p.mayorName)+'" aria-label="Tên Thị trưởng"><input id="city-name" maxlength="24" value="'+htm(p.cityName)+'" aria-label="Tên thành phố">'+this.btn("save-name","Lưu tên",{cls:"primary"})+'</div>'+
    '<h4>Chân dung Thị trưởng</h4><div class="avatar-grid">'+CONFIG.avatars.pick.map(n=>'<button type="button" data-act="avatar" data-id="'+n+'" title="'+CONFIG.avatars.roles[n-1]+'" aria-label="'+CONFIG.avatars.roles[n-1]+'" aria-pressed="'+(p.avatar===n)+'"'+(p.avatar===n?' class="active"':"")+'>'+this.avatar(n)+'</button>').join("")+'</div>'+
    '<div class="statgrid">'+cells.map(([k,v])=>'<div><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>';
  }else if(tab==="skin")body+=this.skinPanel();
  else if(tab==="inventory")body+=this.inventoryPanel();
  else if(tab==="account"){
   if(!cloud?.enabled)body+='<p class="empty">Bạn đang mở trò chơi trực tiếp từ tệp. Tiến độ được lưu trong trình duyệt. Chạy máy chủ (npm start) để dùng lưu đám mây, bảng xếp hạng toàn cầu và kết bạn trực tuyến.</p>';
   else if(cloud.status==="expired")body+='<p class="empty">Phiên đăng nhập đã hết hạn (có thể do đổi mật khẩu ở thiết bị khác). Thành phố vẫn được lưu trên trình duyệt này.</p><div class="actions">'+this.btn("auth","Đăng nhập lại",{id:"relogin",cls:"primary"})+'</div>';
   else if(!cloud.online)body+='<p class="empty">Không kết nối được máy chủ. Trò chơi vẫn tự lưu trên trình duyệt và sẽ đồng bộ lại khi tải lại trang.</p>';
   else{
    const a=cloud.account,field=(id,label,type,auto,hint="")=>'<label>'+label+'<input id="'+id+'" '+(type==="password"?'type="password" maxlength="72"':'maxlength="20" autocapitalize="none" spellcheck="false"')+' autocomplete="'+auto+'" placeholder="'+hint+'"></label>';
    body+='<div class="row"><div class="grow"><b>'+(a.username?"Tài khoản: "+htm(a.username):"Tài khoản khách")+'</b><small>Mã thành phố: <span class="mint">'+a.code+'</span> · '+(cloud.lastSync?"đồng bộ lần cuối "+new Date(cloud.lastSync).toLocaleTimeString("vi-VN"):"chưa đồng bộ trong phiên này")+'</small></div>'+
     (cloud.conflict?this.btn("save-conflict","So sánh bản lưu",{cls:"primary"}):this.btn("sync","Đồng bộ ngay",{cls:"primary"}))+'</div>';
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
      '<small>'+(mode==="register"?"Thành phố hiện tại sẽ được gắn vào tài khoản mới.":"Bản lưu khách vẫn được giữ riêng trên thiết bị này.")+'</small><p id="auth-message" role="status"></p></form>';
    }
   }
  }else{
   const volume=Math.round(s.audio.musicVolume*100);
   body+='<div class="row"><div class="grow"><b>Hiệu ứng âm thanh</b><small>Âm thanh khi xây dựng, nhận thưởng và thao tác.</small></div>'+this.btn("sound",s.audio.enabled?"Đang bật · Tắt":"Đang tắt · Bật")+'</div>'+
    '<div class="row"><div class="grow"><b>Nhạc nền</b><small>Turning Pages — Kanto Daydream</small></div>'+this.btn("music",s.audio.musicEnabled?"Đang bật · Tắt":"Đang tắt · Bật")+'</div>'+
    '<div class="row music-volume"><label for="music-volume">Âm lượng nhạc nền</label><input id="music-volume" type="range" min="0" max="100" value="'+volume+'"><output id="music-volume-value" for="music-volume">'+volume+'%</output></div>'+
    '<div class="row"><div class="grow"><label for="graphics-quality"><b>Chất lượng đồ họa</b></label><small>Tiết kiệm pin giúp giảm tải khi chơi lâu trên điện thoại.</small></div><select id="graphics-quality">'+Object.entries(GRAPHICS).map(([id,q])=>'<option value="'+id+'"'+(this.renderer.qualityId===id?' selected':'')+'>'+q.label+'</option>').join("")+'</select></div>'+
    '<div class="row"><div class="grow"><b>Giảm hiệu ứng</b><small>Tắt rung nảy, pháo giấy, hiệu ứng thu thưởng và chớp sáng.</small></div>'+this.btn("reduce-effects",s.reduceEffects?"Đang bật · Tắt":"Đang tắt · Bật")+'</div>'+
    '<div class="row"><div class="grow"><b>Hướng dẫn tân thủ</b><small>Xem lại các bước làm quen cùng thư ký Mai.</small></div>'+this.btn("replay-tutorial","Xem lại")+'</div>'+
    '<div class="row"><div class="grow"><b>Cẩm nang Thị trưởng</b><small>Giải thích mọi hệ thống trong trò chơi.</small></div>'+this.btn("help","Mở cẩm nang")+'</div>'+
    '<div class="row"><div class="grow"><b>Chơi lại từ đầu</b><small>Xóa toàn bộ tiến độ.</small></div>'+this.btn("reset","Xóa bản lưu",{cls:"danger"})+'</div>';
  }
  if(tab==="account"&&!cloud?.online&&cloud?.conflict)body+=this.btn("save-conflict","So sánh bản lưu",{cls:"primary"});
  this.open("profile","THỊ TRƯỞNG","Hồ sơ & Cài đặt",body,true);
 },
 saveConflict(confirm=false){
  const pending=this.sim.cloud.conflict;if(!pending)return;
  const {local,remote}=pending;
  const card=(name,data,updatedAt)=>{
   const p=CONFIG.saveProgress(data),at=updatedAt||data?.lastSavedAt;
   return '<div class="card"><b>'+name+'</b><small>'+(data?'Thị trưởng cấp '+p.level+' · '+p.buildings+' công trình':'Không có thành phố')+
    '</small><small>'+htm(at?new Date(at).toLocaleString("vi-VN"):"Không rõ thời gian lưu")+'</small></div>';
  };
  this.open("save-conflict","ĐỒNG BỘ THÀNH PHỐ",confirm?"Thay bản lưu có nhiều tiến độ hơn?":"Chọn bản lưu để chơi tiếp",
   '<p class="muted">'+(confirm?"Dùng bản trên thiết bị sẽ thay thế thành phố đã tiến xa hơn trên máy chủ. Chỉ xác nhận nếu bạn muốn bỏ phần tiến độ chênh lệch.":
    "Đồng bộ đã tạm dừng. Game sẽ không tự ghi đè. Hãy so sánh hai bản trước khi chọn.")+'</p>'+
   card("Trên thiết bị này",local)+(remote?card("Trên máy chủ",remote.data,remote.updatedAt):'<p class="warn">Chưa tải được bản trên máy chủ.</p>')+
   '<div class="actions">'+(confirm?this.btn("save-conflict-choose","Xác nhận thay bản máy chủ",{id:"replace",cls:"danger"})+this.btn("save-conflict","Quay lại"):
    remote?this.btn("save-conflict-choose","Dùng bản máy chủ",{id:"cloud",cls:"primary"})+this.btn("save-conflict-choose","Dùng bản thiết bị",{id:"local"}):
    this.btn("save-conflict-choose","Thử tải lại",{id:"retry",cls:"primary"}))+'</div>');
 },
 inventoryPanel(){
  const s=this.sim,{unlocked,claimed,yields,ready}=s.supplyState();
  const status=!unlocked?"Mở sản xuất ở cấp Thị trưởng "+CONFIG.supplyLevel:claimed?"Đã thu lô hôm nay":ready?"Lô hôm nay đã sẵn sàng":"Cần hoàn thành ít nhất một công trình sản xuất";
  return '<h3>Kho vật liệu</h3><p class="muted">Nâng cấp công trình từ cấp 11 cần vật liệu. Bạn cũng có thể nhận từ nhiệm vụ ngày, sự kiện và thư quà.</p>'+
   '<div class="statgrid">'+Object.entries(CONFIG.materials).map(([key,name])=>'<div><small>'+name+'</small><b>'+fmt(s.profile.materials?.[key]||0)+'</b></div>').join("")+'</div>'+
   '<h4>Sản xuất trong thành phố</h4><p class="muted">Thu một lô mỗi ngày (giờ Việt Nam), kể cả khi chơi ngoại tuyến. Cứ 4 cấp nâng cấp, mỗi cơ sở sản xuất thêm 1 vật liệu.</p>'+
   Object.entries(CONFIG.supplySources).map(([key,[id,,max]])=>'<div class="row"><div class="grow"><b>'+CONFIG.buildings[id].name+'</b><small>'+CONFIG.materials[key]+' · Tối đa '+max+'/ngày</small></div>'+
    '<b>+'+yields[key]+'</b></div>').join("")+
   '<div class="row"><div class="grow"><small>'+status+'</small></div>'+this.btn("collect-supplies","Thu vật liệu",{cls:"primary",disabled:!ready})+'</div>'+
   '<div class="actions">'+this.btn("land","Mở rộng địa giới")+this.btn("wonder","Dự án Kỳ quan")+'</div>';
 },
 materialCost(cost){return Object.entries(cost).map(([id,n])=>fmt(n)+" "+CONFIG.materials[id]).join(" · ")},
 landDialog(){
  const {size,plan,block}=this.sim.landState();
  this.open("land","QUY HOẠCH","Mở rộng địa giới",'<p>Bản đồ hiện tại: <b>'+size+' × '+size+' ô</b>. Đất mua thêm nằm ở rìa đông và nam; công trình cũ giữ nguyên vị trí.</p>'+
   (plan?'<div class="card"><b>Mở địa giới '+(size+2)+' × '+(size+2)+' ô</b><small>Thị trưởng cấp '+plan.mayor+' · '+fmt(plan.coins)+' Vàng · '+this.materialCost(plan.materials)+'</small>'+
    (block?'<small>'+htm(block)+'</small>':"")+'</div><div class="actions">'+this.btn("buy-land","Mua địa giới",{cls:"primary",disabled:!!block})+'</div>':'<p class="mint">'+block+'</p>'));
 },
 wonderDialog(){
  const {stage,readyAt,block}=this.sim.wonderState();
  this.wonderShownStage=stage;
  this.open("wonder","DI SẢN ĐÔ THỊ","Dự án Kỳ quan",'<p class="muted">Mỗi giai đoạn cộng thêm 6 điểm phần trăm vào thưởng thu nhập khi có Kỳ quan đang hoạt động. Chỉ triển khai một dự án cho cả thành phố.</p>'+
   CONFIG.wonderPhases.map((p,i)=>'<div class="row"><div class="grow"><b>'+(i+1)+'. '+p.name+'</b><small>Thị trưởng '+p.mayor+' · Kỳ quan cấp '+p.level+' · '+fmt(p.coins)+' Vàng</small><small>'+this.materialCost(p.materials)+' · '+timer(p.seconds)+'</small>'+
    (i===stage&&readyAt?'<small class="mint">Đang thi công · còn '+timer((readyAt-Date.now())/1000)+'</small>':i===stage&&block?'<small>'+htm(block)+'</small>':"")+'</div>'+
    (i<stage?'<b class="mint">Đã xong</b>':i===stage&&!readyAt?this.btn("start-wonder","Khởi công",{cls:"primary",disabled:!!block}):"")+'</div>').join(""));
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
 skinPanel(){
  const {profile,cloud}=this.sim,active=profile.skin||"default";
  const selected=Object.hasOwn(MAYOR_SKINS,this.skinPreview)?this.skinPreview:active;
  const [name,description]=MAYOR_SKINS[selected],owned=cloud?.ownsSkin(selected);
  const housePreview=id=>asset("img/"+(id==="default"?"bld":"skins/"+id)+"/house_small/thumb.webp");
  const hint=selected==="cyberpunk"?"Đăng nhập trực tuyến đủ 7 ngày khác nhau (không cần liên tiếp). "+(cloud?.token?"Tiến độ: "+(cloud.ownership?.loginDays||0)+"/7.":"Cần tài khoản, kể cả tài khoản khách."):"Nhận bộ skin qua thư quà từ ban điều hành.";
  return '<p class="muted">Một bộ skin áp dụng cho toàn bộ công trình của thành phố, không thay đổi chỉ số.</p><div class="skin-grid">'+
   Object.entries(MAYOR_SKINS).map(([id,[label]])=>this.btn("skin-preview",
    '<img src="'+housePreview(id)+'" width="64" height="64" alt=""><b>'+label+'</b><small>'+
    (id===active?"Đang dùng":cloud?.ownsSkin(id)?"Đã sở hữu":"Chưa sở hữu")+'</small>',
    {id,cls:"skin-choice"+(id===selected?" active":"")+(cloud?.ownsSkin(id)?"":" locked")})).join("")+
   '</div><div class="row skin-preview"><img src="'+housePreview(selected)+
   '" width="112" height="94" alt="Nhà mẫu bộ '+name+'"><div class="grow"><b>'+name+'</b><p>'+description+'</p><small>'+(!owned?hint:"")+'</small>'+
   this.btn("skin-equip",selected===active?"Đang sử dụng":owned?"Áp dụng cho thành phố":"Chưa mở khóa",{id:selected,cls:"primary",disabled:!owned||selected===active})+'</div></div>';
 },
 async loadAnnouncements(){
  if(this.loadedAnnouncements||!navigator.onLine)return;
  this.loadedAnnouncements=true;
  try{
   const day=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
   try{if(localStorage.getItem("mp-announcement-hide")===day)return}catch(_){}
   const rows=await this.sim.cloud.announcements();
   if(rows.length)this.sim.pending.unshift({type:"announcements",rows});
  }catch(error){this.loadedAnnouncements=false;throw error}
 },
 announcementsDialog(rows){
  this.open("announcements","TIN TỪ BAN ĐIỀU HÀNH","Thông báo thành phố",rows.map(row=>
   '<article class="announcement"><h3>'+htm(row.title)+'</h3>'+(row.image?'<img src="'+htm(row.image)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':"")+
   '<p class="message-body">'+htm(row.body)+'</p></article>').join("")+'<div class="actions">'+
   this.btn("announcement-hide","Không hiện lại hôm nay")+this.btn("close-dialog","Vào thành phố",{cls:"primary"})+'</div>');
 },
 hideAnnouncements(){
  try{localStorage.setItem("mp-announcement-hide",new Date(Date.now()+7*3600000).toISOString().slice(0,10))}catch(_){}
  this.close();
 },
 async refreshMailbox(){
  const r=await this.sim.cloud.mailbox();
  this.mail=r.gifts||[];this.letters=r.letters||[];this.unreadLetters=r.unread||0;
 },
 mailDialog(){
  const gifts=this.mail.map(g=>'<div class="row"><div class="grow"><b>'+htm(g.fromName)+' đã chi viện thành phố của bạn</b><small>'+new Date(g.createdAt).toLocaleString("vi-VN")+'</small></div><b class="gold">+'+fmt(g.coins)+' V</b></div>').join("");
  const rows=this.letters.map(({id,title,body,createdAt,claimedAt,rewards:r})=>{
   const prize=[this.reward({coins:r.coins,prestige:r.prestige,know:r.knowledge,materials:r.materials}),r.skin&&"Skin "+MAYOR_SKINS[r.skin]?.[0]].filter(Boolean).join(" · ");
   return '<article class="mail-letter"><div><b>'+htm(title)+'</b><small>'+new Date(createdAt).toLocaleString("vi-VN")+'</small></div><p class="message-body">'+htm(body)+'</p>'+
    (prize?'<p>'+prize+'</p>':"")+this.btn("letter-claim",claimedAt?"Đã xem":prize?"Nhận quà":"Đánh dấu đã xem",{id,cls:"primary",disabled:!!claimedAt||this.receivingLetter===id})+'</article>';
  }).join("");
  this.open("mail","THƯ TỪ THÀNH PHỐ","Hộp thư",(rows||gifts?"":'<p class="empty">Hộp thư trống.</p>')+rows+gifts+
   (gifts?'<div class="actions">'+this.btn("mail-claim","Nhận quà chi viện",{cls:"primary"})+'</div>':""));
 },
 async claimLetter(id){
  const row=this.letters.find(letter=>letter.id===id);
  if(this.receivingLetter||!row||row.claimedAt)return;
  this.receivingLetter=id;this.mailDialog();
  try{
   const r=await this.sim.cloud.claimLetter(row);
   row.claimedAt=r.claimedAt;
   this.unreadLetters=Math.max(0,this.unreadLetters-1);
   if(Object.keys(r.rewards).length)this.toast("Đã nhận quà từ thư.");
   await this.refreshMailbox().catch(()=>{});
  }catch(error){this.toast(error.message);if(error.status===409)await this.refreshMailbox().catch(()=>{})}
  finally{this.receivingLetter=null;if(this.dialogType==="mail")this.mailDialog();this.refresh()}
 },
 async claimMail(){
  try{
   const r=await this.sim.cloud.claimMail();this.mail=[];this.close();
   if(r.coins){this.sim.earn(r.coins);this.sim.audio.play("money");this.sim.storage.save();this.toast("Nhận "+fmt(r.coins)+" Vàng từ "+r.count+" lượt chi viện của bạn bè.")}
  }catch(error){this.toast(error.message)}
  this.refresh();
 },
 levelUp(level){
  const fresh=Object.values(CONFIG.buildings).filter(d=>d.unlock===level),grew=CONFIG.radius(level)>CONFIG.radius(level-1),gate=CONFIG.tierMayors.indexOf(level);
  const milestone=level>=20&&level%5===0,reward=CONFIG.mayorReward(level);
  if(!this.sim.reduceEffects)GameArt.celebration();
  const confetti=this.sim.reduceEffects?"":'<span class="level-confetti" aria-hidden="true">'+Array.from({length:18},(_,i)=>'<i data-confetti-art="confetti-'+["clay","blue","sage","gold"][i%4]+'" style="--x:'+((i*31)%96)+'%;--drift:'+((i*13)%75-37)+'px;--angle:'+(90+i*33)+'deg;--delay:'+(i%6*.045)+'s"></i>').join("")+'</span>';
  this.open("level",milestone?"CỘT MỐC THỊ TRƯỞNG":"THĂNG CẤP","Thị trưởng cấp "+fmt(level)+"!",'<div class="levelup level-celebration">'+confetti+'<span class="profile-level big"><b>'+fmt(level)+'</b><small>CẤP</small></span><p>Thưởng: '+this.reward(reward)+'</p></div>'+
   (level===CONFIG.utilityXP.level?'<p class="mint">Giữ đủ điện và nước để kiếm thêm '+CONFIG.utilityXP.perSecond*60+' XP/phút khi chơi, đến cấp 5.</p>':"")+
   (grew?'<div class="row"><div class="grow"><b>Mở rộng địa giới</b><small>Bản đồ nới thêm một vòng đất: '+CONFIG.radius(level)*2+' × '+CONFIG.radius(level)*2+' ô.</small></div></div>':"")+
   (gate>0?'<div class="row"><div class="grow"><b>Bậc tiến hóa mới</b><small>Mở bậc '+CONFIG.tierNamesRoman[gate]+' (công trình cấp '+CONFIG.tierMin[gate]+'–'+((CONFIG.tierMin[gate+1]||CONFIG.maxLevel+1)-1)+').</small></div></div>':"")+
   (CONFIG.landPlans.some(plan=>plan.mayor===level)?'<div class="row"><div class="grow"><b>Mở rộng địa giới</b><small>Có thể mua thêm đất trong Kho vật liệu.</small></div></div>':"")+
   (fresh.length?'<h4>Bản vẽ mới</h4><div class="unlocks">'+fresh.map(d=>'<div><img src="'+this.thumbs[d.id]+'" alt=""><b>'+d.name+'</b><small>'+d.desc+'</small></div>').join("")+'</div>':"")+
   '<div class="actions">'+this.btn("welcome","Tiếp tục xây dựng",{cls:"primary"})+'</div>');
 },
 offline(result){
  this.open("offline","THU NHẬP NGOẠI TUYẾN","Chào mừng trở lại!",'<p>Thành phố đã tự vận hành trong <b>'+timer(result.seconds)+'</b> (trần '+Math.round(result.cap/3600)+' giờ). Bạn nhận <b class="gold">+'+fmt(result.coins)+' Vàng</b>'+(result.know?' và <b class="teal">+'+fmt(result.know)+' Tri thức</b>':'')+' với hiệu suất ngoại tuyến '+Math.round(result.rate*100)+'%.</p><p class="muted">Nghiên cứu «Quỹ dự trữ đô thị» và xây Ngân hàng để nâng trần ngoại tuyến.</p><div class="actions">'+this.btn("welcome","Vào thành phố",{cls:"primary"})+'</div>');
 },
 help(section){
  const pages={
   start:["Bắt đầu",'<p>Bạn là Thị trưởng mới của thị trấn Bình Minh. Ngân sách tăng mỗi giây; hãy dùng Vàng để <b>xây</b> và <b>nâng cấp</b> công trình, giữ cho cư dân hạnh phúc và xử lý sự cố kịp thời.</p><ul><li><b>Xây dựng:</b> mở Kho bản vẽ, chọn công trình rồi chạm ô đất sáng xanh. Với Đường nhựa, kéo để vẽ liên tiếp.</li><li><b>Túi thuế:</b> thỉnh thoảng công trình nổi túi Vàng, ✦ Tri thức hoặc '+this.icon("prestige")+' Uy tín — chạm để thu.</li><li><b>Nhiệm vụ:</b> làm theo cốt truyện 6 chương để mở khóa dần mọi hệ thống.</li><li><b>Phím tắt:</b> B Xây dựng · N Nhiệm vụ · R Nghiên cứu · F Bạn bè · Esc hủy · +/− thu phóng.</li></ul>'],
   build:["Công trình & Quy hoạch",'<ul><li><b>25 cấp, 6 bậc:</b> mỗi cấp +35% thu nhập cơ bản. Bậc II–VI mở ở cấp Thị trưởng 5, 10, 16, 21 và 26. Nâng lên cấp 11 trở đi cần vật liệu và thời gian thi công; công trình vẫn hoạt động ở cấp hiện tại cho tới khi nâng xong.</li><li><b>Vật liệu:</b> hoàn thành thưởng nhiệm vụ ngày từ cấp 16 hoặc đạt cột mốc Thị trưởng từ cấp 20.</li><li><b>Chuyên môn hóa:</b> đạt cấp 5, mỗi công trình chọn một trong hai hướng — không đổi lại được.</li><li><b>Nối đường:</b> công trình có thu nhập mà không kề đường bị −20%.</li><li><b>Công viên:</b> nhà và cửa hàng kề công viên +10% (tối đa +20%).</li><li><b>Dân cư ↔ Thương mại:</b> cửa hàng kề nhà +5% mỗi nhà (tối đa +15%). Ga Metro +15% cho cửa hàng trong 2 ô.</li><li><b>Ô nhiễm:</b> nhà kề Trạm Điện lực hoặc Trạm Xử lý Rác làm giảm Hạnh phúc.</li><li><b>Điện, nước:</b> thiếu nguồn làm giảm Hạnh phúc và tăng nguy cơ sự cố.</li></ul>'],
   crisis:["Sự cố & Đội NPC",'<ul><li>Sự cố sinh ra từ <b>áp lực hạ tầng</b>: thiếu điện/nước, thời tiết, rác, mật độ thương mại…</li><li>Bấm thẻ cảnh báo hoặc biểu tượng trên bản đồ để <b>điều phối</b>. Đội chạy theo đường nhựa; đi ngoài đường rất chậm.</li><li>Xử lý trước ngưỡng nguy hiểm để giữ <b>chuỗi phản ứng</b>: thêm XP và Uy tín.</li><li><b>Nâng xe</b> để đi và sửa nhanh hơn; <b>tuyển thêm người</b> để xử lý nhiều sự cố cùng lúc.</li><li><b>Quân hàm:</b> đội làm 5 / 15 / 40 nhiệm vụ sẽ lên Lành nghề / Tinh nhuệ / Huyền thoại, sửa nhanh hơn tới 35%.</li><li>Hỏa hoạn lan sau 45 giây; mất điện chặn xây dựng xung quanh.</li></ul>'],
   grow:["Tri thức, Sắc lệnh & Thư",'<ul><li><b>Tri thức ✦</b> sinh từ Trường học, Đại học, Bảo tàng, Trung tâm An ninh Mạng, Tháp Công nghệ. Dùng ở <b>Viện Quy hoạch</b> để nghiên cứu 12 công nghệ.</li><li><b>Sắc lệnh:</b> ba hiệu ứng mạnh có thời hạn, mỗi lúc chỉ một sắc lệnh.</li><li><b>Thư quyết định:</b> cư dân và đối tác gửi đề nghị; mỗi lựa chọn có lợi và hại riêng.</li><li><b>Danh hiệu đô thị:</b> Điểm đô thị (dân số, thu nhập, cấp công trình) nâng Bình Minh từ Thị trấn lên Đô thị huyền thoại.</li></ul>'],
   daily:["Mỗi ngày & Bạn bè",'<ul><li><b>Điểm danh</b> 7 ngày liên tục để mở Rương Thị trưởng.</li><li><b>3 nhiệm vụ ngày</b> làm mới lúc nửa đêm; xong cả ba mở thêm rương.</li><li><b>Thành tựu</b> có 3 bậc, thưởng Uy tín.</li><li><b>Thu nhập ngoại tuyến:</b> thành phố vẫn thu tiền khi bạn vắng mặt (trần 8 giờ, nâng được).</li><li><b>Bạn bè:</b> thăm thành phố bạn, chi viện tối đa 5 lượt/ngày để nhận thưởng. Khi kết nối máy chủ, bạn có thể kết bạn bằng mã, xem xếp hạng toàn máy chủ và nhận quà cảm ơn.</li></ul>']
  };
  this.helpPage=pages[section]?section:"start";
  this.open("help","CẨM NANG THỊ TRƯỞNG",pages[this.helpPage][0],'<div class="tabs">'+Object.entries(pages).map(([id,[title]])=>this.btn("help",title,{id,cls:id===this.helpPage?"active":""})).join("")+'</div><div class="guide">'+pages[this.helpPage][1]+'</div>',true);
 }
};
Object.assign(UIController.prototype,UIDialogs);
