export const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  || "https://cakmipiqchlotuhahuds.supabase.co/functions/v1";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNha21pcGlxY2hsb3R1aGFodWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM1NzEsImV4cCI6MjA4OTk0OTU3MX0.VfucK_bIfQGdA30KWehZhjGN71QmsK1YgdZ71I06FW0";

export async function apiPost(path, body, token = null) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
      method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal,
    });
    clearTimeout(tid);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok) {
      const msg = data.error || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    clearTimeout(tid);
    if (e.name === "AbortError") throw new Error("Request timed out. Please check your connection and try again.");
    throw e;
  }
}

export async function apiDelete(path, body, token) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
  try {
    const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
      method: "DELETE", headers, body: JSON.stringify(body), signal: ctrl.signal,
    });
    clearTimeout(tid);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok) {
      const msg = data.error || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    clearTimeout(tid);
    if (e.name === "AbortError") throw new Error("Request timed out. Please check your connection and try again.");
    throw e;
  }
}

export async function getRates() {
  const res = await fetch(`${FUNCTIONS_URL}/get-rates`, {
    headers: { "Authorization": `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error("Failed to load rates");
  const data = await res.json();
  return data.rates || {};
}
