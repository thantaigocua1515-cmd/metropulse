"use strict";

// Điều khiển bản đồ: kéo, thu phóng, vẽ đường liên tiếp, chạm chọn.
const UIInput = {
 wireCanvas(){
  const canvas=this.canvas,r=this.renderer;
  const pinchFrame=()=>{
   const [a,b]=this.pointers.values();
   return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,dist:Math.hypot(a.x-b.x,a.y-b.y)};
  };
  canvas.addEventListener("wheel",e=>{e.preventDefault();const p=r.local(e);r.zoom(Math.exp(-clamp(e.deltaY,-260,260)*.0016),p.x,p.y)},{passive:false});
  canvas.addEventListener("pointerdown",e=>{
   if(e.button>2)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
   const p=r.local(e);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===1){
    const touch=e.pointerType==="touch";
    this.gesture={start:p,last:p,startedAt:e.timeStamp,threshold:touch?8:5,touch,dragged:false,drawn:false,pan:e.button!==0||this.tool==="look"||touch,road:e.button===0&&this.tool==="build"&&this.selection==="road",old:null};
   }else if(this.pointers.size===2){
    this.gesture={pinch:true,frame:pinchFrame()};
   }
  });
  canvas.addEventListener("pointermove",e=>{
   const p=r.local(e);r.hover=IsoMath.screenToGrid(p.x,p.y,r.camera);
   if(!this.pointers.has(e.pointerId)||!this.gesture)return;
   this.pointers.set(e.pointerId,p);const action=this.gesture;
   if(action.pinch){
    if(this.pointers.size!==2)return;
    const frame=pinchFrame(),last=action.frame;
    r.pan(frame.x-last.x,frame.y-last.y);
    if(frame.dist>=1&&last.dist>=1)r.zoom(frame.dist/last.dist,frame.x,frame.y);
    action.frame=frame;return;
   }
   const dx=p.x-action.start.x,dy=p.y-action.start.y,distance=Math.hypot(dx,dy);
   if(!action.dragged){
    if(distance<=action.threshold)return;
    if(action.road)action.old=IsoMath.screenToGrid(action.start.x,action.start.y,r.camera);
    else action.last={x:action.start.x+dx*action.threshold/distance,y:action.start.y+dy*action.threshold/distance};
    action.dragged=true;
   }
   if(action.road){
    const now=IsoMath.screenToGrid(p.x,p.y,r.camera);
    if(!action.drawn){if(inside(action.old.x,action.old.y))this.sim.build("road",action.old.x,action.old.y);action.drawn=true}
    if(inside(now.x,now.y)&&inside(action.old.x,action.old.y)){
     let x=action.old.x,y=action.old.y;
     while(x!==now.x||y!==now.y){if(Math.abs(now.x-x)>=Math.abs(now.y-y))x+=Math.sign(now.x-x);else y+=Math.sign(now.y-y);this.sim.build("road",x,y)}
    }else if(inside(now.x,now.y))this.sim.build("road",now.x,now.y);
    action.old=now;
   }else if(action.pan){canvas.classList.add("drag");r.pan(p.x-action.last.x,p.y-action.last.y)}
   action.last=p;
  });
  const release=e=>{
   if(!this.pointers.has(e.pointerId))return;
   const action=this.gesture;this.pointers.delete(e.pointerId);
   if(!this.pointers.size){this.gesture=null;canvas.classList.remove("drag")}
   if(action?.pinch&&this.pointers.size===2)action.frame=pinchFrame();
   if(e.type!=="pointerup"||e.button!==0||!action||action.pinch||action.dragged)return;
   if(action.touch&&e.timeStamp-action.startedAt>=450)return;
   const p=r.local(e);
   if(Math.hypot(p.x-action.start.x,p.y-action.start.y)<=action.threshold)this.pick(action.touch?action.start:p);
  };
  canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);canvas.addEventListener("lostpointercapture",release);
  canvas.addEventListener("pointerleave",()=>r.hover=null);
 }
};
