"use strict";
class AudioEngine {
 constructor(){this.enabled=true;this.context=null;this.musicEnabled=true;this.musicVolume=.35}
 unlock(){
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!this.context&&Audio)this.context=new Audio();
   if(this.context?.state==="suspended")this.context.resume().catch(()=>{});
   this.musicUnlocked=true;this.syncMusic();
  }catch(_){}
 }
 setMusic(enabled,volume){
  this.musicEnabled=enabled!==false;
  this.musicVolume=Number.isFinite(volume)?clamp(volume,0,1):.35;
  this.syncMusic();
 }
 musicGain(value,fade=.12){
  if(!this.music)return;
  const gain=this.musicBus?.gain,time=this.context?.currentTime;
  if(!gain){this.music.volume=value;return}
  gain.cancelScheduledValues(time);gain.setTargetAtTime(value,time,fade);
 }
 syncMusic(){
  if(!this.musicUnlocked)return;
  clearTimeout(this.musicStop);
  if(document.hidden){
   this.musicGain(0,.01);this.music?.pause();return;
  }
  if(!this.musicEnabled){
   this.musicGain(0,.07);
   if(this.music)this.musicStop=setTimeout(()=>{if(!this.musicEnabled)this.music.pause()},320);
   return;
  }
  if(!this.music){
   const src=asset("audio/turning-pages.mp3"),media=new Audio(src);
   media.loop=true;this.music=media;
   media.addEventListener("playing",()=>navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({type:"warm",version:CONFIG.assetVersion,urls:[src]})).catch(()=>{}),{once:true});
   if(this.context){
    this.musicBus=this.context.createGain();this.musicBus.gain.value=0;
    this.context.createMediaElementSource(media).connect(this.musicBus).connect(this.context.destination);
   }
  }
  this.musicGain(this.musicVolume);
  if(this.music.paused)this.music.play().catch(()=>{});
 }
 play(kind){
  const c=this.context;if(!this.enabled||!c||c.state!=="running")return;
  const score={click:[[440,0,.07,"sine"]],build:[[135,0,.18,"triangle"],[260,.04,.12,"sine"]],money:[[530,0,.12],[670,.08,.12],[795,.16,.19]],level:[[392,0,.17],[523,.08,.2],[659,.16,.2],[784,.24,.32]],alarm:[[450,0,.16,"triangle"],[580,.23,.18,"triangle"]],repair:[[523,0,.12],[659,.07,.15],[784,.14,.21]],done:[[523,0,.12],[784,.09,.22]],upgrade:[[440,0,.12],[659,.055,.13],[880,.115,.22]],pickup:[[784,0,.085],[1047,.065,.16]],mail:[[660,0,.1,"triangle"],[880,.12,.16,"triangle"]],talk:[[330,0,.05,"triangle"]],tab:[[520,0,.05,"sine"]]};
  const notes=score[kind];if(!notes)return;
  if(this.musicEnabled&&!document.hidden&&this.music&&!this.music.paused){
   this.musicGain(this.musicVolume*.68,.035);
   clearTimeout(this.musicRestore);
   this.musicRestore=setTimeout(()=>{if(this.musicEnabled&&!document.hidden)this.musicGain(this.musicVolume)},Math.max(...notes.map(([,delay,length])=>delay+length))*1000);
  }
  for(const [frequency,delay,length,wave="sine"] of notes){
   const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type=wave;o.frequency.value=frequency;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(kind==="click"||kind==="talk"||kind==="tab"?.025:.085,t+.014);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g).connect(c.destination);o.start(t);o.stop(t+length+.01);
  }
 }
}
