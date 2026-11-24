"use strict";
class AudioEngine {
 constructor(){this.enabled=true;this.context=null}
 unlock(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!this.context&&Audio)this.context=new Audio();if(this.context?.state==="suspended")this.context.resume().catch(()=>{});}catch(_){}}
 play(kind){
  const c=this.context;if(!this.enabled||!c||c.state!=="running")return;
  const score={click:[[440,0,.07,"sine"]],build:[[135,0,.18,"triangle"],[260,.04,.12,"sine"]],money:[[530,0,.12],[670,.08,.12],[795,.16,.19]],level:[[392,0,.17],[523,.08,.2],[659,.16,.2],[784,.24,.32]],alarm:[[450,0,.16,"triangle"],[580,.23,.18,"triangle"]],repair:[[740,0,.18],[990,.10,.25]],done:[[523,0,.12],[784,.09,.22]],mail:[[660,0,.1,"triangle"],[880,.12,.16,"triangle"]],talk:[[330,0,.05,"triangle"]],tab:[[520,0,.05,"sine"]]};
  for(const [frequency,delay,length,wave="sine"] of score[kind]||[]){
   const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type=wave;o.frequency.value=frequency;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(kind==="click"||kind==="talk"||kind==="tab"?.025:.085,t+.014);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g).connect(c.destination);o.start(t);o.stop(t+length+.01);
  }
 }
}
