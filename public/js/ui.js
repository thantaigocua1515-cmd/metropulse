"use strict";

class UIController {
 constructor(sim,renderer){
  this.sim=sim;this.renderer=renderer;renderer.ui=this;this.canvas=renderer.canvas;
  this.tool="look";this.selection=null;this.moving=null;this.inspect=null;this.category="all";this.dialogType="";this.catalogOpen=false;
  this.tabs={missions:"story",social:"friends",profile:"me",account:"register"};this.rank="score";this.rankScope="friends";this.globalRows=null;this.mail=[];
  this.pointers=new Map();this.gesture=null;this.ownCamera=null;this.nodes={};this.newsCursor=0;this.displayedNews=[];this.newsAt=-30;this.sceneState=null;
  this.questOpen=false;this.commandsOpen=false;this.commandsPinned=false;this.commandBadges=0;
  for(const id of ["stats","utilities","clock","cloud","sound","profile","maplabel","visit","side","filters","catalog","right","quest-track","inspect","fab","zoom","look","hint","toast","news","build-tools","command-rail","rail-toggle","command-drawer","action-rail","dialog","dialog-tag","dialog-title","dialog-body","scene","scene-body","coach"])this.nodes[id]=document.getElementById(id);
  for(const id of ["center","look","help","settings"])document.getElementById(id).innerHTML=this.icon(id);
  this.html("stats",[
   this.resource("coin","Vàng",true,{act:"login-open",label:"Kiếm Vàng từ điểm danh"}),
   this.resource("prestige","Uy tín"),
   this.resource("brain","Tri thức",true,{act:"research",label:"Mở Viện Quy hoạch"}),
   this.resource("people","Dân số")
  ].join(""));
  this.resources=Object.fromEntries([...this.nodes.stats.children].map(el=>[el.dataset.resource,{el,value:el.querySelector("b"),rate:el.querySelector("em")}]));
  this.thumbs=new Map();
  this.sim.say("Chào mừng đến Bình Minh! Hãy xây thêm nhà và nối đường để thị trấn sống lại.");
  document.addEventListener("pointerdown",()=>sim.audio.unlock(),{passive:true});
  document.addEventListener("touchstart",()=>sim.audio.unlock(),{passive:true});
  document.addEventListener("contextmenu",e=>{if(!e.target.closest('input,textarea,[contenteditable="true"]'))e.preventDefault()});
  for(const type of ["pointerdown","click"])this.nodes["command-rail"].addEventListener(type,()=>this.scheduleCommandClose(),{passive:true});
  document.addEventListener("submit",e=>{const kind=e.target.dataset?.auth;if(kind){e.preventDefault();this.auth(kind)}});
  document.addEventListener("keydown",e=>{
   sim.audio.unlock();
   if(this.sceneState){if(e.key==="Enter"||e.key===" "||e.key==="Escape"){e.preventDefault();this.sceneNext()}return}
   if(this.nodes.dialog.open||e.target.matches("input,textarea"))return;
   if(e.key==="Escape"){this.setTool("look");this.catalogOpen=false;this.refresh()}
   if(e.key==="+"||e.key==="=")this.renderer.zoom(1.14);
   if(e.key==="-")this.renderer.zoom(1/1.14);
   const hot={b:"build",n:"missions",r:"research",f:"social"}[e.key.toLowerCase()];
   if(hot&&!e.ctrlKey&&!e.metaKey){
    const nav=this.nodes[hot==="build"?"build-tools":"action-rail"],button=nav.querySelector('[data-act="'+hot+'"]');
    if(button&&!button.disabled)button.click();
   }
  });
  document.addEventListener("click",e=>{const btn=e.target.closest("button[data-act]");if(btn&&!btn.disabled){sim.audio.play(btn.dataset.act==="tab"?"tab":"click");this.action(btn)}});
  this.nodes.dialog.addEventListener("close",()=>{this.dialogType="";this.refresh()});
  this.wireCanvas();this.refresh(true);
 }
 icon(id){
  if(id==="prestige")return '<img class="prestige-icon" src="'+asset("img/prestige.svg")+'" alt="">';
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="'+asset("img/hud.svg")+'#'+id+'"/></svg>';
 }
 thumb(id){
  if(!this.thumbs.has(id))this.thumbs.set(id,this.renderer.thumbnail(id));
  return this.thumbs.get(id);
 }
 scheduleCommandClose(){
  clearTimeout(this.commandTimer);
  if(this.commandsOpen&&!this.commandsPinned)this.commandTimer=setTimeout(()=>this.setCommands(false),5000);
 }
 setCommands(open){
  const drawer=this.nodes["command-drawer"],toggle=this.nodes["rail-toggle"];
  this.commandsOpen=open||this.commandsPinned;
  if(!this.commandsOpen&&drawer.contains(document.activeElement))toggle.focus({preventScroll:true});
  drawer.inert=!this.commandsOpen;
  toggle.setAttribute("aria-expanded",String(this.commandsOpen));
  this.renderCommandToggle();this.scheduleCommandClose();
 }
 pinCommands(pinned){
  if(this.commandsPinned===pinned)return;
  this.commandsPinned=pinned;
  if(pinned)this.setCommands(true);else this.scheduleCommandClose();
 }
 renderCommandToggle(){
  const button=this.nodes["rail-toggle"],count=this.commandsOpen?0:this.commandBadges,label=this.commandsOpen?"Thu gọn chức năng":"Mở chức năng";
  this.html("rail-toggle",this.icon("commands")+(count?'<sup aria-hidden="true">'+count+'</sup>':""));
  button.title=label;button.setAttribute("aria-label",label+(count?" · "+count+" thông báo":""));
 }
 refreshCloud(){
  const cloud=this.sim.cloud,state=!cloud?.enabled?"local":cloud.status;
  const who=cloud?.online&&cloud.account?(cloud.account.username||"Khách")+" · ":"";
  const label="Tài khoản · "+who+({local:"Lưu trên máy",offline:"Ngoại tuyến",syncing:"Đang đồng bộ",synced:"Đã đồng bộ",error:"Lỗi đồng bộ",expired:"Hết phiên · đăng nhập lại"}[state]||"Tài khoản");
  this.html("cloud",this.icon(state==="syncing"||state==="synced"?"cloud":"cloud-off"));
  const button=this.nodes.cloud;
  button.dataset.state=state;button.title=label;button.setAttribute("aria-label",label);
 }
 // Chân dung lấy từ bộ ảnh trong img/npc (01–36).
 avatar(n,cls=""){
  const id=Number.isInteger(n)&&n>=1&&n<=CONFIG.avatars.count?n:CONFIG.avatars.fallback;
  return '<img class="portrait'+(cls?" "+cls:"")+'" src="'+asset("img/npc/"+String(id).padStart(2,"0")+".webp")+'" alt="" width="104" height="104" decoding="async" draggable="false">';
 }
 portrait(id){return this.avatar(CONTENT.cast[id].avatar)}
 // Chân dung kèm huy hiệu nhỏ (cấp, biểu tượng đội…).
 face(n,mark="",color=""){return '<span class="face">'+this.avatar(n)+(mark!==""?'<i'+(color?' style="color:'+color+'"':"")+'>'+mark+'</i>':"")+'</span>'}
 html(id,value){const el=this.nodes[id];if(el._mp!==value){el.innerHTML=value;el._mp=value}}
 text(id,value){if(this.nodes[id].textContent!==value)this.nodes[id].textContent=value}
 btn(act,label,opts={}){
  return '<button type="button" data-act="'+act+'"'+(opts.id!==undefined?' data-id="'+htm(opts.id)+'"':"")+(opts.arg!==undefined?' data-arg="'+htm(opts.arg)+'"':"")+(opts.cls?' class="'+opts.cls+'"':"")+(opts.disabled?" disabled":"")+(opts.title?' title="'+htm(opts.title)+'"':"")+(opts.label?' aria-label="'+htm(opts.label)+'"':"")+(opts.expanded!==undefined?' aria-expanded="'+opts.expanded+'"':"")+">"+label+"</button>";
 }
 bar(value,style=""){return '<div class="bar '+style+'"><i style="width:'+Math.round(clamp(value,0,1)*100)+'%"></i></div>'}
 resource(icon,label,rate=false,more=null){
  return '<div class="resource resource-'+icon+'" data-resource="'+icon+'" aria-label="'+label+'"><span class="resource-icon">'+this.icon(icon)+'</span><div class="resource-data"><small>'+label+'</small><b></b></div>'+
   (rate?'<em></em>':"")+(more?this.btn(more.act,this.icon("plus"),{cls:"resource-plus",title:more.label,label:more.label}):"")+'</div>';
 }
 updateResource(icon,value,rate=""){
  const {el,value:amount,rate:per}=this.resources[icon];
  if(amount.textContent!==value)amount.textContent=value;
  if(per&&per.textContent!==rate){per.textContent=rate;el.title=el.getAttribute("aria-label")+" · "+rate}
 }
 utility(icon,label,value,fraction,warning=false,detail=label){
  return '<div class="utility utility-'+icon+(warning?" low":"")+'" title="'+detail+'"><span class="utility-icon">'+this.icon(icon)+'</span><div class="utility-track"><i style="width:'+Math.round(clamp(fraction,0,1)*100)+'%"></i><span><small>'+label+'</small><b>'+value+'</b></span></div></div>';
 }
 gameButton(act,label,icon,options={}){
  const {count=0,active=false,shop=false,disabled=false}=options;
  return this.btn(act,this.icon(icon)+(shop?'<span>'+label+'</span>':"")+(count?'<sup aria-hidden="true">'+count+'</sup>':""),{
   cls:"game-btn "+(shop?"shop":"round")+(active?" active":""),disabled,title:label,label:label+(count?" · "+count+" thông báo":"")
  });
 }
 prestigeAmount(value){return this.icon("prestige")+" "+value+" Uy tín"}
 orderedProgress(items,read){
  const rank=st=>st.claimed||st.complete?2:(st.claimable??st.done)?0:1;
  return items.map(item=>({item,st:read(item)})).sort((a,b)=>rank(a.st)-rank(b.st));
 }
 reward(r){
  return [r.coins&&'<span class="gold">+'+fmt(r.coins)+' Vàng</span>',r.xp&&'<span>+'+r.xp+' XP</span>',r.prestige&&'<span class="mint">'+this.prestigeAmount("+"+r.prestige)+'</span>',r.know&&'<span class="teal">+'+r.know+' Tri thức</span>'].filter(Boolean).join(" · ");
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
  if(hit?.citizen&&this.tool==="look"){this.renderer.life.poke(hit.citizen);s.audio.play("click");return}
  const at=lookup(w,x,y),b=hit?.building||at;
  if(this.tool==="build"&&this.selection){const error=s.build(this.selection,x,y);this.toast(error);if(!error&&this.selection!=="road")this.renderer.closeUp(x,y);this.refresh();return}
  if(this.tool==="move"){
   if(!this.moving){if(b){this.moving=b;this.toast("Chọn ô trống để di chuyển "+CONFIG.buildingName(b)+".")}}
   else{const error=s.move(this.moving,x,y);if(!error){this.moving=null;this.inspect=null;this.toast("Đã di chuyển công trình.")}else this.toast(error)}
  }else if(this.tool==="demo"){
   if(b)this.confirmDemolish(b);
  }else if(this.tool==="look"){
   this.inspect=b||null;if(b&&b.id!=="road")this.closeUp(b);
  }
  this.refresh();
 }
 open(type,tag,title,value,wide=false){
  this.dialogType=type;this.text("dialog-tag",tag);this.text("dialog-title",title);this.html("dialog-body",value);
  this.nodes.dialog.classList.toggle("wide",wide);
  if(!this.nodes.dialog.open)this.nodes.dialog.showModal();
 }
 close(){if(this.nodes.dialog.open)this.nodes.dialog.close();this.dialogType=""}
 // Đưa công trình đang xem lại gần; trên điện thoại đẩy nó lên trên để thẻ thông tin không che.
 closeUp(b){this.renderer.closeUp(b.x,b.y,innerWidth<=780?.34:.46)}
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
   case "rail-toggle":this.setCommands(!this.commandsOpen);return;
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
   case "reduce-effects":s.reduceEffects=!s.reduceEffects;s.fx.length=0;s.storage.save();this.profileDialog();break;
   case "tab":this.tabs[id]=arg;this.reopen();break;
   case "profile":this.tabs.profile=id||"me";this.profileDialog();break;
   case "avatar":{const n=Number(id);if(CONFIG.avatars.pick.includes(n)){s.profile.avatar=n;s.storage.save();s.cloud?.flush(true);this.profileDialog()}break}
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
   case "upgrade":if(tile()){const error=s.upgrade(tile());this.toast(error||"Đã nâng cấp công trình.");if(!error)this.closeUp(tile())}break;
   case "spec":if(tile())this.toast(s.specialize(tile(),arg)||"Đã chọn chuyên môn hóa.");break;
   case "accelerate":if(tile())this.toast(s.accelerate(tile())||"Đã xây xong!");break;
   case "rotate":{const b=tile();if(b&&b.id!=="road"&&b.left<=0&&SPRITES[b.id]){b.rot=(r.facing(b,s.world)+1)%4;s.audio.play("click");s.storage.save()}}break;
   case "remove":if(tile())this.confirmDemolish(tile());break;
   case "do-demolish":if(tile()){this.close();this.toast(s.demolish(tile())||"Đã phá dỡ công trình.");this.inspect=null}break;
   case "teams":this.teams();break;
   case "team-up":case "team-hire":if(tile()){const error=s.crisis.teamAction(tile(),act==="team-hire"?"hire":"upgrade");this.teams();if(error){this.close();this.toast(error)}}break;
   case "policies":this.policies();break;
   case "policy":{const error=s.activate(id);if(error){this.close();this.toast(error)}else this.policies();break}
   case "missions":if(id)this.tabs.missions=id;this.missions();break;
   case "event-open":this.eventDialog();break;
   case "event-quest":s.events.claimQuest(Number(id));this.eventDialog();break;
   case "event-tier":s.events.claimTier(Number(id));this.eventDialog();break;
   case "event-skin":s.events.selectSkin(id);this.eventDialog();break;
   case "quest-toggle":this.questOpen=!this.questOpen;break;
   case "claim":say(s.prog.claimQuest(id));if(this.dialogType==="missions")this.missions();break;
   case "claim-daily":say(s.prog.claimDaily(id));this.missions();break;
   case "claim-bonus":say(s.prog.claimDailyBonus());this.missions();break;
   case "claim-login":say(s.prog.claimLogin());if(this.dialogType==="login")this.close();else this.missions();break;
   case "claim-ach":say(s.prog.claimAchievement(id));this.missions();break;
   case "claim-legacy":s.legacy.claim(arg,id);this.missions();break;
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
    s.social.own();if(this.ownCamera)r.camera={...this.ownCamera};else r.center();r.target=null;r.back=null;r.hover=null;this.setTool("look");this.close();break;
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
  if(!this.inspect&&this.tool!=="build")this.renderer.closeDown();
  const s=this.sim,p=s.profile,w=s.social.world,friend=s.social.current,m=s.metrics,own=!friend,badges=s.prog.badges(),rank=CONFIG.cityRank(m.score,p.level);
  const xpNext=CONFIG.xpNext(p.level);
  this.html("profile",this.icon("star")+'<strong>'+fmt(p.level)+'</strong>'+this.bar(p.xp/xpNext));
  this.nodes.profile.title="Hồ sơ · "+p.mayorName+" · Cấp "+p.level+" · "+fmt(p.xp)+" / "+fmt(xpNext)+" XP";
  this.nodes.profile.setAttribute("aria-label",this.nodes.profile.title);
  this.updateResource("coin",fmt(Math.floor(p.coins)),"+"+fmt(m.income,1)+"/s");
  this.updateResource("prestige",fmt(Math.floor(p.prestige)));
  this.updateResource("brain",fmt(Math.floor(p.knowledge)),"+"+fmt(m.know*60,1)+"/ph");
  this.updateResource("people",fmt(m.pop));
  const coverage=(supply,demand)=>demand?supply/demand:(supply?1:0);
  this.html("utilities",[
   this.utility("happy","Hạnh phúc",fmt(m.happiness)+"%",m.happiness/150,m.happiness<90),
   this.utility("power","Điện",fmt(m.ps)+" / "+fmt(m.pd),coverage(m.ps,m.pd),m.ps<m.pd,"Điện · Cung cấp / Nhu cầu"),
   this.utility("water","Nước",fmt(m.ws)+" / "+fmt(m.wd),coverage(m.ws,m.wd),m.ws<m.wd,"Nước · Cung cấp / Nhu cầu")
  ].join(""));
  const t=Math.floor(s.world.timeOfDay*1440),phase=t<360||t>=1140?"Đêm":t<660?"Buổi sáng":t<960?"Buổi trưa":"Hoàng hôn",weather=CONFIG.weather[s.world.weather];
  this.html("clock",this.icon(s.world.weather!=="sunny"?s.world.weather:phase==="Đêm"?"moon":"sun")+'<b>'+String(Math.floor(t/60)).padStart(2,"0")+':'+String(t%60).padStart(2,"0")+'</b><small>'+phase+' · '+weather[1]+'</small>');
  this.html("sound",this.icon(s.audio.enabled?"sound":"mute"));this.nodes.sound.setAttribute("aria-pressed",String(s.audio.enabled));
  this.nodes.sound.title=s.audio.enabled?"Tắt âm thanh":"Bật âm thanh";
  this.refreshCloud();
  this.html("maplabel",'<small>'+(own?rank.name:"Thành phố bạn bè")+' · '+(w.unlockedRadius*2)+' × '+(w.unlockedRadius*2)+' ô đất</small><h1>'+(own?htm(p.cityName):htm(friend.name))+'</h1>');
  this.eventBanner(own);
  this.nodes.visit.hidden=own;
  if(friend)this.html("visit",this.avatar(friend.avatar)+'<b>Đang thăm thành phố của '+htm(friend.name)+'</b>'+this.btn("return","Về thành phố của tôi"));
  const dots={missions:badges.missions,research:badges.research};
  this.commandBadges=Object.values(dots).reduce((total,count)=>total+count,0);this.renderCommandToggle();
  this.html("action-rail",[
   ["missions","Nhiệm vụ","checklist"],["research","Nghiên cứu","flask"],["policies","Sắc lệnh","policy"],["social","Bạn bè","social"],["teams","Đội NPC","crew"]
  ].map(([id,name,icon])=>this.gameButton(id,name,icon,{count:dots[id],active:this.dialogType===id})).join(""));
  this.html("build-tools",[
   this.gameButton("build","Xây dựng","crane",{shop:true,active:this.catalogOpen||this.tool==="build",disabled:!own}),
   this.gameButton("move","Di chuyển","move",{active:this.tool==="move",disabled:!own}),
   this.gameButton("demo","Phá dỡ","demo",{active:this.tool==="demo",disabled:!own})
  ].join(""));
  const look=this.tool==="look"&&!this.catalogOpen;
  this.nodes.look.classList.toggle("active",look);
  this.nodes.look.setAttribute("aria-pressed",String(look));
  this.nodes.side.hidden=!this.catalogOpen||!own;
  if(this.catalogOpen&&own){
   this.html("filters",Object.entries(CONFIG.groups).map(([id,name])=>this.btn("filter",name,{id,cls:this.category===id?"active":""})).join(""));
   const rows=Object.values(CONFIG.buildings).filter(d=>this.category==="all"||d.group===this.category);
   this.html("catalog",rows.map(d=>{
    const locked=p.level<d.unlock,poor=!locked&&p.coins<d.price,hint=Districts.hint(d),title=d.name+" · "+d.desc+(hint?" · "+hint:"");
    const facts=[d.income&&"+"+d.income+" V/s",d.pop&&"+"+d.pop+" dân",d.power>0&&"+"+d.power+" điện",d.water>0&&"+"+d.water+" nước",d.happy>0&&"+"+d.happy+" HP",d.know&&"Tri thức"].filter(Boolean).slice(0,2).join(" · ");
    return this.btn("select",'<img src="'+this.thumb(d.id)+'" alt="" loading="lazy" decoding="async" width="36" height="36"><span><b>'+d.name+'</b><small>'+(locked?'🔒 Mở ở cấp '+d.unlock:(facts||CONFIG.groups[d.group])+' · '+(d.duration?d.duration+' giây':'tức thì'))+'</small>'+(hint?'<small class="district-hint">'+hint+'</small>':"")+'</span><span class="price '+(poor?"warn":"gold")+'">'+fmt(d.price)+'</span>',{id:d.id,cls:"blueprint"+(locked?" locked":"")+(this.selection===d.id?" active":""),title});
   }).join(""));
  }
  this.inspectCard();this.sidebar();this.questTracker(badges);this.fab(badges);
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
   if(this.dialogType==="event")this.eventDialog();
  }
  this.pump();this.tutorial?.update();
 }
 fab(badges){
  const s=this.sim,items=[];
  if(s.social.current){this.html("fab","");return}
  if(s.progress.tutorial.done)items.push(this.gameButton("login-open","Điểm danh hằng ngày","gift",{count:badges.login}));
  if(this.mail.length)items.push(this.gameButton("mail-open","Hộp thư quà chi viện","mail",{count:this.mail.length}));
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
   const facts=[];
   if(d.income)facts.push('<span class="gold">+'+fmt(s.production(b,w),1)+' V/s</span>');
   if(d.pop)facts.push("+"+Math.round(d.pop*(1+.15*(b.level-1))*(group==="res"&&b.spec==="a"?1.4:1))+" dân");
   if(d.power)facts.push("Điện "+(d.power>0?"+"+Math.round(d.power*(1+.2*(b.level-1))):d.power));
   if(d.water)facts.push("Nước "+(d.water>0?"+"+Math.round(d.water*(1+.2*(b.level-1))):d.water));
   if(d.happy)facts.push("Hạnh phúc +"+d.happy);
   if(d.waste)facts.push("Rác "+(d.waste>0?"+":"")+d.waste);
   if(d.know)facts.push('<span class="teal">Tri thức +'+fmt(d.know*(1+.25*(b.level-1))*(group==="edu"&&b.spec==="a"?1.5:1)*60,1)+'/ph</span>');
   extra='<div class="facts">'+facts.join(" · ")+'</div>';
   if(team){const r=CONFIG.rank(b.missions);extra+='<small class="captain">'+this.avatar(team.avatar)+team.captain+' · '+r[1]+' · '+b.missions+' nhiệm vụ · '+CONFIG.vehicles[b.teamLevel-1].name+'</small>'}
   if(b.spec&&group)extra+='<div class="chips"><span class="chip spec">✦ '+CONFIG.specs[group][b.spec][0]+' — '+CONFIG.specs[group][b.spec][1]+'</span></div>';
   else if(own&&group&&b.level>=CONFIG.specLevel)extra+='<div class="spec-pick"><small>Chọn một chuyên môn hóa (không đổi lại được):</small>'+["a","b"].map(k=>this.btn("spec",'<b>'+CONFIG.specs[group][k][0]+'</b><small>'+CONFIG.specs[group][k][1]+'</small>',{id:key,arg:k})).join("")+'</div>';
   else if(own&&group&&b.level<CONFIG.specLevel)extra+='<small class="muted">Chuyên môn hóa mở ở cấp '+CONFIG.specLevel+'.</small>';
  }
  if(b.left<=0){
   const notes=s.synergy(b,w,true).notes;
   if(notes.length)extra+='<div class="chips">'+notes.map(([v,label,bad])=>'<span class="chip '+(bad?"bad":"good")+'">'+v+' '+label+'</span>').join("")+'</div>';
  }
  if(own){
   if(b.left>0)actions=this.btn("accelerate","Tăng tốc · "+this.prestigeAmount(1),{id:key,cls:"primary"});
   else if(b.id!=="road"){
    const block=s.upgradeBlock(b),cost=s.upgradeCost(b),evolve=!block&&CONFIG.tier(b.level+1)!==tier;
    actions=this.btn("upgrade",b.level>=CONFIG.maxLevel?"Cấp tối đa":block?"Cần Thị trưởng cấp "+CONFIG.tierGate(b.level):(evolve?"★ Tiến hóa · ":"Nâng cấp · ")+fmt(cost)+" V",{id:key,cls:"primary",disabled:!!block||s.profile.coins<cost,title:block||"Mỗi cấp +35% thu nhập"});
   }
   actions+=(b.id!=="road"&&SPRITES[b.id]&&b.left<=0?this.btn("rotate",this.icon("rotate")+" Xoay",{id:key,title:"Xoay công trình 90°"}):"")+(team&&b.left<=0?this.btn("teams","Quản lý đội"):"")+this.btn("remove","Phá dỡ",{id:key,cls:"danger"});
  }
  const stars=b.id==="road"?"":'<span class="stars" title="Cấp '+b.level+'/'+CONFIG.maxLevel+'">'+Array.from({length:CONFIG.maxLevel},(_,i)=>'<i class="'+(i<b.level?"on":"")+(i===3||i===6?" gap":"")+'"></i>').join("")+'</span>';
  this.html("inspect",'<header class="inspect-head frame-header"><div><div class="eyebrow">'+CONFIG.groups[d.group]+(b.id==="road"?"":' · Bậc '+["I","II","III"][tier])+' · Ô '+String.fromCharCode(65+b.x)+(b.y+1)+'</div><h3>'+CONFIG.buildingName(b)+(b.id==="road"?"":' <em>Cấp '+b.level+'</em>')+'</h3></div>'+this.btn("inspect-close",this.icon("close"),{cls:"frame-close",title:"Đóng thẻ",label:"Đóng thông tin công trình"})+'</header><div class="inspect-body"><img class="inspect-thumb" src="'+(this.renderer.spritePreview(b,w)||this.thumb(b.id))+'" alt=""><div class="inspect-main">'+stars+'<p class="muted">'+d.desc+'</p>'+extra+'<div class="actions">'+actions+'</div></div></div>');
 }
 sidebar(){
  const s=this.sim,w=s.social.world,friend=s.social.current;
  const small=innerWidth<=780||innerHeight<=640,shown=small?w.crises.slice(0,2):w.crises;
  let result=shown.map(c=>{
   const d=CONFIG.crises[c.id],job=w.npcs.find(n=>n.target===c.uid&&n.phase!=="return"),teams=s.crisis.teams(d.hq);
   let status=job?(job.blocked?"Đang chờ mở lối":c.progress>0?"Đang sửa · "+Math.round(c.progress*100)+"%":"Đội đang trên đường"):c.late?"Quá ngưỡng nguy hiểm":"Nguy hiểm sau "+Math.max(0,Math.ceil(d.danger-c.age))+" giây";
   if(!teams.length&&!job)status="Cần xây "+CONFIG.buildings[d.hq].name+" để điều phối "+d.npc+"!";
   const button=job?this.btn("dispatch","Đang điều phối",{id:c.uid,disabled:true}):this.btn("dispatch",friend?"Chi viện NPC":"Điều phối NPC",{id:c.uid,cls:"primary"});
   return '<div class="incident glass interactive">'+(teams.length||job?this.avatar(CONFIG.npcs[d.hq].avatar,"incident-face"):"")+'<div class="eyebrow"><span style="color:'+d.color+'">'+htm(d.icon)+'</span> '+(friend?"Sự cố thành phố bạn":"Cảnh báo sự cố")+'</div><h3>'+d.name+'</h3><p>'+d.penalty+'</p><small>'+status+'</small>'+this.bar(job&&c.progress>0?c.progress:c.age/d.danger,job?"blue":"danger")+button+
    (!teams.length&&!friend?this.btn("quick","Xây nhanh Trụ sở",{id:d.hq}):"")+'</div>';
  }).join("");
  if(shown.length<w.crises.length)result+='<div class="chips buffs"><span class="chip bad">+'+(w.crises.length-shown.length)+' sự cố khác trên bản đồ</span></div>';
  if(!friend){
   const pending=s.progress.decision&&CONTENT.decisions.find(d=>d.id===s.progress.decision.id);
   if(pending)result+='<div class="letter glass interactive">'+this.portrait(pending.who)+'<div><div class="eyebrow">✉ Thư từ '+CONTENT.cast[pending.who].name+'</div><h3>'+pending.title+'</h3>'+this.btn("decision","Mở thư",{cls:"primary"})+'</div></div>';
   const chips=[];
   if(s.world.activePolicy)chips.push('<span class="chip spec">'+CONFIG.policies[s.world.activePolicy.id].name+' · '+Math.ceil(s.world.activePolicy.left)+'s</span>');
   for(const b of s.world.buffs)chips.push('<span class="chip '+((b.income<1||b.happy<0||b.risk>1)?"bad":"good")+'">'+b.name+' · '+Math.ceil(b.left)+'s</span>');
   if(s.profile.combo>=2)chips.push('<span class="chip good">Chuỗi phản ứng ×'+s.profile.combo+'</span>');
   if(chips.length)result+='<div class="chips buffs">'+chips.join("")+'</div>';
  }
  this.html("right",result);
 }
 questTracker(badges){
  const s=this.sim,node=this.nodes["quest-track"];
  node.hidden=!!s.social.current;if(node.hidden)return;
  const chapter=s.prog.chapter(),claimed=chapter?.quests.filter(q=>s.progress.story.claimed.includes(q.id)).length||0;
  const summary=chapter?chapter.title:"Đô thị kiểu mẫu";
  const header=this.btn("quest-toggle",this.icon("story")+'<span><small>THEO DÕI CỐT TRUYỆN</small><b>'+summary+'</b></span>'+
   (chapter?'<i>'+claimed+'/'+chapter.quests.length+'</i>':"")+'<span class="quest-chevron" aria-hidden="true"></span>',{cls:"quest-toggle",expanded:this.questOpen,label:"Theo dõi cốt truyện · "+summary+(badges.story?" · "+badges.story+" phần thưởng":"")});
  const list=this.questOpen&&chapter?this.orderedProgress(chapter.quests,q=>s.prog.questState(q)).filter(x=>!x.st.claimed).slice(0,1):[];
  const body=list.map(({item:q,st})=>'<div class="quest'+(st.done?" ready":"")+'"><b>'+q.name+'</b><small>'+q.desc+'</small>'+
   (st.done?this.btn("claim","Nhận thưởng",{cls:"primary",id:q.id}):this.bar(st.cur/st.goal)+'<small class="count">'+fmt(st.cur)+' / '+fmt(st.goal)+'</small>')+'</div>').join("");
  this.html("quest-track",'<div class="quest-tracker game-frame interactive">'+header+(this.questOpen?'<div class="quest-body">'+body+
   this.btn("missions",chapter?"Xem tất cả nhiệm vụ":"Xem thành tựu",{id:chapter?"story":"ach"})+'</div>':"")+'</div>');
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
