"use strict";
const templates={season:["tet","trung-thu","quoc-khanh","giang-sinh","pho-xanh","cho-phien","xom-vui"],flash:["rush-hour","weekend-market"]};
const validId=id=>typeof id==="string"&&/^[a-z][a-z0-9-]{1,39}$/.test(id);
const read=db=>db.collection("eventConfigs").find({},{projection:{updatedAt:0}}).sort({_id:1}).limit(100).toArray();
function parse(id,input){
 const {kind,template,enabled,start,end,multiplier,rewards,name}=input||{};
 if(!validId(id)||!Object.hasOwn(templates,kind)||!templates[kind].includes(template)||typeof enabled!=="boolean")return null;
 if(templates.season.includes(id)&&!(kind==="season"&&id===template))return null;
 if(templates.flash.includes(id)&&!(kind==="flash"&&id===template))return null;
 const custom=!templates[kind].includes(id);
 if(custom&&kind!=="flash")return null;
 const date=value=>typeof value==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?Z$/.test(value)?Date.parse(value):NaN;
 const from=date(start),to=date(end);
 if((custom||start!=null||end!=null)&&(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>(kind==="flash"?7:60)*86400000))return null;
 if(typeof multiplier!=="number"||!Number.isFinite(multiplier)||multiplier<.1||multiplier>5)return null;
 if(!Array.isArray(rewards)||rewards.length!==3||!rewards.every(value=>Number.isInteger(value)&&value>=0&&value<=1000000))return null;
 if(custom&&(typeof name!=="string"||name.trim().length<2||name.length>45||/[<>\p{Cc}]/u.test(name)))return null;
 return {_id:id,kind,template,enabled,start:Number.isFinite(from)?new Date(from):null,end:Number.isFinite(to)?new Date(to):null,multiplier,rewards,...(custom?{name:name.trim()}:{}),updatedAt:new Date()};
}
module.exports={parse,read};
