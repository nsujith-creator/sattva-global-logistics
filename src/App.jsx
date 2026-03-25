// FAIL-24: Route-level code splitting — pages loaded only when route is visited
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { ErrMsg } from "./components/forms/ErrMsg";
import RateGate from "./components/forms/RateGate";
import { PhoneField } from "./components/forms/PhoneField";
import { CTA } from "./components/layout/CTA";
import { Footer } from "./components/layout/Footer";
import { Nav } from "./components/layout/Nav";
import { ScrollToTop } from "./components/routing/ScrollToTop";
import { CarrierBadge } from "./components/shared/CarrierBadge";
import { I } from "./components/shared/icons";
import { useIsMobile } from "./hooks/useIsMobile";
import { lr, saveRateAPI, deleteRateAPI, logSearchAPI, submitQuoteAPI } from "./api/rates";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { IndustriesPage } from "./pages/IndustriesPage";
import { ServicesPage } from "./pages/ServicesPage";
const KnowledgePage   = lazy(()=>import("./pages/KnowledgePage").then(m=>({default:m.KnowledgePage})));
const TestimonialsPage = lazy(()=>import("./pages/TestimonialsPage").then(m=>({default:m.TestimonialsPage})));
import { CARRIERS } from "./data/carriers";
import { PACK_TYPES, OT_FR_EQ, EQ, EQ_L, CARGO } from "./data/equipment";
import { POL, POD_R, ALL_POD } from "./data/ports";
import { B, F, FF } from "./theme/tokens";
import { st } from "./styles/sharedStyles";
import { waLink } from "./utils/links";
import { pn } from "./utils/ports";
import { saveSession, loadSession, clearSession } from "./utils/session";
import { searchCargo } from "./utils/cargoSearch";
import { saveQuoteHistory, getQuoteHistory } from "./utils/quoteHistory";
import { saveFormState, loadFormState, clearFormState } from "./utils/formState";

const ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNha21pcGlxY2hsb3R1aGFodWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM1NzEsImV4cCI6MjA4OTk0OTU3MX0.VfucK_bIfQGdA30KWehZhjGN71QmsK1YgdZ71I06FW0";
const FN_URL=typeof import.meta!=="undefined"&&import.meta.env?.VITE_SUPABASE_FUNCTIONS_URL||"https://cakmipiqchlotuhahuds.supabase.co/functions/v1";

/* ─── Search-as-you-type port combobox with user history ─── */
function PortCombo({label,value,onChange,options,error,placeholder,history=[]}) {
  const[q,setQ]=useState("");
  const[open,setOpen]=useState(false);
  const[focused,setFocused]=useState(false);
  const ref=React.useRef(null);
  const selected=options.find(o=>o.c===value);
  const display=focused?q:(selected?`${selected.n} (${selected.c})`:"");
  let items=[];
  if(q.length===0&&history.length>0){
    const histItems=history.map(code=>options.find(o=>o.c===code)).filter(Boolean).map(o=>({...o,isHistory:true}));
    items=histItems;
  } else if(q.length>0){
    items=options.filter(o=>o.n.toLowerCase().includes(q.toLowerCase())||o.c.toLowerCase().includes(q.toLowerCase())).slice(0,12);
  }
  React.useEffect(()=>{
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setFocused(false);setQ("");}};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);
  const pick=(code)=>{onChange(code);setQ("");setOpen(false);setFocused(false);};
  const inp={width:"100%",padding:"11px 14px",border:`1.5px solid ${error?"#ef4444":"#d1d5db"}`,borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:"#fff"};
  return(
    <div ref={ref} style={{position:"relative"}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
      <input type="text" value={display}
        onChange={e=>{setQ(e.target.value);setOpen(true);if(!e.target.value)onChange("");}}
        onFocus={()=>{setFocused(true);setQ(selected?`${selected.n} (${selected.c})`:"");setOpen(true);}}
        placeholder={placeholder} style={inp} autoComplete="off"/>
      {error&&<div style={{fontSize:11,color:"#ef4444",marginTop:3}}>{error}</div>}
      {open&&items.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:999,background:"#fff",border:"1.5px solid #d1d5db",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:2}}>
          {items[0]?.isHistory&&<div style={{padding:"5px 14px",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #f3f4f6",background:"#f9fafb"}}>Recent Ports</div>}
          {items.map(o=>(
            <div key={o.c} onMouseDown={()=>pick(o.c)}
              style={{padding:"9px 14px",cursor:"pointer",fontSize:13,display:"flex",justifyContent:"space-between",borderBottom:"1px solid #f3f4f6",background:o.isHistory?"#f0f7ff":"#fff"}}
              onMouseEnter={e=>e.currentTarget.style.background="#e8f0ff"}
              onMouseLeave={e=>e.currentTarget.style.background=o.isHistory?"#f0f7ff":"#fff"}>
              <span>{o.n}{o.isHistory&&<span style={{marginLeft:6,fontSize:10,color:"#3b82f6"}}>★</span>}</span>
              <span style={{color:"#6b7280",fontSize:11,fontWeight:600}}>{o.c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Search-as-you-type cargo combobox ─── */
function CargoCombo({label,value,onChange,error,placeholder,history=[]}){
  const[q,setQ]=useState("");
  const[open,setOpen]=useState(false);
  const[focused,setFocused]=useState(false);
  const[results,setResults]=useState([]);
  const[loading,setLoading]=useState(false);
  const[chunkErr,setChunkErr]=useState(false);
  const ref=React.useRef(null);
  const display=focused?q:(value||"");
  React.useEffect(()=>{
    if(q.length<2){setResults([]);setLoading(false);return;}
    setLoading(true);
    import("./utils/cargoSearch").then(m=>{setResults(m.searchCargo(q,12));setLoading(false);setChunkErr(false);}).catch(()=>{setLoading(false);setChunkErr(true);});
  },[q]);
  const showHistory=focused&&q.length===0&&history.length>0;
  React.useEffect(()=>{
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setFocused(false);setQ("");}};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);
  const pick=(v)=>{onChange(v);setQ("");setOpen(false);setFocused(false);};
  const inp={width:"100%",padding:"11px 14px",border:`1.5px solid ${error?"#ef4444":"#d1d5db"}`,borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:"#fff"};
  const dropItems=showHistory?history.map(h=>({name:h,code:"",isHistory:true})):results;
  return(
    <div ref={ref} style={{position:"relative"}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
      <input type="text" value={display}
        onChange={e=>{setQ(e.target.value);onChange(e.target.value);setOpen(true);}}
        onFocus={()=>{setFocused(true);setQ(value||"");setOpen(true);}}
        placeholder={placeholder} style={inp} autoComplete="off"/>
      {error&&<div style={{fontSize:11,color:"#ef4444",marginTop:3}}>{error}</div>}
      {open&&(loading||chunkErr||dropItems.length>0)&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:999,background:"#fff",border:"1.5px solid #d1d5db",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:2}}>
          {loading&&<div style={{padding:"12px 14px",fontSize:13,color:"#6b7280",display:"flex",alignItems:"center",gap:8}}><span style={{display:"inline-block",width:12,height:12,border:"2px solid #d1d5db",borderTopColor:"#3b82f6",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>Searching cargo database…</div>}
          {chunkErr&&<div style={{padding:"12px 14px",fontSize:13,color:"#dc2626"}}>⚠ Search unavailable — type your cargo description manually</div>}
          {!loading&&showHistory&&<div style={{padding:"5px 14px",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #f3f4f6",background:"#f9fafb"}}>Recent Cargo</div>}
          {dropItems.map((o,i)=>(
            <div key={i} onMouseDown={()=>pick(o.name)}
              style={{padding:"9px 14px",cursor:"pointer",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #f3f4f6",background:o.isHistory?"#f0f7ff":"#fff"}}
              onMouseEnter={e=>e.currentTarget.style.background="#e8f0ff"}
              onMouseLeave={e=>e.currentTarget.style.background=o.isHistory?"#f0f7ff":"#fff"}>
              <span>{o.name}{o.isHistory&&<span style={{marginLeft:6,fontSize:10,color:"#3b82f6"}}>★</span>}</span>
              {o.code&&<span style={{color:"#6b7280",fontSize:10,fontWeight:600,marginLeft:8}}>HS {o.code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuotePage({rates,ratesErr,setRates,setRatesErr}){const go=useNavigate();
React.useEffect(()=>{lr().then(r=>{setRates(r);setRatesErr(false);}).catch(()=>setRatesErr(true));},[]);
const m=useIsMobile();
const BLANK_F={pol:"",podR:"",pod:"",cargo:"",eq:"",vol:"1",msg:"",dimL:"",dimW:"",dimH:"",packType:"",captchaAns:""};
const[f,setF]=useState(()=>loadFormState()||BLANK_F);
const[done,setDone]=useState(false);
const[errs,setErrs]=useState({});
const[sending,setSending]=useState(false);
const[sendErr,setSendErr]=useState("");
const[files,setFiles]=useState([]);
const[fileErr,setFileErr]=useState("");
const[captcha,setCaptcha]=useState(()=>{const a=Math.ceil(Math.random()*9),b=Math.ceil(Math.random()*9);return{a,b,ans:a+b};});
const sessionData=loadSession();
const[gateUser,setGateUser]=useState(()=>sessionData?.user||null);
const[sessionToken,setSessionToken]=useState(()=>sessionData?.token||null);
const[lastLoggedRk,setLastLoggedRk]=useState(null);
const[hist,setHist]=useState(()=>gateUser?getQuoteHistory(gateUser.email):{polHistory:[],podHistory:[],cargoHistory:[]});
const setVerifiedUser=(user,token)=>{saveSession(user,token);setGateUser(user);setSessionToken(token);setHist(getQuoteHistory(user.email));};
React.useEffect(()=>{
  const handler=(e)=>{if(e.key==="sattva-verified-user"){const u=loadSession();setGateUser(u);if(u)setHist(getQuoteHistory(u.email));}};
  window.addEventListener("storage",handler);return()=>window.removeEventListener("storage",handler);
},[]);
const up=(k,v)=>setF(p=>{const n={...p,[k]:v};saveFormState(n);return n;});
React.useEffect(()=>{
  if(gateUser?.email&&f.pol&&f.pod&&f.cargo){saveQuoteHistory(gateUser.email,f.pol,f.pod,f.cargo);setHist(getQuoteHistory(gateUser.email));}
},[f.pol,f.pod,f.cargo,gateUser?.email]);
const rk=f.pol&&f.pod&&f.eq?`${f.pol}:${f.pod}:${f.eq}`:null;
const rate=rk&&rates[rk]?rates[rk]:null;
const qty=Math.max(1,parseInt(f.vol)||1);
const isOTFR=OT_FR_EQ.includes(f.eq);
const MAX_MB=5;const MAX_FILES=3;
const refreshCaptcha=()=>{const a=Math.ceil(Math.random()*9),b=Math.ceil(Math.random()*9);setCaptcha({a,b,ans:a+b});up("captchaAns","");};
const handleFiles=(e)=>{const chosen=Array.from(e.target.files);if(chosen.filter(f=>f.size>MAX_MB*1024*1024).length){setFileErr(`Max file size is ${MAX_MB}MB.`);return;}if(chosen.length>MAX_FILES){setFileErr(`Max ${MAX_FILES} files.`);return;}setFileErr("");setFiles(chosen);};
useEffect(()=>{
  if(rk&&gateUser&&rk!==lastLoggedRk){
    setLastLoggedRk(rk);
    const polName=POL.find(p=>p.c===f.pol)?.n||f.pol;
    const podName=ALL_POD.find(p=>p.c===f.pod)?.n||f.pod;
    logSearchAPI({name:gateUser.name,email:gateUser.email,company:gateUser.company||"(not provided)",phone:gateUser.phone,pol:`${polName} (${f.pol})`,pod:`${podName} (${f.pod})`,eq:f.eq,found:rate?"1":"0",total:rate?rate.total:"—",note:"Route lookup"});
  }
},[rk,gateUser]);
const validate=()=>{
  const e={};
  if(!f.pol)e.pol="Required";if(!f.pod)e.pod="Required";if(!f.cargo)e.cargo="Required";if(!f.eq)e.eq="Required";
  if(isOTFR){if(!f.dimL.trim()||!f.dimW.trim()||!f.dimH.trim())e.dims="All dimensions required";if(!f.packType)e.packType="Required";}
  if(parseInt(f.captchaAns)!==captcha.ans)e.captcha="Incorrect answer";
  setErrs(e);return Object.keys(e).length===0;
};
const handleSubmit=async()=>{
  if(sending)return;
  if(!gateUser){setSendErr("Please select your route and verify your identity first.");return;}
  if(!validate())return;
  setSending(true);setSendErr("");
  const polName=POL.find(p=>p.c===f.pol)?.n||f.pol;
  const podName=ALL_POD.find(p=>p.c===f.pod)?.n||f.pod;
  logSearchAPI({name:gateUser.name,email:gateUser.email,company:gateUser.company||"(not provided)",phone:gateUser.phone,pol:`${polName} (${f.pol})`,pod:`${podName} (${f.pod})`,eq:f.eq,found:rate?"1":"0",total:rate?rate.total:"—",note:"Quote submitted"});
  saveQuoteHistory(gateUser.email,f.pol,f.pod,f.cargo);
  setHist(getQuoteHistory(gateUser.email));
  try{
    await submitQuoteAPI({pol:`${polName} (${f.pol})`,pod:`${podName} (${f.pod})`,equipment:`${EQ_L[f.eq]||f.eq} (${f.eq})`,containers:parseInt(f.vol)||1,cargo:f.cargo,notes:f.msg||"",rateFound:!!rate,rateTotal:rate?.total||null},sessionToken);
    clearFormState();setDone(true);
  }catch(err){
    console.error("submitQuote error:",err);
    setSendErr("Submission failed. Please use WhatsApp button below or email quotes@sattvaglobal.in directly.");
  }finally{setSending(false);}
};
const waMsg=`Hi, freight quote request.\nName: ${gateUser?.name||""}\nPhone: ${gateUser?.phone||""}\nPOL: ${f.pol} → POD: ${f.pod}\nCargo: ${f.cargo} | ${f.eq} x${f.vol}${isOTFR?`\nDims: L${f.dimL}xW${f.dimW}xH${f.dimH}m | Packing: ${f.packType}`:""}${f.msg?`\nNotes: ${f.msg}`:""}`;
const resetForm=()=>{setDone(false);setF(BLANK_F);clearFormState();setFiles([]);setErrs({});refreshCaptcha();};
if(done)return(<div style={{paddingTop:68,minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"68px 24px 40px"}}><div style={{textAlign:"center",maxWidth:480}}><div style={{width:72,height:72,borderRadius:"50%",background:B.gBg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B.green} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div><h2 style={{...st.h2,fontSize:26}}>Quote Request Received!</h2><p style={{...st.bd,marginTop:14}}>Our team will respond within 24 hours with a competitive quotation.</p><div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:28}}><button onClick={resetForm} style={st.bp}>Submit Another</button><button onClick={()=>go("/")} style={st.bs}>Back to Home</button></div></div></div>);
return(
<div style={{paddingTop:68}}><Helmet><title>Get a Freight Quote | Export FCL Rates from India | Sattva Global Logistics</title><meta name="description" content="Request a freight quote for FCL export from JNPT, Mundra, Chennai or Cochin to the Middle East, Red Sea, Africa, Europe or Americas. Instant rates for key trade lanes." /><link rel="canonical" href="https://www.sattvaglobal.in/quote" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Get a Quote</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Request a <span style={{color:B.primary}}>Freight Quote</span></h1>
<p style={{...st.bd,fontSize:17,marginTop:20,maxWidth:600}}>Fill in details — if rates are loaded for your route, you'll see instant pricing.</p>
</div></section>
<div style={st.sec}><div style={{display:"grid",gridTemplateColumns:m?"1fr":"5fr 3fr",gap:40}}>
<div style={{...st.cd,padding:m?20:36}}>
{ratesErr&&<div style={{marginBottom:20,padding:"10px 14px",borderRadius:8,background:"#fffbeb",border:"1px solid #f59e0b",fontSize:12,color:"#92400e"}}>⚠ Live rate data could not be loaded. You can still submit a quote request and we'll respond within 24 hours.</div>}
<h3 style={{...st.h3,marginBottom:28}}>Route & Cargo Details</h3>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(2,minmax(200px,1fr))",gap:18,marginBottom:18}}>
<PortCombo label="POL *" value={f.pol} onChange={v=>{up("pol",v);setErrs(p=>({...p,pol:""}));}} options={POL} error={errs.pol} placeholder="Search port of loading…" history={hist.polHistory}/>
<PortCombo label="POD *" value={f.pod} onChange={v=>{up("pod",v);setErrs(p=>({...p,pod:""}));}} options={ALL_POD} error={errs.pod} placeholder="Search port of discharge…" history={hist.podHistory}/>
</div>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(2,minmax(200px,1fr))",gap:18,marginBottom:18}}>
<CargoCombo label="Cargo Type *" value={f.cargo} onChange={v=>{up("cargo",v);setErrs(p=>({...p,cargo:""}));}} error={errs.cargo} placeholder="Search cargo type or HS code…" history={hist.cargoHistory}/>
<div><label style={st.lb}>Equipment *</label><select style={{...st.inp,borderColor:errs.eq?B.red:undefined}} value={f.eq} onChange={e=>{up("eq",e.target.value);setErrs(p=>({...p,eq:""}));up("dimL","");up("dimW","");up("dimH","");up("packType","");}}><option value="">Select</option>{EQ.map(e=><option key={e} value={e}>{EQ_L[e]} ({e})</option>)}</select><ErrMsg msg={errs.eq}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:18}}>
<div><label style={st.lb}>Containers</label><input type="number" style={st.inp} value={f.vol} onChange={e=>up("vol",e.target.value)} min="1"/></div>
</div>
{isOTFR&&(<div style={{marginTop:24,padding:20,borderRadius:12,background:`${B.primary}05`,border:`1.5px solid ${B.primary}22`}}>
<h4 style={{fontSize:14,fontWeight:700,color:B.primary,marginBottom:16}}>📐 Special Cargo Details — Required for {f.eq}</h4>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:16}}>
<div><label style={st.lb}>Length (m) *</label><input type="number" step="0.01" style={{...st.inp,borderColor:errs.dims?B.red:undefined}} value={f.dimL} onChange={e=>{up("dimL",e.target.value);setErrs(p=>({...p,dims:""}));}} placeholder="e.g. 4.5"/></div>
<div><label style={st.lb}>Width (m) *</label><input type="number" step="0.01" style={{...st.inp,borderColor:errs.dims?B.red:undefined}} value={f.dimW} onChange={e=>{up("dimW",e.target.value);setErrs(p=>({...p,dims:""}));}} placeholder="e.g. 2.1"/></div>
<div><label style={st.lb}>Height (m) *</label><input type="number" step="0.01" style={{...st.inp,borderColor:errs.dims?B.red:undefined}} value={f.dimH} onChange={e=>{up("dimH",e.target.value);setErrs(p=>({...p,dims:""}));}} placeholder="e.g. 2.4"/></div>
</div>
{errs.dims&&<div style={{fontSize:11,color:B.red,marginBottom:10}}>{errs.dims}</div>}
<div style={{marginBottom:16}}><label style={st.lb}>Packing Type *</label><select style={{...st.inp,borderColor:errs.packType?B.red:undefined}} value={f.packType} onChange={e=>{up("packType",e.target.value);setErrs(p=>({...p,packType:""}));}}><option value="">Select packing type</option>{PACK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select><ErrMsg msg={errs.packType}/></div>
<div><label style={st.lb}>Upload Images / Brochure / PDF <span style={{fontWeight:400,color:B.g5}}>(optional — max {MAX_FILES} files, {MAX_MB}MB each, JPG/PNG/PDF only)</span></label><input type="file" accept=".jpg,.jpeg,.png,.pdf" multiple onChange={handleFiles} style={{display:"block",marginTop:6,fontSize:13,fontFamily:F,color:B.g7}}/>{fileErr&&<div style={{fontSize:11,color:B.red,marginTop:4}}>{fileErr}</div>}{files.length>0&&<div style={{fontSize:12,color:B.amber,marginTop:6}}>⚠ {files.length} file(s) selected. Please send them separately to <a href="mailto:quotes@sattvaglobal.in">quotes@sattvaglobal.in</a> quoting your submission.</div>}</div>
</div>)}
{rk&&!gateUser&&(
<div style={{padding:24,borderRadius:14,background:`linear-gradient(135deg,${B.primary}08,${B.accent}10)`,border:`1.5px solid ${B.primary}22`,marginTop:20}}>
  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    <h4 style={{fontSize:15,fontWeight:700,color:B.dark,margin:0}}>Verify Your Identity to View Rates</h4>
  </div>
  <p style={{fontSize:12,color:B.g5,marginBottom:18,lineHeight:1.6}}>Enter your <strong>company email</strong> to receive a one-time access code. Personal email addresses (Gmail, Yahoo, etc.) are not accepted.</p>
  <RateGate onUnlock={setVerifiedUser} isMobile={m} st={st}/>
  <p style={{fontSize:11,color:B.g5,marginTop:12}}>🔒 Your details are kept confidential and used only for rate access purposes.</p>
</div>
)}
{gateUser&&<div style={{marginTop:16,padding:"10px 16px",borderRadius:8,background:B.gBg,border:`1px solid ${B.green}33`,display:"flex",alignItems:"center",gap:8,fontSize:13}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={B.green} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg><span style={{color:B.green,fontWeight:600}}>Verified:</span><span style={{color:B.g7}}>{gateUser.name} {gateUser.company?`· ${gateUser.company}`:""}</span><button onClick={()=>{clearSession();setGateUser(null);}} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:11,color:B.g5}}>Change</button></div>}
{rk&&gateUser&&(<div style={{marginTop:24,padding:20,borderRadius:12,background:rate?B.gBg:B.aBg,border:`1px solid ${rate?B.green:B.amber}22`}}>
{rate?(<><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}><div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><h4 style={{fontSize:15,fontWeight:700,color:B.green,margin:0}}>✓ Instant Rate Available</h4>{rate.carrier&&<CarrierBadge name={rate.carrier}/>}</div><span style={{fontSize:12,color:B.g5}}>Valid: {rate.validFrom||"—"} to {rate.validTo||"—"}</span></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>{[["Ocean Freight",rate.oceanFreight],["THC Origin",rate.thcOrigin],["THC Dest",rate.thcDest],["BL Fee",rate.blFee],["Surcharges",rate.surcharges||0],...(rate.extraItems||[]).map(x=>[x.label,parseFloat(x.value)||0])].map(([lb,v])=><div key={lb} style={{background:"#fff",padding:8,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:B.g5}}>{lb}</div><div style={{fontSize:15,fontWeight:700,color:B.dark}}>${v}</div></div>)}<div style={{background:B.primary,padding:8,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:"#fff",opacity:.8}}>Per Container</div><div style={{fontSize:15,fontWeight:700,color:"#fff"}}>${rate.total}</div></div></div>
{qty>1&&<div style={{background:"#fff",padding:10,borderRadius:8,textAlign:"center",marginBottom:8}}><span style={{fontSize:13,color:B.g5}}>Total {qty} ctrs: </span><span style={{fontSize:18,fontWeight:800,color:B.primary}}>${(rate.total*qty).toLocaleString()} USD</span></div>}
<p style={{fontSize:11,color:B.g5,marginTop:4,fontStyle:"italic"}}>* Indicative. Final quote subject to space & surcharges at booking.</p></>
):(<div><h4 style={{fontSize:14,fontWeight:600,color:B.amber,margin:0,marginBottom:6}}>Rate not pre-loaded for this route</h4><p style={{fontSize:13,color:B.g5,margin:0}}>Submit your request — custom quote within 24 hours.</p></div>)}</div>)}
<div style={{marginTop:20}}><label style={st.lb}>Additional Notes</label><textarea style={{...st.inp,minHeight:80,resize:"vertical"}} value={f.msg} onChange={e=>up("msg",e.target.value)} placeholder="Special requirements…"/></div>
<div style={{marginTop:20,padding:16,borderRadius:10,background:B.g1,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
<label style={{...st.lb,margin:0}}>Verification *</label>
<span style={{fontSize:15,fontWeight:700,color:B.dark}}>{captcha.a} + {captcha.b} = ?</span>
<input type="number" style={{...st.inp,width:80,borderColor:errs.captcha?B.red:undefined}} value={f.captchaAns} onChange={e=>{up("captchaAns",e.target.value);setErrs(p=>({...p,captcha:""}));}} placeholder="Answer"/>
<button onClick={refreshCaptcha} title="New question" style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:B.g5,padding:"2px 6px"}}>↻</button>
{errs.captcha&&<span style={{fontSize:11,color:B.red}}>{errs.captcha}</span>}
</div>
{sendErr&&<div style={{marginTop:16,padding:"12px 16px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",color:B.red,fontSize:13}}>{sendErr}</div>}
<div style={{display:"flex",gap:12,marginTop:24,flexWrap:"wrap"}}>
<button onClick={handleSubmit} disabled={sending} style={{...st.bp,flex:1,justifyContent:"center",opacity:sending?.7:1}}>{sending?"Sending…":"Submit Quote Request"} {!sending&&<I.Ar/>}</button>
<a href={waLink(waMsg)} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"13px 20px",background:"#25D366",color:"#fff",borderRadius:8,fontWeight:600,fontSize:14,textDecoration:"none",whiteSpace:"nowrap"}}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.564l4.682-1.463A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.156 0-4.154-.695-5.785-1.873l-.413-.281-2.776.868.854-2.703-.302-.436A9.713 9.713 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75S21.75 6.615 21.75 12s-4.365 9.75-9.75 9.75z"/></svg>WhatsApp</a>
</div>
</div>
<div>
<div style={{...st.cd,marginBottom:20,borderTop:`3px solid ${B.primary}`}}><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:14}}>Speak to an Expert</h4><p style={{...st.bd,fontSize:13,marginBottom:14}}>Prefer to talk?</p><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13,color:B.g7}}><I.Ph/> +91 9136 121 123</div><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.g7}}><I.Ma/> quotes@sattvaglobal.in</div></div>
<div style={st.cd}><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:14}}>Why Get a Quote?</h4>{["Multi-carrier rates","Transparent breakdown","24hr response","No hidden charges","Expert routing advice"].map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}><div style={{flexShrink:0,marginTop:2}}><I.Ck/></div><span style={{fontSize:13,color:B.g7}}>{t}</span></div>)}</div>
</div>
</div></div></div>);}

/* Admin panel */
function AdminPage({rates,setRates}){const go=useNavigate();
const[authed,setAuthed]=useState(false);
const[adminToken,setAdminToken]=useState(null);
const[email,setEmail]=useState("");
const[pass,setPass]=useState("");
const[loginErr,setLoginErr]=useState("");
const[tab,setTab]=useState("rates");
const[editKey,setEditKey]=useState(null);
const[fm,setFm]=useState({pol:"",pod:"",podR:"",eq:"",of:"",to:"",td:"",bl:"",su:"",vf:"",vt:"",cr:""});
const[extraItems,setExtraItems]=useState([]);
const[bulk,setBulk]=useState("");
const[msg,setMsg]=useState("");
const[search,setSearch]=useState("");
const doLogin=async()=>{
  setLoginErr("");
  try{
    const res=await fetch(`${FN_URL}/admin-login`,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${ANON_KEY}`},
      body:JSON.stringify({email,password:pass})
    });
    const d=await res.json();
    if(!res.ok||!d.token){setLoginErr(d.error||"Invalid email or password.");return;}
    setAdminToken(d.token);setAuthed(true);
  }catch(e){setLoginErr("Login failed. Please try again.");}
};
const doLogout=async()=>{setAuthed(false);setAdminToken(null);};
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
  setMsg("Saving…");
  const ok=await saveRateAPI(key,entry,adminToken);
  if(ok){const updated={...rates,[key]:entry};setRates(updated);setMsg(`✓ Saved: ${key} — $${entry.total}/ctr`);setFm({pol:"",pod:"",podR:"",eq:"",of:"",to:"",td:"",bl:"",su:"",vf:"",vt:"",cr:""});setExtraItems([]);setEditKey(null);setTab("rates");}
  else setMsg("⚠ Save failed.");
};
const del=async(key)=>{setMsg("Deleting…");await deleteRateAPI(key,adminToken);const u={...rates};delete u[key];setRates(u);setMsg(`✓ Deleted: ${key}`);};
const edit=(key)=>{const r=rates[key];const[pol,pod,eq]=key.split(":");let podR="";for(const[rg,ps]of Object.entries(POD_R)){if(ps.find(p=>p.c===pod)){podR=rg;break;}}setFm({pol,pod,podR,eq,of:String(r.oceanFreight),to:String(r.thcOrigin),td:String(r.thcDest),bl:String(r.blFee),su:String(r.surcharges||0),vf:r.validFrom||"",vt:r.validTo||"",cr:r.carrier||""});setExtraItems(r.extraItems||[]);setEditKey(key);setTab("add");};
const importBulk=async()=>{try{const p=JSON.parse(bulk);setMsg(`Saving ${Object.keys(p).length} rates…`);let count=0;for(const[key,entry]of Object.entries(p)){const ok=await saveRateAPI(key,entry,adminToken);if(ok)count++;}const m={...rates,...p};setRates(m);setMsg(`✓ Imported ${count}/${Object.keys(p).length} rates.`);setBulk("");}catch{setMsg("Invalid JSON.");}};
const exportRates=()=>{const b=new Blob([JSON.stringify(rates,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="sattva-rates.json";a.click();URL.revokeObjectURL(u);};
const entries=Object.entries(rates).filter(([k])=>!search||k.toLowerCase().includes(search.toLowerCase()));
if(!authed)return(
<div style={{paddingTop:68,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:B.g1}}>
<div style={{...st.cd,maxWidth:400,width:"100%",textAlign:"center",padding:40}}>
<I.Lk/><h2 style={{fontSize:22,fontWeight:700,color:B.dark,marginTop:16,marginBottom:8,fontFamily:FF}}>Admin Panel</h2>
<p style={{...st.bd,fontSize:14,marginBottom:20}}>Sign in to manage rates.</p>
<input type="email" style={{...st.inp,marginBottom:12}} value={email} onChange={e=>setEmail(e.target.value)} placeholder="sujith@sattvaglobal.in" autoComplete="email"/>
<input type="password" style={{...st.inp,marginBottom:12}} value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
{loginErr&&<p style={{color:B.red,fontSize:13,marginBottom:8}}>{loginErr}</p>}
<button onClick={doLogin} style={{...st.bp,width:"100%",justifyContent:"center"}}>Sign In</button>
<button onClick={()=>go("/")} style={{...st.bs,marginTop:12,width:"100%",justifyContent:"center",fontSize:13}}>← Website</button>
</div></div>);
return(
<div style={{paddingTop:68,minHeight:"100vh",background:B.g1}}>
<div style={{maxWidth:1200,margin:"0 auto",padding:"32px 24px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
<div><h1 style={{fontSize:26,fontWeight:700,color:B.dark,fontFamily:FF,margin:0}}>Rate Management</h1><p style={{fontSize:13,color:B.g5,marginTop:4}}>{Object.keys(rates).length} rates · Auto-saved</p></div>
<div style={{display:"flex",gap:10}}>
<button onClick={exportRates} style={{...st.bs,padding:"8px 16px",fontSize:12}}><I.Dw/> Export</button>
<button onClick={doLogout} style={{...st.bs,padding:"8px 16px",fontSize:12}}>Sign Out</button>
<button onClick={()=>go("/")} style={{...st.bs,padding:"8px 16px",fontSize:12}}>← Site</button>
</div></div>
{msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.startsWith("✓")?B.gBg:B.aBg,color:msg.startsWith("✓")?B.green:B.amber,fontSize:13,marginBottom:16,fontWeight:500}}>{msg}</div>}
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
<td style={{padding:"10px 12px"}}>{r.carrier?<CarrierBadge name={r.carrier} size="sm"/>:<span style={{color:B.g5,fontSize:11}}>—</span>}</td>
<td style={{padding:"10px 12px"}}>${r.oceanFreight}</td>
<td style={{padding:"10px 12px"}}>${r.thcOrigin}</td>
<td style={{padding:"10px 12px"}}>${r.thcDest}</td>
<td style={{padding:"10px 12px"}}>${r.blFee}</td>
<td style={{padding:"10px 12px"}}>${r.surcharges||0}</td>
<td style={{padding:"10px 12px",fontWeight:700,color:B.primary}}>${r.total}</td>
<td style={{padding:"10px 12px",fontSize:11,color:B.g5,whiteSpace:"nowrap"}}>{r.validFrom||"—"}<br/>{r.validTo||"—"}</td>
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
<button onClick={()=>removeExtraItem(i)} style={{background:"none",border:`1px solid ${B.red}44`,borderRadius:6,cursor:"pointer",color:B.red,fontSize:16,height:42,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
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

/* App */
export default function App(){
const[rates,setRates]=useState({});
const[ratesErr,setRatesErr]=useState(false);
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
<Route path="/knowledge" element={<Suspense fallback={<div style={{paddingTop:100,textAlign:"center",color:B.g5}}>Loading…</div>}><KnowledgePage st={st} I={I}/></Suspense>}/>
<Route path="/testimonials" element={<Suspense fallback={<div style={{paddingTop:100,textAlign:"center",color:B.g5}}>Loading…</div>}><TestimonialsPage st={st} I={I}/></Suspense>}/>
<Route path="/quote" element={<QuotePage rates={rates} ratesErr={ratesErr} setRates={setRates} setRatesErr={setRatesErr}/>}/>
<Route path="*" element={<div style={{paddingTop:100,minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><h2 style={{...st.h2,color:B.dark}}>404 — Page Not Found</h2><p style={{...st.bd,color:B.g5}}>The page you're looking for doesn't exist.</p></div>}/>
</Routes><Footer I={I}/></>}/>
<Route path="/admin" element={<AdminPage rates={rates} setRates={setRates}/>}/>
</Routes>
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
