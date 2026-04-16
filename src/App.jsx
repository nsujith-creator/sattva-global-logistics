// FAIL-24: Route-level code splitting
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";

class ChunkErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:false};}
  static getDerivedStateFromError(){return{err:true};}
  render(){
    if(this.state.err)return(
      <div style={{paddingTop:120,minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,textAlign:"center",padding:"120px 24px 40px"}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#1e293b"}}>Page failed to load</h2>
        <p style={{fontSize:14,color:"#64748b"}}>This can happen due to a network issue or a recent update. Please try refreshing.</p>
        <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",background:"#024aab",color:"#fff",border:"none",borderRadius:8,fontWeight:600,fontSize:14,cursor:"pointer"}}>Refresh Page</button>
      </div>
    );
    return this.props.children;
  }
}
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { PhoneField } from "./components/forms/PhoneField";
import { ErrMsg } from "./components/forms/ErrMsg";
import { CTA } from "./components/layout/CTA";
import { Footer } from "./components/layout/Footer";
import { Nav } from "./components/layout/Nav";
import { AdvisoryBanner } from "./components/layout/AdvisoryBanner";
import { ScrollToTop } from "./components/routing/ScrollToTop";
import { CarrierBadge } from "./components/shared/CarrierBadge";
import { I } from "./components/shared/icons";
import { useIsMobile } from "./hooks/useIsMobile";
import { getQuotes, saveQuoteAPI, deleteQuoteAPI, logSearchAPI, submitQuoteAPI } from "./api/rates";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { IndustriesPage } from "./pages/IndustriesPage";
import { ServicesPage } from "./pages/ServicesPage";
import { TradeLanesPage } from "./pages/TradeLanesPage";
import { TradeAdvisoryPage } from "./pages/TradeAdvisoryPage";
import { WhySattvaPage } from "./pages/WhySattvaPage";
import { LinkedInPage } from "./pages/LinkedInPage";
const KnowledgePage   = lazy(()=>import("./pages/KnowledgePage").then(m=>({default:m.KnowledgePage})));
const TestimonialsPage = lazy(()=>import("./pages/TestimonialsPage").then(m=>({default:m.TestimonialsPage})));
import { CARRIERS } from "./data/carriers";
import { PACK_TYPES, OT_FR_EQ, EQ, EQ_L, CARGO } from "./data/equipment";
import { POL, POD_R, ALL_POD } from "./data/ports";
import { B, F, FF } from "./theme/tokens";
import { supabase } from "./config/supabase";
import { st } from "./styles/sharedStyles";
import { waLink } from "./utils/links";
import { pn } from "./utils/ports";
import { saveSession, loadSession, clearSession } from "./utils/session";
import { searchCargo } from "./utils/cargoSearch";
import { saveQuoteHistory, getQuoteHistory } from "./utils/quoteHistory";
import { saveFormState, loadFormState, clearFormState } from "./utils/formState";

const BASIS_OPTIONS = ["Per 20'","Per 40'","Per 40HC","Per 45'","Per Cntr","Per BL","Per Shipment","Per KG","Per CBM"];
const CURRENCY_OPTIONS = ["USD","INR","ZAR","EUR","GBP","AED","SAR","SGD"];
const CATEGORY_OPTIONS = ["Ocean Freight","Surcharge","Terminal","Documentation","Equipment","Inland Haulage","Handling","Misc"];
const EQ_BASIS = {"20GP":"Per 20'","40GP":"Per 40'","40HC":"Per 40HC","45HC":"Per 45'"};
const GENERIC_BASES = new Set(["Per Cntr","Per BL","Per Shipment","Per KG","Per CBM"]);

function newOption(){return{carrier:"",vessel:"",etd:"",transitDays:"",routing:"",lineItems:[]};}
function newLineItem(){return{description:"",basis:"Per 20'",amount:"",currency:"USD",payment:"PREPAID",category:"Ocean Freight"};}

/* ─── Port combobox ─── */
function PortCombo({label,value,onChange,options,error,placeholder,history=[]}){
  const[q,setQ]=useState("");const[open,setOpen]=useState(false);const[focused,setFocused]=useState(false);
  const ref=React.useRef(null);const selected=options.find(o=>o.c===value);
  const display=focused?q:(selected?`${selected.n} (${selected.c})`:"");
  let items=[];
  if(q.length===0&&history.length>0){items=history.map(code=>options.find(o=>o.c===code)).filter(Boolean).map(o=>({...o,isHistory:true}));}
  else if(q.length>0){items=options.filter(o=>o.n.toLowerCase().includes(q.toLowerCase())||o.c.toLowerCase().includes(q.toLowerCase())).slice(0,12);}
  React.useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setFocused(false);setQ("");}};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const pick=(code)=>{onChange(code);setQ("");setOpen(false);setFocused(false);};
  const inp={width:"100%",padding:"11px 14px",border:`1.5px solid ${error?"#ef4444":"#d1d5db"}`,borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:"#fff"};
  return(<div ref={ref} style={{position:"relative"}}>
    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
    <input type="text" value={display} onChange={e=>{setQ(e.target.value);setOpen(true);if(!e.target.value)onChange("");}} onFocus={()=>{setFocused(true);setQ(selected?`${selected.n} (${selected.c})`:"");setOpen(true);}} placeholder={placeholder} style={inp} autoComplete="off"/>
    {error&&<div style={{fontSize:11,color:"#ef4444",marginTop:3}}>{error}</div>}
    {open&&items.length>0&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:999,background:"#fff",border:"1.5px solid #d1d5db",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:2}}>
      {items[0]?.isHistory&&<div style={{padding:"5px 14px",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #f3f4f6",background:"#f9fafb"}}>Recent Ports</div>}
      {items.map(o=>(<div key={o.c} onMouseDown={()=>pick(o.c)} style={{padding:"9px 14px",cursor:"pointer",fontSize:13,display:"flex",justifyContent:"space-between",borderBottom:"1px solid #f3f4f6",background:o.isHistory?"#f0f7ff":"#fff"}} onMouseEnter={e=>e.currentTarget.style.background="#e8f0ff"} onMouseLeave={e=>e.currentTarget.style.background=o.isHistory?"#f0f7ff":"#fff"}><span>{o.n}{o.isHistory&&<span style={{marginLeft:6,fontSize:10,color:"#3b82f6"}}>★</span>}</span><span style={{color:"#6b7280",fontSize:11,fontWeight:600}}>{o.c}</span></div>))}
    </div>)}
  </div>);
}

/* ─── Cargo combobox ─── */
function CargoCombo({label,value,onChange,error,placeholder,history=[]}){
  const[q,setQ]=useState("");const[open,setOpen]=useState(false);const[focused,setFocused]=useState(false);
  const[results,setResults]=useState([]);const[loading,setLoading]=useState(false);const[chunkErr,setChunkErr]=useState(false);
  const ref=React.useRef(null);const display=focused?q:(value||"");
  React.useEffect(()=>{if(q.length<2){setResults([]);setLoading(false);return;}setLoading(true);import("./utils/cargoSearch").then(m=>{setResults(m.searchCargo(q,12));setLoading(false);setChunkErr(false);}).catch(()=>{setLoading(false);setChunkErr(true);});},[q]);
  const showHistory=focused&&q.length===0&&history.length>0;
  React.useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setFocused(false);setQ("");}};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const pick=(v)=>{onChange(v);setQ("");setOpen(false);setFocused(false);};
  const inp={width:"100%",padding:"11px 14px",border:`1.5px solid ${error?"#ef4444":"#d1d5db"}`,borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:"#fff"};
  const dropItems=showHistory?history.map(h=>({name:h,code:"",isHistory:true})):results;
  return(<div ref={ref} style={{position:"relative"}}>
    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
    <input type="text" value={display} onChange={e=>{setQ(e.target.value);onChange(e.target.value);setOpen(true);}} onFocus={()=>{setFocused(true);setQ(value||"");setOpen(true);}} placeholder={placeholder} style={inp} autoComplete="off"/>
    {error&&<div style={{fontSize:11,color:"#ef4444",marginTop:3}}>{error}</div>}
    {open&&(loading||chunkErr||dropItems.length>0)&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:999,background:"#fff",border:"1.5px solid #d1d5db",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:2}}>
      {loading&&<div style={{padding:"12px 14px",fontSize:13,color:"#6b7280",display:"flex",alignItems:"center",gap:8}}><span style={{display:"inline-block",width:12,height:12,border:"2px solid #d1d5db",borderTopColor:"#3b82f6",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>Searching…</div>}
      {chunkErr&&<div style={{padding:"12px 14px",fontSize:13,color:"#dc2626"}}>⚠ Search unavailable — type cargo description manually</div>}
      {!loading&&showHistory&&<div style={{padding:"5px 14px",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #f3f4f6",background:"#f9fafb"}}>Recent Cargo</div>}
      {dropItems.map((o,i)=>(<div key={i} onMouseDown={()=>pick(o.name)} style={{padding:"9px 14px",cursor:"pointer",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #f3f4f6",background:o.isHistory?"#f0f7ff":"#fff"}} onMouseEnter={e=>e.currentTarget.style.background="#e8f0ff"} onMouseLeave={e=>e.currentTarget.style.background=o.isHistory?"#f0f7ff":"#fff"}><span>{o.name}{o.isHistory&&<span style={{marginLeft:6,fontSize:10,color:"#3b82f6"}}>★</span>}</span>{o.code&&<span style={{color:"#6b7280",fontSize:10,fontWeight:600,marginLeft:8}}>HS {o.code}</span>}</div>))}
    </div>)}
  </div>);
}

/* ─── Quote display — with Choose This Option CTA per carrier per equipment ─── */
function QuoteDisplay({quote,selectedEq,gateUser,pol,pod,cargo,vol}){
  const[activeOption,setActiveOption]=useState(0);
  const options=quote?.options||[];

  if(!options.length)return(
    <div style={{padding:20,borderRadius:12,background:B.aBg,border:`1px solid ${B.amber}22`,marginTop:12}}>
      <h4 style={{fontSize:14,fontWeight:600,color:B.amber,margin:0,marginBottom:6}}>No rates pre-loaded for {EQ_L[selectedEq]||selectedEq}</h4>
      <p style={{fontSize:13,color:B.g5,margin:0}}>Submit your request below — custom quote within 24 hours.</p>
    </div>
  );

  const opt=options[activeOption]||options[0];
  const eqBasis=EQ_BASIS[selectedEq]; // e.g. "Per 40HC" for 40HC

  // All equipment-specific basis values — used to detect cross-equipment lines
  const ALL_EQ_BASES=new Set(Object.values(EQ_BASIS)); // {"Per 20'","Per 40'","Per 40HC","Per 45'"}

  const filtered=(opt.lineItems||[]).filter(li=>{
    // 1. If line has an equipment-specific basis, only show it if it matches the selected equipment
    if(ALL_EQ_BASES.has(li.basis)) return li.basis===eqBasis;
    // 2. If line uses a generic basis (Per Cntr, Per BL etc.), check the description doesn't
    //    name a *different* equipment type. E.g. "Ocean Freight 20GP" with "Per Cntr" should
    //    NOT show when user selected 40HC.
    if(GENERIC_BASES.has(li.basis)){
      const desc=(li.description||"").toUpperCase();
      // If description contains any equipment code that is NOT the selected one, skip it
      const otherEqCodes=["20GP","40GP","40HC","45HC"].filter(c=>c!==selectedEq);
      if(otherEqCodes.some(c=>desc.includes(c))) return false;
      return true;
    }
    // 3. Any other basis (Per KG, Per CBM etc.) — always show
    return true;
  });

  // Deduplicate lines with identical description+basis+payment, keeping first occurrence
  const seen=new Set();
  const deduped=filtered.filter(li=>{
    const key=`${(li.description||"").trim().toUpperCase()}|${li.basis}|${li.payment}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });

  // Collapse Seal Charge + THC/BL/Locals lines into a single "Origin Charges" line
  const ORIGIN_CHARGE_KEYWORDS=["THC","SEAL","BL FEE","LOCAL","LOCALS","TERMINAL HANDLING","DOCUMENTATION"];
  const isOriginCharge=(li)=>ORIGIN_CHARGE_KEYWORDS.some(k=>(li.description||"").toUpperCase().includes(k));
  const originLines=deduped.filter(li=>isOriginCharge(li)&&li.payment==="PREPAID");
  const otherLines=deduped.filter(li=>!(isOriginCharge(li)&&li.payment==="PREPAID"));
  const collapsedOrigin=originLines.length>0?[{
    description:"Origin Charges (THC + BL Fee + Seal)",
    basis:"Per Cntr",
    amount:"Per Tariff",
    currency:"",
    payment:"PREPAID",
  }]:[];
  const displayLines=[...otherLines,...collapsedOrigin];

  const prepaid=displayLines.filter(li=>li.payment==="PREPAID");
  const collect=displayLines.filter(li=>li.payment==="COLLECT");
  const fmtAmt=(li)=>{
    const a=li.amount;
    if(a==null||a===""||a==="Per Tariff")return"Per Tariff";
    const n=Number(a);
    if(isNaN(n))return String(a);
    return`${n.toLocaleString()}${li.currency?" "+li.currency:""}`;
  };
  const tdS={padding:"9px 12px",fontSize:13,borderBottom:`1px solid ${B.g1}`,color:B.dark};
  const thS={padding:"8px 12px",fontSize:11,fontWeight:700,color:B.g5,textTransform:"uppercase",letterSpacing:.5,background:B.g1,textAlign:"left"};

  // Build charge list string for messages
  const chargeList=(o)=>{
    const eqB=EQ_BASIS[selectedEq];
    const allEqBases=new Set(Object.values(EQ_BASIS));
    const ORIGIN_KW=["THC","SEAL","BL FEE","LOCAL","LOCALS","TERMINAL HANDLING","DOCUMENTATION"];
    const isOC=(li)=>ORIGIN_KW.some(k=>(li.description||"").toUpperCase().includes(k));

    // Apply same equipment filter as display
    const filtered=(o.lineItems||[]).filter(li=>{
      if(allEqBases.has(li.basis)) return li.basis===eqB;
      if(GENERIC_BASES.has(li.basis)){
        const desc=(li.description||"").toUpperCase();
        const otherEqCodes=["20GP","40GP","40HC","45HC"].filter(c=>c!==selectedEq);
        if(otherEqCodes.some(c=>desc.includes(c))) return false;
        return true;
      }
      return true;
    });

    // Deduplicate
    const seen=new Set();
    const deduped=filtered.filter(li=>{
      const key=`${(li.description||"").trim().toUpperCase()}|${li.basis}|${li.payment}`;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });

    // Collapse origin charges into one line
    const hasOrigin=deduped.some(li=>isOC(li)&&li.payment==="PREPAID");
    const lines=deduped.filter(li=>!(isOC(li)&&li.payment==="PREPAID"));
    if(hasOrigin) lines.push({description:"Origin Charges (THC + BL Fee + Seal)",basis:"Per Cntr",amount:"Per Tariff",currency:"",payment:"PREPAID"});

    return lines
      .map(li=>`  • ${li.description} (${li.basis}): ${fmtAmt(li)} [${li.payment}]`)
      .join("\n");
  };

  const buildWA=(o)=>{
    const msg=[
      `Hi Sujith, I'd like to proceed with this rate from sattvaglobal.in:`,``,
      `👤 ${gateUser?.name||""}${gateUser?.company?` | ${gateUser.company}`:""}`,
      `📞 ${gateUser?.phone||""}  📧 ${gateUser?.email||""}`,``,
      `🚢 Route: ${pol||""} → ${pod||""}`,
      `📦 Equipment: ${EQ_L[selectedEq]||selectedEq}${vol&&Number(vol)>1?` × ${vol} containers`:""}`,
      `${cargo?`🎁 Cargo: ${cargo}`:""}`,``,
      `✅ Chosen Option:`,
      `Carrier: ${o.carrier||""}${o.vessel?` | Vessel: ${o.vessel}`:""}`,
      `${o.etd?`ETD: ${o.etd}`:""}${o.transitDays?` | Transit: ${o.transitDays}`:""}`,
      `${o.routing?`Routing: ${o.routing}`:""}`,``,
      `Charges:`,chargeList(o),``,
      `Please confirm availability and advise next steps. Thank you.`,
    ].filter(l=>l!==undefined).join("\n");
    return `https://wa.me/919136121123?text=${encodeURIComponent(msg)}`;
  };

  const buildEmail=(o)=>{
    const subject=`Rate Selection: ${pol}→${pod} | ${EQ_L[selectedEq]||selectedEq} | ${o.carrier||""}`;
    const body=[
      `Hi Sujith,`,``,
      `I'd like to proceed with the following rate from the Sattva Global Logistics portal.`,``,
      `My Details:`,
      `Name: ${gateUser?.name||""}`,
      `Company: ${gateUser?.company||""}`,
      `Phone: ${gateUser?.phone||""}`,``,
      `Shipment:`,
      `Route: ${pol||""} → ${pod||""}`,
      `Equipment: ${EQ_L[selectedEq]||selectedEq}${vol&&Number(vol)>1?` × ${vol} containers`:""}`,
      `${cargo?`Cargo: ${cargo}`:""}`,``,
      `Chosen Carrier Option:`,
      `Carrier: ${o.carrier||""}${o.vessel?` | Vessel: ${o.vessel}`:""}`,
      `${o.etd?`ETD: ${o.etd}`:""}${o.transitDays?` | Transit: ${o.transitDays}`:""}`,
      `${o.routing?`Routing: ${o.routing}`:""}`,``,
      `Rate Breakdown:`,chargeList(o),``,
      `Please confirm space availability and let me know next steps.`,``,`Thank you.`,
    ].join("\n");
    return `mailto:quotes@sattvaglobal.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const switchOption=(i)=>{setActiveOption(i);};

  return(
    <div style={{marginTop:12,borderRadius:12,border:`1px solid ${B.primary}22`,overflow:"hidden",maxWidth:"100%"}}>
      <div style={{background:B.primary,padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{color:"#fff",fontWeight:700,fontSize:14}}>✓ Indicative Rates — {EQ_L[selectedEq]||selectedEq}</div>
        {quote.validUntil&&<div style={{color:"#fff",opacity:.8,fontSize:12}}>Valid until: {quote.validUntil}</div>}
      </div>
      {options.length>1&&(
        <div style={{display:"flex",borderBottom:`1px solid ${B.g3}44`,background:"#fafbff"}}>
          {options.map((o,i)=>(<button key={i} onClick={()=>switchOption(i)} style={{padding:"10px 18px",border:"none",background:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:F,color:i===activeOption?B.primary:B.g5,borderBottom:i===activeOption?`2px solid ${B.primary}`:"2px solid transparent",marginBottom:-1}}>{o.carrier||`Option ${i+1}`}</button>))}
        </div>
      )}
      <div style={{padding:"12px 18px",background:"#f8f9ff",borderBottom:`1px solid ${B.g3}22`,display:"flex",gap:24,flexWrap:"wrap"}}>
        {opt.carrier&&<span style={{fontSize:13,color:B.g7}}><strong style={{color:B.dark}}>Carrier:</strong> {opt.carrier}</span>}
        {opt.vessel&&<span style={{fontSize:13,color:B.g7}}><strong style={{color:B.dark}}>Vessel:</strong> {opt.vessel}</span>}
        {opt.etd&&<span style={{fontSize:13,color:B.g7}}><strong style={{color:B.dark}}>ETD:</strong> {opt.etd}</span>}
        {opt.transitDays&&<span style={{fontSize:13,color:B.g7}}><strong style={{color:B.dark}}>Transit:</strong> {opt.transitDays}</span>}
        {opt.routing&&<span style={{fontSize:13,color:B.g7}}><strong style={{color:B.dark}}>Routing:</strong> {opt.routing}</span>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{["Charge Description","Basis","Amount","Payment"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {prepaid.length>0&&<tr><td colSpan={4} style={{...tdS,background:"#f0fdf4",color:B.green,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>PREPAID — Payable at Origin by Shipper</td></tr>}
            {prepaid.map((li,i)=>(<tr key={i} style={{background:i%2===0?"#fff":"#fafbff"}}><td style={tdS}>{li.description}</td><td style={{...tdS,color:B.g5}}>{li.basis}</td><td style={{...tdS,fontWeight:600,color:li.amount==null||li.amount===""||li.amount==="Per Tariff"?B.amber:B.dark}}>{fmtAmt(li)}</td><td style={tdS}><span style={{background:"#e0f2fe",color:"#0369a1",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600}}>PREPAID</span></td></tr>))}
            {collect.length>0&&<tr><td colSpan={4} style={{...tdS,background:"#fff7ed",color:"#c2410c",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>COLLECT — Payable at Destination by Consignee</td></tr>}
            {collect.map((li,i)=>(<tr key={i} style={{background:i%2===0?"#fff":"#fafbff"}}><td style={tdS}>{li.description}</td><td style={{...tdS,color:B.g5}}>{li.basis}</td><td style={{...tdS,fontWeight:600,color:li.amount==null||li.amount===""||li.amount==="Per Tariff"?B.amber:B.dark}}>{fmtAmt(li)}</td><td style={tdS}><span style={{background:"#ffedd5",color:"#c2410c",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600}}>COLLECT</span></td></tr>))}
            {prepaid.length===0&&collect.length===0&&<tr><td colSpan={4} style={{...tdS,color:B.g5,fontStyle:"italic",textAlign:"center",padding:20}}>No rates loaded for {EQ_L[selectedEq]||selectedEq} on this route.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Footer: disclaimer + CTA */}
      <div style={{padding:"14px 18px",background:"#f8faff",borderTop:`1px solid ${B.g3}22`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,boxSizing:"border-box"}}>
        <div style={{fontSize:11,color:B.g5,fontStyle:"italic",flex:1,minWidth:200}}>
          * Indicative rates only. Final charges subject to space availability, carrier confirmation, and applicable exchange rates at time of booking.
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <button
              onClick={()=>window.open(buildWA(opt),"_blank","noopener,noreferrer")}
              style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 18px",background:B.primary,color:"#fff",borderRadius:8,fontWeight:700,fontSize:13,border:"none",fontFamily:F,cursor:"pointer",whiteSpace:"nowrap"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Choose This Option
            </button>
            <button
              onClick={()=>window.open(buildEmail(opt),"_blank","noopener,noreferrer")}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 14px",background:"none",border:`1.5px solid ${B.primary}`,color:B.primary,borderRadius:8,fontWeight:600,fontSize:12,fontFamily:F,cursor:"pointer",whiteSpace:"nowrap"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
              Email
            </button>
          </div>
      </div>
    </div>
  );
}

/* ─── Quote page ─── */
function QuotePage(){const go=useNavigate();
const m=useIsMobile();
const BLANK={pol:"",pod:"",cargo:"",eq:"",vol:"1",name:"",company:"",email:"",phone:"",msg:""};
const[f,setF]=useState(BLANK);
const[phoneErr,setPhoneErr]=useState("");
const[errs,setErrs]=useState({});
const[sending,setSending]=useState(false);
const[done,setDone]=useState(false);
const[sendErr,setSendErr]=useState("");
const up=(k,v)=>setF(p=>({...p,[k]:v}));
const validate=()=>{const e={};if(!f.pol)e.pol="Required";if(!f.pod)e.pod="Required";if(!f.cargo)e.cargo="Required";if(!f.eq)e.eq="Required";if(!f.name.trim())e.name="Required";if(!f.email.trim())e.email="Required";else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))e.email="Invalid email";setErrs(e);return!Object.keys(e).length;};
const handleSubmit=async()=>{if(sending||!validate())return;setSending(true);setSendErr("");const polName=POL.find(p=>p.c===f.pol)?.n||f.pol;const podName=ALL_POD.find(p=>p.c===f.pod)?.n||f.pod;try{await submitQuoteAPI({pol:`${polName} (${f.pol})`,pod:`${podName} (${f.pod})`,equipment:`${EQ_L[f.eq]||f.eq} (${f.eq})`,containers:parseInt(f.vol)||1,cargo:f.cargo,notes:f.msg||"",name:f.name,company:f.company||"",email:f.email,phone:f.phone||"",rateFound:false},"anon");setDone(true);}catch(err){setSendErr("Submission failed. Please email quotes@sattvaglobal.in or call +91 9136 121 123 directly.");}finally{setSending(false);}};
if(done)return(<div style={{paddingTop:68,minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"68px 24px 40px"}}><div style={{textAlign:"center",maxWidth:480}}><div style={{width:72,height:72,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div><h2 style={{...st.h2,fontSize:26}}>Quote Request Received</h2><p style={{...st.bd,marginTop:14,lineHeight:1.7}}>Your request is with the Sattva team. We review your route, cargo and equipment and come back within 4 working hours.</p><p style={{fontSize:13,color:B.g5,marginTop:12}}>Urgent? Call <a href="tel:+919136121123" style={{color:B.primary,fontWeight:600}}>+91 9136 121 123</a></p><div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:28}}><button onClick={()=>setDone(false)} style={st.bp}>Submit Another</button><button onClick={()=>go("/")} style={st.bs}>Back to Home</button></div></div></div>);
return(<div style={{paddingTop:68}}><Helmet><title>Get an Export Freight Quote from India | Sattva Global Logistics</title><meta name="description" content="Request an export freight quote from India for Gulf, Red Sea and Africa shipments." /><link rel="canonical" href="https://www.sattvaglobal.in/quote"/></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(80px,10vw,110px) clamp(16px,4vw,24px) 40px"}}><div style={{maxWidth:1200,margin:"0 auto"}}><div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Get a Quote</div><h1 style={{...st.h1,fontSize:"clamp(28px,4vw,42px)"}}>Request Export Freight Quote — <span style={{color:B.primary}}>We Respond Within 4 Hours</span></h1><p style={{...st.bd,fontSize:16,marginTop:16,maxWidth:640}}>Tell us your route, cargo and equipment. We will come back with pricing, route fit, or a direct conversation with the team.</p></div></section>
<div style={st.sec}><div style={{display:"grid",gridTemplateColumns:m?"1fr":"5fr 3fr",gap:m?24:40,alignItems:"start"}}>
<div style={{...st.cd,padding:m?20:36}}><h3 style={{...st.h3,marginBottom:6}}>Shipment Details</h3><p style={{fontSize:13,color:B.g5,marginBottom:24}}>Route, cargo, and equipment.</p>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:16,marginBottom:16}}><PortCombo label="POL *" value={f.pol} onChange={v=>{up("pol",v);setErrs(p=>({...p,pol:""}));}} options={POL} error={errs.pol} placeholder="Search port of loading…" history={[]}/><PortCombo label="POD *" value={f.pod} onChange={v=>{up("pod",v);setErrs(p=>({...p,pod:""}));}} options={ALL_POD} error={errs.pod} placeholder="Search port of discharge…" history={[]}/></div>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:16,marginBottom:16}}><CargoCombo label="Cargo Type *" value={f.cargo} onChange={v=>{up("cargo",v);setErrs(p=>({...p,cargo:""}));}} error={errs.cargo} placeholder="Search cargo or HS code…" history={[]}/><div><label style={st.lb}>Equipment *</label><select style={{...st.inp,borderColor:errs.eq?B.red:undefined}} value={f.eq} onChange={e=>{up("eq",e.target.value);setErrs(p=>({...p,eq:""}));}}><option value="">Select</option>{EQ.map(e=><option key={e} value={e}>{EQ_L[e]} ({e})</option>)}</select><ErrMsg msg={errs.eq}/></div></div>
<div style={{marginBottom:24}}><label style={st.lb}>Number of Containers</label><input type="number" style={{...st.inp,maxWidth:120}} value={f.vol} min="1" max="99" onChange={e=>up("vol",String(Math.max(1,Math.min(99,parseInt(e.target.value)||1))))}/></div>
<hr style={{border:"none",borderTop:`1px solid ${B.g2}`,margin:"4px 0 24px"}}/>
<h3 style={{...st.h3,marginBottom:6}}>Your Details</h3><p style={{fontSize:13,color:B.g5,marginBottom:20}}>So we can send the quote confirmation and follow up.</p>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:16,marginBottom:16}}><div><label style={st.lb}>Name *</label><input style={{...st.inp,borderColor:errs.name?B.red:undefined}} type="text" value={f.name} onChange={e=>{up("name",e.target.value);setErrs(p=>({...p,name:""}));}} placeholder="Full name"/><ErrMsg msg={errs.name}/></div><div><label style={st.lb}>Company</label><input style={st.inp} type="text" value={f.company} onChange={e=>up("company",e.target.value)} placeholder="Company name"/></div><div><label style={st.lb}>Email *</label><input style={{...st.inp,borderColor:errs.email?B.red:undefined}} type="email" value={f.email} onChange={e=>{up("email",e.target.value);setErrs(p=>({...p,email:""}));}} placeholder="you@company.com"/><ErrMsg msg={errs.email}/></div><div><label style={st.lb}>Phone</label><PhoneField value={f.phone} onChange={v=>up("phone",v)} error={errs.phone||phoneErr} onError={setPhoneErr} st={st}/></div></div>
<div style={{marginBottom:24}}><label style={st.lb}>Notes</label><textarea style={{...st.inp,minHeight:80,resize:"vertical"}} value={f.msg} onChange={e=>up("msg",e.target.value)} placeholder="Buyer timelines, Incoterms, product details, packing notes…"/></div>
{sendErr&&<div style={{marginBottom:16,padding:"12px 16px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca",color:B.red,fontSize:13}}>{sendErr}</div>}
<button onClick={handleSubmit} disabled={sending} style={{...st.bp,width:"100%",justifyContent:"center",fontSize:15,padding:"14px 24px",opacity:sending?.7:1}}>{sending?"Submitting…":"Submit Quote Request →"}</button>
<p style={{fontSize:11,color:B.g5,marginTop:10,textAlign:"center"}}>Typically respond within 4 hours. Urgent: +91 9136 121 123.</p></div>
<div><div style={{...st.cd,marginBottom:20,borderTop:`3px solid ${B.primary}`}}><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:14}}>Prefer to speak directly?</h4><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13}}><I.Ph/><a href="tel:+919136121123" style={{color:B.g7,textDecoration:"none"}}>+91 9136 121 123</a></div><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}><I.Ma/><a href="mailto:quotes@sattvaglobal.in" style={{color:B.g7,textDecoration:"none"}}>quotes@sattvaglobal.in</a></div></div>
<div style={st.cd}><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:14}}>What happens after you submit</h4>{["We review your route, cargo and equipment","We confirm lane support and pricing","You get an actual reply — not a template","We set up a call if needed"].map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}><div style={{flexShrink:0,marginTop:3}}><I.Ck/></div><span style={{fontSize:13,color:B.g7,lineHeight:1.6}}>{t}</span></div>)}</div></div>
</div></div></div>);}

/* ─── Admin Quote Builder ─── */
function AdminPage({quotes,setQuotes}){const go=useNavigate();
const[authed,setAuthed]=useState(false);
const[adminToken,setAdminToken]=useState(null);
const[email,setEmail]=useState("");
const[pass,setPass]=useState("");
const[loginErr,setLoginErr]=useState("");
const[tab,setTab]=useState("list");
const[msg,setMsg]=useState("");
const[search,setSearch]=useState("");
const[editKey,setEditKey]=useState(null);
const[fPol,setFPol]=useState("");
const[fPod,setFPod]=useState("");
const[fPodR,setFPodR]=useState("");
const[fValidUntil,setFValidUntil]=useState("");
const[fOptions,setFOptions]=useState([newOption()]);
const[activeOptIdx,setActiveOptIdx]=useState(0);
// Bulk upload state
const[bulkFile,setBulkFile]=useState(null);
const[bulkPreview,setBulkPreview]=useState(null);
const[bulkUploading,setBulkUploading]=useState(false);
const pods=fPodR?POD_R[fPodR]||[]:[];
const doLogin=async()=>{
  setLoginErr("");
  const{data,error}=await supabase.auth.signInWithPassword({email,password:pass});
  if(error){
    if(error.message?.toLowerCase().includes("invalid")||error.status===400)setLoginErr("Invalid email or password.");
    else if(error.message?.toLowerCase().includes("network")||error.status===0)setLoginErr("Network error — check your connection.");
    else setLoginErr(`Sign-in failed (${error.status||"unknown"}). Try again.`);
    return;
  }
  if(!data?.session){setLoginErr("Sign-in failed — no session returned. Try again.");return;}
  setAdminToken(data.session.access_token);
  setAuthed(true);
  // Fetch quotes for admin after auth — FAIL-03 fix
  getQuotes().then(r=>setQuotes(r)).catch(()=>{});
};
// Restore Supabase auth session on mount — FAIL-04 fix
React.useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{
    if(data?.session){setAdminToken(data.session.access_token);setAuthed(true);getQuotes().then(r=>setQuotes(r)).catch(()=>{});}
  });
  const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
    if(!session){setAuthed(false);setAdminToken(null);}
  });
  return()=>subscription.unsubscribe();
},[]);
const doLogout=async()=>{await supabase.auth.signOut();setAuthed(false);setAdminToken(null);};
const resetForm=()=>{setFPol("");setFPod("");setFPodR("");setFValidUntil("");setFOptions([newOption()]);setActiveOptIdx(0);setEditKey(null);};
const editQuote=(key)=>{const q=quotes[key];const[pol,pod]=key.split(":");let podR="";for(const[rg,ps]of Object.entries(POD_R)){if(ps.find(p=>p.c===pod)){podR=rg;break;}}setFPol(pol);setFPod(pod);setFPodR(podR);setFValidUntil(q.validUntil||"");setFOptions(q.options&&q.options.length>0?q.options:[newOption()]);setActiveOptIdx(0);setEditKey(key);setTab("edit");};
const saveQuote=async()=>{if(!fPol||!fPod){setMsg("Fill POL and POD.");return;}const key=`${fPol}:${fPod}`;setMsg("Saving…");try{await saveQuoteAPI(key,{validUntil:fValidUntil||null,options:fOptions},adminToken);const updated={...quotes,[key]:{pol:fPol,pod:fPod,validUntil:fValidUntil||null,options:fOptions}};setQuotes(updated);setMsg(`✓ Saved: ${key}`);resetForm();setTab("list");}catch(e){setMsg("⚠ Save failed: "+e.message);}};
const delQuote=async(key)=>{setMsg("Deleting…");try{await deleteQuoteAPI(key,adminToken);const u={...quotes};delete u[key];setQuotes(u);setMsg(`✓ Deleted: ${key}`);}catch(e){setMsg("⚠ Delete failed.");}};
const upOpt=(i,field,val)=>setFOptions(opts=>opts.map((o,idx)=>idx===i?{...o,[field]:val}:o));
const addOption=()=>{setFOptions(o=>[...o,newOption()]);setActiveOptIdx(fOptions.length);};
const removeOption=(i)=>{setFOptions(o=>o.filter((_,idx)=>idx!==i));setActiveOptIdx(Math.max(0,i-1));};
const addLineItem=(oi)=>setFOptions(opts=>opts.map((o,i)=>i===oi?{...o,lineItems:[...o.lineItems,newLineItem()]}:o));
const removeLineItem=(oi,li)=>setFOptions(opts=>opts.map((o,i)=>i===oi?{...o,lineItems:o.lineItems.filter((_,j)=>j!==li)}:o));
const upLineItem=(oi,li,field,val)=>setFOptions(opts=>opts.map((o,i)=>i===oi?{...o,lineItems:o.lineItems.map((x,j)=>j===li?{...x,[field]:val}:x)}:o));
const entries=Object.entries(quotes).filter(([k])=>!search||k.toLowerCase().includes(search.toLowerCase()));
const inpS={...st.inp,padding:"8px 10px",fontSize:13};
const lbS={...st.lb,fontSize:11};

// ── Bulk upload: parse Excel using SheetJS ──────────────────────────
const parseExcel=async(file)=>{
  try{
    // Dynamically load SheetJS from CDN
    if(!window.XLSX){
      await new Promise((resolve,reject)=>{
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload=resolve;s.onerror=reject;
        document.head.appendChild(s);
      });
    }
    const XLSX=window.XLSX;
    const ab=await file.arrayBuffer();
    const wb=XLSX.read(ab,{type:"array"});
    // Read "Rate Upload" sheet — skip rows 1-4 (title, instructions, headers, hints)
    const ws=wb.Sheets["Rate Upload"]||wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:["route_key","valid_until","carrier","vessel","etd","transit","routing","description","basis","amount","currency","payment","category"],range:4,defval:""});
    // Group rows by route_key → carrier+vessel+etd
    const routeMap={};
    for(const row of rows){
      const rk=(row.route_key||"").trim().toUpperCase();
      if(!rk||!rk.includes(":"))continue;
      const parts=rk.split(":");if(parts.length!==2)continue;
      if(!routeMap[rk]){routeMap[rk]={routeKey:rk,validUntil:row.valid_until||null,carrierMap:{}};}
      if(row.valid_until&&!routeMap[rk].validUntil)routeMap[rk].validUntil=row.valid_until;
      const carrierKey=`${row.carrier||""}|${row.vessel||""}|${row.etd||""}`;
      if(!routeMap[rk].carrierMap[carrierKey]){routeMap[rk].carrierMap[carrierKey]={carrier:row.carrier||"",vessel:row.vessel||"",etd:row.etd||"",transitDays:row.transit||"",routing:row.routing||"",lineItems:[]};}
      if(row.description){
        const amt=row.amount===""||row.amount==null?"":String(row.amount);
        routeMap[rk].carrierMap[carrierKey].lineItems.push({description:row.description,basis:row.basis||"Per Cntr",amount:amt,currency:row.currency||"USD",payment:(row.payment||"PREPAID").toUpperCase(),category:row.category||"Ocean Freight"});
      }
    }
    const parsed=Object.values(routeMap).map(r=>({routeKey:r.routeKey,validUntil:r.validUntil,options:Object.values(r.carrierMap)}));
    return parsed;
  }catch(e){throw new Error("Failed to parse Excel: "+e.message);}
};

const handleBulkFile=async(e)=>{
  const file=e.target.files[0];if(!file)return;
  setBulkFile(file);setBulkPreview(null);setMsg("");
  try{
    const parsed=await parseExcel(file);
    setBulkPreview(parsed);
    setMsg(`✓ Parsed ${parsed.length} routes from Excel. Review below and click "Save All" to upload.`);
  }catch(err){setMsg("⚠ "+err.message);setBulkPreview(null);}
};

const bulkSaveAll=async()=>{
  if(!bulkPreview||bulkPreview.length===0)return;
  setBulkUploading(true);setMsg("Uploading…");
  let saved=0,failed=0;const updated={...quotes};
  for(const r of bulkPreview){
    try{
      await saveQuoteAPI(r.routeKey,{validUntil:r.validUntil,options:r.options},adminToken);
      const[pol,pod]=r.routeKey.split(":");
      updated[r.routeKey]={pol,pod,validUntil:r.validUntil,options:r.options};
      saved++;
    }catch(e){failed++;}
  }
  setQuotes(updated);
  setMsg(`✓ Uploaded ${saved} routes successfully.${failed>0?` ⚠ ${failed} failed.`:""}`);
  setBulkPreview(null);setBulkFile(null);setBulkUploading(false);
  if(saved>0)setTab("list");
};

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
<div style={{maxWidth:1300,margin:"0 auto",padding:"32px 24px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
<div><h1 style={{fontSize:26,fontWeight:700,color:B.dark,fontFamily:FF,margin:0}}>Rate Management</h1><p style={{fontSize:13,color:B.g5,marginTop:4}}>{Object.keys(quotes).length} routes · Sattva Quote Format</p></div>
<div style={{display:"flex",gap:10}}>
<button onClick={doLogout} style={{...st.bs,padding:"8px 16px",fontSize:12}}>Sign Out</button>
<button onClick={()=>go("/")} style={{...st.bs,padding:"8px 16px",fontSize:12}}>← Site</button>
</div></div>
{msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.startsWith("✓")?B.gBg:msg.startsWith("⚠")?B.aBg:"#eff6ff",color:msg.startsWith("✓")?B.green:msg.startsWith("⚠")?B.amber:B.primary,fontSize:13,marginBottom:16,fontWeight:500}}>{msg}</div>}
<div style={{display:"flex",gap:4,marginBottom:24}}>
{[["list","All Routes"],["edit",editKey?"Edit Quote":"Add Quote"],["bulk","📤 Bulk Upload"]].map(([id,lb])=>
<button key={id} onClick={()=>{if(id==="list")resetForm();setTab(id);}} style={{padding:"10px 20px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:F,background:tab===id?"#fff":"transparent",color:tab===id?B.primary:B.g5,boxShadow:tab===id?"0 -1px 4px rgba(0,0,0,.05)":"none"}}>{lb}</button>)}
</div>

{tab==="list"&&(
<div style={{...st.cd,padding:0,overflow:"hidden"}}>
<div style={{padding:"16px 20px",borderBottom:`1px solid ${B.g1}`,display:"flex",gap:12,alignItems:"center"}}>
<input style={{...st.inp,maxWidth:300}} placeholder="Search routes (INNSA, SAJED)…" value={search} onChange={e=>setSearch(e.target.value)}/>
<button onClick={()=>{resetForm();setTab("edit");}} style={{...st.bp,padding:"10px 18px",fontSize:12,whiteSpace:"nowrap"}}><I.Pl/> Add Route</button>
</div>
{entries.length===0?(<div style={{padding:40,textAlign:"center",color:B.g5}}><p style={{fontSize:15,fontWeight:500}}>No routes yet</p><p style={{fontSize:13,marginTop:6}}>Add a route manually or use Bulk Upload.</p></div>):(
<div style={{overflowX:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:F}}>
<thead><tr style={{background:B.g1}}>{["POL","POD","Carrier Options","Valid Until",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:600,color:B.g5,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
<tbody>{entries.map(([key,q])=>{const[pol,pod]=key.split(":");return(
<tr key={key} style={{borderBottom:`1px solid ${B.g1}`}}>
<td style={{padding:"10px 12px",fontWeight:600,color:B.dark}}>{pol}</td>
<td style={{padding:"10px 12px"}}>{pn(pod)}<br/><span style={{fontSize:11,color:B.g5}}>{pod}</span></td>
<td style={{padding:"10px 12px"}}><span style={{background:`${B.primary}15`,color:B.primary,padding:"2px 8px",borderRadius:4,fontSize:12,fontWeight:600}}>{(q.options||[]).length} carrier{(q.options||[]).length!==1?"s":""}</span></td>
<td style={{padding:"10px 12px",fontSize:12,color:B.g5}}>{q.validUntil||"—"}</td>
<td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
<button onClick={()=>editQuote(key)} style={{background:"none",border:"none",cursor:"pointer",color:B.primary,padding:4,marginRight:4}}><I.Ed/></button>
<button onClick={()=>delQuote(key)} style={{background:"none",border:"none",cursor:"pointer",color:B.red,padding:4}}><I.Dl/></button>
</td></tr>);})}
</tbody></table></div>)}
</div>)}

{tab==="edit"&&(
<div style={{...st.cd}}>
<h3 style={{...st.h3,marginBottom:24}}>{editKey?"Edit Route Quote":"Add Route Quote"}</h3>
<p style={{fontSize:13,color:B.g5,marginTop:-16,marginBottom:20}}>Enter all equipment types (20GP, 40HC etc.) as separate line items within each carrier option.</p>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:24}}>
<div><label style={lbS}>POL *</label><select style={inpS} value={fPol} onChange={e=>setFPol(e.target.value)}><option value="">Select</option>{POL.map(p=><option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select></div>
<div><label style={lbS}>Region</label><select style={inpS} value={fPodR} onChange={e=>{setFPodR(e.target.value);setFPod("");}}><option value="">Select</option>{Object.keys(POD_R).map(r=><option key={r} value={r}>{r}</option>)}</select></div>
<div><label style={lbS}>POD *</label><select style={inpS} value={fPod} onChange={e=>setFPod(e.target.value)} disabled={!fPodR}><option value="">Select</option>{pods.map(p=><option key={p.c} value={p.c}>{p.n} ({p.c})</option>)}</select></div>
<div><label style={lbS}>Valid Until</label><input type="date" style={inpS} value={fValidUntil} onChange={e=>setFValidUntil(e.target.value)}/></div>
</div>
<div style={{borderBottom:`2px solid ${B.g3}44`,marginBottom:20,display:"flex",alignItems:"center",gap:0}}>
{fOptions.map((o,i)=>(<button key={i} onClick={()=>setActiveOptIdx(i)} style={{padding:"8px 16px",border:"none",background:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:F,color:i===activeOptIdx?B.primary:B.g5,borderBottom:i===activeOptIdx?`2px solid ${B.primary}`:"2px solid transparent",marginBottom:-2,display:"flex",alignItems:"center",gap:6}}>{o.carrier||`Carrier ${i+1}`}{fOptions.length>1&&<span onClick={ev=>{ev.stopPropagation();removeOption(i);}} style={{marginLeft:4,color:B.red,fontSize:16,lineHeight:1,cursor:"pointer"}}>×</span>}</button>))}
<button onClick={addOption} style={{marginLeft:8,padding:"6px 12px",border:`1.5px dashed ${B.primary}66`,borderRadius:6,background:"none",cursor:"pointer",color:B.primary,fontSize:12,fontWeight:600,fontFamily:F}}>+ Add Carrier</button>
</div>
{fOptions[activeOptIdx]&&(()=>{
const opt=fOptions[activeOptIdx];const oi=activeOptIdx;
return(<div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:20}}>
    <div><label style={lbS}>Carrier / Shipping Line *</label><input style={inpS} value={opt.carrier} onChange={e=>upOpt(oi,"carrier",e.target.value)} placeholder="CMA CGM"/></div>
    <div><label style={lbS}>Vessel Name</label><input style={inpS} value={opt.vessel} onChange={e=>upOpt(oi,"vessel",e.target.value)} placeholder="CUSSLER"/></div>
    <div><label style={lbS}>ETD (from POL)</label><input type="date" style={inpS} value={opt.etd} onChange={e=>upOpt(oi,"etd",e.target.value)}/></div>
    <div><label style={lbS}>Transit Time</label><input style={inpS} value={opt.transitDays} onChange={e=>upOpt(oi,"transitDays",e.target.value)} placeholder="~16 days"/></div>
  </div>
  <div style={{marginBottom:20}}><label style={lbS}>Routing</label><input style={{...inpS,width:"100%"}} value={opt.routing} onChange={e=>upOpt(oi,"routing",e.target.value)} placeholder="e.g. Direct / JNPT → Colombo → Beira"/></div>
  <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <div><h4 style={{fontSize:14,fontWeight:700,color:B.dark,margin:0}}>Charge Line Items</h4><p style={{fontSize:11,color:B.g5,margin:"4px 0 0"}}>⚠ Ocean Freight must use equipment-specific basis: <strong>Per 20'</strong>, <strong>Per 40'</strong>, <strong>Per 40HC</strong>, <strong>Per 45'</strong>. Use <strong>Per Cntr / Per BL</strong> only for surcharges that apply to all equipment equally.</p></div>
    <button onClick={()=>addLineItem(oi)} style={{...st.bp,padding:"7px 14px",fontSize:12,whiteSpace:"nowrap"}}><I.Pl/> Add Line</button>
  </div>
  {opt.lineItems.length===0&&<div style={{padding:"20px",textAlign:"center",color:B.g5,fontSize:13,border:`1.5px dashed ${B.g3}`,borderRadius:8,marginBottom:16}}>No line items yet. Click "Add Line" to start.<br/><span style={{fontSize:11,marginTop:4,display:"block"}}>Tip: Add "Ocean Freight Per 20'" and "Ocean Freight Per 40HC" as separate lines if you have both.</span></div>}
  {opt.lineItems.length>0&&(<div style={{overflowX:"auto",marginBottom:8}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
      <thead><tr style={{background:B.g1}}>{["Charge Description","Basis","Amount","Currency","Payment","Category",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:B.g5,fontSize:10,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
      <tbody>{opt.lineItems.map((li,liIdx)=>(
        <tr key={liIdx} style={{borderBottom:`1px solid ${B.g1}`}}>
          <td style={{padding:"6px 4px",minWidth:180}}><input style={inpS} value={li.description} onChange={e=>upLineItem(oi,liIdx,"description",e.target.value)} placeholder="Ocean Freight"/></td>
          <td style={{padding:"6px 4px",minWidth:120}}><select style={inpS} value={li.basis} onChange={e=>upLineItem(oi,liIdx,"basis",e.target.value)}>{BASIS_OPTIONS.map(b=><option key={b} value={b}>{b}</option>)}</select></td>
          <td style={{padding:"6px 4px",minWidth:110}}><input style={inpS} value={li.amount} onChange={e=>upLineItem(oi,liIdx,"amount",e.target.value)} placeholder="blank = Per Tariff"/></td>
          <td style={{padding:"6px 4px",minWidth:80}}><select style={inpS} value={li.currency} onChange={e=>upLineItem(oi,liIdx,"currency",e.target.value)}>{CURRENCY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
          <td style={{padding:"6px 4px",minWidth:100}}><select style={{...inpS,background:li.payment==="PREPAID"?"#e0f2fe":"#ffedd5",color:li.payment==="PREPAID"?"#0369a1":"#c2410c",fontWeight:600}} value={li.payment} onChange={e=>upLineItem(oi,liIdx,"payment",e.target.value)}><option value="PREPAID">PREPAID</option><option value="COLLECT">COLLECT</option></select></td>
          <td style={{padding:"6px 4px",minWidth:130}}><select style={inpS} value={li.category} onChange={e=>upLineItem(oi,liIdx,"category",e.target.value)}>{CATEGORY_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
          <td style={{padding:"6px 4px"}}><button onClick={()=>removeLineItem(oi,liIdx)} style={{background:"none",border:`1px solid ${B.red}44`,borderRadius:6,cursor:"pointer",color:B.red,fontSize:14,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></td>
        </tr>
      ))}</tbody>
    </table>
  </div>)}
</div>);
})()}
<div style={{display:"flex",gap:12,marginTop:28}}>
<button onClick={saveQuote} style={{...st.bp,padding:"12px 28px"}}>{editKey?"Update Quote":"Save Quote"}</button>
<button onClick={()=>{resetForm();setTab("list");}} style={{...st.bs,padding:"12px 20px"}}>Cancel</button>
</div>
</div>)}

{tab==="bulk"&&(
<div style={{...st.cd,maxWidth:800}}>
<h3 style={{...st.h3,marginBottom:8}}>Bulk Rate Upload from Excel</h3>
<p style={{fontSize:13,color:B.g5,marginBottom:24}}>Fill in the Excel template and upload it here. All routes in the file will be saved in one shot. Existing routes with the same POL:POD will be overwritten.</p>

{/* Download template button */}
<div style={{padding:20,borderRadius:12,background:`${B.primary}06`,border:`1.5px solid ${B.primary}22`,marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
  <div>
    <div style={{fontWeight:700,fontSize:14,color:B.dark,marginBottom:4}}>Step 1 — Download the template</div>
    <div style={{fontSize:12,color:B.g5}}>Pre-formatted with headers, dropdowns, and example rows for INNSA:SAJED and INNSA:ZADUR.</div>
  </div>
  <a href="/Sattva_Rate_Upload_Template.xlsx" download style={{...st.bp,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8,padding:"10px 20px"}}>
    <I.Dw/> Download Template
  </a>
</div>

{/* Upload area */}
<div style={{padding:20,borderRadius:12,background:B.g1,border:`1.5px solid ${B.g3}44`,marginBottom:24}}>
  <div style={{fontWeight:700,fontSize:14,color:B.dark,marginBottom:12}}>Step 2 — Upload your filled Excel</div>
  <input type="file" accept=".xlsx,.xls" onChange={handleBulkFile} style={{display:"block",fontSize:13,fontFamily:F,color:B.g7,marginBottom:8}}/>
  <div style={{fontSize:11,color:B.g5}}>Supported: .xlsx, .xls — Sheet must be named "Rate Upload" — Data starts from row 5 — Ocean Freight lines must use Per 20' / Per 40HC basis, NOT Per Cntr</div>
</div>

{/* Preview table */}
{bulkPreview&&bulkPreview.length>0&&(
<div>
  <div style={{fontWeight:700,fontSize:14,color:B.dark,marginBottom:12}}>Step 3 — Review parsed data ({bulkPreview.length} routes)</div>
  <div style={{overflowX:"auto",marginBottom:20}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:F}}>
      <thead><tr style={{background:B.g1}}>
        {["Route","Valid Until","Carriers","Line Items"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:B.g5,fontSize:10,textTransform:"uppercase"}}>{h}</th>)}
      </tr></thead>
      <tbody>{bulkPreview.map((r,i)=>(
        <tr key={i} style={{borderBottom:`1px solid ${B.g1}`}}>
          <td style={{padding:"8px 12px",fontWeight:700,color:B.dark,fontFamily:"monospace"}}>{r.routeKey}</td>
          <td style={{padding:"8px 12px",fontSize:12,color:B.g5}}>{r.validUntil||"—"}</td>
          <td style={{padding:"8px 12px"}}>{r.options.map(o=>o.carrier||"?").join(", ")}</td>
          <td style={{padding:"8px 12px"}}>{r.options.reduce((a,o)=>a+o.lineItems.length,0)} lines</td>
        </tr>
      ))}</tbody>
    </table>
  </div>
  <button onClick={bulkSaveAll} disabled={bulkUploading} style={{...st.bp,padding:"12px 28px",opacity:bulkUploading?.7:1}}>
    {bulkUploading?`Uploading…`:`Save All ${bulkPreview.length} Routes`}
  </button>
</div>
)}
</div>)}

</div></div>);}

/* ─── App ─── */
export default function App(){
const[quotes,setQuotes]=useState({});
const[quotesErr,setQuotesErr]=useState(false);
const WA_FLOAT=`https://wa.me/919136121123?text=${encodeURIComponent("Hi, I'm planning an export shipment from India and would like to discuss route fit, pricing, and next steps with Sattva Global Logistics.")}`;
return(
<HelmetProvider>
<BrowserRouter>
<ScrollToTop/>
<div style={{fontFamily:F,color:B.g7,background:B.w,minHeight:"100vh",overflowX:"hidden",width:"100%",maxWidth:"100vw"}}>
<Routes>
<Route path="/*" element={<><Nav st={st}/><Routes>
<Route path="/" element={<HomePage st={st} I={I}/>}/>
<Route path="/about" element={<AboutPage st={st} I={I}/>}/>
<Route path="/why-sattva" element={<WhySattvaPage st={st} I={I}/>}/>
<Route path="/services" element={<ServicesPage st={st} I={I}/>}/>
<Route path="/trade-lanes" element={<TradeLanesPage st={st} I={I}/>}/>
<Route path="/industries" element={<IndustriesPage st={st} I={I}/>}/>
<Route path="/knowledge" element={<ChunkErrorBoundary><Suspense fallback={<div style={{paddingTop:100,textAlign:"center",color:B.g5}}>Loading…</div>}><KnowledgePage st={st} I={I}/></Suspense></ChunkErrorBoundary>}/>
<Route path="/testimonials" element={<ChunkErrorBoundary><Suspense fallback={<div style={{paddingTop:100,textAlign:"center",color:B.g5}}>Loading…</div>}><TestimonialsPage st={st} I={I}/></Suspense></ChunkErrorBoundary>}/>
<Route path="/quote" element={<QuotePage/>}/>
<Route path="/trade-advisory" element={<TradeAdvisoryPage st={st} I={I}/>}/>
<Route path="/linkedin" element={<LinkedInPage st={st} I={I}/>}/>
<Route path="*" element={<div style={{paddingTop:100,minHeight:"60vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><h2 style={{...st.h2,color:B.dark}}>404 — Page Not Found</h2><p style={{...st.bd,color:B.g5}}>The page you're looking for doesn't exist.</p></div>}/>
</Routes><Footer I={I}/><AdvisoryBanner/></>}/>

<Route path="/admin" element={<AdminPage quotes={quotes} setQuotes={setQuotes}/>}/>
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




