"use strict";

const GameArt=(()=>{
 const pics=new Map(),paths=new Set(),data=ART_DATA,standalone=new Set(data.images);
 function image(name){
  if(!pics.has(name)){
   const image=new Image(),url=asset("img/art/"+name+".webp");
   image.decoding="async";image.src=url;paths.add(url);pics.set(name,image);
  }
  const image=pics.get(name);
  return image.naturalWidth?image:null;
 }
 function draw(g,group,key,x,y,w,h=w,{ground=false,mirror=false,stretch=false}={}){
  const ref=data.groups[group]?.[key],img=ref&&image(group);if(!img)return false;
  const [,sx,sy,sw,sh]=ref,fit=Math.min(w/sw,h/sh);
  if(!stretch){w=sw*fit;h=sh*fit}
  const top=y-(ground?h:h/2),left=x-w/2;
  if(mirror){g.save();g.translate(x,0);g.scale(-1,1);g.drawImage(img,sx,sy,sw,sh,-w/2,top,w,h);g.restore()}
  else g.drawImage(img,sx,sy,sw,sh,left,top,w,h);
  return true;
 }
 function install(){
  const style=document.createElement("style"),root=document.documentElement;
  const cssURL=name=>'url("'+new URL(asset("img/art/"+name+".webp"),document.baseURI).href+'")';
  const [w,h]=data.hudSize,cell=data.cell,unit=data.hudCell,css=[];
  for(const [key,[,x,y,iw,ih]] of Object.entries(data.hud)){
   const left=x-Math.floor((unit-iw)/2),top=y-Math.floor((unit-ih)/2);
   css.push('.art-hud [data-hud-art="'+key+'"]{--hud-fallback:hidden;--hud-picture:var(--hud-art);background-position:'+
    (w>unit?100*left/(w-unit):0)+'% '+(h>unit?100*top/(h-unit):0)+'%}');
  }
  if(w){
   root.style.setProperty("--hud-art",cssURL("hud"));
   root.style.setProperty("--hud-art-size",(100*w/unit)+"% "+(100*h/unit)+"%");
   const loaded=new Image(),url=asset("img/art/hud.webp");
   loaded.onload=()=>{paths.add(url);root.classList.add("art-hud")};loaded.src=url;
  }
  function decorate(group,mode,select,rules){
   const keys=Object.entries(data.groups[group]||{});
   if(!keys.length)return;
   const url=asset("img/art/"+group+".webp"),cols=Math.min(4,keys.length),rows=Math.ceil(keys.length/cols);
   const load=()=>{
    const loaded=new Image();
    loaded.onload=()=>{paths.add(url);root.classList.add("art-"+mode)};loaded.src=url;
   };
   for(const [key,[,x,y,iw,ih]] of keys.filter(([key])=>select(key))){
    const left=x-Math.floor((cell-iw)/2),top=y-Math.floor((cell-ih)/2);
    css.push('.art-'+mode+' [data-'+mode+'-art="'+key+'"]{'+rules+';background-image:'+cssURL(group)+';background-size:'+(cols*100)+'% '+(rows*100)+'%;background-position:'+
     (cols>1?100*left/((cols-1)*cell):0)+'% '+(rows>1?100*top/((rows-1)*cell):0)+'%}');
   }
   return load;
  }
  decorate("events-tokens","event",()=>true,"color:transparent")?.();
  loadCelebration=decorate("vfx-construction-celebration","confetti",key=>key.startsWith("confetti-"),"background-color:transparent");
  for(const name of standalone){
   const url=cssURL(name);
   if(name.startsWith("ui-"))root.style.setProperty("--art-"+name,url);
   else css.push('[data-art-bg="'+name+'"]{--art-bg:'+url+'}');
  }
  style.textContent=css.join("\n");document.head.append(style);
 }
 let loadCelebration;
 function celebration(){loadCelebration?.();loadCelebration=null}
 return {draw,image(name){return standalone.has(name)?image(name):null},ready:name=>!!pics.get(name)?.naturalWidth,
  install,celebration,urls:()=>[...paths]};
})();
GameArt.install();
