import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import { PhoneField } from "../forms/PhoneField";
import { logSearchAPI } from "../../api/rates";
import { EJS } from "../../config/emailjs";
import { B } from "../../theme/tokens";
import { isFreeEmail } from "../../utils/validation";
export function RateGate({ onUnlock, isMobile, st }){
const[step,setStep]=useState("form");
const[g,setG]=useState({name:"",email:"",company:"",phone:""});
const[errs,setErrs]=useState({});
const[phoneErr,setPhoneErr]=useState("");
const[otp,setOtp]=useState("");
const[sentOtp,setSentOtp]=useState("");
const[otpErr,setOtpErr]=useState("");
const[expiry,setExpiry]=useState(null);
const[sending,setSending]=useState(false);
const[resendCooldown,setResendCooldown]=useState(0);
const upg=(k,v)=>setG(p=>({...p,[k]:v}));

useEffect(()=>{
  if(!expiry) return;
  const t=setInterval(()=>{
    const left=Math.max(0,Math.ceil((expiry-Date.now())/1000));
    if(left===0){setStep("form");setSentOtp("");setOtp("");}
  },1000);
  return()=>clearInterval(t);
},[expiry]);

useEffect(()=>{
  if(resendCooldown<=0) return;
  const t=setInterval(()=>setResendCooldown(c=>Math.max(0,c-1)),1000);
  return()=>clearInterval(t);
},[resendCooldown]);

const validateForm=()=>{
  const e={};
  if(!g.name.trim()) e.name="Required";
  if(!g.email.trim()) e.email="Required";
  else if(!/^[^@]+@[^@]+\.[^@]+$/.test(g.email)) e.email="Invalid email";
  else if(isFreeEmail(g.email)) e.email="Please use your company email (not Gmail/Yahoo/Hotmail)";
  if(!g.phone.trim()) e.phone="Required";
  else if(phoneErr) e.phone=phoneErr;
  setErrs(e); return Object.keys(e).length===0;
};

const sendOtp=async()=>{
  if(!validateForm()) return;
  setSending(true);
  const code=String(Math.floor(100000+Math.random()*900000));
  try{
    await emailjs.send(EJS.serviceId, EJS.otpTemplateId, {
      user_name: g.name,
      user_email: g.email,
      otp: code
    }, EJS.publicKey);
    setSentOtp(code);
    setExpiry(Date.now()+10*60*1000);
    setResendCooldown(60);
    setStep("verify");
  }catch(err){
    console.error(err);
    setErrs(p=>({...p,email:"Failed to send OTP. Check your email and try again."}));
  }finally{setSending(false);}
};

const verifyOtp=()=>{
  if(!otp.trim()){setOtpErr("Enter the OTP");return;}
  if(otp.trim()!==sentOtp){setOtpErr("Incorrect OTP. Please try again.");return;}
  if(Date.now()>expiry){setOtpErr("OTP expired. Please request a new one.");setStep("form");return;}
  logSearchAPI({name:g.name,email:g.email,company:g.company||"(not provided)",phone:g.phone,pol:"—",pod:"—",eq:"—",found:"0",total:"—",note:"Gate unlock via OTP"});
  onUnlock(g);
};

if(step==="form") return(
<div style={{padding:24,borderRadius:14,background:`linear-gradient(135deg,${B.primary}08,${B.accent}10)`,border:`1.5px solid ${B.primary}22`,marginTop:20}}>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
<h4 style={{fontSize:15,fontWeight:700,color:B.dark,margin:0}}>Verify Your Identity to View Rates</h4>
</div>
<p style={{fontSize:12,color:B.g5,marginBottom:18,lineHeight:1.6}}>Enter your <strong>company email</strong> to receive a one-time access code. Personal email addresses (Gmail, Yahoo, etc.) are not accepted.</p>
<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
<div><label style={st.lb}>Your Name *</label><input style={{...st.inp,borderColor:errs.name?B.red:undefined}} value={g.name} onChange={e=>{upg("name",e.target.value);setErrs(p=>({...p,name:""}));}} placeholder="Full name"/>{errs.name&&<div style={{fontSize:11,color:B.red,marginTop:3}}>{errs.name}</div>}</div>
<div><label style={st.lb}>Company</label><input style={st.inp} value={g.company} onChange={e=>upg("company",e.target.value)} placeholder="Company name"/></div>
<div><label style={st.lb}>Company Email *</label><input type="email" style={{...st.inp,borderColor:errs.email?B.red:undefined}} value={g.email}
  onChange={e=>{upg("email",e.target.value);setErrs(p=>({...p,email:""}));}}
  onBlur={()=>{
    const v=g.email.trim();
    if(!v) return;
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(v)){setErrs(p=>({...p,email:"Invalid email address"}));return;}
    if(isFreeEmail(v)){setErrs(p=>({...p,email:"Please use your company email — Gmail, Yahoo, Hotmail and similar are not accepted"}));}
  }}
  placeholder="you@yourcompany.com"/>{errs.email&&<div style={{fontSize:11,color:B.red,marginTop:3}}>{errs.email}</div>}</div>
<div><label style={st.lb}>Phone *</label>
<PhoneField value={g.phone} onChange={v=>{upg("phone",v);setErrs(p=>({...p,phone:""}));}} error={errs.phone} onError={e=>setPhoneErr(e)} st={st}/>
</div>
</div>
<button onClick={sendOtp} disabled={sending} style={{...st.bp,marginTop:18,opacity:sending?.7:1}}>
{sending?"Sending OTP…":"Send Verification Code →"}
</button>
<p style={{fontSize:11,color:B.g5,marginTop:10}}>🔐 Your details are kept confidential and used only for rate access purposes.</p>
</div>);

return(
<div style={{padding:24,borderRadius:14,background:`linear-gradient(135deg,${B.primary}08,${B.accent}10)`,border:`1.5px solid ${B.primary}22`,marginTop:20}}>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={B.green} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
<h4 style={{fontSize:15,fontWeight:700,color:B.dark,margin:0}}>Check Your Email</h4>
</div>
<p style={{fontSize:13,color:B.g7,marginBottom:18,lineHeight:1.6}}>
A 6-digit code was sent to <strong>{g.email}</strong>. Enter it below to unlock rates.
</p>
<div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
<div style={{flex:1,minWidth:160}}>
<label style={st.lb}>Enter 6-digit OTP *</label>
<input type="number" maxLength={6} style={{...st.inp,fontSize:24,fontWeight:700,letterSpacing:8,textAlign:"center",borderColor:otpErr?B.red:undefined}}
  value={otp} onChange={e=>{setOtp(e.target.value.slice(0,6));setOtpErr("");}}
  placeholder="——————"/>
{otpErr&&<div style={{fontSize:11,color:B.red,marginTop:3}}>{otpErr}</div>}
</div>
<button onClick={verifyOtp} style={{...st.bp,marginTop:22,whiteSpace:"nowrap"}}>Verify & Unlock →</button>
</div>
<div style={{marginTop:14,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
<span style={{fontSize:12,color:B.g5}}>Didn't receive it? Check spam folder.</span>
{resendCooldown>0
  ?<span style={{fontSize:12,color:B.g5}}>Resend in {resendCooldown}s</span>
  :<button onClick={sendOtp} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:B.primary,fontWeight:600,padding:0}}>Resend OTP</button>
}
<button onClick={()=>{setStep("form");setOtp("");setOtpErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:B.g5,padding:0}}>← Change email</button>
</div>
</div>);
}



