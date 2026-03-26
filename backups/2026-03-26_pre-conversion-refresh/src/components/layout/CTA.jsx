import { useNavigate } from "react-router-dom";
import { B, FF } from "../../theme/tokens";

export function CTA({headline,st,I}){const go=useNavigate();return(
<div style={{textAlign:"center",padding:"56px 24px",background:`linear-gradient(135deg,${B.primary}06,${B.primary}12)`,borderRadius:20,marginTop:56}}>
<h3 style={{fontSize:26,fontWeight:700,color:B.dark,fontFamily:FF,marginBottom:22}}>{headline||"Ready to Ship with Confidence?"}</h3>
<div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
<button onClick={()=>go("/quote")} style={st.bp}>Get a Freight Quote <I.Ar/></button>
<button onClick={()=>go("/quote")} style={st.bs}>Speak to a Logistics Expert</button>
</div></div>);}
