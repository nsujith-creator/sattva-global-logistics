import { useState } from "react";
import { COUNTRIES } from "../../data/countries";
import { B, F } from "../../theme/tokens";

export function PhoneField({value,onChange,error,onError,st}){
  const[sel,setSel]=useState(COUNTRIES[0]);
  const[num,setNum]=useState("");
  const[open,setOpen]=useState(false);
  const[search,setSearch]=useState("");
  const[touched,setTouched]=useState(false);

  const filtered=search?COUNTRIES.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.dial.includes(search)):COUNTRIES;

  const validate=(n,country,isBlur=false)=>{
    if(!n) return "";
    const digits=n.replace(/\s/g,"");
    if(!digits) return "";

    // India-specific logic: only error immediately if starts with 0-5
    // Otherwise wait for blur to check full length
    if(country.dial==="+91"){
      if(/^[0-5]/.test(digits)) return "Indian numbers must start with 6, 7, 8 or 9";
      if(isBlur && digits.length>0 && digits.length!==10) return "Invalid India number. Expected: 10 digits starting with 6-9";
      if(isBlur && digits.length===10 && !country.pattern.test(digits)) return `Invalid ${country.name} number. Expected: ${country.hint}`;
      return "";
    }

    // For other countries: only validate on blur
    if(!isBlur) return "";
    if(!country.pattern.test(digits)) return `Invalid ${country.name} number. Expected: ${country.hint}`;
    return "";
  };

  const handleNum=(v)=>{
    const clean=v.replace(/[^\d\s]/g,"");
    setNum(clean);
    setTouched(true);
    const err=validate(clean,sel,false); // not blur — only catch starts-with-0-5
    onError(err);
    onChange(`${sel.dial} ${clean}`);
  };

  const handleCountry=(country)=>{
    setSel(country);setOpen(false);setSearch("");
    if(num){
      const err=validate(num,country,false);
      onError(err);
      onChange(`${country.dial} ${num}`);
    }
  };

  const handleBlur=()=>{
    setTouched(true);
    const err=validate(num,sel,true); // blur — check full validation
    onError(err);
  };

  const fieldErr=touched?validate(num,sel,false):"";

  return(
  <div style={{position:"relative"}}>
  <div style={{display:"flex",gap:0,border:`1.5px solid ${(error||fieldErr)?B.red:B.g3}`,borderRadius:8,overflow:"visible",background:"#fff"}}>
    <button type="button" onClick={()=>setOpen(o=>!o)}
      style={{display:"flex",alignItems:"center",gap:6,padding:"0 10px",background:"#f8fafc",border:"none",borderRight:`1px solid ${B.g3}`,cursor:"pointer",fontSize:13,fontFamily:F,fontWeight:600,color:B.dark,whiteSpace:"nowrap",minWidth:96,height:42,borderRadius:"7px 0 0 7px",flexShrink:0}}>
      <span style={{fontSize:18,lineHeight:1}}>{sel.flag}</span>
      <span style={{color:B.g5}}>{sel.dial}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{marginLeft:2,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}><path d="M2 3l3 4 3-4" stroke={B.g5} strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
    <input
      type="tel"
      value={num}
      onChange={e=>handleNum(e.target.value)}
      onBlur={handleBlur}
      placeholder={`${sel.hint}`}
      style={{flex:1,border:"none",outline:"none",padding:"11px 12px",fontSize:14,fontFamily:F,background:"transparent",minWidth:0}}
    />
  </div>
  {open&&(
  <div style={{position:"absolute",top:"100%",left:0,zIndex:9999,background:"#fff",border:`1px solid ${B.g3}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",width:280,maxHeight:280,overflow:"hidden",display:"flex",flexDirection:"column",marginTop:4}}>
    <div style={{padding:"8px 10px",borderBottom:`1px solid ${B.g1}`}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search country..." style={{...st.inp,fontSize:13,padding:"7px 10px"}}/>
    </div>
    <div style={{overflowY:"auto",flex:1}}>
    {filtered.map(c=>(
      <div key={c.c} onClick={()=>handleCountry(c)}
        style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",cursor:"pointer",background:sel.c===c.c?`${B.primary}08`:"#fff",fontSize:13,fontFamily:F}}
        onMouseEnter={e=>e.currentTarget.style.background=`${B.primary}06`}
        onMouseLeave={e=>e.currentTarget.style.background=sel.c===c.c?`${B.primary}08`:"#fff"}>
        <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>{c.flag}</span>
        <span style={{flex:1,color:B.dark,fontWeight:500}}>{c.name}</span>
        <span style={{color:B.g5,fontSize:12}}>{c.dial}</span>
      </div>
    ))}
    </div>
  </div>)}
  {(error||fieldErr)&&<div style={{fontSize:11,color:B.red,marginTop:3}}>{error||fieldErr}</div>}
  </div>);
}
