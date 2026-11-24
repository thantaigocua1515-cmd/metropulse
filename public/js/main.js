"use strict";

// Khởi động: nạp bản lưu trong trình duyệt, so với bản trên máy chủ (nếu có), rồi dựng trò chơi.
(async()=>{
 const boot=document.getElementById("boot"),audio=new AudioEngine(),cloud=new CloudClient();
 let data=StorageManager.load();
 const remote=await cloud.init();
 if(remote?.data){
  const cloudData=StorageManager.normalize(remote.data);
  if(cloudData&&(!data.restored||(cloudData.lastSavedAt||0)>(data.lastSavedAt||0)))data=cloudData;
 }
 audio.enabled=data.sound!==false;
 const sim=new SimulationEngine(data,audio);
 sim.crisis=new CrisisAndNPCManager(sim);
 sim.social=new SocialManager(sim,data.friends);
 sim.storage=new StorageManager(sim);
 sim.prog=new ProgressionManager(sim);
 cloud.attach(sim);
 const renderer=new IsoRenderer(document.getElementById("map"),sim),ui=new UIController(sim,renderer);
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
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persist()});
 window.MetroPulse={sim,renderer,ui,cloud};
 boot?.remove();
 sim.start(renderer,ui);
})();
