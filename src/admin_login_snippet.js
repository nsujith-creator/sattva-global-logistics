const ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNha21pcGlxY2hsb3R1aGFodWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM1NzEsImV4cCI6MjA4OTk0OTU3MX0.VfucK_bIfQGdA30KWehZhjGN71QmsK1YgdZ71I06FW0";
const FN_URL=import.meta.env.VITE_SUPABASE_FUNCTIONS_URL||"https://cakmipiqchlotuhahuds.supabase.co/functions/v1";
const doLogin=async()=>{
  setLoginErr("");
  try{
    const res=await fetch(`${FN_URL}/admin-login`,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${ANON_KEY}`},
      body:JSON.stringify({email,password:pass})
    });
    const d=await res.json();
    if(!res.ok||!d.token){setLoginErr(d.error||"Invalid email or password.");return;}
    setAdminToken(d.token);setAuthed(true);
  }catch(e){setLoginErr("Login failed. Please try again.");}
};
const doLogout=async()=>{setAuthed(false);setAdminToken(null);};
