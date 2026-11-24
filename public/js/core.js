"use strict";

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const coord=(x,y)=>y*CONFIG.size+x;
const steps=[[1,0],[-1,0],[0,1],[0,-1]];
const inside=(x,y)=>x>=0&&y>=0&&x<16&&y<16;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const unlocked=(w,x,y)=>inside(x,y)&&x>=8-w.unlockedRadius&&x<8+w.unlockedRadius&&y>=8-w.unlockedRadius&&y<8+w.unlockedRadius;
const lookup=(w,x,y)=>inside(x,y)?w.index.get(coord(x,y)):undefined;
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const today=()=>new Date().toLocaleDateString("sv-SE");
const fmt=(v,d=0)=>Number(v).toLocaleString("vi-VN",{maximumFractionDigits:d,minimumFractionDigits:d});
const timer=v=>Math.ceil(Math.max(0,v)/60)+ " phút";
const htm=value=>String(value).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const makeBuilding=(id,x,y,level=1,left=0)=>({id,x,y,level,left,total:left,age:0,crew:1,teamLevel:1,spec:null,missions:0});
const makeWorld=(buildings=[],level=1,rest={})=>{
 for(const b of buildings){b.spec??=null;b.missions??=0;b.level=clamp(b.level||1,1,CONFIG.maxLevel)}
 return {gridSize:16,unlockedRadius:CONFIG.radius(level),timeOfDay:.30,weather:"sunny",weatherClock:0,activePolicy:null,policyCooldowns:{},npcs:[],crises:[],crisisClock:0,speedBuff:0,immunity:0,happyDelta:0,
  buffs:[],bubbles:[],bubbleClock:0,decisionClock:0,...rest,buildings,index:new Map(buildings.map(b=>[coord(b.x,b.y),b]))};
};

class IsoMath {
 static gridToScreen(x,y,c){return {x:(x-y)*CONFIG.tileW/2*c.zoom+c.x,y:(x+y)*CONFIG.tileH/2*c.zoom+c.y}}
 static screenToGrid(x,y,c){
  const a=(x-c.x)/(CONFIG.tileW/2*c.zoom),b=(y-c.y)/(CONFIG.tileH/2*c.zoom);
  return {x:Math.floor((a+b)/2+1e-9),y:Math.floor((b-a)/2+1e-9)};
 }
}

class Pathfinding {
 static route(w,start,goal){
  if(!unlocked(w,start.x,start.y)||!unlocked(w,goal.x,goal.y))return null;
  const startKey=coord(start.x,start.y),end=coord(goal.x,goal.y),cost=new Float64Array(256).fill(Infinity),parent=new Int16Array(256).fill(-1);
  let open=[{key:startKey,g:0,f:distance(start,goal)}];cost[startKey]=0;
  while(open.length){
   open.sort((a,b)=>b.f-a.f||a.g-b.g);const {key,g}=open.pop();if(g!==cost[key])continue;
   if(key===end){
    const path=[];for(let k=end;k!==-1;k=parent[k])path.push({x:k%16,y:k>>4});
    return {path:path.reverse(),cost:g,offroad:path.some((p,i)=>i>0&&i<path.length-1&&!lookup(w,p.x,p.y))};
   }
   for(const [dx,dy] of steps){
    const x=key%16+dx,y=(key>>4)+dy;if(!unlocked(w,x,y))continue;
    const k=coord(x,y),b=lookup(w,x,y);if(k!==end&&b&&b.id!=="road")continue;
    const next=g+(b?1:4);if(next>=cost[k])continue;cost[k]=next;parent[k]=key;
    open.push({key:k,g:next,f:next+distance({x,y},goal)});
   }
  }
  return null;
 }
}
