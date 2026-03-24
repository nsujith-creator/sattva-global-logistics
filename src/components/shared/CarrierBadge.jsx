import { CARRIERS } from "../../data/carriers";
import { F } from "../../theme/tokens";

export function CarrierBadge({name,size="md"}){
  const c=CARRIERS[name];if(!c)return null;
  if(size==="sm") return <span style={{fontSize:9,padding:"3px 8px",borderRadius:4,background:c.color,color:"#fff",fontWeight:700,fontFamily:F,letterSpacing:.5,display:"inline-flex",alignItems:"center",gap:4}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0020 17l-9-4-9 4c0 1.03.16 2.04.46 3"/></svg>{name}</span>;
  return(
    <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px",display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:90,height:48}}>
      <img src={c.logo} alt={name} style={{maxHeight:28,maxWidth:80,objectFit:"contain",display:"block"}}
        onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}/>
      <span style={{display:"none",fontSize:11,fontWeight:700,color:c.color,alignItems:"center"}}>{name}</span>
    </div>
  );
}
