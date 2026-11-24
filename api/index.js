"use strict";
// Điểm vào serverless (Vercel): cùng ứng dụng Express, kết nối MongoDB lười và tái sử dụng giữa các lần gọi.
const db=require("../server/db"),{createApp}=require("../server/index");
const app=createApp(()=>db.db);

module.exports=async(req,res)=>{
 const uri=process.env.MONGODB_URI;
 if(uri&&!db.db)try{await db.connect(uri,process.env.MONGODB_DB||"metropulse")}catch(error){console.error("Không kết nối được MongoDB:",error.message)}
 return app(req,res);
};
