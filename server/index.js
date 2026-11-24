"use strict";
const path=require("path"),fs=require("fs"),express=require("express");
const db=require("./db"),routes=require("./routes");

// Nạp .env nếu có (không cần thư viện ngoài).
const envFile=path.join(__dirname,"../.env");
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,"utf8").split("\n")){
 const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
 if(match&&process.env[match[1]]===undefined)process.env[match[1]]=match[2].replace(/^["']|["']$/g,"");
}

function createApp(getDb){
 const app=express();
 app.disable("x-powered-by");app.set("trust proxy",1);
 app.use((req,res,next)=>{res.set({"X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin"});next()});
 app.use("/api",express.json({limit:"600kb"}),routes(getDb));
 app.use(express.static(path.join(__dirname,"../public"),{extensions:["html"],setHeaders:res=>res.set("Cache-Control","no-cache")}));
 return app;
}

async function main(){
 const port=Number(process.env.PORT)||8080,uri=process.env.MONGODB_URI;
 const app=createApp(()=>db.db);
 const server=app.listen(port,()=>console.log("MetroPulse đang chạy tại http://localhost:"+port));
 if(!uri)console.warn("Chưa đặt MONGODB_URI: trò chơi chỉ lưu trên trình duyệt, các API đám mây trả về 503.");
 else{
  // Thử kết nối lại định kỳ để máy chủ tự hồi phục khi cơ sở dữ liệu tạm thời không truy cập được.
  const attempt=async()=>{
   try{await db.connect(uri,process.env.MONGODB_DB||"metropulse");console.log("Đã kết nối MongoDB.")}
   catch(error){console.error("Không kết nối được MongoDB:",error.message);await db.close().catch(()=>{});setTimeout(attempt,15000).unref()}
  };
  attempt();
 }
 const stop=()=>server.close(()=>db.close().finally(()=>process.exit(0)));
 process.on("SIGINT",stop);process.on("SIGTERM",stop);
}

if(require.main===module)main();
module.exports={createApp};
