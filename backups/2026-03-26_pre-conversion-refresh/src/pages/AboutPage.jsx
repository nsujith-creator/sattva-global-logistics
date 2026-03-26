import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";
export function AboutPage({ st, I }){const go=useNavigate();return(
<div style={{paddingTop:68}}><Helmet><title>About Us | Sattva Global Logistics Mumbai</title><meta name="description" content="20+ years of export logistics experience. Sattva Global Logistics specialises in FCL shipments from Indian ports to the Middle East, Red Sea and Africa." /><link rel="canonical" href="https://www.sattvaglobal.in/about" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>About Us</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Built on <span style={{color:B.primary}}>Reliability</span>, Driven by <span style={{color:B.primary}}>Precision</span></h1>
<p style={{...st.bd,fontSize:17,marginTop:20,maxWidth:660}}>Sattva Global Logistics is an international freight forwarding company headquartered in Mumbai, with 20+ years of export logistics experience. We specialise in FCL shipments from Indian ports to the Middle East, Red Sea and Africa.</p>
</div></section>
<div style={st.sec}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:28}}>
{[{t:"Our Mission",d:"Documentation accuracy, transparent pricing, and proactive coordination — delivering freight forwarding that Indian exporters can depend on."},{t:"Mumbai Advantage",d:"Direct JNPT/Nhava Sheva access, strong carrier relationships, and deep Indian export regulation expertise built over 20+ years."},{t:"IMEA Network",d:"Partnerships across 40+ destinations in the Middle East, Red Sea corridor and Africa with shipping lines, overseas agents, and customs brokers."},{t:"Compliance First",d:"Systems designed to prevent documentation errors before they happen — zero BL amendments is our standard, not our target."}].map((x,i)=>
<div key={i} style={{...st.cd,borderTop:`3px solid ${B.primary}`}}><h3 style={{...st.h3,marginBottom:10}}>{x.t}</h3><p style={{...st.bd,fontSize:14}}>{x.d}</p></div>)}
</div>
<CTA headline="Partner with a Team That Delivers" st={st} I={I}/>
</div></div>);}



