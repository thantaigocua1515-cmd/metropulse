"use strict";

function enableOffline(sprites){
 if(!("serviceWorker" in navigator))return;
 const sw=navigator.serviceWorker,sent=new Set();
 const warm=worker=>{
  if(!worker||sent.has(worker))return;
  sent.add(worker);worker.postMessage({
   type:"warm",version:CONFIG.assetVersion,urls:sprites.concat(GameArt.urls(),performance.getEntriesByType("resource").filter(r=>/\/img\/(?:npc|art)\//.test(new URL(r.name).pathname)).map(r=>r.name))
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
 stage(2,"Đang đọc bản lưu và kiểm tra kết nối…");
 let remote=await cloud.init(bootHealth),data=StorageManager.load(cloud.saveCode,!cloud.readMeta("base"));
 if(cloud.online&&!cloud.account){
  boot.hidden=true;
  const mode=await AuthGate.open(cloud,!!data.restored);
  boot.hidden=false;
  if(mode!=="offline"){
   if(mode==="login")data=StorageManager.load(cloud.saveCode,!cloud.readMeta("base"));
   remote=await cloud.pull();
  }
 }
 data=cloud.selectBoot(data,remote);
 stage(3,"Đang dựng thành phố…");
 audio.enabled=data.sound!==false;
 audio.setMusic(data.musicEnabled,data.musicVolume);
 if(typeof data.reduceEffects!=="boolean")data.reduceEffects=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const sim=new SimulationEngine(data,audio);
 sim.underground=new Underground(sim);
 sim.crisis=new CrisisAndNPCManager(sim);
 sim.social=new SocialManager(sim,data.friends);
 sim.storage=new StorageManager(sim,cloud.saveCode);
 sim.prog=new ProgressionManager(sim);
 const params=new URLSearchParams(location.search);
 sim.events=new SeasonalEvents(sim,params.get("event")||"");
 sim.flash=new SeasonalEvents(sim,params.get("flash")||"",true);
 sim.legacy=new LegacyGoals(sim);
 cloud.attach(sim);
 const renderer=new IsoRenderer(document.getElementById("map"),sim),sprites=renderer.preloadCity(sim.world),ui=new UIController(sim,renderer);
 cloud.ui=ui;
 new TutorialManager(sim,ui);
 sim.prog.refresh();
 const offline=!cloud.conflict&&sim.storage.offline(data.lastSavedAt);
 if(offline)sim.pending.unshift({type:"offline",result:offline});else sim.storage.save();
 if(sim.progress.tutorial.done&&sim.prog.loginState().available)sim.pending.push({type:"login"});
 if(cloud.online){
  cloud.flush(true);
  ui.refreshMailbox().then(()=>{if(ui.mail.length)sim.pending.push({type:"mail"})}).catch(()=>{});
  setInterval(()=>{if(!document.hidden)ui.refreshMailbox().catch(()=>{})},120000);
 }
 if(cloud.enabled){
  const checkAnnouncements=()=>ui.loadAnnouncements().catch(()=>{});
  checkAnnouncements();addEventListener("online",checkAnnouncements);
 }
 const persist=()=>{sim.storage.save();cloud.flush(true,true)};
 addEventListener("pagehide",persist);
 document.addEventListener("visibilitychange",()=>{audio.syncMusic();if(document.visibilityState==="hidden")persist()});
 window.MetroPulse={sim,renderer,ui,cloud};
 stage(4,"Thành phố đã sẵn sàng.");
 sim.start(renderer,ui);
 requestAnimationFrame(()=>{
  boot.remove();
  if(cloud.conflict)ui.saveConflict();
  setTimeout(()=>enableOffline(sprites),0);
 });
})();
