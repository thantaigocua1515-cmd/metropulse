"use strict";
// Đời sống đường phố: xe cộ, người dân, biểu cảm và những câu chuyện vặt. Chỉ để trang trí, không ảnh hưởng tới số liệu.
const LIFE = {
 names:["Cô Ba","Chú Tư","Bác Tám","Bà Sáu","Ông Năm","Chú Bảy","Cô Út","Anh Khoa","Chị Hoa","Anh Tú","Chị Lan","Thầy Minh","Cô Thảo","Bé Na","Bé Bin","Bé Bông","Anh Phong","Chị Ngân","Bác Hai","Dì Chín"],
 shirts:["#e8705f","#f0b24a","#4fb38a","#5b8fe0","#b07be0","#f58fb0","#3fa7c4","#f3f0e6","#7ac26b","#e2884e"],
 hair:["#2b2623","#3d2c22","#5a4636","#8a8f96","#d9d9d4"],
 cars:["#e8705f","#f3f0e6","#5b8fe0","#4fb38a","#c9a2f0","#d8dde3","#3b4652","#f58fb0"],
 // Câu nói theo hoàn cảnh; {mayor} và {city} được thay bằng tên thật.
 lines:{
  joy:["{city} đáng sống ghê!","Thị trưởng {mayor} được việc đấy!","Hôm nay vui quá, đi dạo thôi!","Lương về rồi, đi ăn phở nào!","Phố mình ngày càng đẹp!"],
  happy:["Cà phê sáng ở đây là nhất.","Cuối tuần đi đâu chơi nhỉ?","Bánh mì nóng giòn đây!","Nghe nói sắp có công trình mới.","Trời đẹp ghê ta."],
  ok:["Đi làm thôi, trễ giờ rồi.","Chiều nay ăn gì ta?","Cũng tạm ổn.","Lại một ngày bận rộn."],
  sad:["Thành phố dạo này buồn quá…","Thiếu chỗ vui chơi ghê.","Giá mà có thêm công viên.","Thị trưởng ơi, nhớ tới dân chút đi!"],
  angry:["Sống thế này sao chịu nổi!","Tôi sẽ viết đơn lên Thị trưởng!","Dọn đi thành phố khác cho rồi!"],
  blackout:["Lại cúp điện nữa rồi!","Quạt không chạy, nóng quá!","Tủ lạnh nhà tôi chảy nước hết rồi!"],
  water_leak:["Nước đâu mà tắm đây trời!","Đường thành sông luôn rồi!"],
  collapse:["Giàn giáo sập kìa, tránh xa ra!","Thi công kiểu gì vậy trời?"],
  traffic_jam:["Kẹt xe cả tiếng rồi đó!","Nhích lên coi!","Lại trễ làm nữa rồi…"],
  fire:["Cháy! Gọi cứu hỏa mau!","Khói quá, chạy đi bà con!"],
  trash_pile:["Rác chất đống, hôi quá!","Ai dọn rác giùm đi!"],
  flu_outbreak:["Hắt xì! Chắc cúm rồi…","Nhớ đeo khẩu trang nha bà con."],
  cyber_attack:["Mạng lại rớt nữa hả?","Chuyển khoản không được luôn!"],
  storm:["Mưa to quá, trú tạm thôi!","Quên mang áo mưa rồi!"],
  heat:["Nóng muốn xỉu luôn!","Cho ly trà đá đi cô ơi!"],
  night:["Khuya rồi, về ngủ thôi.","Đi ăn khuya không?","Phố đêm đẹp ghê."],
  nopower:["Điện chập chờn hoài à.","Thành phố thiếu điện rồi Thị trưởng ơi!"],
  nowater:["Nước yếu như sợi chỉ!","Xây thêm tháp nước đi Thị trưởng!"],
  park:["Công viên mát ghê!","Ra công viên tập thể dục nào."],
  shop:["Đi chợ thôi!","Hôm nay siêu thị giảm giá!","Mua gì ăn tối đây ta?"],
  school:["Con tôi học trường này đó.","Học, học nữa, học mãi!"],
  horn:["Bíp bíp!","Tin tin!"]
 },
 // Hai người gặp nhau trên vỉa hè sẽ dừng lại nói vài câu.
 chats:{
  good:[["Chào bác, đi đâu đó?","Đi chợ chút cháu ơi."],["Ăn sáng chưa?","Rồi, phở đầu ngõ ngon lắm!"],["Sắp có công trình mới đó.","Ừ, Thị trưởng {mayor} chăm ghê."],["Trời hôm nay đẹp nhỉ?","Đi dạo là hết ý."],
   ["Con bé nhà chị học giỏi ghê!","Nhờ trường mới xây đó chị."],["Tối nay xem đá bóng không?","Có chứ, qua nhà tôi!"],["Lâu quá không gặp!","Ừ, {city} đổi khác nhiều ghê."],["Cho mượn cái thang nhé?","Cứ qua lấy, khỏi hỏi!"]],
  bad:[["Dạo này sống sao rồi?","Chán lắm, tính dọn đi nè."],["Điện nước phập phù quá.","Phải góp ý với Thị trưởng thôi."],["Khu mình buồn hiu à.","Ừ, chẳng có gì chơi."]]
 },
 near:{park:"park",mini_mart:"shop",night_market:"shop",mall:"shop",school:"school",university:"school"},
 faces:{joy:"joy",happy:"happy",ok:"ok",sad:"sad",angry:"angry",blackout:"angry",water_leak:"sad",collapse:"scared",traffic_jam:"angry",fire:"scared",trash_pile:"sick",flu_outbreak:"sick",cyber_attack:"angry",
  storm:"sad",heat:"hot",night:"sleepy",nopower:"sad",nowater:"sad",park:"love",shop:"happy",school:"happy"}
};

class CityLife {
 constructor(renderer){this.r=renderer;this.agents=[];this.world=null;this.clock=0;this.talkAt=2;this.city=null}
 pick(list){return list[Math.floor(Math.random()*list.length)]}
 fill(text){
  const s=this.r.sim,f=s.social.current,mayor=(f?f.mayorName||f.name:s.profile.mayorName)||"",city=(f?f.cityName:s.profile.cityName)||"Thành phố";
  return text.replace("{mayor}",mayor.replace(/^Thị trưởng\s+/i,"")||"mình").replace("{city}",city);
 }
 // Tình hình chung của thành phố, tính lại mỗi 2 giây.
 survey(w){
  const s=this.r.sim,m=w===s.world?s.metrics:s.measure(w),own=s.world;
  this.city={happiness:m.happiness,pop:m.pop,nopower:m.ps<m.pd,nowater:m.ws<m.wd,weather:own.weather,night:Math.cos(own.timeOfDay*Math.PI*2)>.35};
 }
 spawn(a,roads,w){
  let pool=roads;
  if(!a.car){const homes=roads.filter(r=>steps.some(([dx,dy])=>CONFIG.buildings[lookup(w,r.x+dx,r.y+dy)?.id]?.group==="res"));if(homes.length)pool=homes}
  const r=this.pick(pool);Object.assign(a,{fx:r.x,fy:r.y,tx:r.x,ty:r.y,px:-1,py:-1,dx:0,dy:0,ox:0,oy:0,part:1,x:r.x,y:r.y,age:0});
 }
 create(car){
  const a={car,age:0,wait:0,face:0,say:null,chat:0};
  if(car){
   const roll=Math.random();
   a.kind=roll<.3?"bike":roll<.72?"car":roll<.82?"taxi":roll<.92?"truck":"bus";
   a.color=a.kind==="taxi"?"#f5c542":a.kind==="bus"?this.pick(["#4f9bd9","#e8705f","#4fb38a"]):a.kind==="truck"?this.pick(["#5b8fe0","#e2884e","#7c8794"]):this.pick(LIFE.cars);
   a.speed=(a.kind==="bike"?1.7:a.kind==="bus"||a.kind==="truck"?1.05:1.4)+Math.random()*.4;a.lane=a.kind==="bike"?.2+Math.random()*.06:.13;
  }else{
   a.name=this.pick(LIFE.names);a.kid=a.name.startsWith("Bé");a.old=/^(Bà|Ông|Bác)/.test(a.name);
   a.shirt=this.pick(LIFE.shirts);a.hair=a.old?this.pick(LIFE.hair.slice(3)):this.pick(LIFE.hair.slice(0,3));a.hat=!a.kid&&Math.random()<.22;
   a.speed=(a.kid?.6:a.old?.32:.45)+Math.random()*.15;a.lane=(Math.random()<.5?-1:1)*(.41+Math.random()*.05);a.seed=Math.random()*9;a.next=1+Math.random()*8;
  }
  return a;
 }
 // Tâm trạng của một người: sự cố gần đó > thời tiết > thiếu điện nước > công trình kề bên > hạnh phúc chung.
 mood(a,w){
  const c=this.city,here={x:Math.round(a.x),y:Math.round(a.y)};
  const crisis=w.crises.find(z=>distance(z,here)<=2);if(crisis)return crisis.id;
  if(c.weather==="storm")return "storm";
  if(c.weather==="heat"&&a.seed>3)return "heat";
  if(c.nopower&&a.seed<3)return "nopower";
  if(c.nowater&&a.seed>6)return "nowater";
  if(c.happiness>=60&&a.seed>4.5)for(const [dx,dy] of steps){const spot=LIFE.near[lookup(w,here.x+dx,here.y+dy)?.id];if(spot)return spot}
  if(c.night&&a.seed<2.5)return "night";
  const h=c.happiness+(a.seed-4.5)*4;
  return h>=118?"joy":h>=92?"happy":h>=70?"ok":h>=48?"sad":"angry";
 }
 speak(a,text,seconds=3.4,named=false){a.say={text:this.fill(text),until:this.clock+seconds,name:named?a.name:""};a.face=Math.max(a.face,seconds)}
 update(w,dt){
  if(this.world!==w){this.world=w;this.agents=[];this.city=null;this.surveyAt=0}
  this.clock+=dt;
  if(!this.city||this.clock>=this.surveyAt){this.survey(w);this.surveyAt=this.clock+2}
  const roads=w.buildings.filter(b=>b.id==="road"),list=this.agents,c=this.city;
  if(roads.length<2){list.length=0;return}
  const quiet=(c.night?.55:1)*(c.weather==="storm"?.7:1);
  const cars=Math.min(20,Math.round((roads.length/4+c.pop/160)*(c.night?.6:1))),people=Math.min(24,roads.length,Math.round((2+c.pop/22)*quiet));
  let nc=0,np=0;for(const a of list)a.car?nc++:np++;
  if(nc<cars&&Math.random()<dt*2){const a=this.create(true);this.spawn(a,roads,w);list.push(a)}
  if(np<people&&Math.random()<dt*2.5){const a=this.create(false);this.spawn(a,roads,w);list.push(a)}
  for(let i=list.length-1;i>=0;i--){
   const a=list[i];a.age+=dt;a.face=Math.max(0,a.face-dt);
   if(a.say&&this.clock>a.say.until)a.say=null;
   if(a.chat>0){a.chat-=dt;continue}
   const jam=w.crises.some(z=>z.id==="traffic_jam"&&Math.abs(z.x-a.x)+Math.abs(z.y-a.y)<1.6);
   let speed=a.speed*(a.car&&jam?.18:1);
   if(a.car&&list.some(o=>o!==a&&o.car&&o.fx===a.fx&&o.fy===a.fy&&o.tx===a.tx&&o.ty===a.ty&&o.part>a.part&&o.part-a.part<(o.kind==="bus"||o.kind==="truck"?.5:.36)))speed=0;
   a.part+=dt*speed;
   if(a.part>=1){
    a.fx=a.tx;a.fy=a.ty;
    const over=a.car?nc>cars:np>people;
    if(lookup(w,a.fx,a.fy)?.id!=="road"||(over&&a.age>4)){list.splice(i,1);a.car?nc--:np--;continue}
    const options=steps.map(([dx,dy])=>({x:a.fx+dx,y:a.fy+dy})).filter(q=>lookup(w,q.x,q.y)?.id==="road"),forward=options.filter(q=>q.x!==a.px||q.y!==a.py);
    const next=this.pick(forward.length?forward:options);
    a.px=a.fx;a.py=a.fy;a.ox=a.dx;a.oy=a.dy;
    if(next){a.tx=next.x;a.ty=next.y;a.dx=next.x-a.fx;a.dy=next.y-a.fy;a.part=0}else a.part=1;
   }
   // Đổi làn mượt ở góc cua: trượt dần từ hướng cũ sang hướng mới.
   const t=clamp(a.part/.35,0,1),bx=(a.ox||a.dx)*(1-t)+a.dx*t,by=(a.oy||a.dy)*(1-t)+a.dy*t;
   a.x=a.fx+a.dx*a.part-by*a.lane;a.y=a.fy+a.dy*a.part+bx*a.lane;
   if(a.car){if(jam&&!a.say&&Math.random()<dt*.12)this.speak(a,this.pick(LIFE.lines.horn),1.3);continue}
   a.next-=dt;
   if(a.next<=0){a.state=this.mood(a,w);a.face=2.6;a.next=5+Math.random()*9}
  }
  this.talkAt-=dt;
  if(this.talkAt<=0){
   this.talkAt=2.6+Math.random()*3;
   const folk=list.filter(a=>!a.car&&!a.say&&a.chat<=0&&a.age>1.5&&this.visible(a));
   if(list.filter(a=>a.say).length<3&&folk.length){
    const a=this.pick(folk),b=folk.find(o=>o!==a&&Math.abs(o.x-a.x)+Math.abs(o.y-a.y)<.75);
    a.state=this.mood(a,w);
    if(b&&LIFE.chats[c.happiness>=70?"good":"bad"]&&!w.crises.some(z=>distance(z,{x:Math.round(a.x),y:Math.round(a.y)})<=2)){
     const [first,second]=this.pick(LIFE.chats[c.happiness>=70?"good":"bad"]);
     a.chat=b.chat=5.4;b.state=this.mood(b,w);this.speak(a,first,2.6);b.say={text:this.fill(second),until:this.clock+5.4,from:this.clock+2.7,name:""};b.face=5.4;a.face=5.4;
    }else this.speak(a,this.pick(LIFE.lines[a.state]));
   }
  }
 }
 visible(a){const p=this.r.project(a.x+.5,a.y+.5);return p.x>20&&p.x<this.r.width-20&&p.y>90&&p.y<this.r.height-130}
 // Người chơi chạm vào một người dân: họ nói ngay điều đang nghĩ.
 poke(a){a.state=this.mood(a,this.world);this.speak(a,this.pick(LIFE.lines[a.state]),4,true)}
 draw(a,night){
  const r=this.r,g=r.ctx,z=r.camera.zoom,p=r.project(a.x+.5,a.y+.5);
  g.globalAlpha=clamp(a.age*2.5,0,1);
  if(a.car)this.vehicle(a,p,z,night);else this.person(a,p,z);
  g.globalAlpha=1;
 }
 vehicle(a,p,z,night){
  const r=this.r,k=a.kind;
  const box=(len,wid,off,base,h,color)=>{const cx=a.x+.5+a.dx*off,cy=a.y+.5+a.dy*off,w=a.dy?wid:len,d=a.dy?len:wid;r.block(cx-w/2,cy-d/2,w,d,base,h,color)};
  if(k==="bike"){
   r.ellipse(p.x,p.y+1*z,3.4*z,1.5*z,"#1e352c66");box(.14,.05,0,.6,1.6,a.color);
   r.ellipse(p.x,p.y-4.6*z,1.7*z,2.3*z,"#4a5563");r.ellipse(p.x,p.y-7.4*z,1.5*z,1.5*z,a.color);
  }else if(k==="car"||k==="taxi"){
   r.ellipse(p.x,p.y+1.5*z,6*z,2.5*z,"#1e352c77");box(.27,.15,0,1,2.8,a.color);box(.14,.13,-.02,3.8,1.9,"#cfe3ea");
   if(k==="taxi")box(.05,.05,-.02,5.7,1,"#2b3440");
  }else if(k==="bus"){
   r.ellipse(p.x,p.y+1.6*z,8.5*z,3.2*z,"#1e352c77");box(.42,.17,0,1,2.4,a.color);box(.42,.17,0,3.4,2.1,"#d6e8ee");box(.42,.17,0,5.5,.9,"#f4f6f8");
  }else{
   r.ellipse(p.x,p.y+1.6*z,8*z,3*z,"#1e352c77");
   const cab=()=>{box(.1,.15,.14,1,4.2,a.color);box(.05,.13,.15,3.4,1.5,"#cfe3ea")},cargo=()=>box(.26,.16,-.05,1,5.6,"#eef0ea");
   if(a.dx+a.dy>0){cargo();cab()}else{cab();cargo()}
  }
  if(night>.22&&!r.sim.social.world.crises.some(c=>c.id==="blackout"&&Math.abs(c.x-a.x)+Math.abs(c.y-a.y)<=1)){
   const far=k==="bike"?.14:k==="car"||k==="taxi"?.21:.28;
   const q=r.project(a.x+.5+a.dx*far,a.y+.5+a.dy*far,2.6);
   r.effects.glow(q.x,q.y,7*z,4*z);
   for(const side of k==="bike"?[0]:[-1,1])r.ellipse(q.x+side*(a.dx+a.dy)*2.2*z,q.y+side*(a.dy-a.dx)*1.1*z,1.2*z,.85*z,"#fff5c4");
  }
 }
 person(a,p,z){
  const r=this.r,s=z*(a.kid?.72:1),still=a.chat>0,t=r.elapsed*(a.kid?12:9)+a.seed,swing=still?0:Math.sin(t)*1.5*s,bob=still?0:Math.abs(Math.sin(t))*.5*s;
  r.ellipse(p.x,p.y+.8*s,2.8*s,1.2*s,"#1e352c66");
  r.line([{x:p.x-.9*s,y:p.y-2.6*s},{x:p.x-.9*s+swing,y:p.y+.4*s}],"#39475a",1.25*s);r.line([{x:p.x+.9*s,y:p.y-2.6*s},{x:p.x+.9*s-swing,y:p.y+.4*s}],"#39475a",1.25*s);
  r.ellipse(p.x,p.y-4.7*s-bob,2.1*s,2.9*s,a.shirt);
  r.ellipse(p.x,p.y-8.6*s-bob,1.75*s,1.75*s,"#f3d9b5");
  if(a.hat)r.poly([{x:p.x-3.4*s,y:p.y-9.2*s-bob},{x:p.x+3.4*s,y:p.y-9.2*s-bob},{x:p.x,y:p.y-12*s-bob}],"#e9d9a6","#bfa76a",.5*s);
  else r.ellipse(p.x,p.y-9.5*s-bob,1.8*s,1.1*s,a.hair);
  if(this.city?.weather==="storm"){
   r.line([{x:p.x+1.6*s,y:p.y-5*s},{x:p.x+1.6*s,y:p.y-13*s}],"#5b6675",.7*s);
   const g=r.ctx;g.fillStyle=a.shirt;g.beginPath();g.ellipse(p.x+1.6*s,p.y-13*s,5.2*s,2.6*s,0,Math.PI,Math.PI*2);g.fill();
  }
 }
 // Biểu cảm vẽ tay để mọi thiết bị đều hiển thị giống nhau.
 face(x,y,r,kind){
  const g=this.r.ctx,fill={joy:"#ffd84d",happy:"#ffd84d",ok:"#ffe08a",sad:"#bcd3ee",angry:"#ff7a5c",scared:"#c9b8f5",sick:"#b9db7c",hot:"#ffb347",sleepy:"#c8d2e6",love:"#ffc2d4"}[kind]||"#ffd84d";
  g.fillStyle="#fff";g.beginPath();g.arc(x,y,r+1.6,0,Math.PI*2);g.fill();g.fillStyle=fill;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  g.strokeStyle=g.fillStyle="#3b2f24";g.lineWidth=Math.max(1,r*.16);g.lineCap="round";
  const eye=(dx,shut)=>{g.beginPath();if(shut){g.moveTo(x+dx-r*.2,y-r*.18);g.lineTo(x+dx+r*.2,y-r*.18);g.stroke()}else{g.arc(x+dx,y-r*.2,r*.13,0,Math.PI*2);g.fill()}};
  if(kind==="love"){g.fillStyle="#e8476a";for(const dx of [-.36,.36]){g.beginPath();g.arc(x+dx*r-r*.1,y-r*.25,r*.13,0,Math.PI*2);g.arc(x+dx*r+r*.1,y-r*.25,r*.13,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(x+dx*r-r*.22,y-r*.2);g.lineTo(x+dx*r,y+r*.08);g.lineTo(x+dx*r+r*.22,y-r*.2);g.fill()}}
  else{eye(-r*.36,kind==="sleepy"||kind==="joy");eye(r*.36,kind==="sleepy"||kind==="joy")}
  if(kind==="angry")for(const d of [-1,1]){g.beginPath();g.moveTo(x+d*r*.6,y-r*.6);g.lineTo(x+d*r*.18,y-r*.4);g.stroke()}
  g.beginPath();
  if(kind==="joy"){g.fillStyle="#7a3b2a";g.arc(x,y+r*.12,r*.45,0,Math.PI);g.fill()}
  else if(kind==="happy"||kind==="love"){g.arc(x,y+r*.05,r*.45,.15*Math.PI,.85*Math.PI);g.stroke()}
  else if(kind==="ok"||kind==="sleepy"||kind==="hot"){g.moveTo(x-r*.32,y+r*.4);g.lineTo(x+r*.32,y+r*.4);g.stroke()}
  else if(kind==="scared"){g.ellipse(x,y+r*.42,r*.2,r*.28,0,0,Math.PI*2);g.fill()}
  else if(kind==="sick"){g.moveTo(x-r*.4,y+r*.42);g.quadraticCurveTo(x-r*.2,y+r*.25,x,y+r*.42);g.quadraticCurveTo(x+r*.2,y+r*.6,x+r*.4,y+r*.42);g.stroke()}
  else{g.arc(x,y+r*.72,r*.42,1.2*Math.PI,1.8*Math.PI);g.stroke()}
  if(kind==="hot"||kind==="scared"){g.fillStyle="#58b4f0";g.beginPath();g.moveTo(x+r*.78,y-r*.75);g.quadraticCurveTo(x+r*1.15,y-r*.1,x+r*.78,y-r*.05);g.quadraticCurveTo(x+r*.42,y-r*.1,x+r*.78,y-r*.75);g.fill()}
  if(kind==="sleepy"){g.font="700 "+r*.9+"px system-ui,sans-serif";g.textAlign="left";g.textBaseline="middle";g.fillStyle="#5b6b8c";g.fillText("z",x+r*.9,y-r*.9)}
 }
 bubble(x,y,text,name){
  const g=this.r.ctx,size=Math.max(11,Math.min(13,11*this.r.camera.zoom));
  g.font="600 "+size+"px system-ui,sans-serif";
  const label=name?name+": ":"",w=Math.min(230,g.measureText(label+text).width)+16,h=size+11,left=clamp(x-w/2,6,this.r.width-w-6),top=y-h-6,rad=h/2;
  g.beginPath();g.moveTo(left+rad,top);g.arcTo(left+w,top,left+w,top+h,rad);g.arcTo(left+w,top+h,left,top+h,rad);g.arcTo(left,top+h,left,top,rad);g.arcTo(left,top,left+w,top,rad);g.closePath();
  g.moveTo(x-4,top+h-1);g.lineTo(x,y);g.lineTo(x+4,top+h-1);
  g.shadowColor="#1f2f4a40";g.shadowBlur=8;g.shadowOffsetY=2;g.fillStyle="#fff";g.fill();g.shadowColor="transparent";g.shadowBlur=0;g.shadowOffsetY=0;
  g.textAlign="left";g.textBaseline="middle";
  if(label){g.fillStyle="#178a4c";g.fillText(label,left+8,top+h/2+.5,w-16)}
  g.fillStyle="#1d2733";g.fillText(text,left+8+g.measureText(label).width,top+h/2+.5,w-16-g.measureText(label).width);
 }
 // Vẽ sau lớp phủ ban đêm để biểu cảm và lời thoại luôn dễ đọc; đồng thời ghi vùng chạm của người dân.
 overlay(){
  const r=this.r,z=r.camera.zoom;
  for(const a of this.agents){
   const p=r.project(a.x+.5,a.y+.5),head=p.y-(a.car?9:a.kid?10:13)*z;
   if(!a.car)r.hits.push({citizen:a,x:p.x,y:p.y-5*z,r:Math.max(11,8*z)});
   const talking=a.say&&(!a.say.from||this.clock>=a.say.from);
   if(talking)this.bubble(p.x,head-2,a.say.text,a.say.name);
   else if(!a.car&&a.face>0&&a.state&&z>=.62){const pop=clamp((a.face>2.3?2.6-a.face:a.face)/.3,0,1),size=Math.max(6,5.2*z)*pop;if(size>1)this.face(p.x,head-size-2,size,LIFE.faces[a.state])}
  }
 }
}
