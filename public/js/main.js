"use strict";

function enableOffline(sprites){
 if(!("serviceWorker" in navigator))return;
 const sw=navigator.serviceWorker,sent=new Set();
 const warm=worker=>{
  if(!worker||sent.has(worker))return;
  sent.add(worker);worker.postMessage({
   type:"warm",version:CONFIG.assetVersion,urls:sprites.concat(performance.getEntriesByType("resource").filter(r=>r.initiatorType==="img"&&new URL(r.name).pathname.includes("/img/npc/")).map(r=>r.name))
  });
 };
 sw.addEventListener("controllerchange",()=>warm(sw.controller));
 sw.register("sw.js",{updateViaCache:"none"}).then(()=>sw.ready).then(reg=>warm(reg.active)).catch(()=>{});
}

// Khởi động: nạp bản lưu trong trình duyệt, so với bản trên máy chủ (nếu có), rồi dựng trò chơi.
(async()=>{
 const boot=document.getElementById("boot"),audio=new AudioEngine(),cloud=new CloudClient();
 const stage=(value,text)=>{
  document.getElementById("boot-progress").value=value;
  document.getElementById("boot-status").textContent=text;
 };
 let data=StorageManager.load();
 stage(2,"Đang đọc bản lưu và kiểm tra kết nối…");
 let remote=await cloud.init(bootHealth),force=false;
 if(cloud.online&&!cloud.account){
  boot.hidden=true;
  const mode=await AuthGate.open(cloud,!!data.restored);
  boot.hidden=false;
  if(mode!=="offline")remote=await cloud.pull();
  // Đăng nhập sang tài khoản khác: thành phố của tài khoản luôn được ưu tiên hơn bản lưu trên trình duyệt.
  force=mode==="login"&&data.profile.mayorId!==cloud.account?.code;
 }
 if(remote?.data){
  const cloudData=StorageManager.normalize(remote.data);
  if(cloudData&&(force||!data.restored||(cloudData.lastSavedAt||0)>(data.lastSavedAt||0)))data=cloudData;
 }
 stage(3,"Đang dựng thành phố…");
 audio.enabled=data.sound!==false;
 audio.setMusic(data.musicEnabled,data.musicVolume);
 if(typeof data.reduceEffects!=="boolean")data.reduceEffects=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const sim=new SimulationEngine(data,audio);
 sim.crisis=new CrisisAndNPCManager(sim);
 sim.social=new SocialManager(sim,data.friends);
 sim.storage=new StorageManager(sim);
 sim.prog=new ProgressionManager(sim);
 const params=new URLSearchParams(location.search);
 sim.events=new SeasonalEvents(sim,params.get("event")||"");
 sim.flash=new SeasonalEvents(sim,params.get("flash")||"",true);
 sim.legacy=new LegacyGoals(sim);
 cloud.attach(sim);
 const renderer=new IsoRenderer(document.getElementById("map"),sim),sprites=renderer.preloadCity(sim.world),ui=new UIController(sim,renderer);
 new TutorialManager(sim,ui);
 sim.prog.refresh();
 const offline=sim.storage.offline(data.lastSavedAt);
 if(offline)sim.pending.unshift({type:"offline",result:offline});else sim.storage.save();
 if(sim.progress.tutorial.done&&sim.prog.loginState().available)sim.pending.push({type:"login"});
 if(cloud.online){
  cloud.flush(true);
  cloud.mailbox().then(gifts=>{ui.mail=gifts;if(gifts.length)sim.pending.push({type:"mail"})}).catch(()=>{});
 }
 const persist=()=>{sim.storage.save();cloud.flush(true,true)};
 addEventListener("pagehide",persist);
 document.addEventListener("visibilitychange",()=>{audio.syncMusic();if(document.visibilityState==="hidden")persist()});
 window.MetroPulse={sim,renderer,ui,cloud};
 stage(4,"Thành phố đã sẵn sàng.");
 sim.start(renderer,ui);
 requestAnimationFrame(()=>{
  boot.remove();
  setTimeout(()=>enableOffline(sprites),0);
 });
})();
