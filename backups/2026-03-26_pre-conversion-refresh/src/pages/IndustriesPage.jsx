import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";
export function IndustriesPage({ st, I }){const go=useNavigate();
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



