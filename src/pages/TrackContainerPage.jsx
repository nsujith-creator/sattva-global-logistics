import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { B, F, FF } from "../theme/tokens";
import { useIsMobile } from "../hooks/useIsMobile";
import { trackShipment } from "../api/tracking";
import { waLink } from "../utils/links";

/* ─── Static data ──────────────────────────────────────────────── */

const EVENT_LABELS = {
  EMSH:"Empty to Shipper", GTIN:"Gate In", GTOU:"Gate Out",
  LOAD:"Loaded on Board",  DEPA:"Vessel Departed", ARRV:"Vessel Arrived",
  DISC:"Discharged",       AVDP:"Available for Delivery", DLVR:"Delivered",
};

const STATUS_LABEL = {
  NEW:"Tracking Started", INPROGRESS:"Tracking in Progress",
  BOOKED:"Booked", LOADED:"Loaded at Port",
  SAILING:"Sailing", ARRIVED:"Arrived", DISCHARGED:"Discharged", UNTRACKED:"Untracked",
};

const CARRIERS = [
  {scac:"",     name:"Auto-detect / I don't know"},
  {scac:"MAEU", name:"Maersk Line"},
  {scac:"MSCU", name:"MSC Mediterranean"},
  {scac:"CMDU", name:"CMA CGM"},
  {scac:"HLCU", name:"Hapag-Lloyd"},
  {scac:"ONEY", name:"ONE"},
  {scac:"EGLV", name:"Evergreen Marine"},
  {scac:"COSU", name:"COSCO Shipping"},
  {scac:"YMLU", name:"Yang Ming"},
  {scac:"ZIMU", name:"ZIM Integrated"},
  {scac:"OOLU", name:"OOCL"},
  {scac:"PABV", name:"PIL"},
];

const TYPE_LABEL = {DC:"Dry", HC:"High Cube", RF:"Reefer", OT:"Open Top", FR:"Flat Rack"};

/* ─── Helpers ──────────────────────────────────────────────────── */

function fmtDate(iso){
  if(!iso) return "—";
  try{ return new Date(iso).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); }
  catch{ return iso; }
}

function fmtDateShort(iso){
  if(!iso) return "—";
  try{ return new Date(iso).toLocaleDateString("en-IN",{day:"numeric",month:"short"}); }
  catch{ return iso; }
}

function carrierName(scac){
  return CARRIERS.find(c=>c.scac===scac)?.name || scac || "Unknown";
}

function buildWA(trackingNumber, carrier, status){
  const msg=[
    "Hi Sattva, I checked this shipment on your website.",
    "",
    `Tracking number: ${trackingNumber}`,
    `Carrier: ${carrierName(carrier)}`,
    `Status shown: ${STATUS_LABEL[status]||status||"Unknown"}`,
    "",
    "Please help me understand the shipment status.",
  ].join("\n");
  return waLink(msg);
}

/* ─── Shared style constants (mockup-derived) ───────────────────── */

const navy  = "#050A30";
const blue  = "#024AAB";
const teal  = "#00C9A7";
const gold  = "#f5a623";
const muted = "#6b7390";
const line  = "#e6e9f2";
const ink   = "#1a2035";
const sky   = "#5CB6F9";
const trkGreen   = "#14a05a";
const trkGreenBg = "#e9f8f0";
const trkAmber   = "#e8a020";
const trkAmberBg = "#fff8ec";

const card = {
  background:"#fff",
  borderRadius:18,
  boxShadow:"0 10px 40px rgba(5,10,48,.10)",
  padding:36,
  border:"1px solid rgba(5,10,48,.05)",
};

const inputStyle = {
  width:"100%",padding:"15px 16px",fontFamily:F,fontSize:15,
  border:`1.5px solid ${line}`,borderRadius:12,background:"#fbfcfe",color:ink,
  outline:"none",boxSizing:"border-box",appearance:"none",
  transition:"border-color .15s, box-shadow .15s",
};

const labelStyle = {
  display:"block",fontSize:12.5,fontWeight:600,letterSpacing:".02em",color:navy,marginBottom:7,
};

const btnPrimary = {
  display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",
  fontFamily:F,fontSize:15.5,fontWeight:600,padding:"16px 20px",
  border:"none",borderRadius:12,cursor:"pointer",color:"#fff",
  background:blue,boxShadow:"0 6px 18px rgba(2,74,171,.30)",
  transition:"transform .12s, background .12s",
};

const btnWA = {
  ...btnPrimary,
  background:B.whatsapp,boxShadow:"0 6px 18px rgba(37,211,102,.30)",
};

/* ─── SVG icons ─────────────────────────────────────────────────── */

const ArrowRight = ()=>(
  <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
    <path d="M1 6h13M10 1l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowLeft = ()=>(
  <svg width="14" height="12" viewBox="0 0 16 12" fill="none">
    <path d="M15 6H2M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckSm = ()=>(
  <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
    <path d="M1 4.5L4.5 8 11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WASvg = ()=>(
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.7-.2 1.5z"/>
  </svg>
);

const ContainerIcon = ()=>(
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="7" width="18" height="12" rx="2" stroke={blue} strokeWidth="2"/>
    <path d="M8 7v12M16 7v12" stroke={blue} strokeWidth="1.6"/>
  </svg>
);

const BLIcon = ()=>(
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="7" width="18" height="12" rx="2" stroke={blue} strokeWidth="2"/>
    <path d="M3 11h18" stroke={blue} strokeWidth="2"/>
  </svg>
);

const WarnIcon = ()=>(
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 8v5" stroke={trkAmber} strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="12" cy="16.5" r="1.2" fill={trkAmber}/>
    <path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke={trkAmber} strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);

const ShipIcon = ({color="#024AAB"})=>(
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M4 15h16l-2 4H6l-2-4z" fill={color}/>
    <path d="M8 15V9h8v6" stroke={color} strokeWidth="1.8"/>
    <path d="M12 9V6" stroke={teal} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

/* ─── Sub-components ────────────────────────────────────────────── */

function RouteRail({pct, tsCount}){
  const markerPct = Math.min(Math.max(pct,2),97);
  const tsPct = tsCount>0 ? Math.min(markerPct+20,85) : null;
  return(
    <div style={{position:"relative",height:38,margin:"4px 0 8px"}}>
      {/* rail */}
      <div aria-hidden="true" style={{position:"absolute",left:0,right:0,top:17,height:4,borderRadius:99,background:line}}/>
      {/* fill */}
      <div aria-hidden="true" style={{position:"absolute",left:0,top:17,height:4,width:`${markerPct}%`,borderRadius:99,background:`linear-gradient(90deg,${blue},${teal})`}}/>
      {/* start dot */}
      <div aria-hidden="true" style={{position:"absolute",left:0,top:19,transform:"translateY(-50%)",width:10,height:10,borderRadius:"50%",background:blue}}/>
      {/* end dot */}
      <div aria-hidden="true" style={{position:"absolute",right:0,top:19,transform:"translateY(-50%)",width:10,height:10,borderRadius:"50%",background:line,border:"2px solid #cfd5e6"}}/>
      {/* T/S diamond */}
      {tsPct!=null&&<>
        <div aria-hidden="true" style={{position:"absolute",left:`${tsPct}%`,top:-6,transform:"translateX(-50%)",fontSize:10.5,fontWeight:600,letterSpacing:".08em",color:gold,whiteSpace:"nowrap"}}>
          {tsCount} T/S
        </div>
        <div aria-hidden="true" style={{position:"absolute",left:`${tsPct}%`,top:17,transform:"translate(-50%,-50%) rotate(45deg)",width:11,height:11,background:"#fff",border:`2px solid ${gold}`,borderRadius:2}}/>
      </>}
      {/* ship marker */}
      <div aria-hidden="true" style={{position:"absolute",left:`${markerPct}%`,top:19,transform:"translate(-50%,-50%)",width:30,height:30,borderRadius:"50%",background:"#fff",border:`2px solid ${teal}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 10px rgba(0,201,167,.35)`}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M4 15h16l-2 4H6l-2-4z" fill={teal}/>
          <path d="M8 15V10h8v5" stroke={teal} strokeWidth="1.8"/>
        </svg>
      </div>
      <p className="sr-only">{markerPct}% of voyage complete</p>
    </div>
  );
}

function Timeline({movements}){
  return(
    <ol style={{listStyle:"none",position:"relative",paddingLeft:30,margin:"0 0 30px",padding:"0 0 0 30px"}}>
      {/* vertical line */}
      <div aria-hidden="true" style={{position:"absolute",left:9,top:10,bottom:10,width:2,background:line}}/>
      {movements.map((mv,i)=>{
        const isAct = mv.status==="ACT";
        const label = EVENT_LABELS[mv.event]||mv.event;
        const prevVessel = i>0?movements[i-1]?.vessel?.name:null;
        const showVessel = mv.vessel?.name && mv.vessel.name!==prevVessel;
        return(
          <li key={i} style={{position:"relative",paddingBottom:i===movements.length-1?0:24}}>
            {/* dot */}
            <div aria-hidden="true" style={{position:"absolute",left:-30,top:4,width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isAct?trkGreen:"#fff",border:isAct?`2px solid ${trkGreen}`:"2px dashed #b9c1d9"}}>
              {isAct&&<CheckSm/>}
            </div>
            {/* head */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12}}>
              <span style={{fontWeight:600,fontSize:14.5,color:isAct?navy:muted}}>
                {label}
                {!isAct&&<span style={{fontSize:10.5,fontWeight:600,letterSpacing:".06em",color:"#a4abc4",textTransform:"uppercase",marginLeft:6}}>Est</span>}
              </span>
              <span style={{fontSize:12.5,color:muted,whiteSpace:"nowrap"}}>{fmtDateShort(mv.timestamp)}</span>
            </div>
            <div style={{fontSize:13,color:muted,marginTop:2}}>
              {mv.location?.name}{mv.location?.country?.code?`, ${mv.location.country.code}`:""}
            </div>
            {showVessel&&(
              <div style={{fontSize:12.5,color:teal,fontWeight:500,marginTop:2}}>
                {mv.vessel.name}{mv.voyage?` · ${mv.voyage}`:""}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultCard({shipment, trackingNumber, carrier, onReset}){
  const route   = shipment.route??{};
  const pol     = route.port_of_loading?.location??{};
  const pod     = route.port_of_discharge??{};
  const podLoc  = pod.location??{};
  const containers = shipment.containers??[];
  const container  = containers[0]??{};
  const movements  = container.movements??[];
  const status  = shipment.status??"NEW";
  const pct     = route.transit_percentage??0;
  const tsCount = route.ts_count??0;
  const cname   = shipment.carrier?.name||carrierName(carrier);
  const isDelayed = pod.date_of_discharge&&pod.date_of_discharge_initial&&
    pod.date_of_discharge!==pod.date_of_discharge_initial;
  const waHref  = buildWA(trackingNumber, carrier, status);

  return(
    <div style={{maxWidth:720,margin:"0 auto",padding:"0 20px",marginTop:-96,position:"relative",zIndex:5}}>
      <div style={card}>
        {/* status + carrier */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:26,flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:7,background:trkGreenBg,color:trkGreen,fontSize:13,fontWeight:600,padding:"7px 14px",borderRadius:999}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:trkGreen,boxShadow:`0 0 0 3px rgba(20,160,90,.18)`}}/>
            {STATUS_LABEL[status]||status}
          </span>
          {isDelayed&&(
            <span style={{display:"inline-flex",alignItems:"center",gap:7,background:trkAmberBg,color:trkAmber,fontSize:13,fontWeight:600,padding:"7px 14px",borderRadius:999}}>
              ⚠ Delay Detected
            </span>
          )}
          <span style={{fontFamily:FF,fontWeight:700,fontSize:14,letterSpacing:".14em",color:navy}}>{cname}</span>
        </div>

        {/* route */}
        <div style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:14}}>
          <div>
            <div style={{fontFamily:FF,fontWeight:700,fontSize:"clamp(19px,3.4vw,26px)",color:navy,letterSpacing:".01em",lineHeight:1.15}}>
              {pol.name||"—"}<span style={{color:sky,fontSize:".7em",fontWeight:600,marginLeft:4}}>{pol.country?.code}</span>
            </div>
            <div style={{fontSize:12.5,color:muted,marginTop:4}}>ETD · <b style={{color:ink,fontWeight:600}}>{fmtDateShort(route.port_of_loading?.date_of_loading)}</b></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:FF,fontWeight:700,fontSize:"clamp(19px,3.4vw,26px)",color:navy,letterSpacing:".01em",lineHeight:1.15}}>
              {podLoc.name||"—"}<span style={{color:sky,fontSize:".7em",fontWeight:600,marginLeft:4}}>{podLoc.country?.code}</span>
            </div>
            <div style={{fontSize:12.5,color:isDelayed?trkAmber:muted,marginTop:4}}>
              ETA · <b style={{color:isDelayed?trkAmber:ink,fontWeight:600}}>{fmtDateShort(pod.date_of_discharge)}</b>
              {isDelayed&&<span style={{fontSize:11,marginLeft:4,fontWeight:400}}>was {fmtDateShort(pod.date_of_discharge_initial)}</span>}
            </div>
          </div>
        </div>

        <RouteRail pct={pct} tsCount={tsCount}/>
        <div style={{fontSize:12.5,color:muted,textAlign:"right",marginBottom:22}}>
          <b style={{color:teal,fontWeight:600}}>{pct}%</b> of voyage complete
        </div>

        {/* container chip */}
        {container.number&&(
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:"#f7f9fd",border:`1px solid ${line}`,borderRadius:12,padding:"12px 16px",marginBottom:30,fontSize:13.5}}>
            <ContainerIcon/>
            <span style={{color:muted}}>BL</span>
            <span style={{fontWeight:600,color:navy,letterSpacing:".05em"}}>{trackingNumber}</span>
            <span style={{color:"#c3c9dd"}}>·</span>
            <span style={{fontWeight:600,color:navy,letterSpacing:".05em"}}>{container.number}</span>
            {container.size&&<><span style={{color:"#c3c9dd"}}>·</span><span style={{color:muted}}>{container.size}ft</span></>}
            {container.type&&<><span style={{color:"#c3c9dd"}}>·</span><span style={{color:muted}}>{TYPE_LABEL[container.type]||container.type}</span></>}
          </div>
        )}

        {/* legend */}
        {movements.length>0&&<>
          <div style={{display:"flex",gap:20,fontSize:12,color:muted,marginBottom:26,paddingLeft:2}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:7}}><span style={{width:11,height:11,borderRadius:"50%",background:trkGreen}}/> Actual</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:7}}><span style={{width:11,height:11,borderRadius:"50%",border:"2px dashed #b9c1d9"}}/> Estimated</span>
          </div>
          <h3 style={{fontFamily:FF,fontWeight:700,fontSize:17,color:navy,marginBottom:18}}>Shipment Movements</h3>
          <Timeline movements={movements}/>
        </>}

        {/* insight + WA CTA */}
        <div style={{background:"linear-gradient(135deg,#f2f6ff,#effcf9)",border:"1px solid #dfe8f8",borderRadius:14,padding:24,textAlign:"center"}}>
          <p style={{fontStyle:"italic",color:navy,fontSize:14.5,lineHeight:1.65,marginBottom:18}}>
            Tracking tells you where the shipment is. Sattva helps you understand what it means, what can go wrong next, and what action to take.
          </p>
          <a href={waHref} target="_blank" rel="noopener noreferrer"
            style={{...btnWA,textDecoration:"none",display:"flex"}}>
            <WASvg/> Discuss this shipment on WhatsApp
          </a>
          <button onClick={onReset}
            style={{display:"block",textAlign:"center",marginTop:18,fontSize:13.5,color:blue,fontWeight:500,fontFamily:F,background:"none",border:"none",cursor:"pointer",width:"100%"}}>
            ← Track another shipment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */

export function TrackContainerPage({st}){
  const m = useIsMobile();
  const [step,   setStep]   = useState("input");
  const [trk,    setTrk]    = useState("");
  const [car,    setCar]    = useState("");
  const [name,   setName]   = useState(()=>sessionStorage.getItem("sg_track_name")||"");
  const [wa,     setWa]     = useState(()=>sessionStorage.getItem("sg_track_wa")||"");
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [apiErr, setApiErr] = useState("");

  function reset(){
    setStep("input"); setTrk(""); setCar("");
    setErrors({}); setResult(null); setApiErr("");
  }

  function validateInput(){
    if(!trk.trim()){ setErrors({trk:"Enter a BL, booking, or container number"}); return false; }
    setErrors({}); return true;
  }

  function validateGate(){
    const e={};
    if(!name.trim()) e.name="Required";
    if(!wa.trim()||wa.replace(/\D/g,"").length<7) e.wa="Enter a valid WhatsApp number";
    setErrors(e); return !Object.keys(e).length;
  }

  async function doTrack(){
    setStep("loading"); setApiErr("");
    try{
      const res = await trackShipment({trackingNumber:trk.trim(),carrier:car,name:name.trim(),whatsapp:wa.trim()});
      if(!res.success) throw new Error(res.error||"Tracking failed");
      const data = res.data;
      if(data?.error==="tracking_unavailable"||!data?.shipment){ setStep("error"); return; }
      const sh = data.shipment;
      const containers = sh.containers??[];
      const hasMovements = containers.some(c=>(c.movements??[]).length>0);
      const status = sh.status??"NEW";
      setResult({shipment:sh});
      setStep(!hasMovements&&["NEW","INPROGRESS"].includes(status)?"pending":"result");
    }catch(err){
      setApiErr(err.message||"Something went wrong. Please try again.");
      setStep("error");
    }
  }

  function handleInputSubmit(){
    if(!validateInput()) return;
    if(name.trim()&&wa.replace(/\D/g,"").length>=7){ doTrack(); }
    else{ setStep("gate"); }
  }

  function handleGateSubmit(){
    if(!validateGate()) return;
    sessionStorage.setItem("sg_track_name",name.trim());
    sessionStorage.setItem("sg_track_wa",wa.trim());
    doTrack();
  }

  const waFallback = buildWA(trk||"—", car, null);

  /* ── input field focus ring ── */
  const focusCss=`
    .sg-inp:focus{border-color:${blue}!important;box-shadow:0 0 0 3px rgba(2,74,171,.12)!important;background:#fff!important;}
    .sg-inp::placeholder{color:#a4abc4}
    .sg-select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7390' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;}
    .sg-btn:focus-visible{outline:3px solid ${blue};outline-offset:2px;}
    .sg-btn:active{transform:translateY(1px);}
    @keyframes sg-spin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.sg-ring{animation:none!important}}
  `;

  /* stage wrapper: max 720px centred, padding 0 20px */
  const stage={maxWidth:720,margin:"0 auto",padding:"0 20px"};

  return(
    <div style={{paddingTop:68,background:"#f4f6fb",minHeight:"100vh"}}>
      <Helmet>
        <title>Track Your Container | Sattva Global Logistics</title>
        <meta name="description" content="Track your FCL container, BL, or booking number across major carriers. Sattva helps you interpret shipment status, delays, and next steps."/>
        <link rel="canonical" href="https://www.sattvaglobal.in/track-container"/>
      </Helmet>
      <style>{focusCss}</style>

      {/* ── HERO ── */}
      <section style={{background:navy,color:"#fff",position:"relative",overflow:"hidden",padding:m?"52px 20px 130px":"72px 24px 150px"}}>
        {/* dot grid */}
        <div aria-hidden="true" style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(92,182,249,.16) 1.2px,transparent 1.3px)",backgroundSize:"26px 26px",maskImage:"radial-gradient(ellipse 80% 90% at 60% 40%,#000 30%,transparent 75%)",WebkitMaskImage:"radial-gradient(ellipse 80% 90% at 60% 40%,#000 30%,transparent 75%)"}}/>
        {/* blue glow */}
        <div aria-hidden="true" style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 85% 10%,rgba(2,74,171,.45),transparent 70%)",pointerEvents:"none"}}/>
        {/* route arc */}
        {!m&&<svg aria-hidden="true" viewBox="0 0 420 220" fill="none" style={{position:"absolute",right:-40,top:30,width:420,opacity:.55,zIndex:1,pointerEvents:"none"}}>
          <path d="M10 190 C 120 40, 300 40, 410 130" stroke={gold} strokeWidth="1.6" strokeDasharray="2 7" opacity=".9"/>
          <circle cx="10" cy="190" r="4" fill={sky}/>
          <circle cx="410" cy="130" r="4" fill={gold}/>
          <circle cx="210" cy="78" r="3" fill={teal}/>
        </svg>}
        {/* text */}
        <div style={{maxWidth:920,margin:"0 auto",position:"relative",zIndex:2}}>
          <div style={{fontFamily:F,fontSize:12,fontWeight:600,letterSpacing:".28em",textTransform:"uppercase",color:gold,marginBottom:18}}>
            Container Tracking
          </div>
          <h1 style={{fontFamily:FF,fontWeight:700,fontSize:"clamp(30px,5vw,46px)",lineHeight:1.12,letterSpacing:"-.01em",marginBottom:16}}>
            Track Your Container<br/>— <span style={{color:gold}}>Know What It Means</span>
          </h1>
          <p style={{maxWidth:560,color:"rgba(255,255,255,.78)",fontFamily:F,fontSize:15.5}}>
            Enter your BL, booking, or container number to see live shipment milestones across major carriers.
            If the movement looks delayed or unclear, Sattva helps you read the status and plan the next step.
          </p>
        </div>
      </section>

      {/* ── RESULT (pull-up, replaces input card) ── */}
      {step==="result"&&result&&(
        <ResultCard
          shipment={result.shipment}
          trackingNumber={trk.trim()}
          carrier={car}
          onReset={reset}
        />
      )}

      {/* ── INPUT / GATE / LOADING / PENDING / ERROR (all pull-up) ── */}
      {step!=="result"&&(
        <div style={{...stage,marginTop:-96,position:"relative",zIndex:5}}>

          {/* STATE 1 — INPUT */}
          {step==="input"&&(
            <div style={card}>
              <h2 style={{fontFamily:FF,fontWeight:700,fontSize:23,color:navy,marginBottom:6}}>Enter Tracking Details</h2>
              <p style={{color:muted,fontSize:14,marginBottom:26,fontFamily:F}}>Accepts BL number, MBL, booking number, or container number.</p>
              <div style={{marginBottom:20}}>
                <label style={labelStyle} htmlFor="sg-trk">BL / Booking / Container Number</label>
                <input id="sg-trk" className="sg-inp" type="text"
                  style={{...inputStyle,borderColor:errors.trk?"#dc2626":line}}
                  value={trk} placeholder="e.g. 272172068 or MRKU9410437"
                  onChange={e=>{setTrk(e.target.value);setErrors({});}}
                  onKeyDown={e=>e.key==="Enter"&&handleInputSubmit()}
                  autoComplete="off"/>
                {errors.trk&&<div style={{fontSize:11,color:"#dc2626",marginTop:4}}>{errors.trk}</div>}
              </div>
              <div style={{marginBottom:26}}>
                <label style={labelStyle} htmlFor="sg-car">
                  Carrier <span style={{fontWeight:400,color:muted}}>(optional — improves accuracy)</span>
                </label>
                <select id="sg-car" className="sg-inp sg-select"
                  style={{...inputStyle,background:"#fbfcfe"}}
                  value={car} onChange={e=>setCar(e.target.value)}>
                  {CARRIERS.map(c=><option key={c.scac} value={c.scac}>{c.name}</option>)}
                </select>
              </div>
              <button className="sg-btn" onClick={handleInputSubmit} style={btnPrimary}>
                Track Shipment <ArrowRight/>
              </button>
            </div>
          )}

          {/* STATE 2 — GATE */}
          {step==="gate"&&(
            <div style={card}>
              <button className="sg-btn" onClick={()=>setStep("input")}
                style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,fontWeight:500,color:muted,cursor:"pointer",background:"none",border:"none",fontFamily:F,marginBottom:18}}>
                <ArrowLeft/> Back
              </button>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#eef4ff",border:"1px solid #d6e4fb",color:blue,fontSize:13,fontWeight:600,letterSpacing:".04em",padding:"7px 14px",borderRadius:999,marginBottom:20}}>
                <BLIcon/>{trk.trim().toUpperCase()}
              </div>
              <h2 style={{fontFamily:FF,fontWeight:700,fontSize:23,color:navy,marginBottom:6}}>Almost there</h2>
              <p style={{color:muted,fontSize:14,marginBottom:26,fontFamily:F}}>Tell us who to send updates to — then your tracking status opens instantly.</p>
              <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:16,marginBottom:4}}>
                <div style={{marginBottom:20}}>
                  <label style={labelStyle} htmlFor="sg-name">Your Name</label>
                  <input id="sg-name" className="sg-inp" type="text"
                    style={{...inputStyle,borderColor:errors.name?"#dc2626":line}}
                    value={name} placeholder="Full name"
                    onChange={e=>{setName(e.target.value);setErrors(p=>({...p,name:""}));}}
                    autoComplete="name"/>
                  {errors.name&&<div style={{fontSize:11,color:"#dc2626",marginTop:4}}>{errors.name}</div>}
                </div>
                <div style={{marginBottom:20}}>
                  <label style={labelStyle} htmlFor="sg-wa">WhatsApp Number</label>
                  <input id="sg-wa" className="sg-inp" type="tel"
                    style={{...inputStyle,borderColor:errors.wa?"#dc2626":line}}
                    value={wa} placeholder="e.g. 9136121123"
                    onChange={e=>{setWa(e.target.value);setErrors(p=>({...p,wa:""}));}}
                    autoComplete="tel"/>
                  {errors.wa&&<div style={{fontSize:11,color:"#dc2626",marginTop:4}}>{errors.wa}</div>}
                </div>
              </div>
              <button className="sg-btn" onClick={handleGateSubmit} style={btnPrimary}>
                Show Tracking Status <ArrowRight/>
              </button>
              <p style={{fontSize:12,color:muted,marginTop:14,textAlign:"center",lineHeight:1.5,fontFamily:F}}>
                By continuing, you agree Sattva may contact you on WhatsApp about this shipment.
              </p>
            </div>
          )}

          {/* STATE 3 — LOADING */}
          {step==="loading"&&(
            <div style={{...card,display:"flex",flexDirection:"column",alignItems:"center",padding:"64px 36px"}}>
              <div style={{position:"relative",width:72,height:72,marginBottom:22}}>
                <div className="sg-ring" style={{position:"absolute",inset:0,borderRadius:"50%",border:`3px solid ${line}`,borderTopColor:teal,animation:"sg-spin 1s linear infinite"}}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <ShipIcon/>
                </div>
              </div>
              <p style={{color:muted,fontSize:14.5,fontFamily:F}}>Fetching shipment status…</p>
            </div>
          )}

          {/* STATE 4b — PENDING */}
          {step==="pending"&&(
            <div style={card}>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:16}}>
                <div style={{width:40,height:40,borderRadius:12,background:trkAmberBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <WarnIcon/>
                </div>
                <h2 style={{fontFamily:FF,fontWeight:700,fontSize:21,color:navy,margin:0}}>No tracking data yet</h2>
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#eef4ff",border:"1px solid #d6e4fb",color:blue,fontSize:13,fontWeight:600,letterSpacing:".04em",padding:"7px 14px",borderRadius:999,marginBottom:16}}>
                <BLIcon/>{trk.trim().toUpperCase()}
              </div>
              <p style={{color:muted,fontSize:14,marginBottom:0,fontFamily:F}}>This can be normal. Common reasons:</p>
              <ul style={{margin:"18px 0 24px",paddingLeft:2,listStyle:"none"}}>
                {["The booking is new — carriers publish milestones 24–48 hours after confirmation.",
                  "The number format doesn't match this carrier. Try the MBL or container number instead.",
                  "The carrier isn't covered by live tracking yet."].map((t,i)=>(
                  <li key={i} style={{position:"relative",paddingLeft:22,marginBottom:10,fontSize:14,color:muted,fontFamily:F}}>
                    <span style={{position:"absolute",left:4,top:8,width:6,height:6,borderRadius:"50%",background:trkAmber,display:"block"}}/>
                    {t}
                  </li>
                ))}
              </ul>
              <a href={waFallback} target="_blank" rel="noopener noreferrer"
                style={{...btnWA,textDecoration:"none",display:"flex"}}>
                <WASvg/> Send this number to Sattva on WhatsApp
              </a>
            </div>
          )}

          {/* STATE 5 — ERROR */}
          {step==="error"&&(
            <div style={{...card,borderLeft:`5px solid ${trkAmber}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:12,background:trkAmberBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <WarnIcon/>
                </div>
                <h2 style={{fontFamily:FF,fontWeight:700,fontSize:21,color:navy,margin:0}}>No tracking data yet</h2>
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#eef4ff",border:"1px solid #d6e4fb",color:blue,fontSize:13,fontWeight:600,letterSpacing:".04em",padding:"7px 14px",borderRadius:999,marginBottom:16}}>
                <BLIcon/>{trk.trim().toUpperCase()}
              </div>
              {apiErr&&<p style={{fontSize:13,color:"#374151",marginBottom:12,fontFamily:F}}>{apiErr}</p>}
              <p style={{color:muted,fontSize:14,marginBottom:0,fontFamily:F}}>This can be normal. Common reasons:</p>
              <ul style={{margin:"18px 0 24px",paddingLeft:2,listStyle:"none"}}>
                {["The booking is new — carriers publish milestones 24–48 hours after confirmation.",
                  "The number format doesn't match this carrier. Try the MBL or container number instead.",
                  "The carrier isn't covered by live tracking yet."].map((t,i)=>(
                  <li key={i} style={{position:"relative",paddingLeft:22,marginBottom:10,fontSize:14,color:muted,fontFamily:F}}>
                    <span style={{position:"absolute",left:4,top:8,width:6,height:6,borderRadius:"50%",background:trkAmber,display:"block"}}/>
                    {t}
                  </li>
                ))}
              </ul>
              <a href={waFallback} target="_blank" rel="noopener noreferrer"
                style={{...btnWA,textDecoration:"none",display:"flex"}}>
                <WASvg/> Send this number to Sattva on WhatsApp
              </a>
              <div style={{textAlign:"center",marginTop:16}}>
                <button onClick={()=>setStep("input")} style={{background:"none",border:"none",color:muted,fontSize:13,cursor:"pointer",fontFamily:F}}>
                  ← Try a different number
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      <div style={{height:80}}/>
    </div>
  );
}
