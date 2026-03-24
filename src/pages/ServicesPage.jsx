import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";
export function ServicesPage({ st, I }){const go=useNavigate();
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



