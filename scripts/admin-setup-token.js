"use strict";
const db=require("../server/db"),{adminOrigin,issueSetupToken}=require("../server/admin-auth");

(async()=>{
 const origin=adminOrigin();
 if(!origin||!process.env.MONGODB_URI)throw new Error("Cần cung cấp ADMIN_ORIGIN (HTTPS) và MONGODB_URI qua môi trường tin cậy.");
 const connection=await db.connect(process.env.MONGODB_URI,process.env.MONGODB_DB||"metropulse");
 const {token,expiresAt}=await issueSetupToken(connection);
 console.log(origin+"/admin#setup="+token);
 console.log("Hết hạn vào "+expiresAt.toISOString()+". Chỉ gửi liên kết qua kênh riêng.");
})().catch(error=>{console.error(error.status===409?error.message:"Không tạo được liên kết. Kiểm tra cấu hình HTTPS và kết nối MongoDB.");process.exitCode=1})
 .finally(()=>db.close());
