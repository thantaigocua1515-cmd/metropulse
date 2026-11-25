"use strict";

const VERSION="4.1.0",PREFIX="metropulse-static-",CACHE=PREFIX+VERSION;
const root=new URL(self.registration.scope),shell=new URL("./",root).href;
const build=url=>new URL(url,root).href;
let cacheHandle;
const currentCache=()=>cacheHandle??=caches.has(CACHE).then(exists=>exists?caches.open(CACHE):null);
const staticPath=url=>url.origin===root.origin&&url.pathname.startsWith(root.pathname)&&
 /^(?:js\/[\w-]+\.js|css\/[\w-]+\.css|img\/(?:[\w-]+\.svg|(?:bld|npc)\/[\w/-]+\.webp))$/.test(url.pathname.slice(root.pathname.length))&&
 url.search==="?v="+VERSION;
const isAsset=res=>res.ok&&!res.redirected&&!/^text\/html\b/i.test(res.headers.get("content-type")||"");

async function cacheStatic(cache,href,request){
 const hit=await cache.match(href);
 if(hit)return hit;
 const res=await fetch(request||href,{cache:"force-cache"});
 if(isAsset(res))await cache.put(href,res.clone());
 return res;
}

self.addEventListener("install",event=>event.waitUntil((async()=>{
 const response=await fetch(shell,{cache:"reload"});
 if(!response.ok)throw Error("MetroPulse shell unavailable");
 const html=await response.clone().text();
 if(!html.includes('<meta name="mp-release" content="'+VERSION+'">'))throw Error("MetroPulse release mismatch");
 const core=[...html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+)"/g)].map(([,url])=>build(url));
 const pictures=["img/hud.svg","img/prestige.svg"].map(path=>build(path+"?v="+VERSION));
 const cache=await (cacheHandle=caches.open(CACHE));
 await Promise.all(core.concat(pictures).map(async href=>{
  if(!staticPath(new URL(href))||!isAsset(await cacheStatic(cache,href)))throw Error("MetroPulse asset unavailable");
 }));
 await cache.put(shell,response);
 await self.skipWaiting();
})()));

self.addEventListener("activate",event=>event.waitUntil((async()=>{
 await currentCache();
 await self.clients.claim();
 await Promise.all((await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
})()));

self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 const path=url.pathname.slice(root.pathname.length);
 if(path==="api"||path.startsWith("api/")||request.method!=="GET")return;
 if(request.mode==="navigate"&&(!path||path==="index.html")){
  event.respondWith((async()=>{
   try{return await fetch(request)}
   catch(error){
    const offline=await caches.match(shell,{cacheName:CACHE});
    if(offline)return offline;
    throw error;
   }
  })());
 }else if(staticPath(url)){
  event.respondWith(currentCache().then(cache=>cache?cacheStatic(cache,url.href,request):fetch(request)));
 }
});

self.addEventListener("message",event=>{
 const data=event.data;
 if(data?.type!=="warm"||data.version!==VERSION||!Array.isArray(data.urls))return;
 event.waitUntil((async()=>{
  const cache=await currentCache(),urls=new Set();
  if(!cache)return;
  for(const value of data.urls.slice(0,300)){
   if(typeof value!=="string")continue;
   const url=new URL(value,root);
   if(staticPath(url)&&url.pathname.slice(root.pathname.length).startsWith("img/"))urls.add(url.href);
  }
  await Promise.allSettled([...urls].map(href=>cacheStatic(cache,href)));
 })());
});
