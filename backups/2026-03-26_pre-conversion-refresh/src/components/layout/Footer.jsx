import { useNavigate } from "react-router-dom";
import { B } from "../../theme/tokens";

export function Footer({I}){const go=useNavigate();return(
<footer style={{background:B.dark,color:B.g3,padding:"56px 24px 28px"}}>
<div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:36}}>
<div><img src="/sattva-logo-white.png" alt="Sattva Global Logistics" onClick={()=>go("/")} style={{height:80,width:"auto",marginBottom:12,display:"block",cursor:"pointer"}}/><p style={{fontSize:13,lineHeight:1.7,color:B.g5}}>Reliable international freight forwarding from Mumbai to the world.</p></div>
<div><h4 style={{color:"#fff",fontSize:13,fontWeight:600,marginBottom:14}}>Links</h4>{["home","about","services","industries","testimonials","quote"].map(id=><div key={id} onClick={()=>go(id==="home"?"/":`/${id}`)} style={{fontSize:13,color:B.g5,marginBottom:8,cursor:"pointer"}}>{id.charAt(0).toUpperCase()+id.slice(1)}</div>)}</div>
<div><h4 style={{color:"#fff",fontSize:13,fontWeight:600,marginBottom:14}}>Services</h4>{["Export FCL Ocean Freight","Customs Clearance","Freight Forwarding","Inland Transport"].map(x=><div key={x} style={{fontSize:13,color:B.g5,marginBottom:8}}>{x}</div>)}</div>
<div><h4 style={{color:"#fff",fontSize:13,fontWeight:600,marginBottom:14}}>Contact</h4><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13}}><I.Pi/> Mumbai, India</div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13}}><I.Ma/> info@sattvaglobal.in</div><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}><I.Ph/> +91 9136 121 123</div></div>
</div>
<div style={{maxWidth:1200,margin:"40px auto 0",paddingTop:20,borderTop:"1px solid #334155",display:"flex",justifyContent:"space-between",fontSize:12,color:B.g5}}>
<span>{`© ${new Date().getFullYear()} Sattva Global Logistics`}</span>
<span onClick={()=>go("/admin")} style={{cursor:"pointer",opacity:.35,fontSize:11}}>Admin</span>
</div></footer>);}
