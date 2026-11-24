"use strict";

// Hướng dẫn tân thủ: thư ký Mai chỉ từng bước, có vòng sáng quanh mục tiêu.
class TutorialManager {
 constructor(sim,ui){
  this.sim=sim;this.ui=ui;ui.tutorial=this;this.node=ui.nodes.coach;this.entered=-1;this.mark={};this.shown="";
  this.node.innerHTML='<div class="coach-ring"></div><div class="coach-bubble glass interactive"></div>';
  this.ring=this.node.firstChild;this.bubble=this.node.lastChild;
 }
 get state(){return this.sim.progress.tutorial}
 get active(){return !this.state.done}
 houses(){return this.sim.world.buildings.filter(b=>b.id==="house_small").length}
 freeTile(){
  const w=this.sim.world;let best=null;
  for(const r of w.buildings)if(r.id==="road")for(const [dx,dy] of steps){
   const x=r.x+dx,y=r.y+dy;if(!unlocked(w,x,y)||lookup(w,x,y))continue;
   const score=Math.abs(x-7.5)+Math.abs(y-7.5);if(!best||score<best.score)best={x,y,score};
  }
  return best;
 }
 steps(){
 const s=this.sim,ui=this.ui,w=s.world,q=sel=>document.querySelector(sel),m=this.mark;
  const build=()=>q('#build-tools [data-act="build"]');
  return [
   {text:"Trước hết mình cần thêm nhà cho dân về ở. Bấm <b>Xây dựng</b> để mở Kho bản vẽ.",target:build,done:()=>ui.catalogOpen||ui.tool==="build"},
   {text:"Chọn bản vẽ <b>Nhà cấp 4</b> trong danh sách.",target:()=>q('.blueprint[data-id="house_small"]')||build(),done:()=>ui.selection==="house_small"},
   {text:"Giờ chạm vào <b>ô đất đang nhấp nháy</b> cạnh đường để đặt nhà. Nhà kề đường mới thu đủ thuế.",tile:()=>this.freeTile(),
    back:()=>ui.selection!=="house_small"&&this.houses()<=m.houses,done:()=>this.houses()>m.houses},
   {text:"Tốt lắm! Tiếp theo chọn <b>Đường nhựa</b> rồi <b>kéo</b> trên bản đồ để vẽ thêm ít nhất 2 ô đường.",target:()=>ui.selection==="road"?null:q('.blueprint[data-id="road"]')||build(),done:()=>s.stats.roadsBuilt>=m.roads+2},
   {text:"Ôi, có sự cố rồi! Bấm <b>Điều phối NPC</b> trên thẻ cảnh báo để cử đội đi sửa.",enter:()=>this.stage(),target:()=>q('.incident [data-act="dispatch"]'),done:()=>w.npcs.length>0||s.stats.crisesSolved>m.solved||!w.crises.length},
   {text:"Đội đang chạy theo đường tới hiện trường. Đường càng thông suốt, đội đến càng nhanh — xử lý kịp thời sẽ được thưởng thêm.",done:()=>s.stats.crisesSolved>m.solved||(!w.crises.length&&!w.npcs.length)},
   {text:"Cư dân nộp thuế kìa! Chọn <b>Quan sát</b> rồi chạm vào <b>túi vàng</b> đang nổi trên công trình để thu.",enter:()=>this.coin(),tile:()=>w.bubbles[0],lift:44,done:()=>s.stats.bubbles>m.bubbles||!w.bubbles.length},
   {text:"Cuối cùng, mở <b>Nhiệm vụ</b> để xem cốt truyện và nhận thưởng nhé!",target:()=>q('#action-rail [data-act="missions"]'),done:()=>ui.dialogType==="missions"}
  ];
 }
 stage(){
  const s=this.sim,w=s.world;if(w.crises.length)return;
  const hq=["water_tower","power_plant"].find(id=>s.count(id)),target=w.buildings.find(b=>b.id==="house_small"&&b.left<=0)||w.buildings.find(b=>b.id!=="road"&&b.left<=0&&b.id!==hq);
  if(hq&&target)s.crisis.spawn(w,CONFIG.npcs[hq].crisis,target,true);
 }
 coin(){
  const s=this.sim,w=s.world;this.ui.setTool("look");this.ui.catalogOpen=false;
  if(w.bubbles.length)return;
  const b=w.buildings.find(x=>x.left<=0&&CONFIG.buildings[x.id].income>0);
  if(b)w.bubbles.push({uid:uid(),x:b.x,y:b.y,kind:"coin"});
 }
 restart(){this.entered=-1;this.sim.storage.save();this.ui.refresh()}
 skip(){this.finish(false)}
 finish(reward=true){
  const s=this.sim;this.state.done=true;this.hide();
  if(reward){this.ui.toast("Hoàn thành hướng dẫn! "+s.grant({coins:300,prestige:3}));s.audio.play("level")}
  s.world.crisisClock=0;s.world.bubbleClock=0;s.world.decisionClock=CONFIG.decisionInterval-75;
  if(s.prog.loginState().available)s.pending.push({type:"login"});
  s.storage.save();
 }
 hide(){if(!this.node.hidden){this.node.hidden=true;this.renderer().guide=null;this.shown=""}}
 renderer(){return this.ui.renderer}
 update(){
  const s=this.sim,ui=this.ui;
  if(!this.active){this.hide();return}
  if(ui.sceneState||s.social.current||!s.progress.story.seen.includes("c1_intro")){this.hide();return}
  const list=this.steps(),step=list[this.state.step];
  if(!step){this.finish();return}
  if(this.entered!==this.state.step){
   this.entered=this.state.step;this.mark={houses:this.houses(),roads:s.stats.roadsBuilt,solved:s.stats.crisesSolved,bubbles:s.stats.bubbles};step.enter?.();
  }
  if(step.done()){this.state.step++;s.audio.play("done");s.storage.save();if(this.state.step>=list.length)this.finish();return}
  if(step.back?.()){this.state.step--;return}
  if(ui.nodes.dialog.open){this.hide();return}
  this.node.hidden=false;
  const html='<div class="coach-row">'+ui.portrait("mai")+'<div><div class="eyebrow">Hướng dẫn · Bước '+(this.state.step+1)+'/'+list.length+'</div><p>'+step.text+'</p></div></div>'+ui.btn("coach-skip","Bỏ qua hướng dẫn",{cls:"ghost"});
  if(this.shown!==html){this.bubble.innerHTML=html;this.shown=html}
  const r=this.renderer(),tile=step.tile?.();let box=null;
  r.guide=tile&&!step.lift?{x:tile.x,y:tile.y}:null;
  if(tile){const p=r.project(tile.x+.5,tile.y+.5,step.lift||0),z=r.camera.zoom;box={left:p.x-34*z,top:p.y-(step.lift?20:18)*z,width:68*z,height:(step.lift?40:36)*z,round:true}}
  else{const el=step.target?.();if(el){const rect=el.getBoundingClientRect();if(rect.width)box={left:rect.left-5,top:rect.top-5,width:rect.width+10,height:rect.height+10}}}
  this.ring.hidden=!box;
  if(box){Object.assign(this.ring.style,{left:box.left+"px",top:box.top+"px",width:box.width+"px",height:box.height+"px"});this.ring.classList.toggle("tile",!!box.round)}
 }
}
