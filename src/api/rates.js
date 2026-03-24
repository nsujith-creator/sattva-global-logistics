const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSAfny0ojMT7pMLmmMdD-DfppV7vrIksFgOI_iCA-WO5YhbQsT5YF7fU8l4XUgArHhCw/exec";

export async function lr(){
  if(!SCRIPT_URL||SCRIPT_URL==="PASTE_YOUR_SCRIPT_URL_HERE") return {};
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),5000);
  const r=await fetch(`${SCRIPT_URL}?action=getRates&_=${Date.now()}`,{signal:ctrl.signal});
  clearTimeout(tid);
  const d=await r.json();
  return d.rates||{};
}

export async function saveRateAPI(key,entry){
  if(!SCRIPT_URL||SCRIPT_URL==="PASTE_YOUR_SCRIPT_URL_HERE") return false;
  try{
    const p=new URLSearchParams({
      action:"saveRate",key,
      carrier:entry.carrier||"",
      of:entry.oceanFreight||0,
      to:entry.thcOrigin||0,
      td:entry.thcDest||0,
      bl:entry.blFee||0,
      su:entry.surcharges||0,
      total:entry.total||0,
      vf:entry.validFrom||"",
      vt:entry.validTo||""
    });
    const r=await fetch(`${SCRIPT_URL}?${p}`);
    const d=await r.json();
    return d.success===true;
  }catch(e){console.error("saveRate error:",e);return false;}
}

export async function deleteRateAPI(key){
  if(!SCRIPT_URL||SCRIPT_URL==="PASTE_YOUR_SCRIPT_URL_HERE") return true;
  try{
    await fetch(`${SCRIPT_URL}?action=deleteRate&key=${encodeURIComponent(key)}&_=${Date.now()}`);
    return true;
  }catch(e){console.error("deleteRate error:",e);return false;}
}

export async function logSearchAPI(data){
  if(!SCRIPT_URL||SCRIPT_URL==="PASTE_YOUR_SCRIPT_URL_HERE") return;
  try{
    const ctrl=new AbortController();
    setTimeout(()=>ctrl.abort(),4000);
    const p=new URLSearchParams({action:"logSearch",...data,_:Date.now()});
    fetch(`${SCRIPT_URL}?${p}`,{signal:ctrl.signal});
  }catch{}
}
