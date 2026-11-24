"use strict";

class UIController {
 constructor(sim,renderer){
  this.sim=sim;this.renderer=renderer;renderer.ui=this;this.canvas=renderer.canvas;
  this.tool="look";this.selection=null;this.moving=null;this.inspect=null;this.category="all";this.dialogType="";this.catalogOpen=false;
  this.tabs={missions:"story",social:"friends",profile:"me",account:"register"};this.rank="score";this.rankScope="friends";this.globalRows=null;this.mail=[];
  this.pointers=new Map();this.gesture=null;this.ownCamera=null;this.nodes={};this.newsCursor=0;this.displayedNews=[];this.newsAt=-30;this.sceneState=null;
  for(const id of ["logo","stats","clock","cloud","sound","profile","maplabel","visit","side","filters","catalog","right","inspect","fab","zoom","center","hint","toast","news","dock","dialog","dialog-tag","dialog-title","dialog-body","scene","scene-body","coach"])this.nodes[id]=document.getElementById(id);
  this.nodes.logo.innerHTML=this.icon("pulse");this.nodes.center.innerHTML=this.icon("center");
  document.getElementById("help").innerHTML=this.icon("book");document.getElementById("settings").innerHTML=this.icon("settings");
  this.thumbs=Object.fromEntries(Object.keys(CONFIG.buildings).map(id=>[id,renderer.thumbnail(id)]));
  this.menu=[["look","Quan sát","center"],["build","Xây dựng","build"],["teams","Đội NPC","crew"],["policies","Sắc lệnh","policy"],["missions","Nhiệm vụ","target"],["research","Nghiên cứu","flask"],["social","Bạn bè","social"],["move","Di chuyển","move"],["demo","Phá dỡ","demo"]];
  this.sim.say("Chào mừng đến Bình Minh! Hãy xây thêm nhà và nối đường để thị trấn sống lại.");
  document.addEventListener("pointerdown",()=>sim.audio.unlock(),{passive:true});
  document.addEventListener("submit",e=>{const kind=e.target.dataset?.auth;if(kind){e.preventDefault();this.auth(kind)}});
  document.addEventListener("keydown",e=>{
   sim.audio.unlock();
   if(this.sceneState){if(e.key==="Enter"||e.key===" "||e.key==="Escape"){e.preventDefault();this.sceneNext()}return}
   if(this.nodes.dialog.open||e.target.matches("input,textarea"))return;
   if(e.key==="Escape"){this.setTool("look");this.catalogOpen=false;this.refresh()}
   if(e.key==="+"||e.key==="=")this.renderer.zoom(1.14);
   if(e.key==="-")this.renderer.zoom(1/1.14);
   const hot={b:"build",n:"missions",r:"research",f:"social"}[e.key.toLowerCase()];
   if(hot&&!e.ctrlKey&&!e.metaKey){const button=this.nodes.dock.querySelector('[data-act="'+hot+'"]');if(button&&!button.disabled)button.click()}
  });
  document.addEventListener("click",e=>{const btn=e.target.closest("button[data-act]");if(btn&&!btn.disabled){sim.audio.play(btn.dataset.act==="tab"?"tab":"click");this.action(btn)}});
  this.nodes.dialog.addEventListener("close",()=>{this.dialogType="";this.refresh()});
  this.wireCanvas();this.refresh(true);
 }
 icon(id){
  const paths={
   pulse:'<path d="M2 13h5l4-8 3 14 3-6h5"/>',
   coin:'<circle cx="12" cy="12" r="8"/><path d="M10 9h3.5a1.5 1.5 0 0 1 0 3H11a1.5 1.5 0 0 0 0 3H15M12 7v10"/>',
   gem:'<path d="M3 8l4-5h10l4 5-9 13zM3 8h18M8 8l4 13 4-13"/>',
   brain:'<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3.5 3.5 0 0 0 2 6 3 3 0 0 0 6 1V5a2 2 0 0 0-3-2zM15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3.5 3.5 0 0 1-2 6 3 3 0 0 1-6 1"/>',
   crew:'<circle cx="9" cy="7" r="3"/><path d="M3 19v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2zm14-7a4 4 0 0 1 4 4v3h-3M16 4a3 3 0 0 1 0 6"/>',
   happy:'<circle cx="12" cy="12" r="9"/><path d="M7.5 13.5a5 5 0 0 0 9 0M9 9h.01m6 0h.01"/>',
   power:'<path d="M13 2 5 13h6l-1 9 9-12h-6z"/>',
   water:'<path d="M12 2c-1.9 4.3-6 7.5-6 12a6 6 0 0 0 12 0c0-4.5-4.1-7.7-6-12zM9 14c0 2 1 3 3 3"/>',
   sound:'<path d="M3 9h4l5-4v14l-5-4H3zM15 9c2 2 2 4 0 6m3-9c4 4 4 8 0 12"/>',
   mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
   settings:'<circle cx="12" cy="12" r="3"/><path d="m10 3-.8 2.3-2 .8-2.2-1-2 3.4 1.7 1.6v2.8L3 15l2 3.4 2.2-1 2 .8L10 21h4l.8-2.8 2-.8 2.2 1 2-3.4-1.7-2.1v-2.8L21 8.5l-2-3.4-2.2 1-2-.8L14 3z"/>',
   build:'<path d="M3 20h18M5 19V9l7-5 7 5v10M9 19v-5h6v5M9 10h.01m6 0h.01"/>',
   policy:'<path d="M5 3h11l3 3v15H5zM15 3v5h4M8 12h8m-8 4h8"/>',
   target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
   flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9"/>',
   social:'<path d="M3 18V7h18v11M3 11h18M8 7V4h8v3M7 18h3v3H7zm7 0h3v3h-3z"/>',
   center:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="3"/>',
   move:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
   demo:'<path d="M4 7h16M8 7V4h8v3m2 0-1 13H7L6 7m4 3v7m4-7v7"/>',
   gift:'<path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7c-2 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-3 3-5 3z"/>',
   mail:'<path d="M3 5h18v14H3zM3 6l9 7 9-7"/>',
   book:'<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5v15"/>',
   cloud:'<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10.5a3.8 3.8 0 0 1-.5 7.5z"/>',
   star:'<path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
   check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[id]+"</svg>";
 }
 // Chân dung nhân vật vẽ bằng SVG, không dùng ảnh ngoài.
 portrait(id){
  const c=CONTENT.cast[id],top='<path d="M29 50c-4-24 8-34 21-34s25 10 21 34c-2-10-5-16-8-19-8 3-18 3-26 0-3 3-6 9-8 19z"/>';
  const hair={
   bob:top+'<path d="M29 44v17c3 1 6 0 7-3zM71 44v17c-3 1-6 0-7-3z"/>',
   long:top+'<path d="M28 44c-2 14-2 27 2 37h9c-5-10-6-22-5-33zM72 44c2 14 2 27-2 37h-9c5-10 6-22 5-33z"/>',
   bun:top+'<circle cx="50" cy="15" r="8"/>',
   slick:'<path d="M30 43c-2-18 8-27 20-27s22 9 20 27c-3-8-7-12-12-13-8 2-16 1-22-2-3 3-5 8-6 15z"/>',
   helmet:'<path d="M31 46c-1-6 0-10 2-13h34c2 3 3 7 2 13-1-4-3-7-5-9H36c-2 2-4 5-5 9z"/>',
   glasses:'<path d="M30 43c-2-18 8-27 20-27s22 9 20 27c-3-8-7-12-12-13-8 2-16 1-22-2-3 3-5 8-6 15z"/>'
  }[c.style];
  const extra=c.style==="helmet"?'<path d="M28 38c0-15 10-24 22-24s22 9 22 24z" fill="#ffce4d"/><path d="M24 37h52v5H24z" fill="#e9ad2f"/>':
   c.style==="glasses"?'<g fill="none" stroke="#22303a" stroke-width="2"><circle cx="42" cy="47" r="6.5"/><circle cx="58" cy="47" r="6.5"/><path d="M48.5 47h3"/></g>':"";
  return '<svg class="portrait" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="'+c.shirt+'" opacity=".22"/><clipPath id="clip-'+id+'"><circle cx="50" cy="50" r="50"/></clipPath><g clip-path="url(#clip-'+id+')">'+
   '<path d="M12 104c2-22 17-30 38-30s36 8 38 30z" fill="'+c.shirt+'"/><path d="M43 62h14v14a7 7 0 0 1-14 0z" fill="'+c.skin+'" opacity=".82"/>'+
   '<ellipse cx="50" cy="46" rx="19" ry="22" fill="'+c.skin+'"/><g fill="'+c.hair+'">'+hair+'</g>'+
   '<circle cx="42" cy="47" r="2.2" fill="#262a2e"/><circle cx="58" cy="47" r="2.2" fill="#262a2e"/><path d="M43 57q7 6 14 0" fill="none" stroke="#7a3b32" stroke-width="2.2" stroke-linecap="round"/>'+extra+'</g></svg>';
 }
 html(id,value){const el=this.nodes[id];if(el._mp!==value){el.innerHTML=value;el._mp=value}}
 text(id,value){if(this.nodes[id].textContent!==value)this.nodes[id].textContent=value}
 btn(act,label,opts={}){
  return '<button type="button" data-act="'+act+'"'+(opts.id!==undefined?' data-id="'+htm(opts.id)+'"':"")+(opts.arg!==undefined?' data-arg="'+htm(opts.arg)+'"':"")+(opts.cls?' class="'+opts.cls+'"':"")+(opts.disabled?" disabled":"")+(opts.title?' title="'+htm(opts.title)+'"':"")+">"+label+"</button>";
 }
 bar(value,style=""){return '<div class="bar '+style+'"><i style="width:'+Math.round(clamp(value,0,1)*100)+'%"></i></div>'}
 stat(icon,label,value,extra="",cls=""){
  return '<div class="stat" title="'+label+'">'+this.icon(icon)+'<label>'+label+'</label><b class="'+cls+'">'+value+(extra?'<em>'+extra+"</em>":"")+"</b></div>";
 }
 reward(r){
  return [r.coins&&'<span class="gold">+'+fmt(r.coins)+' Vàng</span>',r.xp&&'<span>+'+r.xp+' XP</span>',r.prestige&&'<span class="mint">+'+r.prestige+' Uy tín</span>',r.know&&'<span class="teal">+'+r.know+' Tri thức</span>'].filter(Boolean).join(" · ");
 }
 toast(message){
  if(!message)return;this.text("toast",message);this.nodes.toast.hidden=false;clearTimeout(this.toastTimer);
  this.toastTimer=setTimeout(()=>this.nodes.toast.hidden=true,3600);
 }
 setTool(name,id=null){
  this.tool=name;this.selection=id;this.moving=null;this.inspect=null;
  this.canvas.classList.toggle("build",["build","move","demo"].includes(name));
 }
 pick(point){
  const s=this.sim,w=s.social.world,{x,y}=IsoMath.screenToGrid(point.x,point.y,this.renderer.camera),hit=this.renderer.hit(point);
  if(hit?.crisis){this.dispatch(hit.crisis.uid);return}
  if(hit?.bubble&&this.tool==="look"){this.toast(s.collect(hit.bubble.uid));this.refresh();return}
  const at=lookup(w,x,y),b=hit?.building||at;
  if(this.tool==="build"&&this.selection){this.toast(s.build(this.selection,x,y));this.refresh();return}
  if(this.tool==="move"){
   if(!this.moving){if(b){this.moving=b;this.toast("Chọn ô trống để di chuyển "+CONFIG.buildingName(b)+".")}}
   else{const error=s.move(this.moving,x,y);if(!error){this.moving=null;this.inspect=null;this.toast("Đã di chuyển công trình.")}else this.toast(error)}
  }else if(this.tool==="demo"){
   if(b)this.confirmDemolish(b);
  }else if(this.tool==="look"){
   this.inspect=b||null;
  }
  this.refresh();
 }
 open(type,tag,title,value,wide=false){
  this.dialogType=type;this.text("dialog-tag",tag);this.text("dialog-title",title);this.html("dialog-body",value);
  this.nodes.dialog.classList.toggle("wide",wide);
  if(!this.nodes.dialog.open)this.nodes.dialog.showModal();
 }
 close(){if(this.nodes.dialog.open)this.nodes.dialog.close();this.dialogType=""}
 select(id){
  const d=CONFIG.buildings[id];if(!d||this.sim.social.current)return;
  if(this.sim.profile.level<d.unlock){this.toast("Mở khóa "+d.name+" khi đạt cấp "+d.unlock+".");return}
  this.setTool("build",id);this.catalogOpen=innerWidth>780;
 }
 dispatch(uid){
  const s=this.sim,w=s.social.world,c=w.crises.find(z=>z.uid===uid);if(!c)return;
  this.renderer.focus(c.x,c.y);this.toast(s.crisis.dispatch(c,w,s.social.current));this.refresh();
 }
 confirmDemolish(b){
  if(!this.sim.canAlter(b)){this.toast("Không thể phá khi có sự cố hoặc đội đang làm nhiệm vụ.");return}
  const {price}=CONFIG.buildings[b.id];
  this.open("demolish","QUY HOẠCH","Phá dỡ công trình",'<p>Phá <b>'+CONFIG.buildingName(b)+'</b>'+(b.level>1?' (cấp '+b.level+')':'')+' và nhận lại <b class="gold">'+fmt(price/2,price%2?1:0)+'</b> Vàng? Chi phí nâng cấp sẽ không được hoàn lại.</p><div class="actions">'+this.btn("do-demolish","Xác nhận phá dỡ",{id:coord(b.x,b.y),cls:"danger"})+this.btn("close-dialog","Giữ lại")+'</div>');
 }
 action(button){
  const s=this.sim,r=this.renderer,act=button.dataset.act,id=button.dataset.id,arg=button.dataset.arg;
  const tile=()=>{const k=Number(id);return lookup(s.world,k%16,k>>4)};
  const say=text=>{if(text)this.toast(text)};
  switch(act){
   case "look":this.setTool("look");this.catalogOpen=false;break;
   case "build":if(s.social.current)return;this.catalogOpen=!this.catalogOpen;if(!this.catalogOpen)this.setTool("look");break;
   case "close-build":this.catalogOpen=false;this.setTool("look");break;
   case "filter":this.category=id;this.nodes.catalog.scrollTop=0;break;
   case "select":this.select(id);break;
   case "move":case "demo":if(!s.social.current){this.catalogOpen=false;this.setTool(this.tool===act?"look":act)}break;
   case "zoom-in":r.zoom(1.15);break;
   case "zoom-out":r.zoom(1/1.15);break;
   case "center":r.center();break;
   case "sound":s.audio.enabled=!s.audio.enabled;if(s.audio.enabled)s.audio.play("click");s.storage.save();if(this.dialogType==="profile")this.profileDialog();break;
   case "tab":this.tabs[id]=arg;this.reopen();break;
   case "profile":this.tabs.profile=id||"me";this.profileDialog();break;
   case "save-name":{
    const input=document.getElementById("mayor-name"),city=document.getElementById("city-name"),name=input?.value.trim(),town=city?.value.trim();
    if(!name||!town){this.toast("Tên Thị trưởng và tên thành phố không được để trống.");return}
    s.profile.mayorName=name;s.profile.cityName=town;s.cloud?.rename(name);
    this.toast(s.storage.save()?"Đã lưu hồ sơ.":"Không thể lưu: trình duyệt không cho phép ghi dữ liệu.");s.cloud?.flush(true);this.profileDialog();break;
   }
   case "sync":s.storage.save();s.cloud?.flush(true).then(ok=>{this.toast(ok?"Đã đồng bộ lên máy chủ.":"Chưa đồng bộ được. Trò chơi vẫn lưu trên trình duyệt.");if(this.dialogType==="profile")this.profileDialog()});break;
   case "auth":this.auth(id);return;
   case "reset":this.open("reset","XÁC NHẬN","Bắt đầu lại từ đầu?",'<p>Toàn bộ tiến độ, thành phố và danh sách bạn bè sẽ bị xóa'+(s.cloud?.online?", kể cả bản lưu trên máy chủ":"")+'.</p><div class="actions">'+this.btn("do-reset","Xóa và chơi lại",{cls:"danger"})+this.btn("close-dialog","Hủy")+'</div>');break;
   case "do-reset":s.storage.reset().then(ok=>{if(!ok){this.close();this.toast("Không thể xóa bản lưu trên trình duyệt này.")}});return;
   case "help":this.help(id||"start");break;
   case "replay-tutorial":s.progress.tutorial={step:0,done:false};this.close();this.tutorial?.restart();break;
   case "dispatch":this.dispatch(id);break;
   case "quick":this.select(id);break;
   case "focus":if(this.inspect)r.focus(this.inspect.x,this.inspect.y);break;
   case "inspect-close":this.inspect=null;break;
   case "upgrade":if(tile())this.toast(s.upgrade(tile())||"Đã nâng cấp công trình.");break;
   case "spec":if(tile())this.toast(s.specialize(tile(),arg)||"Đã chọn chuyên môn hóa.");break;
   case "accelerate":if(tile())this.toast(s.accelerate(tile())||"Đã xây xong!");break;
   case "remove":if(tile())this.confirmDemolish(tile());break;
   case "do-demolish":if(tile()){this.close();this.toast(s.demolish(tile())||"Đã phá dỡ công trình.");this.inspect=null}break;
   case "teams":this.teams();break;
   case "team-up":case "team-hire":if(tile()){const error=s.crisis.teamAction(tile(),act==="team-hire"?"hire":"upgrade");this.teams();if(error){this.close();this.toast(error)}}break;
   case "policies":this.policies();break;
   case "policy":{const error=s.activate(id);if(error){this.close();this.toast(error)}else this.policies();break}
   case "missions":if(id)this.tabs.missions=id;this.missions();break;
   case "claim":say(s.prog.claimQuest(id));if(this.dialogType==="missions")this.missions();break;
   case "claim-daily":say(s.prog.claimDaily(id));this.missions();break;
   case "claim-bonus":say(s.prog.claimDailyBonus());this.missions();break;
   case "claim-login":say(s.prog.claimLogin());if(this.dialogType==="login")this.close();else this.missions();break;
   case "claim-ach":say(s.prog.claimAchievement(id));this.missions();break;
   case "replay":{const chapter=CONTENT.chapters.find(c=>c.id===id);if(chapter){this.close();this.playScene({type:"scene",key:"",title:chapter.title,subtitle:chapter.subtitle,lines:chapter.intro})}return}
   case "research":this.research();break;
   case "study":{const error=s.research(id);if(error)this.toast(error);this.research();break}
   case "decision":this.decision();break;
   case "decide":{const text=s.decide(Number(id));this.close();this.toast(text);break}
   case "social":if(id)this.tabs.social=id;this.socials();break;
   case "rank":if(id)this.rank=id;if(arg)this.rankScope=arg;this.socials();break;
   case "copy":{
    const out=document.getElementById(id||"export-code");out.select();
    if(navigator.clipboard)navigator.clipboard.writeText(out.value).then(()=>button.textContent="Đã sao chép").catch(()=>button.textContent="Đã chọn · Ctrl+C");
    else button.textContent=document.execCommand("copy")?"Đã sao chép":"Đã chọn · Ctrl+C";
    return;
   }
   case "import":this.importCode();return;
   case "add-friend":this.addFriend();return;
   case "unfriend":if(s.social.remove(id)){s.cloud?.removeFriend(id);this.toast("Đã xóa khỏi danh sách bạn bè.")}else this.toast("Không thể xóa khi đang thăm hoặc đội chi viện đang làm việc.");this.socials();break;
   case "visit":
    if(!s.social.current)this.ownCamera={...r.camera};
    s.social.visit(id);r.center();this.setTool("look");this.catalogOpen=false;r.hover=null;this.close();break;
   case "return":
    s.social.own();if(this.ownCamera)r.camera={...this.ownCamera};else r.center();r.target=null;r.hover=null;this.setTool("look");this.close();break;
   case "login-open":this.loginDialog();break;
   case "mail-open":this.mailDialog();break;
   case "mail-claim":this.claimMail();return;
   case "close-dialog":this.close();break;
   case "welcome":s.audio.play("money");this.close();break;
   case "scene-next":this.sceneNext();return;
   case "scene-skip":this.sceneEnd();return;
   case "coach-skip":this.tutorial?.skip();break;
  }
  this.refresh();
 }
 reopen(){({missions:()=>this.missions(),social:()=>this.socials(),profile:()=>this.profileDialog()})[this.dialogType]?.()}
 refresh(initial=false){
  const s=this.sim,p=s.profile,w=s.social.world,friend=s.social.current,m=s.metrics,own=!friend,badges=s.prog.badges(),rank=CONFIG.cityRank(m.score);
  this.html("profile",'<span class="profile-level"><b>'+p.level+'</b><small>CẤP</small></span><span class="profile-meta"><b>'+htm(p.mayorName)+'</b><small>'+rank.name+' '+htm(p.cityName)+' · '+fmt(p.xp)+' / '+fmt(CONFIG.xpNext(p.level))+' XP</small>'+this.bar(p.xp/CONFIG.xpNext(p.level))+'</span>');
  this.html("stats",[
   this.stat("coin","Vàng",fmt(Math.floor(p.coins)),"+"+fmt(m.income,1)+"/s","gold"),
   this.stat("gem","Uy tín",fmt(Math.floor(p.prestige)),"","mint"),
   this.stat("brain","Tri thức",fmt(Math.floor(p.knowledge)),"+"+fmt(m.know*60,1)+"/ph","teal"),
   this.stat("crew","Dân số",fmt(m.pop)),
   this.stat("happy","Hạnh phúc",fmt(m.happiness)+"%","",m.happiness<90?"warn":"mint"),
   this.stat("power","Điện",m.ps+" / "+m.pd,"",m.ps<m.pd?"warn":""),
   this.stat("water","Nước",m.ws+" / "+m.wd,"",m.ws<m.wd?"warn":"")
  ].join(""));
  const t=Math.floor(s.world.timeOfDay*1440),phase=t<360||t>=1140?"Đêm":t<660?"Buổi sáng":t<960?"Buổi trưa":"Hoàng hôn",weather=CONFIG.weather[s.world.weather];
  this.html("clock",'<b>'+String(Math.floor(t/60)).padStart(2,"0")+':'+String(t%60).padStart(2,"0")+' · '+phase+'</b><small>'+weather[0]+' '+weather[1]+'</small>');
  this.html("sound",this.icon(s.audio.enabled?"sound":"mute"));this.nodes.sound.setAttribute("aria-pressed",String(s.audio.enabled));
  const cloud=s.cloud,state=!cloud?.enabled?"local":cloud.status;
  const who=cloud?.online&&cloud.account?(cloud.account.username?htm(cloud.account.username):"Khách")+" · ":"";
  this.html("cloud",this.icon("cloud")+'<span>'+who+({local:"Lưu trên máy",offline:"Ngoại tuyến",syncing:"Đang đồng bộ",synced:"Đã đồng bộ",error:"Lỗi đồng bộ",expired:"Hết phiên · đăng nhập lại"}[state])+'</span>');this.nodes.cloud.dataset.state=state;
  this.html("maplabel",'<small>'+(own?rank.name:"Thành phố bạn bè")+' · '+(w.unlockedRadius*2)+' × '+(w.unlockedRadius*2)+' ô đất</small><h1>'+(own?htm(p.cityName):htm(friend.name))+'</h1>');
  this.nodes.visit.hidden=own;
  if(friend)this.html("visit",'<b>Đang thăm thành phố của '+htm(friend.name)+'</b>'+this.btn("return","Về thành phố của tôi"));
  const dots={missions:badges.missions,research:badges.research};
  this.html("dock",this.menu.map(([id,name,icon])=>this.btn(id,this.icon(icon)+'<span>'+name+'</span>'+(dots[id]?'<sup>'+(id==="missions"?dots[id]:"")+'</sup>':""),{
   cls:((id==="build"&&(this.catalogOpen||this.tool==="build"))||(id==="look"&&this.tool==="look"&&!this.catalogOpen&&!this.dialogType)||(["move","demo"].includes(id)&&this.tool===id)||(this.dialogType===id))?"active":"",
   disabled:!own&&["build","move","demo"].includes(id)
  })).join(""));
  this.nodes.side.hidden=!this.catalogOpen||!own;
  if(this.catalogOpen&&own){
   this.html("filters",Object.entries(CONFIG.groups).map(([id,name])=>this.btn("filter",name,{id,cls:this.category===id?"active":""})).join(""));
   const rows=Object.values(CONFIG.buildings).filter(d=>this.category==="all"||d.group===this.category);
   this.html("catalog",rows.map(d=>{
    const locked=p.level<d.unlock,poor=!locked&&p.coins<d.price,title=d.name+" · "+d.desc;
    const facts=[d.income&&"+"+d.income+" V/s",d.pop&&"+"+d.pop+" dân",d.power>0&&"+"+d.power+" điện",d.water>0&&"+"+d.water+" nước",d.happy>0&&"+"+d.happy+" HP",d.know&&"Tri thức"].filter(Boolean).slice(0,2).join(" · ");
    return this.btn("select",'<img src="'+this.thumbs[d.id]+'" alt=""><span><b>'+d.name+'</b><small>'+(locked?'🔒 Mở ở cấp '+d.unlock:(facts||CONFIG.groups[d.group])+' · '+(d.duration?d.duration+' giây':'tức thì'))+'</small></span><span class="price '+(poor?"warn":"gold")+'">'+fmt(d.price)+'</span>',{id:d.id,cls:"blueprint"+(locked?" locked":"")+(this.selection===d.id?" active":""),title});
   }).join(""));
  }
  this.inspectCard();this.sidebar();this.fab(badges);
  document.body.classList.toggle("panel-open",this.catalogOpen||!!this.inspect);
  this.text("zoom",Math.round(this.renderer.camera.zoom*100)+"%");
  let hint="Kéo để quan sát · Cuộn để thu phóng · Chạm công trình để xem";
  if(friend)hint="Chỉ xem · Chạm sự cố để chi viện · Còn "+p.dailyHelpsLeft+"/5 lượt";
  else if(this.tool==="build"&&this.selection)hint=CONFIG.buildings[this.selection].name+" · "+(this.selection==="road"?"Kéo vẽ đường liên tiếp":"Chạm một ô đất sáng để đặt")+" · Esc để hủy";
  else if(this.tool==="move")hint=this.moving?"Chạm ô trống để đặt lại công trình":"Chạm công trình muốn di chuyển";
  else if(this.tool==="demo")hint="Chạm công trình để phá dỡ · Hoàn lại 50% giá gốc";
  this.text("hint",hint);
  if(s.news.length&&(!this.displayedNews.includes(s.news[0])||s.elapsed-this.newsAt>=24||initial)){
   const next=!this.displayedNews.includes(s.news[0])?s.news[0]:s.news[this.newsCursor++%s.news.length];
   this.displayedNews.unshift(next);this.displayedNews.length=Math.min(this.displayedNews.length,12);
   this.text("news",next+"   •   MetroPulse — Nhịp Đập Đô Thị");
   for(const animation of this.nodes.news.getAnimations())animation.currentTime=0;
   this.newsAt=s.elapsed;
  }
  if(this.dialogType==="social"){
   const timer=document.getElementById("help-timer"),left=document.getElementById("help-left");
   if(timer)timer.textContent=s.social.resetTime();if(left)left.textContent=p.dailyHelpsLeft+"/5";
  }
  if(this.nodes.dialog.open&&Math.floor(s.elapsed)!==this.dialogFrame){
   this.dialogFrame=Math.floor(s.elapsed);
   if(this.dialogType==="policies")this.policies();
   if(this.dialogType==="research"&&!this.nodes["dialog-body"].matches(":hover"))this.research();
  }
  this.pump();this.tutorial?.update();
 }
 fab(badges){
  const s=this.sim,items=[];
  if(s.social.current){this.html("fab","");return}
  if(s.progress.tutorial.done)items.push(this.btn("login-open",this.icon("gift")+(badges.login?"<sup></sup>":""),{cls:"round"+(badges.login?" pulse":""),title:"Điểm danh hằng ngày"}));
  if(this.mail.length)items.push(this.btn("mail-open",this.icon("mail")+"<sup>"+this.mail.length+"</sup>",{cls:"round pulse",title:"Hộp thư quà chi viện"}));
  this.html("fab",items.join(""));
 }
 inspectCard(){
  const b=this.inspect,card=this.nodes.inspect,s=this.sim;
  if(!b||!s.social.world.buildings.includes(b)){card.hidden=true;return}
  card.hidden=false;
  const d=CONFIG.buildings[b.id],key=coord(b.x,b.y),team=CONFIG.npcs[b.id],w=s.social.world,own=!s.social.current,tier=CONFIG.tier(b.level),group=CONFIG.specGroup(b.id);
  let actions="",extra="";
  if(b.left>0)extra='<small>Đang xây · còn '+Math.ceil(b.left)+' giây</small>'+this.bar(1-b.left/b.total);
  else if(b.id!=="road"){
   const syn=s.synergy(b,w),facts=[];
   if(d.income)facts.push('<span class="gold">+'+fmt(s.production(b,w),1)+' V/s</span>');
   if(d.pop)facts.push("+"+Math.round(d.pop*(1+.15*(b.level-1))*(group==="res"&&b.spec==="a"?1.4:1))+" dân");
   if(d.power)facts.push("Điện "+(d.power>0?"+"+Math.round(d.power*(1+.2*(b.level-1))):d.power));
   if(d.water)facts.push("Nước "+(d.water>0?"+"+Math.round(d.water*(1+.2*(b.level-1))):d.water));
   if(d.happy)facts.push("Hạnh phúc +"+d.happy);
   if(d.waste)facts.push("Rác "+(d.waste>0?"+":"")+d.waste);
   if(d.know)facts.push('<span class="teal">Tri thức +'+fmt(d.know*(1+.25*(b.level-1))*(group==="edu"&&b.spec==="a"?1.5:1)*60,1)+'/ph</span>');
   extra='<div class="facts">'+facts.join(" · ")+'</div>';
   if(syn.notes.length)extra+='<div class="chips">'+syn.notes.map(([v,label])=>'<span class="chip '+(v.startsWith("−")?"bad":"good")+'">'+v+' '+label+'</span>').join("")+'</div>';
   if(team){const r=CONFIG.rank(b.missions);extra+='<small>'+team.captain+' · '+r[1]+' · '+b.missions+' nhiệm vụ · '+CONFIG.vehicles[b.teamLevel-1].name+'</small>'}
   if(b.spec&&group)extra+='<div class="chips"><span class="chip spec">✦ '+CONFIG.specs[group][b.spec][0]+' — '+CONFIG.specs[group][b.spec][1]+'</span></div>';
   else if(own&&group&&b.level>=CONFIG.specLevel)extra+='<div class="spec-pick"><small>Chọn một chuyên môn hóa (không đổi lại được):</small>'+["a","b"].map(k=>this.btn("spec",'<b>'+CONFIG.specs[group][k][0]+'</b><small>'+CONFIG.specs[group][k][1]+'</small>',{id:key,arg:k})).join("")+'</div>';
   else if(own&&group&&b.level<CONFIG.specLevel)extra+='<small class="muted">Chuyên môn hóa mở ở cấp '+CONFIG.specLevel+'.</small>';
  }
  if(own){
   if(b.left>0)actions=this.btn("accelerate","Tăng tốc · 1 Uy tín",{id:key,cls:"primary"});
   else if(b.id!=="road"){
    const block=s.upgradeBlock(b),cost=s.upgradeCost(b),evolve=!block&&CONFIG.tier(b.level+1)!==tier;
    actions=this.btn("upgrade",b.level>=CONFIG.maxLevel?"Cấp tối đa":block?"Cần Thị trưởng cấp "+CONFIG.tierGate(b.level):(evolve?"★ Tiến hóa · ":"Nâng cấp · ")+fmt(cost)+" V",{id:key,cls:"primary",disabled:!!block||s.profile.coins<cost,title:block||"Mỗi cấp +35% thu nhập"});
   }
   actions+=(team&&b.left<=0?this.btn("teams","Quản lý đội"):"")+this.btn("remove","Phá dỡ",{id:key,cls:"danger"});
  }
  const stars=b.id==="road"?"":'<span class="stars" title="Cấp '+b.level+'/'+CONFIG.maxLevel+'">'+Array.from({length:CONFIG.maxLevel},(_,i)=>'<i class="'+(i<b.level?"on":"")+(i===3||i===6?" gap":"")+'"></i>').join("")+'</span>';
  this.html("inspect",'<img class="inspect-thumb" src="'+this.thumbs[b.id]+'" alt=""><div class="inspect-main"><div class="inspect-head"><div><div class="eyebrow">'+CONFIG.groups[d.group]+(b.id==="road"?"":' · Bậc '+["I","II","III"][tier])+' · Ô '+String.fromCharCode(65+b.x)+(b.y+1)+'</div><h3>'+CONFIG.buildingName(b)+(b.id==="road"?"":' <em>Cấp '+b.level+'</em>')+'</h3></div>'+this.btn("inspect-close","×",{cls:"ghost icon",title:"Đóng thẻ"})+'</div>'+stars+'<p class="muted">'+d.desc+'</p>'+extra+'<div class="actions">'+actions+'</div></div>');
 }
 sidebar(){
  const s=this.sim,w=s.social.world,friend=s.social.current;
  const small=innerWidth<=780||innerHeight<=640,shown=small?w.crises.slice(0,2):w.crises;
  let result=shown.map(c=>{
   const d=CONFIG.crises[c.id],job=w.npcs.find(n=>n.target===c.uid&&n.phase!=="return"),teams=s.crisis.teams(d.hq);
   let status=job?(job.blocked?"Đang chờ mở lối":c.progress>0?"Đang sửa · "+Math.round(c.progress*100)+"%":"Đội đang trên đường"):c.late?"Quá ngưỡng nguy hiểm":"Nguy hiểm sau "+Math.max(0,Math.ceil(d.danger-c.age))+" giây";
   if(!teams.length&&!job)status="Cần xây "+CONFIG.buildings[d.hq].name+" để điều phối "+d.npc+"!";
   const button=job?this.btn("dispatch","Đang điều phối",{id:c.uid,disabled:true}):this.btn("dispatch",friend?"Chi viện NPC":"Điều phối NPC",{id:c.uid,cls:"primary"});
   return '<div class="incident glass interactive"><div class="eyebrow"><span style="color:'+d.color+'">'+htm(d.icon)+'</span> '+(friend?"Sự cố thành phố bạn":"Cảnh báo sự cố")+'</div><h3>'+d.name+'</h3><p>'+d.penalty+'</p><small>'+status+'</small>'+this.bar(job&&c.progress>0?c.progress:c.age/d.danger,job?"blue":"danger")+button+
    (!teams.length&&!friend?this.btn("quick","Xây nhanh Trụ sở",{id:d.hq}):"")+'</div>';
  }).join("");
  if(shown.length<w.crises.length)result+='<div class="chips buffs"><span class="chip bad">+'+(w.crises.length-shown.length)+' sự cố khác trên bản đồ</span></div>';
  if(!friend){
   const pending=s.progress.decision&&CONTENT.decisions.find(d=>d.id===s.progress.decision.id);
   if(pending)result+='<div class="letter glass interactive">'+this.portrait(pending.who)+'<div><div class="eyebrow">✉ Thư từ '+CONTENT.cast[pending.who].name+'</div><h3>'+pending.title+'</h3>'+this.btn("decision","Mở thư",{cls:"primary"})+'</div></div>';
   const chapter=s.prog.chapter(),compact=small;
   if(chapter&&!(compact&&w.crises.length)){
    const list=chapter.quests.map(q=>({q,st:s.prog.questState(q)})).filter(x=>!x.st.claimed).sort((a,b)=>b.st.done-a.st.done).slice(0,compact?1:3);
    const total=chapter.quests.length,claimed=chapter.quests.filter(q=>s.progress.story.claimed.includes(q.id)).length;
    result+='<div class="mission glass interactive"><div class="eyebrow">◆ '+chapter.subtitle.split(" · ")[0]+' · '+claimed+'/'+total+'</div><h3>'+chapter.title+'</h3>'+list.map(({q,st})=>
     '<div class="quest'+(st.done?" ready":"")+'"><b>'+q.name+'</b><small>'+q.desc+'</small>'+(st.done?this.btn("claim","Nhận thưởng",{cls:"primary",id:q.id}):this.bar(st.cur/st.goal)+'<small class="count">'+fmt(st.cur)+' / '+fmt(st.goal)+'</small>')+'</div>').join("")+
     this.btn("missions","Xem tất cả nhiệm vụ",{cls:"ghost",id:"story"})+'</div>';
   }else if(!chapter&&!compact)result+='<div class="mission glass interactive"><div class="eyebrow">◆ Hậu truyện</div><h3>Đô thị kiểu mẫu</h3><p>Cốt truyện đã hoàn thành. Hãy chinh phục thành tựu, nhiệm vụ ngày và bảng xếp hạng!</p>'+this.btn("missions","Xem thành tựu",{id:"ach"})+'</div>';
   const chips=[];
   if(s.world.activePolicy)chips.push('<span class="chip spec">'+CONFIG.policies[s.world.activePolicy.id].name+' · '+Math.ceil(s.world.activePolicy.left)+'s</span>');
   for(const b of s.world.buffs)chips.push('<span class="chip '+((b.income<1||b.happy<0||b.risk>1)?"bad":"good")+'">'+b.name+' · '+Math.ceil(b.left)+'s</span>');
   if(s.profile.combo>=2)chips.push('<span class="chip good">Chuỗi phản ứng ×'+s.profile.combo+'</span>');
   if(chips.length)result+='<div class="chips buffs">'+chips.join("")+'</div>';
  }
  this.html("right",result);
 }
 // Hàng đợi sự kiện giao diện: hội thoại cốt truyện, lên cấp, điểm danh, thư quà.
 pump(){
  const queue=this.sim.pending;
  for(let i=queue.length-1;i>=0;i--)if(queue[i].type==="toast"){this.toast(queue[i].text);queue.splice(i,1)}
  if(!queue.length||this.sceneState||this.nodes.dialog.open||this.sim.social.current)return;
  const waiting=this.tutorial?.active&&queue[0].type!=="scene";
  if(waiting)return;
  const event=queue.shift();
  if(event.type==="scene")this.playScene(event);
  else if(event.type==="level")this.levelUp(event.level);
  else if(event.type==="login"){if(this.sim.prog.loginState().available)this.loginDialog()}
  else if(event.type==="mail"){if(this.mail.length)this.mailDialog()}
  else if(event.type==="offline")this.offline(event.result);
 }
 playScene(event){
  this.sceneState={event,index:0};this.nodes.scene.hidden=false;this.catalogOpen=false;this.renderScene();
 }
 renderScene(){
  const {event,index}=this.sceneState,[who,line]=event.lines[index],c=CONTENT.cast[who],last=index===event.lines.length-1;
  const text=line.replaceAll("anh/chị","Thị trưởng");
  this.html("scene-body",'<div class="scene-chapter"><small>'+event.subtitle+'</small><b>'+event.title+'</b></div><div class="scene-card glass">'+this.portrait(who)+'<div class="scene-text"><div class="scene-name"><b>'+c.name+'</b><small>'+c.role+'</small></div><p>'+htm(text)+'</p>'+
   (last&&event.reward?'<p class="scene-reward">Thưởng chương: '+htm(event.reward)+'</p>':"")+
   '<div class="actions">'+(last?"":this.btn("scene-skip","Bỏ qua",{cls:"ghost"}))+this.btn("scene-next",last?(event.finale?"Khép lại hành trình":"Bắt đầu thôi!"):"Tiếp tục ›",{cls:"primary"})+'<small class="muted">'+(index+1)+' / '+event.lines.length+'</small></div></div></div>');
  this.sim.audio.play("talk");
 }
 sceneNext(){
  const st=this.sceneState;if(!st)return;
  if(st.index<st.event.lines.length-1){st.index++;this.renderScene()}else this.sceneEnd();
 }
 sceneEnd(){
  const st=this.sceneState;if(!st)return;
  this.sceneState=null;this.nodes.scene.hidden=true;if(st.event.key)this.sim.prog.seen(st.event.key);this.refresh();
 }
}
Object.assign(UIController.prototype,UIInput);
