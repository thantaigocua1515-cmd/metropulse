"use strict";
// MongoDB tạm trong bộ nhớ để phát triển khi chưa có Atlas: node scripts/dev-db.js
const {MongoMemoryServer}=require("mongodb-memory-server");
(async()=>{
 const server=await MongoMemoryServer.create({instance:{port:Number(process.env.DEV_DB_PORT)||27018,dbName:"metropulse"}});
 console.log("MONGODB_URI="+server.getUri());
 const stop=()=>server.stop().finally(()=>process.exit(0));
 process.on("SIGINT",stop);process.on("SIGTERM",stop);
})();
