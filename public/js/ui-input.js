"use strict";

// Điều khiển bản đồ: kéo, thu phóng, vẽ đường liên tiếp, chạm chọn.
const UIInput = {
 wireCanvas(){
  const canvas=this.canvas,r=this.renderer;
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  canvas.addEventListener("wheel",e=>{e.preventDefault();const p=r.local(e);r.zoom(Math.exp(-clamp(e.deltaY,-260,260)*.0016),p.x,p.y)},{passive:false});
  canvas.addEventListener("pointerdown",e=>{
   if(e.button>2)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
   const p=r.local(e);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===1){
    this.gesture={id:e.pointerId,start:p,last:p,dragged:false,drawn:false,pan:e.button!==0||this.tool==="look",touch:e.pointerType==="touch",road:e.button===0&&this.tool==="build"&&this.selection==="road",old:null};
   }else if(this.pointers.size===2){
    this.gesture={pinch:true};const [a,b]=this.pointers.values();this.pinch={mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},dist:Math.hypot(a.x-b.x,a.y-b.y)};
   }
  });
  canvas.addEventListener("pointermove",e=>{
   const p=r.local(e);r.hover=IsoMath.screenToGrid(p.x,p.y,r.camera);
   if(!this.pointers.has(e.pointerId)||!this.gesture)return;
   this.pointers.set(e.pointerId,p);const action=this.gesture;
   if(action.pinch){
    if(this.pointers.size!==2)return;
    const [a,b]=this.pointers.values(),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},dist=Math.hypot(a.x-b.x,a.y-b.y);
    r.pan(mid.x-this.pinch.mid.x,mid.y-this.pinch.mid.y);r.zoom(dist/Math.max(1,this.pinch.dist),mid.x,mid.y);this.pinch={mid,dist};return;
   }
   const dragged=Math.hypot(p.x-action.start.x,p.y-action.start.y)>5;
   if(dragged||action.dragged){
    if(!action.dragged&&action.road)action.old=IsoMath.screenToGrid(action.start.x,action.start.y,r.camera);
    action.dragged=true;
    if(action.road){
     const now=IsoMath.screenToGrid(p.x,p.y,r.camera);
     if(!action.drawn){if(inside(action.old.x,action.old.y))this.sim.build("road",action.old.x,action.old.y);action.drawn=true}
     if(inside(now.x,now.y)&&inside(action.old.x,action.old.y)){
      let x=action.old.x,y=action.old.y;
      while(x!==now.x||y!==now.y){if(Math.abs(now.x-x)>=Math.abs(now.y-y))x+=Math.sign(now.x-x);else y+=Math.sign(now.y-y);this.sim.build("road",x,y)}
     }else if(inside(now.x,now.y))this.sim.build("road",now.x,now.y);
     action.old=now;
    }else if(action.pan||action.touch){canvas.classList.add("drag");r.pan(p.x-action.last.x,p.y-action.last.y)}
   }
   action.last=p;
  });
  const release=e=>{
   const action=this.gesture;this.pointers.delete(e.pointerId);
   if(!this.pointers.size){this.gesture=null;canvas.classList.remove("drag")}
   if(e.type==="pointerup"&&e.button===0&&action&&!action.pinch&&!action.dragged)this.pick(r.local(e));
  };
  canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);canvas.addEventListener("lostpointercapture",e=>{if(this.pointers.has(e.pointerId))release(e)});
  canvas.addEventListener("pointerleave",()=>r.hover=null);
 }
};
