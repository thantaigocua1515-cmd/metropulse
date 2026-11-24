"use strict";

// Màn hình chào: đăng nhập, đăng ký hoặc chơi khách trước khi vào thành phố.
const AuthGate = {
 rules:{
  user:v=>/^[a-zA-Z0-9_.]{3,20}$/.test(v)?"":"Tên đăng nhập gồm 3–20 chữ cái, số, dấu chấm hoặc gạch dưới.",
  pass:v=>v.length<6?"Mật khẩu cần ít nhất 6 ký tự.":v.length>72?"Mật khẩu tối đa 72 ký tự.":""
 },
 // Trả về "login" | "register" | "guest" khi đã có phiên, hoặc "offline" nếu người chơi tiếp tục không cần máy chủ.
 open(cloud,hasLocal){
  const root=document.getElementById("auth"),form=document.getElementById("auth-form"),$=id=>document.getElementById(id);
  const user=$("gate-user"),pass=$("gate-pass"),again=$("gate-again"),message=$("gate-message"),submit=$("gate-submit"),guest=$("gate-guest"),note=$("gate-note");
  let mode="login",busy=false;
  const say=(text,ok=false)=>{message.textContent=text;message.className=ok?"mint":"warn"};
  const setMode=next=>{
   mode=next;root.dataset.mode=mode;say("");
   for(const tab of root.querySelectorAll("[data-mode-tab]"))tab.classList.toggle("active",tab.dataset.modeTab===mode);
   $("gate-again-row").hidden=mode!=="register";
   pass.autocomplete=mode==="register"?"new-password":"current-password";
   submit.textContent=mode==="register"?"Tạo tài khoản & bắt đầu":"Đăng nhập";
   note.textContent=!hasLocal?"":mode==="register"?"Thành phố đang lưu trên trình duyệt này sẽ được gắn vào tài khoản mới.":"Nếu tài khoản đã có thành phố, nó sẽ thay cho thành phố đang lưu trên trình duyệt này.";
  };
  const lock=value=>{busy=value;for(const el of [user,pass,again,submit,guest])el.disabled=value};
  return new Promise(resolve=>{
   const done=result=>{root.hidden=true;resolve(result)};
   const run=async(job,result)=>{
    if(busy)return;lock(true);say("Đang kết nối…",true);
    try{await job();done(result)}
    catch(error){
     lock(false);
     if(error.status===0&&result==="guest"){cloud.online=false;done("offline");return}
     say(error.message||"Có lỗi xảy ra. Hãy thử lại.");
    }
   };
   root.onclick=event=>{
    const tab=event.target.closest("[data-mode-tab]");
    if(tab&&!busy){setMode(tab.dataset.modeTab);user.focus()}
   };
   $("gate-show").onchange=event=>{pass.type=again.type=event.target.checked?"text":"password"};
   guest.onclick=()=>run(()=>cloud.guest(),"guest");
   form.onsubmit=event=>{
    event.preventDefault();
    const name=user.value.trim(),secret=pass.value,problem=this.rules.user(name)||this.rules.pass(secret)||(mode==="register"&&secret!==again.value?"Hai lần nhập mật khẩu chưa khớp.":"");
    if(problem){say(problem);return}
    run(()=>mode==="register"?cloud.signup(name,secret):cloud.signin(name,secret),mode);
   };
   setMode("login");root.hidden=false;user.focus();
  });
 }
};
