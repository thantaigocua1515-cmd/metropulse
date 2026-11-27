"use strict";

// Nội dung: nhân vật, cốt truyện, nghiên cứu, thành tựu, nhiệm vụ ngày, điểm danh, thư quyết định.
const CONTENT = (() => {
 const cast = {
  mai:{name:"Mai",role:"Thư ký trưởng",avatar:2},
  bach:{name:"Ông Bách",role:"Kỹ sư trưởng",avatar:23},
  vy:{name:"Vy",role:"Phóng viên Bản tin Đô thị",avatar:34},
  hanh:{name:"Bà Hạnh",role:"Tổ trưởng dân phố",avatar:7},
  quan:{name:"Ông Quân",role:"Chủ tịch Tập đoàn Kim Long",avatar:31},
  lam:{name:"Tiến sĩ Lam",role:"Viện trưởng Viện Quy hoạch",avatar:13}
 };
 const q=(id,name,desc,[coins,xp,prestige,know],prog,guide)=>({id,name,desc,coins,xp,prestige,know,prog,guide});
 const has=(s,id,n=1)=>[Math.min(n,s.count(id)),n];
 const sum=(...pairs)=>[pairs.reduce((a,p)=>a+p[0],0),pairs.reduce((a,p)=>a+p[1],0)];
 const chapters = [
  {id:"c1",title:"Di sản của chú Tư",subtitle:"Chương 1 · Thị trấn Bình Minh",
   intro:[["mai","Chào Thị trưởng! Em là Mai, thư ký của chú Tư suốt mười năm qua. Chú nghỉ hưu rồi, và chú chọn anh/chị kế nhiệm."],
    ["mai","Thị trấn Bình Minh giờ chỉ còn một ngã tư, một căn nhà, trạm điện và tháp nước. Nhưng em tin mình sẽ làm nó sống lại."],
    ["quan","Xin lỗi vì chen ngang. Tôi là Quân, Tập đoàn Kim Long. Nếu sau sáu kỳ đánh giá thị trấn này vẫn èo uột, tỉnh sẽ giao đất cho chúng tôi."],
    ["mai","…Ông ta nói thật đấy ạ. Mình bắt đầu thôi: thêm nhà cho dân về ở, rồi nối đường cho thông suốt!"]],
   quests:[
    q("c1_home","Mái ấm đầu tiên","Có 3 Nhà cấp 4 đang hoạt động.",[150,60,1,0],s=>has(s,"house_small",3),{build:"house_small"}),
    q("c1_road","Mạng lưới đầu tiên","Nối liền ít nhất 14 ô Đường nhựa.",[180,70,1,0],s=>[Math.min(14,s.roadChain()),14],{build:"road"}),
    q("c1_shop","Tiệm tạp hóa đầu ngõ","Lên cấp 2 và xây một Tiệm Tạp hóa.",[220,80,1,5],s=>has(s,"mini_mart"),{build:"mini_mart"}),
    q("c1_fix","Phản ứng đầu tiên","Điều phối đội xử lý thành công 1 sự cố.",[250,90,2,5],s=>[Math.min(1,s.stats.crisesSolved),1]),
    q("c1_tax","Túi thuế đầu tay","Thu 3 túi thuế nổi trên các công trình.",[200,60,1,5],s=>[Math.min(3,s.stats.bubbles),3])],
   outro:[["hanh","Thị trưởng ơi, bà con trong tổ nhờ tôi cảm ơn. Lâu lắm rồi đèn đường mới sáng lại."],
    ["mai","Kỳ đánh giá đầu tiên: ĐẠT! Ông Quân vừa gọi hỏi thăm, giọng không vui lắm đâu ạ."]],
   reward:{coins:600,prestige:5,know:15}},
  {id:"c2",title:"Những người hàng xóm",subtitle:"Chương 2 · Dân về, việc tới",
   intro:[["hanh","Người ta nghe Bình Minh hồi sinh nên kéo về đông lắm. Nhà cấp 4 không đủ nữa rồi Thị trưởng ạ."],
    ["bach","Tôi là Bách, kỹ sư trưởng. Dân đông thì cháy nổ, vỡ ống là chuyện sớm muộn. Xây trạm cứu hỏa trước khi quá muộn."],
    ["mai","Và đừng quên nâng cấp công trình: mỗi cấp tăng 35% hiệu suất đó ạ!"]],
   quests:[
    q("c2_apart","An cư lạc nghiệp","Xây một Chung cư mini.",[400,110,1,5],s=>has(s,"apartment"),{build:"apartment"}),
    q("c2_fire","Lá chắn lửa","Xây Trạm Cứu hỏa.",[450,120,2,5],s=>has(s,"fire_station"),{build:"fire_station"}),
    q("c2_up","Sửa sang nhà cửa","Nâng cấp công trình 5 lần.",[500,130,2,10],s=>[Math.min(5,s.stats.upgrades),5],{upgrade:true}),
    q("c2_income","Thành phố làm ăn","Đạt 60 Vàng/giây.",[600,150,2,10],s=>[Math.min(60,Math.floor(s.stats.peakIncome)),60]),
    q("c2_solve","Đội phản ứng tin cậy","Xử lý tổng cộng 5 sự cố.",[550,150,2,10],s=>[Math.min(5,s.stats.crisesSolved),5])],
   outro:[["vy","Vy đây, Bản tin Đô thị! Bài «Thị trấn ngủ quên đã thức giấc» đang đứng đầu lượt đọc tuần này."],
    ["quan","Khá đấy. Nhưng thành phố lớn thì rắc rối lớn. Tôi vẫn đang chờ."]],
   reward:{coins:1500,prestige:6,know:30}},
  {id:"c3",title:"Đêm không ngủ",subtitle:"Chương 3 · Ánh đèn phố thị",
   intro:[["vy","Thị trưởng có biết giới trẻ gọi Bình Minh là gì không? «Thị trấn đi ngủ lúc tám giờ» đấy!"],
    ["mai","Mình mở Chợ Đêm đi ạ! Nhưng đông vui thì kẹt xe, nên cần Đồn Công an và cả trường học cho bọn trẻ."],
    ["lam","Tôi là Lam ở Viện Quy hoạch. Có trường học, thành phố sẽ sinh Tri thức. Mang Tri thức đến viện, tôi đổi cho anh/chị công nghệ."]],
   quests:[
    q("c3_market","Phố lên đèn","Xây Chợ Đêm.",[700,160,2,10],s=>has(s,"night_market"),{build:"night_market"}),
    q("c3_school","Ươm mầm tri thức","Xây Trường Tiểu học.",[650,160,2,15],s=>has(s,"school"),{build:"school"}),
    q("c3_research","Phát minh đầu tiên","Nghiên cứu 1 công nghệ tại Viện Quy hoạch.",[700,170,2,10],s=>[Math.min(1,s.stats.research),1],{panel:"research"}),
    q("c3_policy","Một quyết định lớn","Ban hành một Sắc lệnh Thị trưởng.",[800,180,3,10],s=>[Math.min(1,s.stats.policies),1],{panel:"policies"}),
    q("c3_park","Khoảng trời xanh","Xây Công viên Xanh và đạt 112% Hạnh phúc.",[900,200,3,15],s=>sum(has(s,"park"),[s.metrics.happiness>=112?1:0,1]),{build:"park",ifMissing:true}),
    q("c3_crew","Đội ngũ chuyên nghiệp","Nâng phương tiện một đội NPC lên cấp 2.",[700,170,2,10],s=>[Math.min(2,s.stats.npcLevel),2],{panel:"teams"})],
   outro:[["hanh","Tối qua cả tổ tôi ra chợ đêm. Vui thì vui thật, mà rác nhiều quá Thị trưởng ơi…"],
    ["bach","Đài báo có áp thấp ngoài khơi. Tôi không thích cái kiểu trời đứng gió thế này chút nào."]],
   reward:{coins:3000,prestige:8,know:50}},
  {id:"c4",title:"Cơn bão thế kỷ",subtitle:"Chương 4 · Thử lửa",
   intro:[["bach","Bão sắp vào. Lưới điện, đường ống, giàn giáo… cái gì yếu là gãy. Ta cần bệnh viện và trạm xử lý rác ngay."],
    ["quan","Thị trưởng à, tôi có sẵn hợp đồng mua lại hạ tầng đây. Ký đi, đỡ phải thức trắng vì sự cố."],
    ["mai","Mình không ký đâu ạ! Giữ chuỗi phản ứng nhanh, đừng để sự cố nào quá hạn. Cả thành phố đang nhìn vào mình."]],
   quests:[
    q("c4_hospital","Tuyến đầu","Xây Bệnh viện Đa khoa.",[1200,220,3,15],s=>has(s,"hospital"),{build:"hospital"}),
    q("c4_waste","Thành phố sạch","Xây Trạm Xử lý Rác.",[1100,220,3,15],s=>has(s,"waste_plant"),{build:"waste_plant"}),
    q("c4_combo","Không bỏ sót","Đạt chuỗi 5 sự cố xử lý kịp thời liên tiếp.",[1500,260,4,20],s=>[Math.min(5,s.stats.bestCombo),5]),
    q("c4_solve","Vững vàng trong bão","Xử lý tổng cộng 20 sự cố.",[1600,280,4,20],s=>[Math.min(20,s.stats.crisesSolved),20]),
    q("c4_spec","Bản sắc riêng","Chọn chuyên môn hóa cho một công trình cấp 5.",[1400,240,3,20],s=>[Math.min(1,s.stats.specs),1]),
    q("c4_pop","Đô thị đông vui","Đạt dân số 150 người.",[1500,260,3,15],s=>[Math.min(150,s.metrics.pop),150])],
   outro:[["vy","«Bình Minh đứng vững sau bão» — trang nhất hôm nay. Người ta gọi các đội cứu hộ của Thị trưởng là người hùng."],
    ["quan","…Được. Tôi rút lại hợp đồng. Nhưng thời đại số mới là cuộc chơi của Kim Long."]],
   reward:{coins:6000,prestige:10,know:80}},
  {id:"c5",title:"Thành phố thông minh",subtitle:"Chương 5 · Cuộc đua công nghệ",
   intro:[["lam","Đã đến lúc Bình Minh bước vào kỷ nguyên số: văn phòng, điện mặt trời, metro. Viện của tôi sẽ đồng hành."],
    ["mai","Có tin đồn máy chủ Kim Long đang «thăm dò» hệ thống của mình. Em đề nghị xây Trung tâm An ninh Mạng trước khi dựng tháp công nghệ."],
    ["bach","Và nhớ tiến hóa công trình lên bậc II, bậc III. Nhà cấp 4 thì không gánh nổi một siêu đô thị đâu."]],
   quests:[
    q("c5_office","Vươn lên bầu trời","Xây Khu Văn phòng.",[2000,300,3,20],s=>has(s,"office_tower"),{build:"office_tower"}),
    q("c5_solar","Năng lượng sạch","Xây Nhà máy Điện Mặt trời.",[2200,300,3,20],s=>has(s,"solar_plant"),{build:"solar_plant"}),
    q("c5_cyber","Tường lửa thành phố","Xây Trung tâm An ninh Mạng.",[3000,340,4,30],s=>has(s,"cyber_hub"),{build:"cyber_hub"}),
    q("c5_tier","Tiến hóa đô thị","Đưa một công trình lên cấp 7 (bậc III).",[3500,360,5,30],s=>[Math.min(7,s.stats.maxBuildingLevel),7],{upgrade:true}),
    q("c5_tech","Viện Quy hoạch tin cậy","Đạt tổng 8 cấp nghiên cứu.",[3000,340,4,0],s=>[Math.min(8,s.stats.research),8],{panel:"research"}),
    q("c5_income","Cỗ máy kinh tế","Đạt 600 Vàng/giây.",[4000,400,5,30],s=>[Math.min(600,Math.floor(s.stats.peakIncome)),600])],
   outro:[["lam","Dữ liệu cho thấy Bình Minh là đô thị phát triển nhanh nhất vùng. Tôi tự hào được làm việc ở đây."],
    ["quan","Tôi thừa nhận mình đã đánh giá thấp anh/chị. Kim Long muốn… hợp tác. Xây cùng nhau một thứ để đời, được chứ?"]],
   reward:{coins:15000,prestige:15,know:120}},
  {id:"c6",title:"Nhịp đập đô thị",subtitle:"Chương 6 · Dấu ấn để đời",
   intro:[["mai","Kỳ đánh giá cuối cùng, Thị trưởng ạ. Tỉnh muốn thấy một đô thị có tầm vóc: cảng, kỳ quan, và những người hàng xóm quý mến mình."],
    ["hanh","Bà con bảo nhau: thành phố lớn mấy cũng phải giữ cái tình. Thị trưởng nhớ sang giúp các thành phố bạn nhé."],
    ["quan","Kim Long góp vốn dựng Kỳ quan. Lần này tôi đứng cùng phía với anh/chị."]],
   quests:[
    q("c6_port","Vươn ra biển lớn","Xây Cảng Giao thương.",[14000,450,5,40],s=>has(s,"trade_port"),{build:"trade_port"}),
    q("c6_help","Hàng xóm nghĩa tình","Hoàn thành 10 lượt chi viện thành phố bạn.",[8000,420,6,40],s=>[Math.min(10,s.profile.helpsGiven),10],{panel:"socials"}),
    q("c6_happy","Thành phố đáng sống","Đạt 130% Hạnh phúc.",[9000,440,6,40],s=>[Math.min(130,Math.floor(s.metrics.happiness)),130]),
    q("c6_income","Siêu đô thị","Đạt 2.500 Vàng/giây.",[16000,500,6,40],s=>[Math.min(2500,Math.floor(s.stats.peakIncome)),2500]),
    q("c6_wonder","Dấu ấn để đời","Xây xong Kỳ quan Đô thị.",[25000,600,10,60],s=>has(s,"metro_wonder"),{build:"metro_wonder"}),
    q("c6_max","Đỉnh cao quy hoạch","Đưa một công trình lên cấp 10.",[20000,550,8,60],s=>[Math.min(10,s.stats.maxBuildingLevel),10],{upgrade:true})],
   outro:[["vy","Tin nóng: Bình Minh chính thức được công nhận đô thị kiểu mẫu! Thị trưởng có muốn nói gì với khán giả không?"],
    ["mai","Chú Tư vừa nhắn: «Chú biết mình chọn đúng người». Em… em hơi xúc động chút. Cảm ơn Thị trưởng."],
    ["hanh","Chuyện thành phố thì chưa bao giờ hết. Mai lại có việc mới thôi — nhưng hôm nay cứ ăn mừng cái đã!"]],
   reward:{coins:60000,prestige:30,know:200}}
 ];
 // Công nghệ sau cần công nghệ trước đạt cấp 1.
 const T=(id,name,desc,unit)=>({id,name,desc,unit});
 const research = {
  costs:[15,40,90,180],levelFactor:[1,2.2,4,12,32],maxLevel:CONFIG.researchMax,
  advanced:CONFIG.researchAdvanced,
  branches:[
   {id:"eco",name:"Kinh tế",color:"#ffce77",techs:[
    T("tax","Thuế thông minh","+8% tổng thu nhập mỗi cấp","+8% thu nhập"),
    T("trade","Xúc tiến thương mại","+10% thu nhập công trình thương mại mỗi cấp","+10% thương mại"),
    T("offline","Quỹ dự trữ đô thị","+1 giờ trần và +5% hiệu suất thu nhập ngoại tuyến mỗi cấp","+1 giờ ngoại tuyến"),
    T("invest","Đấu thầu minh bạch","−6% chi phí nâng cấp công trình mỗi cấp","−6% phí nâng cấp")]},
   {id:"infra",name:"Hạ tầng",color:"#7cdaff",techs:[
    T("construct","Xây dựng lắp ghép","−10% thời gian xây mỗi cấp","−10% thời gian xây"),
    T("grid","Lưới điện thông minh","+10% sản lượng điện và nước mỗi cấp","+10% điện, nước"),
    T("logistics","Điều phối số","Đội NPC di chuyển nhanh hơn 10% mỗi cấp","+10% tốc độ đội"),
    T("smartroad","Giao thông thông minh","−20% nguy cơ kẹt xe mỗi cấp; đội đi ngoài đường nhựa đỡ chậm hơn","−20% kẹt xe")]},
   {id:"civic",name:"An sinh",color:"#d1fb8b",techs:[
    T("community","Gắn kết cộng đồng","+3 Hạnh phúc mỗi cấp","+3 Hạnh phúc"),
    T("prevention","Bảo trì dự báo","−8% xác suất mọi sự cố mỗi cấp","−8% sự cố"),
    T("education","Thành phố học tập","+10% XP nhận được mỗi cấp","+10% XP"),
    T("heroes","Tôn vinh người hùng","+15% thưởng khi xử lý sự cố mỗi cấp","+15% thưởng sự cố")]}
  ]
 };
 research.all=research.branches.flatMap(b=>b.techs.map((t,i)=>({...t,branch:b.id,index:i,prev:i?b.techs[i-1].id:null})));
 research.cost=(tech,level)=>Math.round(research.costs[tech.index]*research.levelFactor[level]);
 // Thành tựu 3 bậc: [id, tên, mô tả, hàm lấy giá trị, 3 mốc]
 const A=(id,name,desc,value,goals)=>({id,name,desc,value,goals});
 const achievements = [
  A("solver","Người gỡ rối","Xử lý {n} sự cố",s=>s.stats.crisesSolved,[10,60,250]),
  A("builder","Bàn tay kiến tạo","Hoàn thành {n} công trình",s=>s.stats.buildingsBuilt,[25,80,200]),
  A("upgrader","Không ngừng cải tiến","Nâng cấp công trình {n} lần",s=>s.stats.upgrades,[10,50,150]),
  A("tycoon","Ngân khố dồi dào","Đạt {n} Vàng/giây",s=>Math.floor(s.stats.peakIncome),[100,1000,5000]),
  A("citizen","Đất lành chim đậu","Đạt dân số {n}",s=>s.stats.peakPop,[100,400,1000]),
  A("combo","Phản xạ thép","Chuỗi {n} sự cố xử lý kịp thời",s=>s.stats.bestCombo,[3,8,15]),
  A("collector","Người thu thuế mẫn cán","Thu {n} túi thuế",s=>s.stats.bubbles,[20,120,500]),
  A("scholar","Trí tuệ đô thị","Đạt tổng {n} cấp nghiên cứu",s=>s.stats.research,[4,16,36]),
  A("neighbor","Thị trưởng nghĩa hiệp","Chi viện bạn bè {n} lượt",s=>s.profile.helpsGiven,[3,25,100]),
  A("streak","Chuyên cần","Điểm danh tổng cộng {n} ngày",s=>s.stats.loginDays,[3,7,30]),
  A("daily","Việc hôm nay chớ để ngày mai","Hoàn thành {n} nhiệm vụ ngày",s=>s.stats.dailyDone,[5,30,120]),
  A("decider","Người cầm cân nảy mực","Giải quyết {n} thư quyết định",s=>s.stats.decisions,[3,15,50]),
  A("veteran","Đội quân tinh nhuệ","Nâng phương tiện đội NPC lên cấp {n}",s=>s.stats.npcLevel,[2,4,5]),
  A("architect","Kiến trúc sư trưởng","Đưa một công trình lên cấp {n}",s=>s.stats.maxBuildingLevel,[4,7,10]),
  A("specialist","Mỗi nơi một vẻ","Chuyên môn hóa {n} công trình",s=>s.stats.specs,[1,6,15]),
  A("decree","Thị trưởng quyết đoán","Ban hành {n} sắc lệnh",s=>s.stats.policies,[3,15,50])
 ];
 const achievementReward = tier=>({prestige:[2,5,12][tier],coins:[300,2000,10000][tier]});
 // Nhiệm vụ ngày: [id, mô tả, khóa thống kê, mục tiêu theo cấp]
 const dailyPool = [
  ["d_solve","Xử lý {n} sự cố","crisesSolved",l=>l<4?2:l<8?4:6],
  ["d_build","Hoàn thành {n} công trình","buildingsBuilt",l=>l<4?4:6],
  ["d_upgrade","Nâng cấp công trình {n} lần","upgrades",l=>l<5?2:4],
  ["d_bubble","Thu {n} túi thuế","bubbles",l=>l<5?5:10],
  ["d_decide","Giải quyết {n} thư quyết định","decisions",()=>1],
  ["d_policy","Ban hành {n} sắc lệnh","policies",()=>1],
  ["d_fast","Xử lý kịp thời {n} sự cố","fastSolves",l=>l<6?2:4],
  ["d_road","Xây {n} ô đường","roadsBuilt",()=>5],
  ["d_help","Chi viện bạn bè {n} lượt","helps",()=>2],
  ["d_research","Nghiên cứu {n} cấp công nghệ","research",()=>1]
 ];
 const dailyReward = level=>({coins:150*level+200,xp:30+8*level,know:6+level,materials:level>=CONFIG.supplyLevel?{steel:2,glass:1,chip:1}:null});
 const dailyBonus = level=>({coins:500*level+500,prestige:3,know:15+2*level,
  materials:level>=CONFIG.supplyLevel?{steel:5,glass:3,chip:2}:null});
 // Điểm danh 7 ngày (Vàng nhân với cấp Thị trưởng).
 const login = [
  {coins:300,label:"Ngân sách khởi động"},{know:20,label:"Tài liệu quy hoạch"},{prestige:3,label:"Thư khen của tỉnh"},
  {coins:600,label:"Quỹ phát triển"},{know:40,label:"Học bổng nghiên cứu"},{prestige:6,label:"Bằng khen đô thị"},
  {coins:1500,prestige:10,know:60,label:"Rương Thị trưởng"}
 ];
 // Thư quyết định: chi phí/thưởng Vàng tính theo ×100×cấp. buff: [tên, giây, hệ số thu nhập, hạnh phúc, hệ số rủi ro, hệ số thời gian xây, hệ số tốc độ đội]
 const D=(id,who,title,text,a,b)=>({id,who,title,text,options:[a,b]});
 const decisions = [
  D("billboard","quan","Biển quảng cáo Kim Long","Tập đoàn Kim Long muốn thuê mặt tiền khắp các tuyến phố để dựng biển quảng cáo cỡ lớn.",
   {label:"Cho thuê",hint:"+Vàng, Hạnh phúc −6 trong 3 phút",coins:6,buff:["Phố quảng cáo",180,1,-6,1,1,1]},
   {label:"Từ chối",hint:"+2 Uy tín",prestige:2}),
  D("foodfair","hanh","Hội chợ ẩm thực","Bà con xin phép tổ chức hội chợ ẩm thực cuối tuần và mong thành phố tài trợ sân bãi.",
   {label:"Tài trợ",hint:"−Vàng, +25% thu nhập và +5 Hạnh phúc trong 2,5 phút",coins:-3,buff:["Hội chợ ẩm thực",150,1.25,5,1,1,1]},
   {label:"Để bà con tự tổ chức",hint:"+XP",xp:50}),
  D("pipes","bach","Bảo trì đường ống","Đường ống và tủ điện cũ đã đến hạn bảo trì. Làm ngay thì tốn kém, để sau thì rủi ro.",
   {label:"Bảo trì ngay",hint:"−Vàng, giảm một nửa sự cố trong 5 phút",coins:-4,buff:["Bảo trì định kỳ",300,1,0,.5,1,1]},
   {label:"Hoãn lại",hint:"+Vàng, sự cố +40% trong 3 phút",coins:2,buff:["Hạ tầng xuống cấp",200,1,0,1.4,1,1]}),
  D("interview","vy","Phỏng vấn độc quyền","Vy muốn một cuộc phỏng vấn độc quyền về kế hoạch phát triển của thành phố.",
   {label:"Trả lời thẳng thắn",hint:"+3 Uy tín",prestige:3},
   {label:"Quảng bá du lịch",hint:"+15% thu nhập trong 3 phút",buff:["Sóng du lịch",180,1.15,0,1,1,1]}),
  D("grant","lam","Tài trợ nghiên cứu","Viện Quy hoạch xin ngân sách cho đề tài «Đô thị chống chịu».",
   {label:"Tài trợ toàn phần",hint:"−Vàng, nhận nhiều Tri thức",coins:-5,know:30},
   {label:"Tài trợ một phần",hint:"−ít Vàng, nhận ít Tri thức",coins:-2,know:12}),
  D("tourists","mai","Đoàn khách tham quan","Một đoàn khách lớn ghé thăm. Mình mở cửa miễn phí các điểm công cộng hay bán vé ạ?",
   {label:"Mở cửa miễn phí",hint:"+8 Hạnh phúc trong 3 phút",buff:["Thành phố hiếu khách",180,1,8,1,1,1]},
   {label:"Bán vé tham quan",hint:"+Vàng",coins:5}),
  D("trees","hanh","Tuần lễ trồng cây","Tổ dân phố muốn phát động tuần lễ trồng cây trên các tuyến đường.",
   {label:"Cấp kinh phí",hint:"−Vàng, +6 Hạnh phúc trong 4 phút",coins:-2,buff:["Tuần lễ trồng cây",240,1,6,1,1,1]},
   {label:"Kêu gọi tình nguyện",hint:"+XP",xp:70}),
  D("overtime","bach","Công nhân xin tăng ca","Đội xây dựng đề nghị tăng ca để kịp tiến độ, đổi lại là phụ cấp và… vài lời phàn nàn vì tiếng ồn.",
   {label:"Đồng ý tăng ca",hint:"Xây nhanh hơn 40% trong 3 phút, Hạnh phúc −4",buff:["Công trường xuyên đêm",180,1,-4,1,.6,1]},
   {label:"Giữ giờ hành chính",hint:"+2 Uy tín",prestige:2}),
  D("land","quan","Đề nghị mua đất","Kim Long trả giá cao cho quyền khai thác một phần dịch vụ công trong thời gian ngắn.",
   {label:"Bán quyền khai thác",hint:"+nhiều Vàng, thu nhập −10% trong 4 phút",coins:10,buff:["Nhượng quyền dịch vụ",240,.9,0,1,1,1]},
   {label:"Giữ cho thành phố",hint:"+4 Hạnh phúc trong 2 phút",buff:["Của dân, vì dân",120,1,4,1,1,1]}),
  D("heroes","vy","Phóng sự người hùng","Bản tin Đô thị muốn làm phóng sự về các đội cứu hộ.",
   {label:"Tôn vinh các đội",hint:"Đội NPC nhanh hơn 30% trong 4 phút",buff:["Tinh thần quyết thắng",240,1,0,1,1,1.3]},
   {label:"Xin tài trợ thiết bị",hint:"+Tri thức",know:18})
 ];
 return {cast,chapters,research,achievements,achievementReward,dailyPool,dailyReward,dailyBonus,login,decisions};
})();
