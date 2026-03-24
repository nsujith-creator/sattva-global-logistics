import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B, FF } from "../theme/tokens";
export function TestimonialsPage({ st, I }){const go=useNavigate();
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



