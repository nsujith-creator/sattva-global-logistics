import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { CarrierBadge } from "../components/shared/CarrierBadge";
import { CARRIERS } from "../data/carriers";
import { B, FF } from "../theme/tokens";
import { useIsMobile } from "../hooks/useIsMobile";
export function HomePage({ st, I }){const go=useNavigate();const m=useIsMobile();return(<><Helmet><title>Freight Forwarder Mumbai | Export to Middle East &amp; Africa | Sattva Global Logistics</title><meta name="description" content="Mumbai's most reliable freight forwarder for FCL exports to Middle East, Red Sea, and Africa. 20+ years experience. JNPT, Mundra, Chennai, Cochin." /><link rel="canonical" href="https://www.sattvaglobal.in/" /></Helmet>
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



