"use strict";

const app=document.querySelector("#app"),notice=document.querySelector("#notice");
const nav={
 overview:["▦","Tổng quan"],users:["♙","Người chơi"],events:["✦","Sự kiện"],
 announcements:["◉","Thông báo"],mail:["✉","Gửi thư"],chat:["▤","Trò chuyện"],audit:["☷","Nhật ký"],security:["◈","Bảo mật"]
};
const templates={
 tet:"Tết Nguyên Đán","trung-thu":"Tết Trung Thu","quoc-khanh":"Quốc Khánh","giang-sinh":"Giáng Sinh",
 "pho-xanh":"Tuần Phố Xanh","cho-phien":"Tuần Chợ Phiên","xom-vui":"Tuần Xóm Vui",
 "rush-hour":"Giờ Cao Điểm","weekend-market":"Chợ Cuối Tuần"
};
const flash=["rush-hour","weekend-market"];
const fields={coins:"Vàng",prestige:"Uy tín",knowledge:"Tri thức",level:"Cấp Thị trưởng"};
const skins={tet:"Tết",noel:"Noel",cyberpunk:"Cyberpunk",sakura:"Sakura",desert:"Sa Mạc",jungle:"Rừng Xanh",ocean:"Đại Dương",steampunk:"Steampunk"};
const localTime=value=>value?new Date(Date.parse(value)+7*3600000).toISOString().slice(0,16):"";
const utcTime=value=>value?new Date(value+"+07:00").toISOString():null;
const actions={"admin.setup":"Thiết lập quản trị","admin.login":"Đăng nhập","admin.login.failed":"Đăng nhập thất bại","admin.logout":"Đăng xuất","admin.logout-all":"Đăng xuất mọi phiên","admin.password":"Đổi mật khẩu","admin.totp.reset":"Đặt lại 2FA",
 "user.ban":"Khóa tài khoản","user.unban":"Mở khóa","user.revoke":"Thu hồi phiên","user.delete":"Xóa tài khoản","user.resources":"Sửa tài nguyên","chat.visibility":"Đổi hiển thị","event.update":"Lưu sự kiện","event.reset":"Xóa cấu hình",
 "announcement.create":"Tạo thông báo","announcement.update":"Sửa thông báo","announcement.delete":"Xóa thông báo","mail.send":"Gửi thư quà"};
const e=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=value=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1}).format(value??0);
const date=value=>value?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(value)):"—";
const short=value=>new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(value));
const btn=(action,text,id="",cls="")=>'<button type="button" data-action="'+e(action)+'" data-id="'+e(id)+'" class="'+e(cls)+'">'+e(text)+'</button>';
const field=(name,label,opts={})=>'<label>'+e(label)+'<input type="'+e(opts.type||"text")+'" name="'+e(name)+'" value="'+e(opts.value)+'" '+(opts.extra||"")+'></label>';
const table=(labels,body,empty="Chưa có dữ liệu.")=>'<div class="scroll"><table><thead><tr>'+labels.map(s=>"<th scope=\"col\">"+e(s)+"</th>").join("")+'</tr></thead><tbody>'+body+'</tbody></table>'+(body?"":'<p class="empty">'+e(empty)+'</p>')+'</div>';
const tag=(s,bad=false)=>'<span class="pill'+(bad?' bad':'')+'">'+e(s)+'</span>';
const heading=(tagline,title,sub,tools="")=>'<header class="page-head"><div><p class="kicker">'+e(tagline)+'</p><h1>'+e(title)+'</h1><p class="muted">'+e(sub)+'</p></div>'+tools+'</header>';
let username="",view="overview",selected="",range=1,page=1,q="",sort="seen",responses=0,toastTimer,setupToken,resetRequest;
const show=(text,error=false)=>{
 notice.textContent=text;notice.classList.toggle("error",error);notice.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.hidden=true,6500);
};
async function api(path,method="GET",body){
 const response=await fetch("/api/admin"+path,{method,cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||"Không kết nối được bảng điều hành."),{status:response.status});
 return data;
}
const logo='<div class="brand"><span class="mark" aria-hidden="true">M</span><div><b>MetroPulse</b><small>Trung tâm điều hành</small></div></div>';
function gate(inner){
 app.innerHTML='<div class="gate"><section class="gate-banner">'+logo+'<div><p class="kicker">QUẢN TRỊ RIÊNG TƯ</p><h1>Nắm nhịp<br>thành phố.</h1></div><p>Quản lý người chơi, theo dõi cộng đồng và điều hành các sự kiện từ một nơi.</p></section><main class="gate-main"><section class="card">'+inner+'</section></main></div>';
}
function login(){
 username="";
 gate('<p class="kicker">Truy cập bảo mật</p><h2>Đăng nhập quản trị</h2><p class="muted">Dành riêng cho chủ sở hữu MetroPulse.</p><form class="form" data-form="login">'+
  field("username","Tên đăng nhập",{extra:'required autocomplete="username" maxlength="40"'})+
  field("password","Mật khẩu",{type:"password",extra:'required autocomplete="current-password"'})+
  field("code","Mã 2FA hoặc mã khôi phục",{extra:'required autocomplete="one-time-code" maxlength="39"'})+
  '<button class="primary">Đăng nhập</button></form>');
}
function qrBlock(data){
 return '<p class="muted">Quét mã bằng ứng dụng xác thực hoặc nhập khóa thủ công.</p><img class="qr" src="'+e(data.qr)+'" alt="Mã QR thiết lập xác thực hai lớp"><p><small>Khóa thiết lập:</small><br><code>'+e(data.key)+'</code></p>';
}
function setup(data){
 gate('<p class="kicker">Thiết lập lần đầu</p><h2>Bảo vệ bằng 2FA</h2>'+qrBlock(data)+'<form class="form" data-form="setup">'+
  field("username","Tên đăng nhập",{extra:'required autocomplete="username" minlength="3" maxlength="40"'})+
  field("password","Mật khẩu mới",{type:"password",extra:'required autocomplete="new-password" minlength="14" maxlength="256"'})+
  field("code","Mã 6 số từ ứng dụng",{extra:'required autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}"'})+
  '<button class="primary">Tạo tài khoản chủ sở hữu</button></form>');
}
function recovery(codes){
 gate('<p class="kicker">Chỉ hiển thị một lần</p><h2>Mã khôi phục</h2><p>Giữ các mã ở nơi an toàn và không chia sẻ. Mỗi mã chỉ dùng một lần để thay cho mã xác thực.</p><div class="codes">'+
  codes.map(code=>'<code>'+e(code)+'</code>').join("")+'</div>'+btn("continue",username?"Tôi đã lưu mã":"Tôi đã lưu mã · Đăng nhập","","primary"));
}
function shell(){
 app.innerHTML='<div class="layout"><aside class="sidebar">'+logo+'<nav class="nav" aria-label="Điều hành">'+
  Object.entries(nav).map(([key,[glyph,name]])=>'<button data-action="nav" data-id="'+key+'" '+(view===key?'aria-current="page"':'')+'><span class="glyph" aria-hidden="true">'+glyph+'</span>'+name+'</button>').join("")+
  '</nav><footer>METROPULSE · QUẢN TRỊ<br>Chỉ dành cho chủ sở hữu</footer></aside><div><header class="topbar"><span class="lock-label">◈ &nbsp; BẢNG ĐIỀU HÀNH</span><div class="identity"><span class="avatar" aria-hidden="true">'+e(username[0]?.toUpperCase())+'</span><strong>'+e(username)+'</strong></div>'+
  btn("logout","Đăng xuất")+'</header><main id="content"><p class="loading" role="status">Đang tải dữ liệu…</p></main></div></div>';
 app.querySelector('.nav [aria-current]')?.scrollIntoView({block:"nearest",inline:"nearest"});
}
async function render(){
 const id=++responses;shell();
 try{
  let html;
  if(view==="overview")html=overview(await api("/overview?days="+range));
  else if(view==="users")html=selected?user(await api("/users/"+encodeURIComponent(selected))):users(await api("/users?"+new URLSearchParams({page,q,sort})));
  else if(view==="events")html=eventPage((await api("/events")).rows);
  else if(view==="announcements")html=announcementPage((await api("/announcements")).rows);
  else if(view==="mail")html=mailPage(await api("/mail?page="+page));
  else if(view==="chat")html=chat(await api("/chat?"+new URLSearchParams({page,...(selected?{code:selected}:{})})));
  else if(view==="audit")html=audit(await api("/audit?page="+page));
  else html=security();
  if(id===responses)document.querySelector("#content").innerHTML=html;
 }catch(error){
  if(id!==responses)return;
  if(error.status===401)login();
  else document.querySelector("#content").innerHTML='<div class="card"><p>'+e(error.message)+'</p>'+btn("reload","Thử lại")+'</div>';
 }
}
const metric=(name,value,hint)=>'<section class="stat card">'+tag(name)+'<strong>'+e(value)+'</strong><small>'+e(hint)+'</small></section>';
function graph(series,labels,max,desc){
 const w=570,h=185,left=42,right=12,top=12,bottom=31,length=Math.max(...series.map(s=>s.length),2);
 const x=i=>left+i*(w-left-right)/(length-1),y=v=>top+(1-v/max)*(h-top-bottom);
 let inner="";
 for(let i=0;i<=4;i++){
  const val=max*i/4,Y=y(val);
  inner+='<line x1="'+left+'" y1="'+Y+'" x2="'+(w-right)+'" y2="'+Y+'"/><text x="'+(left-7)+'" y="'+(Y+4)+'" text-anchor="end">'+e(num(val))+'</text>';
 }
 for(const [i,list] of series.entries()){
  let set=[];
  const flush=()=>{
   if(set.length===1){const [cx,cy]=set[0];inner+='<circle cx="'+cx+'" cy="'+cy+'" r="3"/>'}
   if(set.length>1)inner+='<polyline class="'+["","secondary","tertiary"][i]+'" points="'+set.map(pair=>pair.join(",")).join(" ")+'"/>';
   set=[];
  };
  for(const [j,value] of list.entries()){if(value==null)flush();else set.push([x(j),y(value)])}
  flush();
 }
 for(const [i,label] of labels.entries())inner+='<text x="'+(left+i*(w-left-right)/Math.max(1,labels.length-1))+'" y="'+(h-7)+'" text-anchor="'+(i===0?"start":i===labels.length-1?"end":"middle")+'">'+e(label)+'</text>';
 return '<svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+e(desc)+'">'+inner+'</svg>';
}
const graphMax=values=>Math.max(4,Math.ceil(Math.max(...values.filter(v=>v!=null),0)/4)*4);
function overview(d){
 const ccu=d.ccu.map(s=>s.value),signups=d.signups.map(s=>s.value),cohorts=[...d.cohorts].reverse();
 const hours=new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"});
 const dateTick=s=>range===1?hours.format(new Date(s.at)):short(s.at);
 const ticks=d.ccu.filter((_,i,a)=>[0,Math.floor(a.length/2),a.length-1].includes(i)).map(dateTick);
 return heading("Hoạt động đô thị","Tổng quan","Theo dõi sức khỏe cộng đồng và xu hướng người chơi · giờ Việt Nam.",btn("reload","Làm mới"))+
  '<div class="metrics">'+metric("Đang trực tuyến",num(d.online),"Hoạt động trong 150 giây gần nhất")+metric("DAU",num(d.dau),"Duy nhất trong ngày")+metric("WAU",num(d.wau),"Duy nhất trong 7 ngày")+metric("MAU",num(d.mau),"Duy nhất trong 30 ngày")+
  metric("Tài khoản",num(d.users),"Gồm cả tài khoản khách")+metric("Phiên trung bình",num(d.averageSeconds/60)+" phút","Thời gian đo qua tín hiệu hiện diện")+'</div>'+
  '<div class="charts"><section class="card"><div class="row"><div><h2>Trực tuyến đồng thời</h2><small>Đỉnh của các mẫu trong từng khoảng</small></div><label class="range"><select aria-label="Khoảng thời gian" data-change="range">'+[1,7,30].map((r,i)=>'<option value="'+r+'" '+(r===range?"selected":"")+'>'+["24 giờ","7 ngày","30 ngày"][i]+'</option>').join("")+'</select></label></div>'+
  graph([ccu],ticks,graphMax(ccu),"Lượng người chơi trực tuyến đồng thời")+'<small>Khoảng trống là thời gian không có mẫu.</small></section>'+
  '<section class="card"><h2>Tài khoản mới</h2><small>Số tài khoản được tạo mỗi ngày · 30 ngày</small>'+graph([signups],[short(d.signups[0].at),short(d.signups[14].at),short(d.signups.at(-1).at)],graphMax(signups),"Số tài khoản mới theo ngày")+'</section></div>'+
  '<section class="card"><h2>Người chơi quay lại</h2><p class="muted">Tỷ lệ theo nhóm ngày tạo tài khoản, dựa trên tín hiệu hiện diện và hoạt động gần nhất được nhập. Dấu — là nhóm chưa đủ thời gian quan sát.</p>'+
  '<div class="legend"><b>D1 · Ngày 1</b><b>D7 · Ngày 7</b><b>D30 · Ngày 30</b></div>'+
  graph(["d1","d7","d30"].map(k=>cohorts.map(c=>c[k]==null?null:c[k]*100/c.size)),cohorts.length?[cohorts[0].day,cohorts.at(-1).day]:[],100,"Tỷ lệ quay lại (%) theo nhóm")+
  table(["Ngày tạo","Nhóm","D1","D7","D30"],d.cohorts.map(c=>'<tr><td>'+e(c.day)+'</td><td>'+num(c.size)+'</td>'+["d1","d7","d30"].map(k=>'<td>'+(c[k]==null?"—":num(100*c[k]/c.size)+"%")+'</td>').join("")+'</tr>').join(""))+'</section>';
}
const nextPage=(d,more)=>'<div class="row"><small>Trang '+num(d.page)+'</small><div class="inline">'+(d.page>1?btn("prev","‹ Trước"):"")+(more?btn("next","Sau ›"):"")+'</div></div>';
function users(d){
 return heading("Cộng đồng","Người chơi","Tìm tài khoản, kiểm tra bản lưu và quản lý quyền truy cập.")+
  '<section class="card form"><form class="search inline" data-form="search"><input name="q" placeholder="Tên, tên đăng nhập hoặc mã" aria-label="Tìm người chơi" value="'+e(q)+'"><select aria-label="Sắp xếp" name="sort">'+
  [["seen","Hoạt động gần nhất"],["new","Mới đăng ký"],["level","Cấp cao nhất"]].map(([id,name])=>'<option value="'+id+'" '+(sort===id?"selected":"")+'>'+name+'</option>').join("")+'</select><button class="primary">Tìm kiếm</button></form>'+
  '<small>'+num(d.total)+' người chơi</small>'+
  table(["Thị trưởng","Mã","Cấp","Hoạt động","Trạng thái",""],d.rows.map(p=>'<tr><td><b>'+e(p.name)+'</b><span class="sub">'+e(p.username||"Tài khoản khách")+'</span></td><td>'+e(p.code)+'</td><td>'+num(p.summary?.level)+'</td><td>'+date(p.lastSeenAt)+'</td><td>'+tag(p.bannedAt?"Đã khóa":"Hoạt động",!!p.bannedAt)+'</td><td>'+btn("user","Chi tiết",p.code)+'</td></tr>').join(""),"Không tìm thấy người chơi.")+nextPage(d,d.page*d.size<d.total)+'</section>';
}
function user({player:p,save:s,sessions}){
 const info=(k,v)=>'<div><dt>'+e(k)+'</dt><dd>'+e(v)+'</dd></div>';
 return heading("Hồ sơ người chơi",p.name,p.code,btn("back","‹ Danh sách"))+
  '<div class="split"><section class="card"><div class="row"><h2>Thông tin tài khoản</h2>'+tag(p.bannedAt?"Đã khóa":"Hoạt động",!!p.bannedAt)+'</div><dl class="details">'+
  info("Tên đăng nhập",p.username||"Khách")+info("Tham gia",date(p.createdAt))+info("Hoạt động cuối",date(p.lastSeenAt))+info("Phiên đăng nhập",sessions.length)+info("Thành phố",s?.cityName||"—")+info("Công trình / ô đường",s?num(s.buildings)+" / "+num(s.roads):"—")+
  '</dl><div class="actions">'+btn("ban",p.bannedAt?"Mở khóa":"Khóa tài khoản",p.bannedAt?"false":"true",p.bannedAt?"":"danger")+btn("revoke","Thu hồi mọi phiên")+btn("user-chat","Xem tin nhắn")+btn("delete","Xóa tài khoản","","danger")+
  '</div></section><section class="card form"><div><h2>Tài nguyên bản lưu</h2><small>'+(s?"Phiên bản "+num(s.rev)+" · "+date(s.updatedAt):"Không có bản lưu máy chủ.")+'</small></div>'+
  (s?'<form class="form" data-form="resources"><input type="hidden" name="rev" value="'+s.rev+'"><div class="grid-form">'+Object.entries(fields).map(([key,name])=>field(key,name,{type:"number",value:s.resources[key],extra:key==="level"?'required min="1" step="1"':'required min="0" step="any"'})).join("")+'</div><div><button class="primary">Lưu tài nguyên</button></div></form>':"")+
  '</section></div><section class="card"><h2>Các lần cấp phiên</h2>'+table(["Phiên","Thời điểm"],sessions.map((s,i)=>'<tr><td>Phiên '+(i+1)+'</td><td>'+date(s.createdAt)+'</td></tr>').join(""),"Không có phiên.")+'</section>';
}
function eventPage(rows){
 const id=selected||"tet",custom=id==="new"||!Object.hasOwn(templates,id);
 const row=rows.find(r=>r._id===id),isFlash=custom||flash.includes(id),preset=isFlash?[80,160,250]:[180,350,550],name=templates[id]||row?.name||"Sự kiện tùy chỉnh";
 const local=value=>value?new Date(Date.parse(value)+7*3600000).toISOString().slice(0,16):"";
 return heading("Lịch thành phố","Sự kiện","Quản lý sự kiện có sẵn hoặc mở sự kiện ngắn từ mẫu.",btn("event-new","＋ Sự kiện ngắn","","primary"))+
  '<div class="split"><section class="card"><h2 class="section-title">Lịch và cấu hình</h2>'+table(["Sự kiện","Cấu hình",""],[...Object.entries(templates),...rows.filter(r=>!Object.hasOwn(templates,r._id)).map(r=>[r._id,r.name])].map(([k,v])=>{
   const config=rows.find(r=>r._id===k);
   return '<tr><td><b>'+e(v)+'</b><span class="sub">'+e(k)+'</span></td><td>'+tag(config?(config.enabled?"Đã bật":"Đã tắt"):"Mặc định",config&&!config.enabled)+'</td><td>'+btn("event-edit","Sửa",k)+'</td></tr>';
  }).join(""))+'</section>'+
  '<section class="card form"><div><h2>'+e(name)+'</h2><p class="muted">Đặt thời gian theo giờ Việt Nam. Với sự kiện có sẵn, bỏ trống cả hai ngày để theo lịch mặc định.</p></div>'+
  '<form class="form" data-form="event"><div class="grid-form">'+(custom?
   field("id","Mã sự kiện",{value:id==="new"?"":id,extra:id==="new"?'required minlength="2" maxlength="40"':'readonly'})+
   field("name","Tên trong game",{value:row?.name,extra:'required maxlength="45"'})+
   '<label class="field-wide">Mẫu nhiệm vụ<select name="template">'+flash.map(k=>'<option value="'+k+'" '+(row?.template===k?"selected":"")+'>'+templates[k]+'</option>').join("")+'</select></label>':
   '<input type="hidden" name="id" value="'+e(id)+'"><input type="hidden" name="template" value="'+e(id)+'">')+
  '<input type="hidden" name="kind" value="'+(isFlash?"flash":"season")+'">'+
  '<label class="check field-wide"><input type="checkbox" name="enabled" '+(row?.enabled!==false?"checked":"")+'> Bật sự kiện</label>'+
  field("start","Bắt đầu",{type:"datetime-local",value:local(row?.start),extra:custom?"required":""})+
  field("end","Kết thúc",{type:"datetime-local",value:local(row?.end),extra:custom?"required":""})+
  field("multiplier","Hệ số Vàng",{type:"number",value:row?.multiplier??1,extra:'required min="0.1" max="5" step="0.1"'})+
  preset.map((reward,i)=>field("reward"+i,"Vàng mốc "+(i+1),{type:"number",value:row?.rewards[i]??reward,extra:'required min="0" max="1000000" step="1"'})).join("")+
  '</div><div class="actions"><button class="primary">Lưu cấu hình</button>'+(row?btn("event-reset","Xóa cấu hình",id,"danger"):"")+'</div></form></section></div>';
}
const textFields=row=>field("title","Tiêu đề",{value:row?.title,extra:"required maxlength=100"})+
 '<label>Nội dung<textarea name="body" required maxlength="2400" rows="4">'+e(row?.body)+'</textarea></label>';
function announcementPage(rows){
 const row=rows.find(row=>row._id===selected);
 return heading("Giao tiếp","Thông báo","Thông báo đang hiệu lực hiện khi người chơi vào game.",btn("announcement-edit","＋ Thông báo mới","","primary"))+
  '<div class="split"><section class="card"><h2 class="section-title">Thông báo đã lưu</h2>'+
  table(["Thông báo","Trạng thái","Ưu tiên",""],rows.map(r=>'<tr><td><b>'+e(r.title)+'</b><span class="sub">'+date(r.start)+' → '+date(r.end)+'</span></td>'+
   '<td>'+tag(r.active?"Đã bật":"Đã tắt",!r.active)+'</td><td>'+e(r.priority)+'</td><td>'+btn("announcement-edit","Sửa",r._id)+'</td></tr>').join(""))+
  '</section><section class="card form"><h2>'+(row?"Sửa thông báo":"Thông báo mới")+'</h2><p class="muted">Giờ Việt Nam. Bỏ trống ngày nếu không giới hạn lịch.</p>'+
  '<form class="form" data-form="announcement">'+textFields(row)+field("image","URL ảnh HTTPS (tùy chọn)",{value:row?.image,type:"url",extra:"maxlength=500"})+'<div class="grid-form">'+
   field("start","Bắt đầu",{type:"datetime-local",value:localTime(row?.start)})+field("end","Kết thúc",{type:"datetime-local",value:localTime(row?.end)})+
   field("priority","Ưu tiên",{type:"number",value:row?.priority??0,extra:"required min=0 max=100"})+
  '<label class="check"><input name="active" type="checkbox" '+(!row||row.active?"checked":"")+'> Bật thông báo</label></div><div class="controls">'+
  '<button class="primary">Lưu thông báo</button>'+(row?btn("announcement-delete","Xóa",row._id,"danger"):"")+'</div></form></section></div>';
}
function mailPage({rows,page,more}){
 const rewardText=r=>[...["coins","prestige","knowledge"].filter(key=>r[key]).map(key=>num(r[key])+" "+fields[key]),r.skin&&"Skin "+skins[r.skin]].filter(Boolean).join(" · ");
 return heading("Giao tiếp","Gửi thư quà","Gửi cho một người chơi hoặc toàn máy chủ, kể cả tài khoản tạo sau.")+
  '<div class="split"><section class="card"><h2 class="section-title">Lịch sử gửi</h2>'+table(["Thư","Người nhận","Đã nhận"],rows.map(r=>
   '<tr><td><b>'+e(r.title)+'</b><span class="sub">'+e(rewardText(r.rewards))+'</span><span class="sub">'+date(r.createdAt)+(r.expiresAt?" · Hết hạn "+date(r.expiresAt):"")+'</span></td>'+
   '<td>'+e(r.toCode||"Toàn máy chủ")+'</td><td>'+num(r.claims)+'</td></tr>').join(""))+
  '<div class="controls">'+(page>1?btn("prev","Trang trước"):"")+'<span>Trang '+page+'</span>'+(more?btn("next","Trang sau"):"")+'</div></section>'+
  '<section class="card form"><h2>Soạn thư</h2><form class="form" data-form="mail">'+textFields()+
  '<label>Người nhận<select name="target"><option value="player">Một người chơi</option><option value="all">Toàn máy chủ (kể cả tài khoản tạo sau)</option></select></label>'+
  '<div class="form" data-mail-picker><label>Mã hoặc tên người chơi<input name="code" maxlength="40" list="mail-recipients" autocomplete="off"></label>'+
  '<button type="button" data-action="mail-find">Tìm người chơi</button><datalist id="mail-recipients"></datalist><div class="controls" data-mail-results></div></div>'+
  '<div data-mail-expiry>'+field("expiresAt","Hạn nhận theo giờ Việt Nam (tùy chọn)",{type:"datetime-local"})+'</div><div class="grid-form">'+
  ["coins","prestige","knowledge"].map(key=>field(key,fields[key],{type:"number",value:0,extra:"min=0 step=1"})).join("")+
  '<label>Skin<select name="skin"><option value="">Không đính kèm</option>'+Object.entries(skins).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join("")+
  '</select></label></div><div><button class="primary">Gửi thư</button></div></form></section></div>';
}
function chat(d){
 return heading("Kiểm duyệt","Trò chuyện",selected?"Tin nhắn liên quan đến "+selected:"Ẩn hoặc khôi phục tin nhắn cộng đồng.",selected?btn("chat-all","Xem tất cả"):"")+
  '<section class="card form">'+table(["Thời gian","Người gửi","Kênh","Nội dung","Hiển thị",""],d.rows.map(r=>'<tr><td>'+date(r.createdAt)+'</td><td>'+e(r.name)+'<span class="sub">'+e(r.from)+'</span></td><td>'+e(r.to?"Riêng · "+r.to:"Thế giới")+'</td><td>'+e(r.text)+'</td><td>'+tag(r.hiddenAt?"Đã ẩn":"Công khai",!!r.hiddenAt)+'</td><td>'+btn(r.hiddenAt?"unhide":"hide",r.hiddenAt?"Khôi phục":"Ẩn",r.id)+'</td></tr>').join(""))+nextPage(d,d.more)+'</section>';
}
function audit(d){
 return heading("Truy vết","Nhật ký quản trị","Theo dõi đăng nhập và mọi thay đổi trên bảng điều hành.")+
  '<section class="card form">'+table(["Thời gian","Quản trị viên","Hành động","Đối tượng","Địa chỉ IP","Thay đổi"],d.rows.map(r=>'<tr><td>'+date(r.at)+'</td><td>'+e(r.actor)+'</td><td>'+e(actions[r.action]||r.action)+'</td><td>'+e(r.target)+'</td><td>'+e(r.ip)+'</td><td>'+
  (r.before||r.after?'<details><summary>Chi tiết</summary><pre>'+e(JSON.stringify({trước:r.before,sau:r.after},null,2))+'</pre></details>':"—")+'</td></tr>').join(""))+nextPage(d,d.more)+'</section>';
}
const current=()=>field("current","Mật khẩu hiện tại",{type:"password",extra:'required autocomplete="current-password"'});
const totpField=(name,label)=>field(name,label,{extra:'required inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"'});
function security(){
 return heading("Chủ sở hữu","Bảo mật","Quản lý mật khẩu, xác thực hai lớp và các phiên quản trị.")+
  '<div class="split"><section class="card form"><h2>Đổi mật khẩu</h2><form class="form" data-form="password">'+current()+
  field("password","Mật khẩu mới",{type:"password",extra:'required autocomplete="new-password" minlength="14" maxlength="256"'})+
  totpField("code","Mã xác thực hiện tại")+'<div><button class="primary">Đổi mật khẩu</button></div></form></section>'+
  '<section class="card form"><div class="row"><h2>Xác thực hai lớp</h2>'+tag("Bắt buộc")+'</div><p class="muted">Cần mật khẩu và mã 2FA của ứng dụng hiện tại để đổi thiết bị xác thực. Mã khôi phục cũ sẽ mất hiệu lực.</p>'+
  '<form class="form" data-form="totp-start">'+current()+'<div><button>Bắt đầu thiết lập lại</button></div></form></section></div>'+
  '<section class="card"><div class="row"><div><h2>Phiên quản trị</h2><p class="muted">Đăng xuất ở tất cả thiết bị, bao gồm phiên này.</p></div>'+btn("logout-all","Đăng xuất mọi phiên","","danger")+'</div></section>';
}
function confirmDialog(title,message,code){
 const dialog=document.createElement("dialog");
 dialog.innerHTML='<form method="dialog" class="form"><h2>'+e(title)+'</h2><p>'+e(message)+'</p>'+
  (code?field("confirm","Nhập "+code+" để xác nhận",{extra:"required"}):"")+
  '<div class="actions"><button value="cancel" formnovalidate>Hủy</button><button value="confirm" class="danger">Xác nhận</button></div></form>';
 document.body.append(dialog);dialog.showModal();
 return new Promise(resolve=>dialog.addEventListener("close",()=>{
  const input=dialog.querySelector("input"),value=dialog.returnValue==="confirm"?(input?input.value:true):null;
  dialog.remove();resolve(value);
 },{once:true}));
}
app.addEventListener("change",event=>{
 if(event.target.dataset.change==="range"){range=Number(event.target.value);render()}
});
app.addEventListener("click",async event=>{
 const button=event.target.closest("[data-action]");if(!button)return;
 const {action,id}=button.dataset,base="/users/"+encodeURIComponent(selected);
 try{
  if(action==="nav"){view=id;selected="";page=1}
  else if(action==="user"||action==="event-edit"||action==="announcement-edit"){selected=id}
  else if(action==="announcement-delete"){
   if(!await confirmDialog("Xóa thông báo?","Thông báo sẽ không còn xuất hiện khi người chơi vào game."))return;
   await api("/announcements/"+id,"DELETE");selected="";show("Đã xóa thông báo.");
  }else if(action==="mail-find"||action==="mail-pick"){
   const form=button.closest("form"),input=form.elements.code;
   if(action==="mail-pick"){input.value=id;return}
   const {rows}=await api("/users?"+new URLSearchParams({q:input.value}));
   form.querySelector("#mail-recipients").innerHTML=rows.map(row=>'<option value="'+e(row.code)+'">'+e(row.name)+'</option>').join("");
   form.querySelector("[data-mail-results]").innerHTML=rows.length?rows.map(row=>btn("mail-pick",row.name+" · "+row.code,row.code)).join(""):"Không tìm thấy người chơi.";
   return;
  }
  else if(action==="back"||action==="chat-all"){selected=""}
  else if(action==="continue"){if(!username){login();return}}
  else if(action==="user-chat"){view="chat";page=1}
  else if(action==="event-new")selected="new";
  else if(action==="prev")page--;
  else if(action==="next")page++;
  else if(action==="logout"||action==="logout-all"){
   if(action==="logout-all"&&!await confirmDialog("Đăng xuất mọi phiên?","Bạn sẽ phải đăng nhập lại trên tất cả thiết bị."))return;
   await api("/"+action,"POST",{});login();return;
  }else if(action==="ban"){
   const banned=id==="true";
   if(!await confirmDialog(banned?"Khóa tài khoản?":"Mở khóa tài khoản?",banned?"Tài khoản sẽ bị đăng xuất và không thể dùng dịch vụ trực tuyến.":"Người chơi có thể đăng nhập lại."))return;
   await api(base+"/ban","POST",{banned});show(banned?"Đã khóa tài khoản.":"Đã mở khóa tài khoản.");
  }else if(action==="revoke"){
   if(!await confirmDialog("Thu hồi phiên?","Người chơi sẽ phải đăng nhập lại trên mọi thiết bị."))return;
   await api(base+"/revoke","POST",{});show("Đã thu hồi các phiên.");
  }else if(action==="delete"){
   const confirm=await confirmDialog("Xóa vĩnh viễn?","Tài khoản và bản lưu đám mây sẽ bị xóa.",selected);
   if(!confirm)return;
   await api(base,"DELETE",{confirm});selected="";show("Đã xóa tài khoản.");
  }else if(action==="hide"||action==="unhide"){
   await api("/chat/"+id,"PATCH",{hidden:action==="hide"});show("Đã cập nhật tin nhắn.");
  }else if(action==="event-reset"){
   if(!await confirmDialog("Xóa cấu hình sự kiện?","Sự kiện có sẵn sẽ trở về lịch mặc định."))return;
   await api("/events/"+id,"DELETE");selected="";show("Đã xóa cấu hình.");
  }
  await render();
 }catch(error){if(error.status===401)login();show(error.message,true)}
});
app.addEventListener("submit",async event=>{
 const form=event.target;
 if(!form.dataset.form)return;
 event.preventDefault();
 const data=Object.fromEntries(new FormData(form)),button=form.querySelector('button:not([type="button"])');
 if(button?.disabled)return;
 if(button)button.disabled=true;
 try{
  switch(form.dataset.form){
   case "login":({username}=await api("/login","POST",data));view="overview";selected="";break;
   case "setup":{
    const result=await api("/setup","POST",{...data,token:setupToken});
    setupToken=null;username=result.username;recovery(result.codes);return;
   }
   case "search":q=data.q;sort=data.sort;page=1;break;
   case "resources":
    await api("/users/"+selected+"/resources","PATCH",{rev:Number(data.rev),resources:Object.fromEntries(Object.keys(fields).map(k=>[k,Number(data[k])]))});
    show("Đã cập nhật tài nguyên và phiên bản bản lưu.");break;
   case "event":{
    const utc=value=>value?new Date(value+"+07:00").toISOString():null;
    const config={kind:data.kind,template:data.template,name:data.name,enabled:data.enabled==="on",start:utc(data.start),end:utc(data.end),
     multiplier:Number(data.multiplier),rewards:[0,1,2].map(i=>Number(data["reward"+i]))};
    await api("/events/"+encodeURIComponent(data.id),"PUT",config);selected=data.id;show("Đã lưu sự kiện.");break;
   }
   case "announcement":{
    const payload={title:data.title,body:data.body,active:data.active==="on",priority:Number(data.priority),image:data.image,start:utcTime(data.start),end:utcTime(data.end)};
    const {row}=await api("/announcements"+(selected?"/"+encodeURIComponent(selected):""),selected?"PUT":"POST",payload);
    selected=row._id;show("Đã lưu thông báo.");break;
   }
   case "mail":{
    if(!await confirmDialog("Gửi thư quà?",data.target==="all"?"Thư không hết hạn và sẽ đến cả tài khoản tạo sau.":"Thư sẽ gửi đến mã "+data.code+"."))return;
    await api("/mail","POST",{title:data.title,body:data.body,target:data.target,code:data.code,expiresAt:data.target==="all"?null:utcTime(data.expiresAt),
     rewards:{coins:Number(data.coins),prestige:Number(data.prestige),knowledge:Number(data.knowledge),skin:data.skin}});
    page=1;show("Đã gửi thư.");break;
   }
   case "password":
    await api("/password","POST",data);login();show("Đã đổi mật khẩu. Hãy đăng nhập lại.");return;
   case "totp-start":{
    const result=await api("/totp/start","POST",data);resetRequest=result.request;
    document.querySelector("#content").innerHTML=heading("Bảo mật","Đổi thiết bị xác thực","Xác nhận mã của cả thiết bị cũ lẫn mới.",btn("reload","Hủy"))+
     '<section class="card form">'+qrBlock(result)+'<form class="form" data-form="totp-reset">'+current()+totpField("code","Mã từ thiết bị cũ")+
     totpField("newCode","Mã từ thiết bị mới")+'<div><button class="primary">Xác nhận 2FA mới</button></div></form></section>';return;
   }
   case "totp-reset":{
    const result=await api("/totp/reset","POST",{...data,request:resetRequest});
    resetRequest=null;username="";recovery(result.codes);return;
   }
  }
  await render();
 }catch(error){show(error.message,true)}
 finally{if(button)button.disabled=false}
});
app.addEventListener("change",event=>{
 const node=event.target;
 if(node.name==="target"&&node.form?.dataset.form==="mail")for(const region of node.form.querySelectorAll("[data-mail-picker],[data-mail-expiry]"))region.hidden=node.value==="all";
});

(async()=>{
 setupToken=new URLSearchParams(location.hash.slice(1)).get("setup");
 if(setupToken){
  history.replaceState(null,"",location.pathname);
  try{setup(await api("/setup/start","POST",{token:setupToken}))}
  catch(error){setupToken=null;login();show(error.message,true)}
 }else{
  try{({username}=await api("/session"));await render()}
  catch{login()}
 }
})();
