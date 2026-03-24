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
function HomePage(){const go=useNavigate();const m=useIsMobile();return(<><Helmet><title>Freight Forwarder Mumbai | Export to Middle East &amp; Africa | Sattva Global Logistics</title><meta name="description" content="Mumbai's most reliable freight forwarder for FCL exports to Middle East, Red Sea, and Africa. 20+ years experience. JNPT, Mundra, Chennai, Cochin." /><link rel="canonical" href="https://www.sattvaglobal.in/" /></Helmet>
<section style={{minHeight:"100vh",display:"flex",alignItems:"center",position:"relative",overflow:"hidden",background:`linear-gradient(160deg,${B.lightBlue}55 0%,${B.w} 50%,${B.g1} 100%)`}}>
<div style={{position:"absolute",top:-200,right:-200,width:600,height:600,borderRadius:"50%",background:`radial-gradient(circle,${B.primary}08,transparent 70%)`}}/>
<div style={{...st.sec,display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?32:56,alignItems:"center",paddingTop:m?100:110}}>
<div style={{minWidth:0}}>
<div style={{fontSize:11,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:2,marginBottom:16,lineHeight:1.5}}>International Freight Forwarding from Mumbai</div>
<h1 style={st.h1}>Mumbai's Most Reliable <span style={{color:B.primary}}>Middle East, Red Sea & Africa</span> Freight Forwarder</h1>
<p style={{...st.bd,fontSize:m?15:17,marginTop:20,maxWidth:500}}>20+ years of export forwarding experience. FCL shipments from JNPT, Mundra, Chennai and Cochin to the Gulf, Red Sea and Africa â€” with documentation accuracy your buyers depend on.</p>
<div style={{display:"flex",gap:12,marginTop:32,flexWrap:"wrap"}}>
<button onClick={()=>go("/quote")} style={{...st.bp,fontSize:m?13:14}}>Get a Freight Quote <I.Ar/></button>
<button onClick={()=>go("/testimonials")} style={{...st.bs,fontSize:m?13:14}}>Client Stories</button>
</div>
<div style={{display:"flex",gap:m?24:36,marginTop:40,flexWrap:"wrap"}}>
{[["20+","Years Experience"],["1000+","Shipments Handled"],["40+","Destinations Served"]].map(([n,l])=><div key={l}><div style={{fontSize:m?24:30,fontWeight:800,color:B.primary,fontFamily:FF}}>{n}</div><div style={{fontSize:12,color:B.g5}}>{l}</div></div>)}
</div>
</div>
{!m&&<div style={{display:"flex",justifyContent:"center"}}>
<div style={{width:400,height:400,borderRadius:"50%",background:`linear-gradient(135deg,${B.primary}10,${B.accent}10)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:300,height:300,borderRadius:"50%",background:`linear-gradient(135deg,${B.primary}16,${B.accent}16)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{textAlign:"center"}}><svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke={B.primary} strokeWidth="1" opacity=".5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg><div style={{fontSize:13,fontWeight:600,color:B.primary,marginTop:6}}>Mumbai â†’ Middle East Â· Africa</div></div>
</div></div></div>}
</div></section>

{/* â”€â”€ Trade Lane Map with Transit Times â”€â”€ */}
<section style={{background:B.dark,padding:m?"48px 20px":"64px 24px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{textAlign:"center",marginBottom:40}}>
<div style={{fontSize:12,fontWeight:600,color:B.accent,textTransform:"uppercase",letterSpacing:3,marginBottom:12}}>Trade Lanes We Serve</div>
<h2 style={{...st.h2,color:"#fff",margin:0}}>Direct Services to Your Market</h2>
</div>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"repeat(3,1fr)",gap:16}}>
{[
{region:"Middle East & Upper Gulf",color:B.accent,lanes:[["JNPT â†’ Jebel Ali","Direct Â· 8â€“10 days"],["Mundra â†’ Jebel Ali","Direct Â· 7â€“9 days"],["JNPT â†’ Dammam","Direct Â· 10â€“12 days"],["JNPT â†’ Jeddah","Direct Â· 12â€“14 days"],["Mundra â†’ Sohar","Direct Â· 8â€“10 days"]]},
{region:"Red Sea & East Africa",color:"#10b981",lanes:[["JNPT â†’ Mombasa","Direct Â· 14â€“16 days"],["Mundra â†’ Mombasa","Direct Â· 14â€“16 days"],["JNPT â†’ Dar es Salaam","Direct Â· 16â€“18 days"],["JNPT â†’ Port Sudan","Via hub Â· 18â€“22 days"],["JNPT â†’ Djibouti","Via hub Â· 16â€“20 days"]]},
{region:"Southern & West Africa",color:"#f59e0b",lanes:[["JNPT â†’ Durban","Direct Â· 18â€“22 days"],["JNPT â†’ Lagos","Via hub Â· 22â€“26 days"],["Mundra â†’ Lagos","Via hub Â· 22â€“26 days"],["JNPT â†’ Tema (Ghana)","Via hub Â· 24â€“28 days"],["JNPT â†’ Maputo","Via hub Â· 20â€“24 days"]]},
].map((r,i)=>(
<div key={i} style={{background:"rgba(255,255,255,.05)",borderRadius:12,padding:24,border:`1px solid rgba(255,255,255,.1)`}}>
<div style={{fontSize:11,fontWeight:700,color:r.color,textTransform:"uppercase",letterSpacing:2,marginBottom:16}}>{r.region}</div>
{r.lanes.map(([lane,time],j)=>(
<div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
<span style={{fontSize:13,color:"rgba(255,255,255,.85)"}}>{lane}</span>
<span style={{fontSize:11,color:"rgba(255,255,255,.45)",whiteSpace:"nowrap",marginLeft:8}}>{time}</span>
</div>))}
</div>))}
</div>
</div></section>

{/* â”€â”€ Recent Shipments â”€â”€ */}
<section style={{background:B.g1}}><div style={st.sec}>
<div style={{textAlign:"center",marginBottom:40}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:12}}>Shipment Activity</div>
<h2 style={st.h2}>Recent Export Shipments</h2>
<p style={st.sub}>A snapshot of cargo we have recently moved for Indian exporters.</p>
</div>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":m?"1fr":"repeat(3,1fr)",gap:16}}>
{[
{cargo:"Readymade Garments",route:"JNPT â†’ Jeddah",eq:"2 Ã— 40HC",transit:"Direct Â· 12 days",tag:"Textiles"},
{cargo:"Pharma API / Chemicals",route:"JNPT â†’ Mombasa",eq:"7 Ã— 20GP",transit:"Direct Â· 15 days",tag:"Pharmaceuticals"},
{cargo:"Engineering Goods",route:"JNPT â†’ Dammam",eq:"3 Ã— 40HC",transit:"Direct Â· 11 days",tag:"Engineering"},
{cargo:"Ceramic Tiles",route:"Mundra â†’ Jebel Ali",eq:"6 Ã— 40HC",transit:"Direct Â· 8 days",tag:"Building Materials"},
{cargo:"Food Products / FMCG",route:"Mundra â†’ Mombasa",eq:"4 Ã— 20GP",transit:"Direct Â· 14 days",tag:"Food & FMCG"},
{cargo:"Auto Components",route:"Chennai â†’ Durban",eq:"2 Ã— 40HC",transit:"Direct Â· 18 days",tag:"Automotive"},
].map((s,i)=>(
<div key={i} style={{...st.cd,padding:20}}>
<div style={{fontSize:10,fontWeight:700,color:B.primary,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8,background:`${B.primary}10`,display:"inline-block",padding:"3px 8px",borderRadius:4}}>{s.tag}</div>
<h4 style={{fontSize:15,fontWeight:600,color:B.dark,margin:"8px 0 4px"}}>{s.cargo}</h4>
<div style={{fontSize:13,color:B.primary,fontWeight:600,marginBottom:6}}>{s.route}</div>
<div style={{display:"flex",gap:16}}>
<span style={{fontSize:12,color:B.g5}}>{s.eq}</span>
<span style={{fontSize:12,color:B.g5}}>{s.transit}</span>
</div>
</div>))}
</div>
</div></section>

{/* â”€â”€ Core Services â”€â”€ */}
<section><div style={st.sec}>
<h2 style={st.h2}>Core Services</h2><p style={st.sub}>Full-service export logistics for Indian exporters shipping to the Gulf, Red Sea and Africa.</p>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:28,marginTop:48}}>
{[{icon:<I.Sh/>,t:"Export FCL Ocean Freight",d:"Full container load from JNPT, Mundra, Chennai and Cochin. Competitive rates on weekly services to the Gulf and Africa."},{icon:<I.Sd/>,t:"Customs Clearance & Documentation",d:"Expert handling of export documentation, customs procedures, and regulatory compliance â€” zero BL amendments."},{icon:<I.Gl/>,t:"End-to-End Freight Forwarding",d:"Complete logistics from factory to destination â€” inland transport, port handling, and destination delivery coordination."},{icon:<I.Tr/>,t:"Inland Transportation",d:"Factory-to-port pickup across Maharashtra, Gujarat and Tamil Nadu. GPS-tracked, timely vessel cut-off delivery."}].map((x,i)=>(
<div key={i} style={{...st.cd,textAlign:"center",padding:"40px 28px"}}>
<div style={{width:64,height:64,borderRadius:14,background:`${B.primary}08`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>{x.icon}</div>
<h3 style={{...st.h3,fontSize:18,marginBottom:10}}>{x.t}</h3><p style={{...st.bd,fontSize:14}}>{x.d}</p></div>))}
</div></div></section>

{/* â”€â”€ Carrier Network â”€â”€ */}
<section style={{background:B.g1}}><div style={st.sec}>
<div style={{textAlign:"center",marginBottom:40}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:12}}>Carrier Network</div>
<h2 style={st.h2}>Shipping Lines We Work With</h2>
<p style={st.sub}>Direct access to Tier-1 ocean carriers for competitive rates and reliable space on Gulf and Africa trade lanes.</p>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:14,justifyContent:"center",marginBottom:40}}>
{Object.entries(CARRIERS).map(([name])=><CarrierBadge key={name} name={name} size="md"/>)}
</div>
</div></section>

{/* â”€â”€ Why Exporters Choose Sattva â”€â”€ */}
<section><div style={st.sec}>
<h2 style={st.h2}>Why Exporters Choose Sattva</h2>
<p style={st.sub}>Precision, compliance, and long-term reliability â€” not just freight rates.</p>
<p style={{textAlign:"center",fontStyle:"italic",color:B.g7,marginTop:20,fontSize:14}}>"In international logistics, small mistakes cause big delays. Our systems prevent them."</p>
<div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:0,marginTop:40,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.05)"}}>
<div style={{background:`${B.primary}05`,padding:36}}>
<h4 style={{fontSize:14,fontWeight:700,color:B.primary,marginBottom:20}}>Sattva Global Logistics</h4>
{["Proactive tracking & regular updates","Documentation accuracy & compliance","Single point of contact","Transparent pricing","Structured pickup-to-vessel coordination","Long-term partnership mindset"].map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:14}}><div style={{flexShrink:0,marginTop:1}}><I.Ck/></div><span style={{fontSize:13,color:B.g7}}>{t}</span></div>)}
</div>
<div style={{background:"#fff",padding:36}}>
<h4 style={{fontSize:14,fontWeight:700,color:B.g5,marginBottom:20}}>Typical Freight Forwarder</h4>
{["Updates only when customer follows up","Higher paperwork error risk","Multiple contacts, inconsistent comm","Hidden or last-minute charges","Reactive, last-minute firefighting","Transaction-focused approach"].map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:14}}><div style={{flexShrink:0,marginTop:1}}><I.Wr/></div><span style={{fontSize:13,color:B.g5}}>{t}</span></div>)}
</div></div>
<CTA headline="Experience Logistics Done Right" st={st} I={I}/>
</div></section>

{/* â”€â”€ Process â”€â”€ */}
<section style={{background:B.g1}}><div style={st.sec}>
<h2 style={st.h2}>Our Process â€” Step-by-Step Export Flow</h2>
<p style={st.sub}>A structured approach from booking to departure.</p>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:28,marginTop:48}}>
{[{icon:<I.Cb/>,n:"01",t:"Assessment",d:"Cargo details, destination & planning."},{icon:<I.Sh/>,n:"02",t:"Booking",d:"Space secured with reliable carriers."},{icon:<I.Dc/>,n:"03",t:"Documentation",d:"Export docs verified for compliance."},{icon:<I.Tr/>,n:"04",t:"Pickup",d:"Safe movement to port/ICD."},{icon:<I.Sd/>,n:"05",t:"Customs",d:"Efficient clearance procedures."},{icon:<I.Gl/>,n:"06",t:"Departure",d:"On-schedule with tracking."}].map((x,i)=>(
<div key={i} style={{textAlign:"center"}}>
<div style={{width:44,height:44,borderRadius:"50%",background:B.primary,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,margin:"0 auto 14px"}}>{x.n}</div>
<div style={{width:64,height:64,borderRadius:14,background:`${B.primary}08`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>{x.icon}</div>
<h4 style={{fontSize:14,fontWeight:700,color:B.dark,marginBottom:6}}>{x.t}</h4>
<p style={{fontSize:12,color:B.g5,lineHeight:1.6}}>{x.d}</p></div>))}
</div>
<CTA headline="Let's Plan Your Next Shipment" st={st} I={I}/>
</div></section>
</>);}

/* â•â•â• ABOUT â•â•â• */
function AboutPage(){const go=useNavigate();return(
<div style={{paddingTop:68}}><Helmet><title>About Us | Sattva Global Logistics Mumbai</title><meta name="description" content="20+ years of export logistics experience. Sattva Global Logistics specialises in FCL shipments from Indian ports to the Middle East, Red Sea and Africa." /><link rel="canonical" href="https://www.sattvaglobal.in/about" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>About Us</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Built on <span style={{color:B.primary}}>Reliability</span>, Driven by <span style={{color:B.primary}}>Precision</span></h1>
<p style={{...st.bd,fontSize:17,marginTop:20,maxWidth:660}}>Sattva Global Logistics is an international freight forwarding company headquartered in Mumbai, with 20+ years of export logistics experience. We specialise in FCL shipments from Indian ports to the Middle East, Red Sea and Africa.</p>
</div></section>
<div style={st.sec}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:28}}>
{[{t:"Our Mission",d:"Documentation accuracy, transparent pricing, and proactive coordination â€” delivering freight forwarding that Indian exporters can depend on."},{t:"Mumbai Advantage",d:"Direct JNPT/Nhava Sheva access, strong carrier relationships, and deep Indian export regulation expertise built over 20+ years."},{t:"IMEA Network",d:"Partnerships across 40+ destinations in the Middle East, Red Sea corridor and Africa with shipping lines, overseas agents, and customs brokers."},{t:"Compliance First",d:"Systems designed to prevent documentation errors before they happen â€” zero BL amendments is our standard, not our target."}].map((x,i)=>
<div key={i} style={{...st.cd,borderTop:`3px solid ${B.primary}`}}><h3 style={{...st.h3,marginBottom:10}}>{x.t}</h3><p style={{...st.bd,fontSize:14}}>{x.d}</p></div>)}
</div>
<CTA headline="Partner with a Team That Delivers" st={st} I={I}/>
</div></div>);}

/* â•â•â• SERVICES â•â•â• */
function ServicesPage(){const go=useNavigate();
const data=[
{icon:<I.Sh/>,t:"Export FCL Ocean Freight",items:["Full container load from all major Indian ports","Competitive rates with Tier-1 shipping lines","Regular sailings to Gulf, Far East, Europe, Americas, Africa","Real-time container tracking","Equipment: GP, HC, Reefer, OT, FR, ISO Tank"]},
{icon:<I.Sd/>,t:"Customs Clearance & Documentation",items:["Complete export customs clearance at JNPT+","Shipping Bill, BL, Certificate of Origin","DGFT, Customs, FSSAI, BIS compliance","GST/IGST refund documentation","IMO hazardous cargo docs"]},
{icon:<I.Gl/>,t:"End-to-End Freight Forwarding",items:["Door-to-port and door-to-door","Multi-modal coordination","Cargo insurance","Destination clearance with overseas partners","Single point of contact"]},
{icon:<I.Tr/>,t:"Inland Transportation",items:["Factory to port/ICD/CFS pickup","Containerized + break-bulk transport","Trailer & flatbed arrangements","GPS-tracked vehicles","Timely vessel cut-off delivery"]},
];
return(
<div style={{paddingTop:68}}><Helmet><title>Export Freight Services | FCL Ocean Freight from India | Sattva Global Logistics</title><meta name="description" content="Export FCL ocean freight, customs clearance, end-to-end freight forwarding, and inland transportation from JNPT, Mundra, Chennai and Cochin." /><link rel="canonical" href="https://www.sattvaglobal.in/services" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Our Services</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Comprehensive <span style={{color:B.primary}}>Export Logistics</span></h1>
</div></section>
<div style={st.sec}><div style={{display:"grid",gap:32}}>
{data.map((x,i)=>(
<div key={i} style={{...st.cd,display:"grid",gridTemplateColumns:"auto 1fr",gap:28,alignItems:"start"}}>
<div style={{width:72,height:72,borderRadius:18,background:`${B.primary}08`,display:"flex",alignItems:"center",justifyContent:"center"}}>{x.icon}</div>
<div><h3 style={{...st.h3,marginBottom:14}}>{x.t}</h3>
{x.items.map((it,j)=><div key={j} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}><div style={{flexShrink:0,marginTop:2}}><I.Ck/></div><span style={{fontSize:14,color:B.g7}}>{it}</span></div>)}
</div></div>))}
</div><CTA st={st} I={I}/></div></div>);}

/* â•â•â• INDUSTRIES â•â•â• */
function IndustriesPage(){const go=useNavigate();
const d=[{t:"Textiles & Garments",d:"Time-sensitive shipments, GSP/COO documentation."},{t:"Pharmaceuticals",d:"Temperature-controlled logistics, GDP compliance."},{t:"Chemicals & Hazardous",d:"IMO-classified, MSDS documentation."},{t:"Engineering Goods",d:"Heavy cargo, ODC handling, project cargo."},{t:"Food & Agriculture",d:"FSSAI compliance, fumigation, phytosanitary."},{t:"Auto Components",d:"JIT delivery, precision stuffing."},{t:"Electronics",d:"High-value insurance, secure handling."},{t:"Machinery",d:"Project cargo, flat rack, heavy lift."}];
return(
<div style={{paddingTop:68}}><Helmet><title>Industries We Serve | Freight Forwarding for Indian Exporters | Sattva Global Logistics</title><meta name="description" content="Specialist freight forwarding for textiles, pharma, chemicals, engineering goods, food, auto components, electronics and machinery exporters from India." /><link rel="canonical" href="https://www.sattvaglobal.in/industries" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Industries</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Industries We Serve with <span style={{color:B.primary}}>Expertise</span></h1>
</div></section>
<div style={st.sec}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20}}>
{d.map((x,i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${B.primary}`}}><h3 style={{...st.h3,fontSize:17,marginBottom:6}}>{x.t}</h3><p style={{...st.bd,fontSize:13}}>{x.d}</p></div>)}
</div><CTA headline="Discuss Your Industry Needs" st={st} I={I}/></div></div>);}

/* â•â•â• KNOWLEDGE â•â•â• */
function KnowledgePage(){const go=useNavigate();
const[tab,setTab]=useState("incoterms");
const tabs=[["incoterms","Incoterms 2020"],["docs","Export Documents"],["fcl","FCL Ocean Freight"],["customs","Customs Clearance"],["containers","Container Guide"],["rates","Rate Components"]];

const incoterms=[
{code:"EXW",name:"Ex Works",risk:"Buyer bears all risk from seller's premises.",desc:"Seller makes goods available at their facility. Buyer handles everything: pickup, export clearance, freight, insurance, import clearance. Rarely used in Indian exports as seller can't control export compliance."},
{code:"FCA",name:"Free Carrier",risk:"Risk transfers when goods are handed to carrier.",desc:"Seller delivers goods cleared for export to the carrier nominated by buyer. Most flexible Incoterm. If delivery at seller's premises, seller loads. If elsewhere, seller delivers but unloading is buyer's responsibility."},
{code:"CPT",name:"Carriage Paid To",risk:"Risk transfers at origin, but seller pays freight to destination.",desc:"Seller pays freight to the named destination but risk transfers when goods are handed to the first carrier at origin. Buyer needs cargo insurance. Common in Indian export contracts."},
{code:"CIP",name:"Carriage & Insurance Paid To",risk:"Like CPT but seller must also arrange insurance.",desc:"Same as CPT but seller must obtain cargo insurance (minimum ICC-A coverage under Incoterms 2020). Cost is on seller. Risk still transfers at origin. Preferred when buyer wants insurance arranged by seller."},
{code:"DAP",name:"Delivered at Place",risk:"Seller bears risk until goods arrive at destination.",desc:"Seller delivers goods to a named destination, ready for unloading. Seller bears all transport risk and cost. Import clearance and duties are buyer's responsibility. Common for door-to-door contracts."},
{code:"DPU",name:"Delivered at Place Unloaded",risk:"Seller bears risk until goods are unloaded at destination.",desc:"Replaced DAT in Incoterms 2020. Seller delivers and unloads at the named destination. Only Incoterm where seller is responsible for unloading. Used for specific terminal/warehouse deliveries."},
{code:"DDP",name:"Delivered Duty Paid",risk:"Seller bears all risk and cost including import duties.",desc:"Maximum obligation on seller. Seller handles everything including import clearance and duties at destination. Most expensive for Indian exporters but simplifies life for foreign buyers. Be cautious of unknown import duty costs."},
{code:"FAS",name:"Free Alongside Ship",risk:"Risk transfers when goods are placed alongside the vessel.",desc:"Maritime only. Seller delivers goods alongside the vessel at the port of loading. Buyer handles loading, freight, insurance. Rarely used in Indian container trade; more common for bulk cargo."},
{code:"FOB",name:"Free on Board",risk:"Risk transfers when goods pass the ship's rail at loading port.",desc:"The most popular Incoterm in Indian exports. Seller delivers goods on board the vessel and handles export clearance. Buyer arranges and pays ocean freight and insurance. Clear risk transfer point at Indian port."},
{code:"CFR",name:"Cost and Freight",risk:"Risk transfers at loading port, but seller pays freight.",desc:"Seller pays ocean freight to destination port but risk transfers when goods are loaded on vessel at origin. Buyer should arrange cargo insurance. Very common in Indian textile and commodity exports."},
{code:"CIF",name:"Cost, Insurance & Freight",risk:"Like CFR but seller arranges marine insurance.",desc:"Seller pays freight and insurance to destination port. Under Incoterms 2020, minimum insurance is ICC-C (most basic). Risk still transfers at loading port. Popular in Indian export contracts but insurance coverage may be limited."},
];

const containers=[
{type:"20GP",name:"20' Standard",dim:"L: 5.9m Ã— W: 2.35m Ã— H: 2.39m",door:"W: 2.34m Ã— H: 2.28m",cap:"33.2 CBM / 28,200 kg",desc:"Most common. Ideal for heavy cargo like steel, chemicals, machinery, rice bags. Max payload ~21.7 tonnes due to road weight limits in India.",cargo:"Rice, chemicals, steel coils, machinery parts, cement bags"},
{type:"40GP",name:"40' Standard",dim:"L: 12.03m Ã— W: 2.35m Ã— H: 2.39m",door:"W: 2.34m Ã— H: 2.28m",cap:"67.7 CBM / 26,680 kg",desc:"Double the length of 20GP. Good for voluminous goods with moderate weight. Standard for most FCL shipments from India.",cargo:"Textiles, garments, furniture, auto parts, packaged food"},
{type:"40HC",name:"40' High Cube",dim:"L: 12.03m Ã— W: 2.35m Ã— H: 2.69m",door:"W: 2.34m Ã— H: 2.58m",cap:"76.3 CBM / 26,460 kg",desc:"Extra 30cm height vs 40GP. Most popular for voluminous cargo. Slightly higher freight but much better cube utilization. The go-to container for Indian garment exporters.",cargo:"Garments on hangers, cotton bales, voluminous goods, furniture"},
{type:"20RF",name:"20' Reefer",dim:"L: 5.44m Ã— W: 2.29m Ã— H: 2.27m",door:"W: 2.29m Ã— H: 2.26m",cap:"28.3 CBM / 27,400 kg",desc:"Temperature-controlled (-30Â°C to +30Â°C). Built-in refrigeration unit needs power (ship provides). Smaller internal dimensions due to insulation.",cargo:"Pharma products, frozen seafood, dairy, temperature-sensitive chemicals"},
{type:"40RH",name:"40' Reefer HC",dim:"L: 11.56m Ã— W: 2.29m Ã— H: 2.55m",door:"W: 2.29m Ã— H: 2.44m",cap:"67.5 CBM / 26,280 kg",desc:"Large reefer with high-cube height. Standard for perishable Indian exports. Requires pre-cooling and temperature monitoring throughout transit.",cargo:"Fresh fruits (grapes, mangoes), frozen shrimp, meat, pharma, flowers"},
{type:"20OT",name:"20' Open Top",dim:"L: 5.9m Ã— W: 2.35m Ã— H: 2.35m",door:"W: 2.34m Ã— H: 2.28m",cap:"32.5 CBM / 28,130 kg",desc:"Removable tarpaulin roof. Allows top-loading with crane. Used for tall cargo that won't fit through standard doors. Higher freight rates.",cargo:"Machinery, marble slabs, tall industrial equipment, project cargo"},
{type:"40OT",name:"40' Open Top",dim:"L: 12.03m Ã— W: 2.35m Ã— H: 2.35m",door:"W: 2.34m Ã— H: 2.28m",cap:"65.9 CBM / 26,630 kg",desc:"Longer open-top for oversized cargo. Crane-loadable. May incur Over-Height surcharges if cargo extends above container wall.",cargo:"Large machinery, long pipes, wind turbine components"},
{type:"20FR",name:"20' Flat Rack",dim:"L: 5.62m Ã— W: 2.24m Ã— H: 2.23m",door:"Open sides",cap:"N/A / 31,250 kg",desc:"Collapsible end walls, no sides or roof. For heavy, oversized cargo. Can be stacked when empty. Requires special lashing and securing.",cargo:"Trucks, bulldozers, transformers, heavy machinery, boats"},
{type:"40FR",name:"40' Flat Rack",dim:"L: 12.08m Ã— W: 2.42m Ã— H: 2.10m",door:"Open sides",cap:"N/A / 39,200 kg",desc:"Large flat rack for very heavy project cargo. Often used with Over-Dimensional Cargo (ODC) surcharges. Popular for Indian engineering/infrastructure exports.",cargo:"Generators, heavy vehicles, construction equipment, large fabrications"},
{type:"ISO Tank",name:"ISO Tank Container",dim:"L: 6.06m Ã— Ã˜: 1.52m",door:"Valve openings",cap:"21,000-26,000 litres",desc:"Stainless steel tank in ISO frame for liquid bulk. Can carry hazardous and non-hazardous liquids. Temperature control options available. Reusable.",cargo:"Chemicals, food-grade oils, wine, latex, pharmaceutical liquids"},
];

const rateComp=[
{name:"Ocean Freight (OF)",desc:"The base rate charged by the shipping line for transporting your container from origin port to destination port. Varies by trade lane, season, demand, and container type."},
{name:"Terminal Handling Charges â€“ Origin (THC-O)",desc:"Charged at the Indian port (JNPT, Mundra, etc.) for receiving the container, yard handling, and loading onto the vessel. Quoted in INR but converted to USD in freight quotes."},
{name:"Terminal Handling Charges â€“ Destination (THC-D)",desc:"Same as THC-O but at the destination port. Charged to the consignee/buyer in most cases. Varies significantly by country and port."},
{name:"Bill of Lading Fee (BL/DOC)",desc:"Shipping line's documentation fee for issuing the Bill of Lading. Some lines charge separately for surrender BL, telex release, or switch BL services."},
{name:"Container Freight Station (CFS) Charges",desc:"If your cargo goes through a CFS (common at JNPT), charges include: handling, storage, seal charges, and documentation at the CFS. Avoided if you do direct port delivery (DPD) or use ICD."},
{name:"Inland Haulage / Transport",desc:"Cost of moving the container from your factory/warehouse to the port, ICD, or CFS. Depends on distance, route, and vehicle type required."},
{name:"Customs Broker Fee",desc:"Your customs broker's professional fee for filing the Shipping Bill, managing customs examination, and ensuring compliance. Separate from ICEGATE filing fees."},
{name:"BAF/Bunker Adjustment Factor",desc:"Fuel surcharge to cover fluctuating bunker fuel costs. Applied as a fixed amount per container or as a percentage of ocean freight. Fluctuates monthly with oil prices. Currently a significant component of total freight."},
{name:"CAF/Currency Adjustment Factor",desc:"Protects the shipping line from currency exchange fluctuations. Applied as a percentage of OF. More common on trades where currencies are volatile."},
{name:"Peak Season Surcharge (PSS)",desc:"Applied during high-demand periods (typically Q3â€“Q4 for India-Europe/US trades). Lines announce PSS through GRI (General Rate Increase) notices."},
{name:"ISPS Surcharge",desc:"International Ship and Port Facility Security surcharge, mandated post-9/11. Applied at both origin and destination."},
{name:"Seal Charge",desc:"For the high-security bolt seal applied to the container. Mandatory for all export containers."},
{name:"Export Promotion Charges",desc:"Specific to Indian ports â€” charged by port authorities for export containers. Minimal amount but applies per container."},
];

return(
<div style={{paddingTop:68}}><Helmet><title>Export Knowledge Hub | Incoterms, FCL Guide, Container Types | Sattva Global Logistics</title><meta name="description" content="Comprehensive guides on Incoterms 2020, export documentation, FCL ocean freight process, customs clearance, container types, and freight rate components for Indian exporters." /><link rel="canonical" href="https://www.sattvaglobal.in/knowledge" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Knowledge Center</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Export <span style={{color:B.primary}}>Knowledge</span> Hub</h1>
<p style={{...st.bd,fontSize:17,marginTop:20,maxWidth:640}}>Comprehensive guides on Incoterms, documentation, freight procedures, container types, and rate structures â€” tailored for Indian exporters.</p>
</div></section>
<div style={st.sec}>
<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:32}}>
{tabs.map(([id,lb])=><button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:F,background:tab===id?B.primary:"#fff",color:tab===id?"#fff":B.g5,boxShadow:tab===id?`0 2px 8px ${B.primary}33`:"0 1px 3px rgba(0,0,0,.06)"}}>{lb}</button>)}
</div>

{tab==="incoterms"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>IncotermsÂ® 2020 â€” Complete Guide</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Incoterms define who pays for what, where risk transfers, and who handles documentation between seller and buyer. Published by the International Chamber of Commerce (ICC), the 2020 edition has 11 rules: 7 for any transport mode and 4 for sea/inland waterway only.</p>
<div style={{display:"grid",gap:16}}>
{incoterms.map((ic,i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${B.primary}`,padding:"20px 24px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
<div><span style={{fontSize:20,fontWeight:800,color:B.primary,fontFamily:FF}}>{ic.code}</span><span style={{fontSize:15,fontWeight:600,color:B.dark,marginLeft:10}}>{ic.name}</span></div>
{null}
</div>
<p style={{fontSize:13,color:B.amber,fontWeight:600,margin:"4px 0 8px"}}>{ic.risk}</p>
<p style={{...st.bd,fontSize:13}}>{ic.desc}</p>
</div>)}
</div>
</div>)}

{tab==="docs"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Export Document Templates</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Every export shipment requires a set of documents. We provide branded templates for your use. Download the XLSX templates, fill in your shipment details, and print.</p>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
{[["Commercial Invoice","The primary document for customs and payment. Lists goods, values, HS codes, buyer/seller details, Incoterms, and payment terms. Required for every export shipment.","Sattva_Export_Invoice_Template.xlsx"],
["Packing List","Details container contents: item descriptions, gross/net weights, dimensions, CBM, package counts. Used by customs and for cargo verification.","Sattva_Export_Packing_List_Template.xlsx"],
["Bill of Lading (BL Draft)","The title document for ocean cargo. Proves shipment, acts as receipt, and can be negotiable. Our draft template helps you verify BL details before finalization with the shipping line.","Sattva_BL_Draft_Template.xlsx"],
["Certificate of Origin","Certifies the country of manufacture. Required for preferential duty rates under trade agreements. Issued by local Chamber of Commerce or Export Promotion Council.","Sattva_Certificate_of_Origin_Draft.xlsx"],
["MSDS (Material Safety Data Sheet)","Mandatory for chemical/hazardous cargo. Provides 16-section safety information. Must accompany IMO-classified goods. Our template follows GHS format.","Sattva_MSDS_Template.xlsx"],
["Phytosanitary Certificate","Required for agricultural products, food items, and plant-based materials. Issued by the Plant Quarantine Authority of India before export.","Issued by govt authority"],
["FSSAI Certificate","Required for food product exports. Ensures compliance with food safety standards. Applied for through FSSAI portal.","Issued by FSSAI"],
].map(([title,desc,file],i)=><div key={i} style={{...st.cd,borderTop:`3px solid ${B.primary}`}}>
<h3 style={{...st.h3,fontSize:16,marginBottom:8}}>{title}</h3>
<p style={{fontSize:13,color:B.g5,lineHeight:1.6,marginBottom:12}}>{desc}</p>
<div style={{fontSize:12,color:B.primary,fontWeight:600}}>{file.endsWith(".xlsx")?"ðŸ“¥ XLSX Template Available":"ðŸ“‹ "+file}</div>
</div>)}
</div>
</div>)}

{tab==="fcl"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>How FCL Ocean Freight Works</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Full Container Load (FCL) means your cargo exclusively occupies an entire container. It's the most common method for Indian exports above 15 CBM volume. Here's the complete process:</p>
<div style={{display:"grid",gap:16}}>
{[["1. Booking Confirmation","Exporter (or freight forwarder) books space with the shipping line. Booking confirmation includes: vessel name, voyage number, sailing date, cut-off dates (documentation and cargo), and empty container pickup location."],
["2. Empty Container Collection","Container is picked up from the shipping line's container yard or depot (typically near the port â€” JNPT has yards in Uran, Panvel, Bhiwandi). You receive empty equipment and a seal."],
["3. Factory/Warehouse Stuffing","Container is transported to your factory or warehouse. Goods are loaded (stuffed) into the container following proper weight distribution. Photos of stuffing are taken for documentation. Container is sealed with a bolt seal."],
["4. Transport to Port / ICD / CFS","Sealed container moves to the port (JNPT/Mundra), Inland Container Depot (ICD like Tumb, Khodiyar), or Container Freight Station (CFS). Must arrive before the cargo cut-off deadline (usually 24â€“48 hrs before sailing)."],
["5. Shipping Bill Filing","Customs broker files the Shipping Bill electronically through ICEGATE (Indian Customs EDI system). Documents include: Invoice, Packing List, IEC, AD Code, HS Classification, FOB value, buyer details."],
["6. Customs Examination","Customs may select the container for physical examination (based on risk management system) or grant Let Export Order (LEO) directly. If examined, container is opened at the port/CFS, cargo verified, and re-sealed."],
["7. Let Export Order (LEO)","Once customs is satisfied, LEO is granted. This authorizes the port to load the container onto the vessel. The Shipping Bill is stamped and EGM (Export General Manifest) is filed by the shipping line."],
["8. Vessel Loading","Container is loaded onto the designated vessel during the vessel's port call. Stowage position is determined by the vessel planner based on weight, destination, and cargo type (reefer, hazardous, etc.)."],
["9. Ocean Transit","Vessel sails from Indian port to destination. Transit times: Gulf (5â€“10 days), Far East (12â€“20 days), Europe (18â€“25 days), USA East (25â€“35 days). You receive container tracking updates throughout."],
["10. Destination Arrival & Delivery","Container is discharged at destination port. Consignee handles import clearance, pays duties, and collects the container for delivery to their warehouse (door delivery if arranged)."],
].map(([title,desc],i)=><div key={i} style={{...st.cd,display:"grid",gridTemplateColumns:"auto 1fr",gap:16,alignItems:"start"}}>
<div style={{width:40,height:40,borderRadius:10,background:`${B.primary}08`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:B.primary,fontSize:15,fontFamily:FF}}>{i+1}</div>
<div><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:6}}>{title.replace(/^\d+\.\s/,"")}</h4><p style={{fontSize:13,color:B.g5,lineHeight:1.7}}>{desc}</p></div>
</div>)}
</div>
</div>)}

{tab==="customs"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Export Customs Clearance in India</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>All goods leaving India must be cleared through Indian Customs. The process is electronic (paperless) through the ICEGATE system. Here's the step-by-step process:</p>
<div style={{display:"grid",gap:16}}>
{[["Prerequisites","IEC (Import Export Code) from DGFT, AD Code registered with your bank, GST registration, Authorized Dealer bank account. Your customs broker must be licensed (CHA license from CBIC)."],
["Shipping Bill Filing via ICEGATE","Your CHA files the Shipping Bill electronically. It includes: exporter IEC, HS Code classification, FOB value in INR, quantity/weight, buyer details, port codes, Incoterms, IGST payment details (if applicable), and MEIS/RoDTEP scheme codes."],
["Document Submission","Supporting documents uploaded to ICEGATE: Commercial Invoice, Packing List, Export Contract/PO, Letter of Credit (if applicable), ARE-1 (for excisable goods), any product-specific certificates (FSSAI, drug license, CPCB NOC for hazardous)."],
["Risk Management System (RMS)","Customs' automated system evaluates the Shipping Bill. Based on risk parameters, it assigns: GREEN channel (no examination, direct LEO), YELLOW channel (document check only), or RED channel (physical examination required). ~80% of export Shipping Bills get green channel."],
["Physical Examination (if RED)","Container is opened at the port/CFS under customs supervision. Cargo is verified against documents: correct goods, correct quantity, no prohibited items, proper marking. After verification, container is re-sealed with a new customs seal."],
["Let Export Order (LEO)","Once cleared, customs grants LEO. This is the official permission for the cargo to leave India. The Shipping Bill status updates on ICEGATE. Port/CFS can now accept the container for loading."],
["Drawback & Incentives","After LEO, you can claim duty drawback (refund of customs/excise duties on inputs). Filed through ICEGATE. Amount credited to your bank account. Also: IGST refund for zero-rated exports, RoDTEP benefits."],
["Export General Manifest (EGM)","Filed by the shipping line/airline after vessel departure. Lists all cargo on board. Must match Shipping Bill details. EGM filing triggers the DBK (drawback) processing cycle."],
].map(([title,desc],i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${i<3?B.primary:B.green}`}}>
<h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:8}}>{title}</h4>
<p style={{fontSize:13,color:B.g5,lineHeight:1.7}}>{desc}</p>
</div>)}
</div>
</div>)}

{tab==="containers"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Container Type Guide â€” Dimensions & Specifications</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Choosing the right container is critical for cost efficiency and cargo safety. Here's a detailed guide to every container type used in Indian export trade.</p>
<div style={{display:"grid",gap:20}}>
{containers.map((c,i)=><div key={i} style={{...st.cd,overflow:"hidden"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
<div><span style={{fontSize:11,padding:"4px 10px",borderRadius:4,background:B.primary,color:"#fff",fontWeight:700,marginRight:8}}>{c.type}</span><span style={{fontSize:17,fontWeight:700,color:B.dark,fontFamily:FF}}>{c.name}</span></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}}>
<div style={{background:B.g1,padding:10,borderRadius:8}}><div style={{fontSize:10,fontWeight:600,color:B.g5,textTransform:"uppercase"}}>Internal Dimensions</div><div style={{fontSize:13,fontWeight:600,color:B.dark,marginTop:4}}>{c.dim}</div></div>
<div style={{background:B.g1,padding:10,borderRadius:8}}><div style={{fontSize:10,fontWeight:600,color:B.g5,textTransform:"uppercase"}}>Door Opening</div><div style={{fontSize:13,fontWeight:600,color:B.dark,marginTop:4}}>{c.door}</div></div>
<div style={{background:B.g1,padding:10,borderRadius:8}}><div style={{fontSize:10,fontWeight:600,color:B.g5,textTransform:"uppercase"}}>Capacity</div><div style={{fontSize:13,fontWeight:600,color:B.dark,marginTop:4}}>{c.cap}</div></div>
</div>
<p style={{fontSize:13,color:B.g5,lineHeight:1.7,marginBottom:8}}>{c.desc}</p>
<div style={{fontSize:12,color:B.primary,fontWeight:600}}>Common cargo: <span style={{color:B.g7,fontWeight:400}}>{c.cargo}</span></div>
</div>)}
</div>
</div>)}

{tab==="rates"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Freight Rate Components â€” Indian Export Context</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Understanding what goes into a freight quote helps you compare rates accurately and avoid surprise charges. Here's every component explained in the Indian context with typical ranges.</p>
<div style={{display:"grid",gap:16}}>
{rateComp.map((r,i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${i<5?B.primary:B.g3}`}}>
<h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:8}}>{r.name}</h4>
<p style={{fontSize:13,color:B.g5,lineHeight:1.7}}>{r.desc}</p>
</div>)}
</div>
</div>)}

<CTA headline="Have Questions? Our Experts Are Ready" st={st} I={I}/></div></div>);}

/* â•â•â• TESTIMONIALS â•â•â• */
function TestimonialsPage(){const go=useNavigate();
const d=[
{text:"Our buyers stopped raising discrepancy claims after we switched to Sattva. The documentation is always clean and the vessel bookings are never missed.",from:"Ravi M., Export Manager",co:"Garments Manufacturer, Mumbai",route:"JNPT â†’ Jebel Ali"},
{text:"Sattva handled every FSSAI certificate and fumigation requirement without us having to follow up even once. Our first Africa shipments went without a single customs hold.",from:"Haresh P., Proprietor",co:"Food Products Exporter, Surat",route:"Mundra â†’ Mombasa"},
{text:"Pharma exports need a forwarder who understands regulatory compliance, not just freight rates. Sattva has never missed a documentation deadline.",from:"Priya S., GM Logistics",co:"Pharma API Manufacturer, Thane",route:"JNPT â†’ Jeddah"},
{text:"Proactive updates at every milestone â€” we always know where our cargo is without having to call. That kind of transparency is rare in this industry.",from:"Anand K., Director",co:"Engineering Goods Exporter, Pune",route:"JNPT â†’ Dammam"},
{text:"Switched to Sattva after a bad experience with documentation errors on our previous forwarder. Not a single BL amendment in 14 months.",from:"Farida T., CFO",co:"Chemical Exporter, Ankleshwar",route:"Mundra â†’ Port Said"},
{text:"Their understanding of Indian customs procedures and DGFT compliance gave us confidence when we started exporting for the first time.",from:"Suresh N., MD",co:"Auto Components Manufacturer, Chennai",route:"Chennai â†’ Durban"},
];

const cases=[
{tag:"Readymade Garments Â· Mumbai",headline:"Zero BL amendments across 18 months for a Mumbai garment exporter shipping to the Gulf",challenge:"A mid-sized garments manufacturer from Andheri was regularly facing BL amendments and customs examination delays â€” costing them buyer penalties and L/C discrepancy charges on every second shipment.",solution:"Sattva implemented a pre-shipment documentation checklist aligned with their buyer's L/C terms, coordinated directly with their CHA for Shipping Bill filing, and set up structured pickup-to-vessel cut-off timelines.",stats:[["18 months","zero BL amendments"],["40HC / 20GP","JNPT â†’ Jebel Ali, weekly"],["100%","on-vessel before cut-off"]],quote:"Our buyers stopped raising discrepancy claims after we switched to Sattva. The documentation is always clean and the vessel bookings are never missed.",attr:"Export Manager, Garments Manufacturer, Mumbai"},
{tag:"Food Products / FMCG Â· Gujarat",headline:"Seamless FSSAI-compliant exports to East Africa for a Gujarat food products manufacturer",challenge:"A packaged food exporter from Surat was expanding into East Africa for the first time. The key challenge: FSSAI labelling compliance, fumigation certificates, and phytosanitary requirements that their previous forwarder had no experience handling.",solution:"Sattva managed end-to-end â€” coordinating fumigation at the warehouse, obtaining FSSAI export certificates, filing the Shipping Bill with correct HS codes to avoid customs holds at Mombasa, and arranging inland haulage from Surat to Mundra.",stats:[["Mundra â†’ Mombasa","primary trade lane"],["0 customs holds","across first 12 shipments"],["Full compliance","FSSAI + fumigation + COO"]],quote:"We were nervous about our first Africa shipments given the documentation complexity. Sattva handled every certificate and requirement without us having to follow up once.",attr:"Proprietor, Food Products Exporter, Surat"},
{tag:"Pharma API Â· Mumbai",headline:"Time-critical pharma API exports to the Red Sea corridor â€” with zero compliance failures",challenge:"A pharmaceutical API manufacturer from Thane needed a freight partner who could handle CDSCO export NOC, MSDS, dangerous goods declarations, and strict temperature-monitoring requirements during port dwell time.",solution:"Sattva coordinated all regulatory documentation, sourced reefer containers for temperature-sensitive consignments, and established a dedicated communication protocol ensuring the client received updates at every milestone.",stats:[["JNPT â†’ Jeddah","fortnightly, regular"],["100% GDP","cold chain compliance"],["Zero delays","CDSCO NOC + customs"]],quote:"Pharma exports require a forwarder who understands regulatory compliance, not just freight rates. Sattva has never missed a documentation deadline.",attr:"GM Logistics, Pharma API Manufacturer, Thane"},
];

return(
<div style={{paddingTop:68}}><Helmet><title>Client Testimonials | Indian Exporter Success Stories | Sattva Global Logistics</title><meta name="description" content="Real results from Indian exporters shipping garments, pharma, food, engineering goods and chemicals to the Middle East, Africa and beyond with Sattva Global Logistics." /><link rel="canonical" href="https://www.sattvaglobal.in/testimonials" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px",textAlign:"center"}}>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)",maxWidth:700,margin:"0 auto"}}>Trusted by Exporters Who <span style={{color:B.primary}}>Move the World</span></h1>
<p style={{...st.bd,fontSize:17,maxWidth:600,margin:"18px auto 0"}}>Real results from Indian exporters shipping to the Middle East, Africa and beyond.</p>
</section>

<div style={st.sec}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
{d.map((t,i)=>(
<div key={i} style={{...st.cd,display:"flex",flexDirection:"column",gap:12}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
<div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(x=><I.St key={x}/>)}</div>
<span style={{fontSize:11,background:`${B.primary}10`,color:B.primary,padding:"3px 8px",borderRadius:6,fontWeight:600}}>{t.route}</span>
</div>
<p style={{...st.bd,fontSize:14,fontStyle:"italic",flex:1}}>"{t.text}"</p>
<div>
<div style={{fontSize:13,fontWeight:600,color:B.dark}}>{t.from}</div>
<div style={{fontSize:12,color:B.g5}}>{t.co}</div>
</div>
</div>))}
</div>

<div style={{marginTop:64}}>
<h2 style={st.h2}>Client Success Stories</h2>
<p style={{...st.sub,marginBottom:48}}>How Indian exporters achieved documentation accuracy and shipment reliability with Sattva.</p>
<div style={{display:"grid",gap:32}}>
{cases.map((c,i)=>(
<div key={i} style={{...st.cd,borderLeft:`4px solid ${B.primary}`}}>
<div style={{fontSize:11,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>{c.tag}</div>
<h3 style={{...st.h3,fontSize:20,marginBottom:14}}>{c.headline}</h3>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:16}}>
<div><div style={{fontSize:12,fontWeight:600,color:B.g5,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>The Challenge</div><p style={{...st.bd,fontSize:13}}>{c.challenge}</p></div>
<div><div style={{fontSize:12,fontWeight:600,color:B.g5,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>What We Did</div><p style={{...st.bd,fontSize:13}}>{c.solution}</p></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
{c.stats.map(([n,l],j)=>(
<div key={j} style={{background:B.g1,borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
<div style={{fontSize:n.length>8?13:18,fontWeight:700,color:B.primary,fontFamily:FF}}>{n}</div>
<div style={{fontSize:11,color:B.g5,marginTop:4}}>{l}</div>
</div>))}
</div>
<div style={{background:`${B.primary}06`,borderRadius:10,padding:16}}>
<p style={{fontSize:14,fontStyle:"italic",color:B.g7,margin:"0 0 6px"}}>"{c.quote}"</p>
<div style={{fontSize:12,fontWeight:600,color:B.primary}}>â€” {c.attr}</div>
</div>
</div>))}
</div>
</div>
<CTA st={st} I={I}/>
</div></div>);}

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
<Route path="/" element={<HomePage/>}/>
<Route path="/about" element={<AboutPage/>}/>
<Route path="/services" element={<ServicesPage/>}/>
<Route path="/industries" element={<IndustriesPage/>}/>
<Route path="/knowledge" element={<KnowledgePage/>}/>
<Route path="/testimonials" element={<TestimonialsPage/>}/>
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




