import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { HelmetProvider, Helmet } from "react-helmet-async";
import emailjs from "@emailjs/browser";
import { ErrMsg } from "./components/forms/ErrMsg";
import { PhoneField } from "./components/forms/PhoneField";
import { CTA } from "./components/layout/CTA";
import { Footer } from "./components/layout/Footer";
import { Nav } from "./components/layout/Nav";
import { ScrollToTop } from "./components/routing/ScrollToTop";
import { CarrierBadge } from "./components/shared/CarrierBadge";
import { useIsMobile } from "./hooks/useIsMobile";
import { lr, saveRateAPI, deleteRateAPI, logSearchAPI } from "./api/rates";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { IndustriesPage } from "./pages/IndustriesPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { ServicesPage } from "./pages/ServicesPage";
import { TestimonialsPage } from "./pages/TestimonialsPage";
import { EJS } from "./config/emailjs";
import { CARRIERS } from "./data/carriers";
import { PACK_TYPES, OT_FR_EQ, EQ, EQ_L, CARGO } from "./data/equipment";
import { POL, POD_R, ALL_POD } from "./data/ports";
import { B, F, FF } from "./theme/tokens";
import { waLink } from "./utils/links";
import { pn } from "./utils/ports";
import { saveSession, loadSession, clearSession, lp, sp } from "./utils/session";
import { isFreeEmail } from "./utils/validation";
/* â•â•â• EMAILJS CONFIG â•â•â• */
/* â•â•â• RESPONSIVE HOOK â•â•â• */
/* â•â•â• PACKING TYPES â•â•â• */
/* â•â•â• BRAND â€” Sattva Brand Palette â•â•â• */
/* â•â•â• PORT DATA â•â•â• */
/* â•â•â• GOOGLE SHEETS BACKEND â•â•â• */
/* â•â•â• ICONS â•â•â• */
const I={
Ck:()=><svg width="18" height="18" viewBox="0 0 20 20" fill={B.primary}><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm4.707 8.707l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 11.586l4.293-4.293a1 1 0 111.414 1.414z"/></svg>,
Wr:()=><svg width="18" height="18" viewBox="0 0 20 20" fill="#94a3b8"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm1 14H9v-2h2v2zm0-4H9V6h2v4z"/></svg>,
St:()=><svg width="14" height="14" viewBox="0 0 16 16" fill={B.primary}><path d="M8 0l2.472 4.932L16 5.78l-4 3.854L12.944 16 8 13.416 3.056 16 4 9.634 0 5.78l5.528-.848z"/></svg>,
Qt:()=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>,
Sh:()=><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0020 17l-9-4-9 4c0 1.03.16 2.04.46 3"/><path d="M11 2v5L6 10l4-1V2"/><path d="M11 7h2"/></svg>,
Dc:()=><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
Tr:()=><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
Sd:()=><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
Gl:()=><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
Cb:()=><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
Ph:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
Ma:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>,
Pi:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
Ar:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
An:()=><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1.5"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M5 12H2a10 10 0 0020 0h-3"/></svg>,
Lk:()=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
Ed:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
Dl:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>,
Pl:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
Dw:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
};

/* â•â•â• STYLES â•â•â• */
const st={
sec:{padding:"72px 20px",maxWidth:1200,margin:"0 auto",boxSizing:"border-box",width:"100%"},
h1:{fontSize:"clamp(28px,6vw,52px)",fontWeight:700,color:B.dark,lineHeight:1.12,fontFamily:FF,margin:0},
h2:{fontSize:"clamp(24px,3.5vw,38px)",fontWeight:700,color:B.dark,lineHeight:1.2,fontFamily:FF,margin:0,textAlign:"center"},
h3:{fontSize:20,fontWeight:600,color:B.dark,fontFamily:F,margin:0},
bd:{fontSize:15,lineHeight:1.7,color:B.g5,fontFamily:F},
sub:{fontSize:16,lineHeight:1.7,color:B.g5,maxWidth:620,margin:"14px auto 0",textAlign:"center",fontFamily:F},
bp:{display:"inline-flex",alignItems:"center",gap:8,padding:"13px 24px",background:B.primary,color:"#fff",borderRadius:8,fontWeight:600,fontSize:14,border:"none",cursor:"pointer",fontFamily:F,boxShadow:`0 4px 14px ${B.primary}40`,transition:"all .2s"},
bs:{display:"inline-flex",alignItems:"center",gap:8,padding:"13px 24px",background:"transparent",color:B.primary,borderRadius:8,fontWeight:600,fontSize:14,border:`2px solid ${B.primary}`,cursor:"pointer",fontFamily:F,transition:"all .2s"},
cd:{background:"#fff",borderRadius:14,padding:28,boxShadow:"0 1px 3px rgba(0,0,0,.05), 0 6px 20px rgba(0,0,0,.03)"},
inp:{width:"100%",padding:"11px 14px",border:`1.5px solid ${B.g3}`,borderRadius:8,fontSize:14,fontFamily:F,outline:"none",boxSizing:"border-box",background:"#fff"},
lb:{fontSize:12,fontWeight:600,color:B.g7,marginBottom:5,display:"block",fontFamily:F},
};

/* â•â•â• NAV â•â•â• */
/* â•â•â• FOOTER â•â•â• */
/* â•â•â• CTA â•â•â• */
/* â•â•â• HOME â•â•â• */
/* â•â•â• ABOUT â•â•â• */
/* â•â•â• SERVICES â•â•â• */
/* â•â•â• INDUSTRIES â•â•â• */
/* â•â•â• KNOWLEDGE â•â•â• */
/* â•â•â• TESTIMONIALS â•â•â• */
/* â•â•â• COUNTRY PHONE DATA â•â•â• */
/* â•â•â• RATE GATE â€” email OTP verification â•â•â• */
function RateGate({onUnlock,isMobile}){
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
  logSearchAPI({name:g.name,email:g.email,company:g.company||"(not provided)",phone:g.phone,pol:"â€”",pod:"â€”",eq:"â€”",found:"0",total:"â€”",note:"Gate unlock via OTP"});
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
<div><label style={st.lb}>Company Email *</label><input type="email" style={{...st.inp,borderColor:errs.email?B.red:undefined}} value={g.email} onChange={e=>{upg("email",e.target.value);setErrs(p=>({...p,email:""}));}} placeholder="you@yourcompany.com"/>{errs.email&&<div style={{fontSize:11,color:B.red,marginTop:3}}>{errs.email}</div>}</div>
<div><label style={st.lb}>Phone *</label>
<PhoneField value={g.phone} onChange={v=>{upg("phone",v);setErrs(p=>({...p,phone:""}));}} error={errs.phone} onError={e=>setPhoneErr(e)} st={st}/>
</div>
</div>
<button onClick={sendOtp} disabled={sending} style={{...st.bp,marginTop:18,opacity:sending?.7:1}}>
{sending?"Sending OTPâ€¦":"Send Verification Code â†’"}
</button>
<p style={{fontSize:11,color:B.g5,marginTop:10}}>ðŸ”’ Your details are kept confidential and used only for rate access purposes.</p>
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
  placeholder="â€”â€”â€”â€”â€”â€”"/>
{otpErr&&<div style={{fontSize:11,color:B.red,marginTop:3}}>{otpErr}</div>}
</div>
<button onClick={verifyOtp} style={{...st.bp,marginTop:22,whiteSpace:"nowrap"}}>Verify & Unlock â†’</button>
</div>
<div style={{marginTop:14,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
<span style={{fontSize:12,color:B.g5}}>Didn't receive it? Check spam folder.</span>
{resendCooldown>0
  ?<span style={{fontSize:12,color:B.g5}}>Resend in {resendCooldown}s</span>
  :<button onClick={sendOtp} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:B.primary,fontWeight:600,padding:0}}>Resend OTP</button>
}
<button onClick={()=>{setStep("form");setOtp("");setOtpErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:B.g5,padding:0}}>â† Change email</button>
</div>
</div>);
}

/* â•â•â• QUOTE PAGE â€” with instant rate lookup â•â•â• */
function QuotePage({rates}){const go=useNavigate();
const m=useIsMobile();
const[f,setF]=useState({pol:"",podR:"",pod:"",cargo:"",eq:"",vol:"1",msg:"",dimL:"",dimW:"",dimH:"",packType:"",captchaAns:""});
const[done,setDone]=useState(false);
const[errs,setErrs]=useState({});
const[sending,setSending]=useState(false);
const[sendErr,setSendErr]=useState("");
const[files,setFiles]=useState([]);
const[fileErr,setFileErr]=useState("");
const[captcha,setCaptcha]=useState(()=>{const a=Math.ceil(Math.random()*9),b=Math.ceil(Math.random()*9);return{a,b,ans:a+b};});
const[gateUser,setGateUser]=useState(()=>loadSession());
const[lastLoggedRk,setLastLoggedRk]=useState(null);
const setVerifiedUser=(user)=>{saveSession(user);setGateUser(user);};
const up=(k,v)=>setF(p=>({...p,[k]:v}));
const pods=f.podR?POD_R[f.podR]||[]:[];
const rk=f.pol&&f.pod&&f.eq?`${f.pol}:${f.pod}:${f.eq}`:null;
const rate=rk&&rates[rk]?rates[rk]:null;
const qty=Math.max(1,parseInt(f.vol)||1);
const isOTFR=OT_FR_EQ.includes(f.eq);
const MAX_MB=5;const MAX_FILES=3;
const refreshCaptcha=()=>{const a=Math.ceil(Math.random()*9),b=Math.ceil(Math.random()*9);setCaptcha({a,b,ans:a+b});up("captchaAns","");};
const handleFiles=(e)=>{const chosen=Array.from(e.target.files);if(chosen.filter(f=>f.size>MAX_MB*1024*1024).length){setFileErr(`Max file size is ${MAX_MB}MB.`);return;}if(chosen.length>MAX_FILES){setFileErr(`Max ${MAX_FILES} files.`);return;}setFileErr("");setFiles(chosen);};

// Log each unique route lookup after gate is unlocked
useEffect(()=>{
  if(rk&&gateUser&&rk!==lastLoggedRk){
    setLastLoggedRk(rk);
    const polName=POL.find(p=>p.c===f.pol)?.n||f.pol;
    const podName=ALL_POD.find(p=>p.c===f.pod)?.n||f.pod;
    logSearchAPI({
      name:gateUser.name,email:gateUser.email,
      company:gateUser.company||"(not provided)",phone:gateUser.phone,
      pol:`${polName} (${f.pol})`,pod:`${podName} (${f.pod})`,
      eq:f.eq,found:rate?"1":"0",total:rate?rate.total:"â€”",note:"Route lookup"
    });
  }
},[rk,gateUser]);
const validate=()=>{
  const e={};
  if(!f.pol)e.pol="Required";
  if(!f.pod)e.pod="Required";
  if(!f.cargo)e.cargo="Required";
  if(!f.eq)e.eq="Required";
  if(isOTFR){if(!f.dimL.trim()||!f.dimW.trim()||!f.dimH.trim())e.dims="All dimensions required";if(!f.packType)e.packType="Required";}
  if(parseInt(f.captchaAns)!==captcha.ans)e.captcha="Incorrect answer";
  setErrs(e);return Object.keys(e).length===0;
};
const handleSubmit=async()=>{
  if(!gateUser){setSendErr("Please select your route and verify your identity first.");return;}
  if(!validate())return;
  setSending(true);setSendErr("");
  const polName=POL.find(p=>p.c===f.pol)?.n||f.pol;
  const podName=ALL_POD.find(p=>p.c===f.pod)?.n||f.pod;
  const params={
    from_name:gateUser.name,company:gateUser.company||"(not provided)",
    from_email:gateUser.email,phone:gateUser.phone,
    pol:`${polName} (${f.pol})`,pod:`${podName} (${f.pod})`,
    cargo:f.cargo,equipment:`${EQ_L[f.eq]||f.eq} (${f.eq})`,containers:f.vol,
    dimensions:isOTFR?`L:${f.dimL}m x W:${f.dimW}m x H:${f.dimH}m`:"N/A",
    packing:isOTFR?f.packType:"N/A",
    attachments:files.length?files.map(x=>x.name).join(", "):"None",
    notes:f.msg||"(none)",reply_to:gateUser.email
  };
  // Always log to Google Sheets regardless of email success
  logSearchAPI({
    name:gateUser.name,email:gateUser.email,
    company:gateUser.company||"(not provided)",phone:gateUser.phone,
    pol:params.pol,pod:params.pod,eq:f.eq,
    found:rate?"1":"0",total:rate?rate.total:"â€”",note:"Quote submitted"
  });
  try{
    await emailjs.send(EJS.serviceId,EJS.templateId,params,EJS.publicKey);
    setDone(true);
  }catch(err){
    console.error("EmailJS error:",err);
    // Even if email fails, show success since we logged to Sheets
    // and give user the WhatsApp fallback
    setSendErr("Email delivery failed. Please use WhatsApp button below to send your request, or email quotes@sattvaglobal.in directly.");
  }
  finally{setSending(false);}
};
const waMsg=`Hi, freight quote request.\nName: ${gateUser?.name||""}\nPhone: ${gateUser?.phone||""}\nPOL: ${f.pol} â†’ POD: ${f.pod}\nCargo: ${f.cargo} | ${f.eq} x${f.vol}${isOTFR?`\nDims: L${f.dimL}xW${f.dimW}xH${f.dimH}m | Packing: ${f.packType}`:""}${f.msg?`\nNotes: ${f.msg}`:""}`;
const resetForm=()=>{setDone(false);setF({pol:"",podR:"",pod:"",cargo:"",eq:"",vol:"1",msg:"",dimL:"",dimW:"",dimH:"",packType:"",captchaAns:""});setFiles([]);setErrs({});setGateUser(null);clearSession();refreshCaptcha();};
if(done)return(<div style={{paddingTop:68,minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"68px 24px 40px"}}><div style={{textAlign:"center",maxWidth:480}}><div style={{width:72,height:72,borderRadius:"50%",background:B.gBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.green} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div><h2 style={{...st.h2,fontSize:26}}>Quote Request Received!</h2><p style={{...st.bd,marginTop:14}}>Our team will respond within 24 hours with a competitive quotation.</p><div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:28}}><button onClick={resetForm} style={st.bp}>Submit Another</button><button onClick={()=>go("/")} style={st.bs}>Back to Home</button></div></div></div>);
return(
<div style={{paddingTop:68}}><Helmet><title>Get a Freight Quote | Export FCL Rates from India | Sattva Global Logistics</title><meta name="description" content="Request a freight quote for FCL export from JNPT, Mundra, Chennai or Cochin to the Middle East, Red Sea, Africa, Europe or Americas. Instant rates for key trade lanes." /><link rel="canonical" href="https://www.sattvaglobal.in/quote" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Get a Quote</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Request a <span style={{color:B.primary}}>Freight Quote</span></h1>
<p style={{...st.bd,fontSize:17,marginTop:20,maxWidth:600}}>Fill in details â€” if rates are loaded for your route, you'll see instant pricing.</p>
</div></section>
<div style={st.sec}><div style={{display:"grid",gridTemplateColumns:m?"1fr":"5fr 3fr",gap:40}}>
<div style={{...st.cd,padding:m?20:36}}>
<h3 style={{...st.h3,marginBottom:28}}>Route & Cargo Details</h3>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:18}}>
<div><label style={st.lb}>POL *</label><select style={{...st.inp,borderColor:errs.pol?B.red:undefined}} value={f.pol} onChange={e=>{up("pol",e.target.value);setErrs(p=>({...p,pol:""}));}}><option value="">Select</option>{POL.map(p=><option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select><ErrMsg msg={errs.pol}/></div>
<div><label style={st.lb}>Region *</label><select style={st.inp} value={f.podR} onChange={e=>{up("podR",e.target.value);up("pod","");}}><option value="">Select</option>{Object.keys(POD_R).map(r=><option key={r} value={r}>{r}</option>)}</select></div>
<div><label style={st.lb}>POD *</label><select style={{...st.inp,borderColor:errs.pod?B.red:undefined}} value={f.pod} onChange={e=>{up("pod",e.target.value);setErrs(p=>({...p,pod:""}));}} disabled={!f.podR}><option value="">Select</option>{pods.map(p=><option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select><ErrMsg msg={errs.pod}/></div>
<div><label style={st.lb}>Cargo Type *</label><select style={{...st.inp,borderColor:errs.cargo?B.red:undefined}} value={f.cargo} onChange={e=>{up("cargo",e.target.value);setErrs(p=>({...p,cargo:""}));}}><option value="">Select</option>{CARGO.map(c=><option key={c} value={c}>{c}</option>)}</select><ErrMsg msg={errs.cargo}/></div>
<div><label style={st.lb}>Equipment *</label><select style={{...st.inp,borderColor:errs.eq?B.red:undefined}} value={f.eq} onChange={e=>{up("eq",e.target.value);setErrs(p=>({...p,eq:""}));up("dimL","");up("dimW","");up("dimH","");up("packType","");}}><option value="">Select</option>{EQ.map(e=><option key={e} value={e}>{EQ_L[e]} ({e})</option>)}</select><ErrMsg msg={errs.eq}/></div>
<div><label style={st.lb}>Containers</label><input type="number" style={st.inp} value={f.vol} onChange={e=>up("vol",e.target.value)} min="1"/></div>
</div>
{isOTFR&&(<div style={{marginTop:24,padding:20,borderRadius:12,background:`${B.primary}05`,border:`1.5px solid ${B.primary}22`}}>
<h4 style={{fontSize:14,fontWeight:700,color:B.primary,marginBottom:16}}>ðŸ“ Special Cargo Details â€” Required for {f.eq}</h4>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:16}}>
<div><label style={st.lb}>Length (m) *</label><input type="number" step="0.01" style={{...st.inp,borderColor:errs.dims?B.red:undefined}} value={f.dimL} onChange={e=>{up("dimL",e.target.value);setErrs(p=>({...p,dims:""}));}} placeholder="e.g. 4.5"/></div>
<div><label style={st.lb}>Width (m) *</label><input type="number" step="0.01" style={{...st.inp,borderColor:errs.dims?B.red:undefined}} value={f.dimW} onChange={e=>{up("dimW",e.target.value);setErrs(p=>({...p,dims:""}));}} placeholder="e.g. 2.1"/></div>
<div><label style={st.lb}>Height (m) *</label><input type="number" step="0.01" style={{...st.inp,borderColor:errs.dims?B.red:undefined}} value={f.dimH} onChange={e=>{up("dimH",e.target.value);setErrs(p=>({...p,dims:""}));}} placeholder="e.g. 2.4"/></div>
</div>
{errs.dims&&<div style={{fontSize:11,color:B.red,marginBottom:10}}>{errs.dims}</div>}
<div style={{marginBottom:16}}><label style={st.lb}>Packing Type *</label><select style={{...st.inp,borderColor:errs.packType?B.red:undefined}} value={f.packType} onChange={e=>{up("packType",e.target.value);setErrs(p=>({...p,packType:""}));}}><option value="">Select packing type</option>{PACK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select><ErrMsg msg={errs.packType}/></div>
<div><label style={st.lb}>Upload Images / Brochure / PDF <span style={{fontWeight:400,color:B.g5}}>(optional â€” max {MAX_FILES} files, {MAX_MB}MB each, JPG/PNG/PDF only)</span></label><input type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={handleFiles} style={{display:"block",marginTop:6,fontSize:13,fontFamily:F,color:B.g7}}/>{fileErr&&<div style={{fontSize:11,color:B.red,marginTop:4}}>{fileErr}</div>}{files.length>0&&<div style={{fontSize:12,color:B.green,marginTop:6}}>âœ“ {files.length} file(s) selected: {files.map(x=>x.name).join(", ")}</div>}</div>
</div>)}
{rk&&!gateUser&&<RateGate onUnlock={setVerifiedUser} isMobile={m}/>}
{gateUser&&<div style={{marginTop:16,padding:"10px 16px",borderRadius:8,background:B.gBg,border:`1px solid ${B.green}33`,display:"flex",alignItems:"center",gap:8,fontSize:13}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={B.green} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg><span style={{color:B.green,fontWeight:600}}>Verified:</span><span style={{color:B.g7}}>{gateUser.name} {gateUser.company?`Â· ${gateUser.company}`:""}</span><button onClick={()=>{clearSession();setGateUser(null);}} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:11,color:B.g5}}>Change</button></div>}
{rk&&gateUser&&(<div style={{marginTop:24,padding:20,borderRadius:12,background:rate?B.gBg:B.aBg,border:`1px solid ${rate?B.green:B.amber}22`}}>
{rate?(<><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}><div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><h4 style={{fontSize:15,fontWeight:700,color:B.green,margin:0}}>âœ“ Instant Rate Available</h4>{rate.carrier&&<CarrierBadge name={rate.carrier}/>}</div><span style={{fontSize:12,color:B.g5}}>Valid: {rate.validFrom||"â€”"} to {rate.validTo||"â€”"}</span></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>{[["Ocean Freight",rate.oceanFreight],["THC Origin",rate.thcOrigin],["THC Dest",rate.thcDest],["BL Fee",rate.blFee],["Surcharges",rate.surcharges||0],...(rate.extraItems||[]).map(x=>[x.label,parseFloat(x.value)||0])].map(([lb,v])=><div key={lb} style={{background:"#fff",padding:8,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:B.g5}}>{lb}</div><div style={{fontSize:15,fontWeight:700,color:B.dark}}>${v}</div></div>)}<div style={{background:B.primary,padding:8,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:"#fff",opacity:.8}}>Per Container</div><div style={{fontSize:15,fontWeight:700,color:"#fff"}}>${rate.total}</div></div></div>
{qty>1&&<div style={{background:"#fff",padding:10,borderRadius:8,textAlign:"center",marginBottom:8}}><span style={{fontSize:13,color:B.g5}}>Total {qty} ctrs: </span><span style={{fontSize:18,fontWeight:800,color:B.primary}}>${(rate.total*qty).toLocaleString()} USD</span></div>}
<p style={{fontSize:11,color:B.g5,marginTop:4,fontStyle:"italic"}}>* Indicative. Final quote subject to space & surcharges at booking.</p></>
):(<div><h4 style={{fontSize:14,fontWeight:600,color:B.amber,margin:0,marginBottom:6}}>Rate not pre-loaded for this route</h4><p style={{fontSize:13,color:B.g5,margin:0}}>Submit your request â€” custom quote within 24 hours.</p></div>)}</div>)}
<div style={{marginTop:20}}><label style={st.lb}>Additional Notes</label><textarea style={{...st.inp,minHeight:80,resize:"vertical"}} value={f.msg} onChange={e=>up("msg",e.target.value)} placeholder="Special requirementsâ€¦"/></div>
<div style={{marginTop:20,padding:16,borderRadius:10,background:B.g1,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
<label style={{...st.lb,margin:0}}>Verification *</label>
<span style={{fontSize:15,fontWeight:700,color:B.dark}}>{captcha.a} + {captcha.b} = ?</span>
<input type="number" style={{...st.inp,width:80,borderColor:errs.captcha?B.red:undefined}} value={f.captchaAns} onChange={e=>{up("captchaAns",e.target.value);setErrs(p=>({...p,captcha:""}));}} placeholder="Answer"/>
<button onClick={refreshCaptcha} title="New question" style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:B.g5,padding:"2px 6px"}}>â†»</button>
{errs.captcha&&<span style={{fontSize:11,color:B.red}}>{errs.captcha}</span>}
</div>
{sendErr&&<div style={{marginTop:16,padding:"12px 16px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",color:B.red,fontSize:13}}>{sendErr}</div>}
<div style={{display:"flex",gap:12,marginTop:24,flexWrap:"wrap"}}>
<button onClick={handleSubmit} disabled={sending} style={{...st.bp,flex:1,justifyContent:"center",opacity:sending?.7:1}}>{sending?"Sendingâ€¦":"Submit Quote Request"} {!sending&&<I.Ar/>}</button>
<a href={waLink(waMsg)} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"13px 20px",background:"#25D366",color:"#fff",borderRadius:8,fontWeight:600,fontSize:14,textDecoration:"none",whiteSpace:"nowrap"}}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.564l4.682-1.463A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.156 0-4.154-.695-5.785-1.873l-.413-.281-2.776.868.854-2.703-.302-.436A9.713 9.713 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75S21.75 6.615 21.75 12s-4.365 9.75-9.75 9.75z"/></svg>WhatsApp</a>
</div>
</div>
<div>
<div style={{...st.cd,marginBottom:20,borderTop:`3px solid ${B.primary}`}}><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:14}}>Speak to an Expert</h4><p style={{...st.bd,fontSize:13,marginBottom:14}}>Prefer to talk?</p><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13,color:B.g7}}><I.Ph/> +91 9136 121 123</div><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.g7}}><I.Ma/> quotes@sattvaglobal.in</div></div>
<div style={st.cd}><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:14}}>Why Get a Quote?</h4>{["Multi-carrier rates","Transparent breakdown","24hr response","No hidden charges","Expert routing advice"].map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}><div style={{flexShrink:0,marginTop:2}}><I.Ck/></div><span style={{fontSize:13,color:B.g7}}>{t}</span></div>)}</div>
</div>
</div></div></div>);}
/* â•â•â• ADMIN PANEL â€” Rate Management Backend â•â•â• */
function AdminPage({rates,setRates}){const go=useNavigate();
const[authed,setAuthed]=useState(false);
const[pin,setPin]=useState("");
const[pinErr,setPinErr]=useState("");
const[storedPin,setStoredPin]=useState(null);
const[setup,setSetup]=useState(false);
const[newPin,setNewPin]=useState("");
const[tab,setTab]=useState("rates");
const[editKey,setEditKey]=useState(null);
const[fm,setFm]=useState({pol:"",pod:"",podR:"",eq:"",of:"",to:"",td:"",bl:"",su:"",vf:"",vt:"",cr:""});
const[extraItems,setExtraItems]=useState([]); // [{label:"",value:""}]
const[bulk,setBulk]=useState("");
const[msg,setMsg]=useState("");
const[search,setSearch]=useState("");

useEffect(()=>{lp().then(p=>{setStoredPin(p);if(!p)setSetup(true);});},[]);

const doLogin=()=>{if(pin===storedPin){setAuthed(true);setPinErr("");}else setPinErr("Wrong PIN.");};
const doSetup=async()=>{if(newPin.length<4)return;await sp(newPin);setStoredPin(newPin);setSetup(false);setAuthed(true);};
const up=(k,v)=>setFm(p=>({...p,[k]:v}));
const pods=fm.podR?POD_R[fm.podR]||[]:[];
const extraTotal=()=>extraItems.reduce((a,x)=>a+(parseFloat(x.value)||0),0);
const tot=()=>["of","to","td","bl","su"].map(k=>parseFloat(fm[k])||0).reduce((a,b)=>a+b,0)+extraTotal();
const addExtraItem=()=>setExtraItems(p=>[...p,{label:"",value:""}]);
const removeExtraItem=(i)=>setExtraItems(p=>p.filter((_,idx)=>idx!==i));
const upExtra=(i,k,v)=>setExtraItems(p=>p.map((x,idx)=>idx===i?{...x,[k]:v}:x));

const saveRate=async()=>{
if(!fm.pol||!fm.pod||!fm.eq){setMsg("Fill POL, POD, Equipment.");return;}
const key=`${fm.pol}:${fm.pod}:${fm.eq}`;
const entry={oceanFreight:parseFloat(fm.of)||0,thcOrigin:parseFloat(fm.to)||0,thcDest:parseFloat(fm.td)||0,blFee:parseFloat(fm.bl)||0,surcharges:parseFloat(fm.su)||0,extraItems:extraItems.filter(x=>x.label&&parseFloat(x.value)),total:tot(),validFrom:fm.vf,validTo:fm.vt,carrier:fm.cr||null,updatedAt:new Date().toISOString()};
setMsg("Savingâ€¦");
const ok=await saveRateAPI(key,entry);
if(ok){
  const updated={...rates,[key]:entry};
  setRates(updated);
  setMsg(`âœ“ Saved to Google Sheets: ${key} â€” $${entry.total}/ctr`);
  setFm({pol:"",pod:"",podR:"",eq:"",of:"",to:"",td:"",bl:"",su:"",vf:"",vt:"",cr:""});
  setExtraItems([]);
  setEditKey(null);setTab("rates");
}else setMsg("âš  Save failed. Check your SCRIPT_URL in App.jsx.");};

const del=async(key)=>{
  setMsg("Deletingâ€¦");
  await deleteRateAPI(key);
  const u={...rates};delete u[key];
  setRates(u);
  setMsg(`âœ“ Deleted: ${key}`);
};;

const edit=(key)=>{
const r=rates[key];const[pol,pod,eq]=key.split(":");
let podR="";for(const[rg,ps]of Object.entries(POD_R)){if(ps.find(p=>p.c===pod)){podR=rg;break;}}
setFm({pol,pod,podR,eq,of:String(r.oceanFreight),to:String(r.thcOrigin),td:String(r.thcDest),bl:String(r.blFee),su:String(r.surcharges||0),vf:r.validFrom||"",vt:r.validTo||"",cr:r.carrier||""});
setExtraItems(r.extraItems||[]);
setEditKey(key);setTab("add");};

const importBulk=async()=>{
  try{
    const p=JSON.parse(bulk);
    setMsg(`Saving ${Object.keys(p).length} rates to Google Sheetsâ€¦`);
    let count=0;
    for(const[key,entry]of Object.entries(p)){
      const ok=await saveRateAPI(key,entry);
      if(ok)count++;
    }
    const m={...rates,...p};
    setRates(m);
    setMsg(`âœ“ Imported ${count}/${Object.keys(p).length} rates to Google Sheets.`);
    setBulk("");
  }catch{setMsg("Invalid JSON.");}
};;

const exportRates=()=>{const b=new Blob([JSON.stringify(rates,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="sattva-rates.json";a.click();URL.revokeObjectURL(u);};

const entries=Object.entries(rates).filter(([k])=>!search||k.toLowerCase().includes(search.toLowerCase()));

if(!authed) return(
<div style={{paddingTop:68,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:B.g1}}>
<div style={{...st.cd,maxWidth:400,width:"100%",textAlign:"center",padding:40}}>
<I.Lk/><h2 style={{fontSize:22,fontWeight:700,color:B.dark,marginTop:16,marginBottom:8,fontFamily:FF}}>Admin Panel</h2>
{setup?(<>
<p style={{...st.bd,fontSize:14,marginBottom:20}}>First time? Set a 4+ digit PIN.</p>
<input type="password" style={{...st.inp,textAlign:"center",fontSize:24,letterSpacing:8}} value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="PIN" maxLength={8}/>
<button onClick={doSetup} style={{...st.bp,marginTop:16,width:"100%",justifyContent:"center"}} disabled={newPin.length<4}>Set PIN & Enter</button>
</>):(<>
<p style={{...st.bd,fontSize:14,marginBottom:20}}>Enter PIN to manage rates.</p>
<input type="password" style={{...st.inp,textAlign:"center",fontSize:24,letterSpacing:8}} value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN" maxLength={8} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
{pinErr&&<p style={{color:B.red,fontSize:13,marginTop:8}}>{pinErr}</p>}
<button onClick={doLogin} style={{...st.bp,marginTop:16,width:"100%",justifyContent:"center"}}>Unlock</button>
</>)}
<button onClick={()=>go("/")} style={{...st.bs,marginTop:12,width:"100%",justifyContent:"center",fontSize:13}}>â† Website</button>
</div></div>);

return(
<div style={{paddingTop:68,minHeight:"100vh",background:B.g1}}>
<div style={{maxWidth:1200,margin:"0 auto",padding:"32px 24px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
<div><h1 style={{fontSize:26,fontWeight:700,color:B.dark,fontFamily:FF,margin:0}}>Rate Management</h1><p style={{fontSize:13,color:B.g5,marginTop:4}}>{Object.keys(rates).length} rates Â· Auto-saved</p></div>
<div style={{display:"flex",gap:10}}>
<button onClick={exportRates} style={{...st.bs,padding:"8px 16px",fontSize:12}}><I.Dw/> Export</button>
<button onClick={()=>go("/")} style={{...st.bs,padding:"8px 16px",fontSize:12}}>â† Site</button>
</div></div>

{msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.startsWith("âœ“")?B.gBg:B.aBg,color:msg.startsWith("âœ“")?B.green:B.amber,fontSize:13,marginBottom:16,fontWeight:500}}>{msg}</div>}

<div style={{display:"flex",gap:4,marginBottom:24}}>
{[["rates","All Rates"],["add",editKey?"Edit Rate":"Add Rate"],["bulk","Bulk Import"]].map(([id,lb])=>
<button key={id} onClick={()=>{setTab(id);if(id!=="add")setEditKey(null);}} style={{padding:"10px 20px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:F,background:tab===id?"#fff":"transparent",color:tab===id?B.primary:B.g5,boxShadow:tab===id?"0 -1px 4px rgba(0,0,0,.05)":"none"}}>{lb}</button>)}
</div>

{tab==="rates"&&(
<div style={{...st.cd,padding:0,overflow:"hidden"}}>
<div style={{padding:"16px 20px",borderBottom:`1px solid ${B.g1}`,display:"flex",gap:12,alignItems:"center"}}>
<input style={{...st.inp,maxWidth:300}} placeholder="Search (INNSA, AEJEA, 40HC)..." value={search} onChange={e=>setSearch(e.target.value)}/>
<button onClick={()=>setTab("add")} style={{...st.bp,padding:"10px 18px",fontSize:12,whiteSpace:"nowrap"}}><I.Pl/> Add Rate</button>
</div>
{entries.length===0?(<div style={{padding:40,textAlign:"center",color:B.g5}}><p style={{fontSize:15,fontWeight:500}}>No rates found</p><p style={{fontSize:13,marginTop:6}}>Add your first rate or import JSON.</p></div>):(
<div style={{overflowX:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:F}}>
<thead><tr style={{background:B.g1}}>
{["POL","POD","Equip","Carrier","Ocean","THC-O","THC-D","BL","Surch","Total","Valid",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:600,color:B.g5,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}
</tr></thead>
<tbody>{entries.map(([key,r])=>{const[pol,pod,eq]=key.split(":");return(
<tr key={key} style={{borderBottom:`1px solid ${B.g1}`}}>
<td style={{padding:"10px 12px",fontWeight:600,color:B.dark}}>{pol}</td>
<td style={{padding:"10px 12px"}}>{pn(pod)}<br/><span style={{fontSize:11,color:B.g5}}>{pod}</span></td>
<td style={{padding:"10px 12px"}}>{eq}</td>
<td style={{padding:"10px 12px"}}>{r.carrier?<CarrierBadge name={r.carrier} size="sm"/>:<span style={{color:B.g5,fontSize:11}}>â€”</span>}</td>
<td style={{padding:"10px 12px"}}>${r.oceanFreight}</td>
<td style={{padding:"10px 12px"}}>${r.thcOrigin}</td>
<td style={{padding:"10px 12px"}}>${r.thcDest}</td>
<td style={{padding:"10px 12px"}}>${r.blFee}</td>
<td style={{padding:"10px 12px"}}>${r.surcharges||0}</td>
<td style={{padding:"10px 12px",fontWeight:700,color:B.primary}}>${r.total}</td>
<td style={{padding:"10px 12px",fontSize:11,color:B.g5,whiteSpace:"nowrap"}}>{r.validFrom||"â€”"}<br/>{r.validTo||"â€”"}</td>
<td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
<button onClick={()=>edit(key)} style={{background:"none",border:"none",cursor:"pointer",color:B.primary,padding:4,marginRight:4}}><I.Ed/></button>
<button onClick={()=>del(key)} style={{background:"none",border:"none",cursor:"pointer",color:B.red,padding:4}}><I.Dl/></button>
</td></tr>);})}</tbody>
</table></div>)}
</div>)}

{tab==="add"&&(
<div style={{...st.cd,maxWidth:720}}>
<h3 style={{...st.h3,marginBottom:24}}>{editKey?"Edit Rate":"Add New Rate"}</h3>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
<div><label style={st.lb}>POL *</label><select style={st.inp} value={fm.pol} onChange={e=>up("pol",e.target.value)}><option value="">Select</option>{POL.map(p=><option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select></div>
<div><label style={st.lb}>Region</label><select style={st.inp} value={fm.podR} onChange={e=>{up("podR",e.target.value);up("pod","");}}><option value="">Select</option>{Object.keys(POD_R).map(r=><option key={r} value={r}>{r}</option>)}</select></div>
<div><label style={st.lb}>POD *</label><select style={st.inp} value={fm.pod} onChange={e=>up("pod",e.target.value)} disabled={!fm.podR}><option value="">Select</option>{pods.map(p=><option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select></div>
<div><label style={st.lb}>Equipment *</label><select style={st.inp} value={fm.eq} onChange={e=>up("eq",e.target.value)}><option value="">Select</option>{EQ.map(e=><option key={e} value={e}>{EQ_L[e]} ({e})</option>)}</select></div>
<div><label style={st.lb}>Carrier / Shipping Line</label><select style={st.inp} value={fm.cr} onChange={e=>up("cr",e.target.value)}><option value="">Select carrier</option>{Object.keys(CARRIERS).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
<div><label style={st.lb}>Valid From</label><input type="date" style={st.inp} value={fm.vf} onChange={e=>up("vf",e.target.value)}/></div>
<div><label style={st.lb}>Valid To</label><input type="date" style={st.inp} value={fm.vt} onChange={e=>up("vt",e.target.value)}/></div>
</div>
<div style={{borderTop:`1px solid ${B.g3}44`,marginTop:24,paddingTop:20}}>
<h4 style={{fontSize:14,fontWeight:600,color:B.dark,marginBottom:14}}>Rate Components (USD/container)</h4>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:14}}>
<div><label style={st.lb}>Ocean Freight</label><input type="number" style={st.inp} value={fm.of} onChange={e=>up("of",e.target.value)} placeholder="850"/></div>
<div><label style={st.lb}>THC Origin</label><input type="number" style={st.inp} value={fm.to} onChange={e=>up("to",e.target.value)} placeholder="150"/></div>
<div><label style={st.lb}>THC Dest</label><input type="number" style={st.inp} value={fm.td} onChange={e=>up("td",e.target.value)} placeholder="200"/></div>
<div><label style={st.lb}>BL Fee</label><input type="number" style={st.inp} value={fm.bl} onChange={e=>up("bl",e.target.value)} placeholder="50"/></div>
<div><label style={st.lb}>Surcharges</label><input type="number" style={st.inp} value={fm.su} onChange={e=>up("su",e.target.value)} placeholder="0"/></div>
</div>
{extraItems.length>0&&(
<div style={{marginTop:14}}>
<div style={{fontSize:12,fontWeight:600,color:B.g5,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Additional Charges</div>
{extraItems.map((x,i)=>(
<div key={i} style={{display:"grid",gridTemplateColumns:"1fr 140px 36px",gap:10,marginBottom:10,alignItems:"center"}}>
<input style={{...st.inp}} value={x.label} onChange={e=>upExtra(i,"label",e.target.value)} placeholder="e.g. CAF, PSS, AMS Fee..."/>
<input type="number" style={{...st.inp}} value={x.value} onChange={e=>upExtra(i,"value",e.target.value)} placeholder="0"/>
<button onClick={()=>removeExtraItem(i)} style={{background:"none",border:`1px solid ${B.red}44`,borderRadius:6,cursor:"pointer",color:B.red,fontSize:16,height:42,display:"flex",alignItems:"center",justifyContent:"center"}}>Ã—</button>
</div>
))}
</div>)}
<button onClick={addExtraItem} style={{marginTop:12,background:"none",border:`1.5px dashed ${B.primary}66`,borderRadius:8,cursor:"pointer",color:B.primary,fontWeight:600,fontSize:13,fontFamily:F,padding:"8px 16px",display:"flex",alignItems:"center",gap:6}}>
<I.Pl/> Add Charge Line
</button>
<div style={{marginTop:16,padding:16,background:`${B.primary}06`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:14,fontWeight:600,color:B.g7}}>Total per Container:</span>
<span style={{fontSize:24,fontWeight:800,color:B.primary,fontFamily:FF}}>${tot()}</span>
</div></div>
<div style={{display:"flex",gap:12,marginTop:24}}>
<button onClick={saveRate} style={{...st.bp,flex:1,justifyContent:"center"}}>{editKey?"Update":"Save"} Rate</button>
{editKey&&<button onClick={()=>{setEditKey(null);setFm({pol:"",pod:"",podR:"",eq:"",of:"",to:"",td:"",bl:"",su:"",vf:"",vt:"",cr:""});setExtraItems([]);setTab("rates");}} style={{...st.bs,padding:"10px 20px"}}>Cancel</button>}
</div></div>)}

{tab==="bulk"&&(
<div style={{...st.cd,maxWidth:720}}>
<h3 style={{...st.h3,marginBottom:10}}>Bulk Import</h3>
<p style={{...st.bd,fontSize:13,marginBottom:16}}>Paste JSON: keys = <code style={{background:B.g1,padding:"2px 6px",borderRadius:4}}>POL:POD:EQUIPMENT</code></p>
<div style={{background:B.g1,padding:14,borderRadius:10,marginBottom:16,fontSize:12,fontFamily:"monospace",color:B.g7,lineHeight:1.6,whiteSpace:"pre"}}>
{`{
  "INNSA:AEJEA:20GP": {
    "oceanFreight": 650, "thcOrigin": 130,
    "thcDest": 180, "blFee": 45,
    "surcharges": 25, "total": 1030,
    "validFrom": "2026-03-01",
    "validTo": "2026-03-31"
  }
}`}
</div>
<textarea style={{...st.inp,minHeight:200,fontFamily:"monospace",fontSize:12}} value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="Paste JSON..."/>
<button onClick={importBulk} style={{...st.bp,marginTop:16}}>Import Rates</button>
</div>)}
</div></div>);}

/* â•â•â• APP â•â•â• */
export default function App(){
const[rates,setRates]=useState({});
useEffect(()=>{lr().then(setRates);},[]);
const WA_FLOAT=`https://wa.me/919136121123?text=${encodeURIComponent("Hi, I'd like to enquire about freight forwarding services from Sattva Global Logistics.")}`;
return(
<HelmetProvider>
<BrowserRouter>
<ScrollToTop/>
<div style={{fontFamily:F,color:B.g7,background:B.w,minHeight:"100vh",overflowX:"hidden",width:"100%"}}>
<Routes>
<Route path="/*" element={<><Nav st={st}/><Routes>
<Route path="/" element={<HomePage st={st} I={I}/>}/>
<Route path="/about" element={<AboutPage st={st} I={I}/>}/>
<Route path="/services" element={<ServicesPage st={st} I={I}/>}/>
<Route path="/industries" element={<IndustriesPage st={st} I={I}/>}/>
<Route path="/knowledge" element={<KnowledgePage st={st} I={I}/>}/>
<Route path="/testimonials" element={<TestimonialsPage st={st} I={I}/>}/>
<Route path="/quote" element={<QuotePage rates={rates}/>}/>
</Routes><Footer I={I}/></>}/>
<Route path="/admin" element={<AdminPage rates={rates} setRates={setRates}/>}/>
</Routes>
{/* WhatsApp float â€” shown on all non-admin routes */}
<Routes><Route path="/*" element={
<a href={WA_FLOAT} target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp"
  style={{position:"fixed",bottom:28,right:28,zIndex:999,width:56,height:56,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(37,211,102,.5)",textDecoration:"none",transition:"transform .2s"}}
  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.12)"}
  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
  <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.564l4.682-1.463A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.156 0-4.154-.695-5.785-1.873l-.413-.281-2.776.868.854-2.703-.302-.436A9.713 9.713 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75S21.75 6.615 21.75 12s-4.365 9.75-9.75 9.75z"/></svg>
</a>}/></Routes>
</div>
</BrowserRouter>
</HelmetProvider>);}









