"use strict";

const CONFIG = (() => {
 // [id, tên, nhóm, cấp mở, giá, giây xây, thu nhập, điện, nước, dân, hạnh phúc, rác, xp, màu, mô tả]
 const rows = [
  ["road","Đường nhựa","infra",1,15,0,0,0,0,0,0,0,2,"#536365","Nối mạng lưới di chuyển. Công trình không cạnh đường bị giảm 20% thu nhập."],
  ["house_small","Nhà cấp 4","res",1,80,4,6,-2,-2,10,0,3,25,"#ed8b64","Nhà ở và nguồn thu thuế cơ bản."],
  ["power_plant","Trạm Điện lực","svc",1,150,6,0,20,-2,0,0,2,35,"#dcae55","Cung cấp điện và điều phối Thợ Điện lực."],
  ["water_tower","Tháp Nước","svc",1,150,6,0,-2,20,0,0,1,35,"#64bdd1","Cung cấp nước và điều phối Kỹ sư Cấp nước."],
  ["mini_mart","Tiệm Tạp hóa","com",2,220,8,18,-4,-3,0,2,4,45,"#f2a871","Tăng thu nhập và Hạnh phúc. Mạnh hơn khi cạnh khu dân cư."],
  ["apartment","Chung cư mini","res",3,400,12,25,-6,-6,35,0,10,60,"#e0b282","Nhà ở mật độ cao."],
  ["fire_station","Trạm Cứu hỏa","svc",3,450,10,0,-4,-6,0,3,2,65,"#e76b62","Giảm rủi ro cháy; mở đội Cứu hỏa."],
  ["police_station","Đồn Công an","svc",4,550,12,0,-5,-4,0,5,2,75,"#76a9e1","Giảm kẹt xe; mở đội Cảnh sát Giao thông."],
  ["school","Trường Tiểu học","svc",4,600,14,0,-4,-4,0,6,2,85,"#f0c36b","Sinh Tri thức để nghiên cứu công nghệ và tăng Hạnh phúc."],
  ["night_market","Chợ Đêm","com",4,700,15,55,-8,-6,0,4,12,90,"#e898b0","Thu nhập cao, tạo nhiều lưu lượng và rác."],
  ["park","Công viên Xanh","special",5,500,8,5,-1,-4,0,12,-8,80,"#8bc66d","Tăng Hạnh phúc, xử lý 8 rác, +10% thu nhập cho nhà và cửa hàng kề bên."],
  ["construction_hq","Công ty Xây dựng","svc",5,850,15,10,-6,-4,0,0,4,100,"#e4aa59","Giảm 10% thời gian xây; mở đội Xây dựng."],
  ["hospital","Bệnh viện Đa khoa","svc",6,1200,18,0,-10,-10,0,10,4,120,"#e0e6dc","Phòng dịch; mở đội Y tế."],
  ["waste_plant","Trạm Xử lý Rác","svc",6,1100,16,15,-8,-6,0,4,-25,115,"#a6b87a","Xử lý 25 rác; mở đội Môi trường."],
  ["office_tower","Khu Văn phòng","com",7,2000,25,140,-15,-10,50,0,10,140,"#7ab6c5","Nguồn thu lớn nhưng tiêu thụ nhiều điện."],
  ["solar_plant","Nhà máy Điện Mặt trời","infra",7,2200,22,20,55,0,0,5,1,145,"#86abe5","Nguồn điện sạch, giảm nguy cơ quá tải."],
  ["mall","Trung tâm Thương mại","com",8,3800,30,280,-22,-16,0,8,15,165,"#cc9cdd","Nguồn thu chủ lực, lượng rác cao."],
  ["bank","Ngân hàng Đô thị","com",8,3200,28,220,-14,-6,0,2,4,160,"#d9c48a","Mỗi ngân hàng tăng 1 giờ trần thu nhập ngoại tuyến (tối đa 2)."],
  ["cyber_hub","Trung tâm An ninh Mạng","svc",9,5000,28,60,-20,-6,0,6,5,180,"#75d3b7","Giảm nguy cơ tấn công mạng; mở đội IT; sinh Tri thức."],
  ["metro_station","Ga Metro","infra",9,4500,30,40,-18,-4,0,8,2,175,"#8fa7d6","+15% thu nhập cho cửa hàng trong bán kính 2 ô, giảm một nửa nguy cơ kẹt xe."],
  ["tech_tower","Tòa tháp Công nghệ","special",10,8500,40,620,-35,-18,100,0,18,205,"#70cdd1","Lợi nhuận rất cao, sinh Tri thức, dễ gặp sự cố mạng."],
  ["university","Đại học Đô thị","svc",10,7000,36,60,-20,-12,40,10,6,195,"#c98f6b","Nguồn Tri thức lớn nhất thành phố."],
  ["trade_port","Cảng Giao thương","special",11,14000,50,950,-30,-20,0,10,14,225,"#d6ae71","Tăng 25% phần thưởng chi viện."],
  ["wind_farm","Trang trại Điện gió","infra",11,9000,34,30,95,0,0,4,0,200,"#dfe9ee","Nguồn điện sạch công suất lớn."],
  ["metro_wonder","Kỳ quan Đô thị","special",12,25000,60,1800,-40,-30,0,25,8,250,"#e6cef7","Tăng 20% tổng thu nhập thành phố."],
  ["stadium","Sân vận động","special",13,18000,55,1100,-35,-28,0,22,20,235,"#9fd08c","Niềm tự hào của cư dân: Hạnh phúc tăng mạnh."],
  ["museum","Bảo tàng Thành phố","special",14,22000,55,900,-18,-10,0,18,5,240,"#e3d3b1","Lưu giữ ký ức đô thị, sinh Tri thức và Hạnh phúc."],
  ["airport","Sân bay Quốc tế","special",16,45000,75,3600,-60,-35,0,12,25,300,"#b9c7d6","Cửa ngõ quốc tế: +10% thu nhập mọi công trình thương mại."]
 ];
 const tierNames = {
  house_small:["Nhà cấp 4","Nhà phố","Biệt thự vườn"],apartment:["Chung cư mini","Chung cư cao tầng","Căn hộ hạng sang"],
  mini_mart:["Tiệm Tạp hóa","Cửa hàng Tiện lợi","Siêu thị mini"],night_market:["Chợ Đêm","Phố Ẩm thực","Phố đi bộ"],
  office_tower:["Khu Văn phòng","Cao ốc Hạng A","Trung tâm Tài chính"],mall:["Trung tâm Thương mại","Đại siêu thị","Tổ hợp Mua sắm"],
  bank:["Ngân hàng Đô thị","Ngân hàng Trung tâm","Sàn Giao dịch"],power_plant:["Trạm Điện lực","Nhà máy Điện","Trung tâm Điều độ"],
  water_tower:["Tháp Nước","Nhà máy Nước","Hồ điều hòa"],park:["Công viên Xanh","Vườn Bách thảo","Công viên Trung tâm"],
  school:["Trường Tiểu học","Trường Liên cấp","Trường Chuyên"],university:["Đại học Đô thị","Đại học Quốc gia","Viện Hàn lâm"],
  tech_tower:["Tòa tháp Công nghệ","Thung lũng Số","Trung tâm AI"],metro_wonder:["Kỳ quan Đô thị","Biểu tượng Thế kỷ","Di sản Thế giới"]
 };
 const knowRate = {school:.04,cyber_hub:.06,tech_tower:.1,university:.15,museum:.08};
 const priceByUnlock = [0,1,4,6,8,12,16,30,50,60,90,105,120,160,180,200,225];
 const incomeByUnlock = [1,1,1,1,1,1,1,1,.85,.85,.75,.7,.65,.65,.65,.65,.6];
 const buildings = Object.fromEntries(rows.map(([id,name,group,unlock,price,duration,income,power,water,pop,happy,waste,xp,color,desc])=>
  [id,{id,name,group,unlock,price:price*priceByUnlock[unlock],duration,income:Math.round(income*incomeByUnlock[unlock]),power,water,pop,happy,waste,xp,color,desc,know:knowRate[id]||0,tiers:tierNames[id]||[name,name+" II",name+" III"]}]));
 const incidents = [
  ["blackout","Mất điện diện rộng","power_plant","Thợ Điện lực","ϟ","#ffce68","−50% doanh thu quanh điểm mất điện; không thể xây cạnh đó.",45,120,0,45,"Cư dân đang ăn cơm dưới ánh nến vì mất điện!","Đội trưởng Sơn",28],
  ["water_leak","Vỡ ống / Cúp nước","water_tower","Kỹ sư Cấp nước","≈","#7cdaff","−2% Hạnh phúc mỗi 5 giây.",45,0,0,45,"Vỉa hè bất ngờ biến thành đài phun nước.","Kỹ sư Thủy",5],
  ["collapse","Sập giàn giáo / Nứt tường","construction_hq","Kỹ sư Xây dựng","!","#ffc199","Đóng băng thi công; quá hạn tốn 10% giá trị để phục hồi.",80,0,0,45,"Đội thi công tạm nghỉ vì giàn giáo gặp sự cố.","Chỉ huy Tùng",4],
  ["traffic_jam","Kẹt xe / Tai nạn","police_station","Cảnh sát Giao thông","↔","#94aaff","−30% thu nhập thương mại; xe qua đây chậm 60%.",65,0,0,45,"Tắc đường: còi xe đang tranh giải dàn nhạc thành phố.","Thượng úy Hùng",8],
  ["fire","Hỏa hoạn cục bộ","fire_station","Lính Cứu hỏa","▲","#ff8d63","Mất toàn bộ thu nhập tại chỗ; có thể lan sau 45 giây.",100,0,2,45,"Khói bốc cao, đội phản ứng đang chờ lệnh xuất phát!","Đội trưởng Lửa",9],
  ["trash_pile","Quá tải rác / Ô nhiễm","waste_plant","Nhân viên Môi trường","✦","#bdd77e","−10% Hạnh phúc; khu dân cư ngừng cộng XP.",75,150,0,50,"Người dân xin đừng biến vỉa hè thành bãi rác.","Cô Sáu Xanh",36],
  ["flu_outbreak","Dịch cúm mùa","hospital","Đội Y tế / Bác sĩ","✚","#ff9f9f","−25% năng suất toàn thành phố; Hạnh phúc giảm.",110,0,0,50,"Khẩu trang trở lại, thành phố cần đội y tế.","Bác sĩ An",3],
  ["cyber_attack","Tấn công mạng","cyber_hub","Kỹ sư IT","⌘","#8dffb1","Đóng băng doanh thu Văn phòng và Công nghệ.",180,0,4,55,"Máy chủ báo gián đoạn; đội IT đang chờ điều phối.","Hacker mũ trắng Kha",30]
 ];
 const crises = Object.fromEntries(incidents.map(([id,name,hq,npc,icon,color,penalty,xp,coins,prestige,danger,news,captain,avatar])=>[id,{id,name,hq,npc,icon,color,penalty,xp,coins,prestige,danger,news,captain,avatar}]));
 const npcs = Object.fromEntries(Object.values(crises).map(c=>[c.hq,{name:c.npc,icon:c.icon,color:c.color,captain:c.captain,avatar:c.avatar,crisis:c.id}]));
 const vehicles = [
  {name:"Đi bộ",speed:1.8,repair:10},{name:"Xe đạp / Xe đẩy",speed:2.4,repair:8},
  {name:"Xe máy chuyên dụng",speed:3.2,repair:6},{name:"Xe tải kỹ thuật",speed:4,repair:4.5},
  {name:"Xe phản ứng nhanh",speed:5.2,repair:3}
 ];
 // Quân hàm đội: [số nhiệm vụ tối thiểu, tên, hệ số thời gian sửa]
 const ranks = [[0,"Tân binh",1],[5,"Lành nghề",.9],[15,"Tinh nhuệ",.8],[40,"Huyền thoại",.65]];
 const policies = {
  overtime:{name:"Tăng ca Thần tốc",desc:"Giảm 35% thời gian xây. Nguy cơ mất điện và sập giàn giáo +25%.",duration:120,cooldown:180,cost:0},
  festival:{name:"Lễ hội Đường phố",desc:"Tăng 50% thu nhập toàn thành phố, nhưng lượng rác sinh ra gấp đôi.",duration:90,cooldown:180,cost:0},
  green:{name:"Chiến dịch Đô thị Xanh",desc:"Tăng 20% Hạnh phúc và giảm 50% xác suất sự cố.",duration:120,cooldown:180,cost:2}
 };
 const specs = {
  res:{a:["Khu đông đúc","+40% dân số, +20% tiền thuế"],b:["Khu an cư","+3 Hạnh phúc, giảm một nửa lượng rác"]},
  com:{a:["Tối đa lợi nhuận","+35% thu nhập"],b:["Thân thiện cộng đồng","+4 Hạnh phúc, không bị ảnh hưởng bởi kẹt xe"]},
  svc:{a:["Phản ứng nhanh","Đội NPC di chuyển và sửa chữa nhanh hơn 25%"],b:["Phòng ngừa chủ động","Giảm 30% nguy cơ sự cố thuộc chuyên môn của đội"]},
  edu:{a:["Chương trình tài năng","+50% Tri thức sinh ra"],b:["Trường học hạnh phúc","+5 Hạnh phúc"]},
  infra:{a:["Tăng công suất","+40% sản lượng điện / nước"],b:["Vận hành ổn định","+3 Hạnh phúc, giảm nguy cơ mất điện và vỡ ống"]},
  special:{a:["Biểu tượng kinh tế","+30% thu nhập"],b:["Không gian cộng đồng","+6 Hạnh phúc"]}
 };
 const specGroup = id=>{
  const d=buildings[id];if(!d||id==="road")return null;
  if(d.know&&!npcs[id]&&d.group==="svc")return "edu";
  return d.group;
 };
 const cityRanks = [[0,"Thị trấn"],[400,"Thị xã"],[1500,"Thành phố trẻ"],[5000,"Đô thị loại I"],[15000,"Siêu đô thị"],[40000,"Đô thị huyền thoại"]];
 const heritageRanks=[[150000,"Đô thị Tiên phong"],[400000,"Đô thị Kiểu mẫu"],[800000,"Đô thị Di sản"],[1600000,"Thủ phủ Ngàn năm"]];
 // Bộ 36 chân dung trong public/img/npc. `pick` là các chân dung người chơi được chọn (không trùng nhân vật cốt truyện và đội trưởng).
 const avatars = {count:36,fallback:10,pick:[10,1,6,11,12,14,15,16,17,18,19,20,21,22,24,25,26,27,29,32,33,35],
  roles:["Ông lão đeo kính","Cô gái trẻ","Bác sĩ","Công nhân xây dựng","Kỹ sư","Học sinh","Bà lão","Công an","Lính cứu hỏa","Thị trưởng","Nông dân","Cô giáo","Nhà khoa học","Đầu bếp","Họa sĩ","Ngư dân","Bác sĩ trẻ","Doanh nhân","Thợ cắt tóc","Y tá","Shipper","Tiểu thương","Kiến trúc sư","Dược sĩ","Phi công","Nhạc sĩ","Vận động viên","Thợ điện","Thủ thư","Lập trình viên","Thầy giáo","Cô bán hoa","Tài xế xe buýt","Nhiếp ảnh gia","Chủ quán cà phê","Cô làm vườn"]};
 const mayorXP = [170,900,2000,5900,6000,9000,14000,18500,23000];
 return {avatars,buildings,crises,npcs,vehicles,ranks,policies,specs,specGroup,cityRanks,heritageRanks,size:16,tileW:64,tileH:32,starterCoins:500,baseIncome:4,baseKnowledge:.03,maxLevel:10,specLevel:5,
  crisisInterval:24,bubbleInterval:22,decisionInterval:210,key:"metropulse_save_v2",legacyKey:"metropulse_save_v1",
  xpNext:level=>mayorXP[level-1]??Math.floor(23000*(level/9)**1.25),
  utilityXP:{level:4,perSecond:2},
  upgradeBase:b=>Math.ceil(buildings[b.id].price*1.6**b.level),
  // Bậc tiến hóa: cấp 1–3 bậc I, 4–6 bậc II, 7–10 bậc III; bậc II cần Thị trưởng cấp 5, bậc III cần cấp 10.
  tier:level=>level>=7?2:level>=4?1:0,tierGate:level=>level>=6?10:level>=3?5:1,
  buildingName:b=>buildings[b.id].tiers[level2tier(b.level)],
  scale:level=>1+.35*(level-1),radius:level=>Math.min(8,4+Math.floor((level-1)/2)),
  rank:missions=>{let r=ranks[0];for(const x of ranks)if(missions>=x[0])r=x;return r},
  cityRank:(score,level=0)=>{const tiers=level>=16?cityRanks.concat(heritageRanks):cityRanks;let i=0;tiers.forEach((r,k)=>{if(score>=r[0])i=k});return {index:i,name:tiers[i][1],next:tiers[i+1]||null}},
  groups:{all:"Tất cả",infra:"Hạ tầng",res:"Dân cư",com:"Thương mại",svc:"Dịch vụ/NPC",special:"Đặc biệt"},
  weather:{sunny:["☀","Nắng đẹp"],heat:["◉","Nắng gắt"],storm:["☂","Mưa bão"]}
 };
 function level2tier(level){return level>=7?2:level>=4?1:0}
})();
