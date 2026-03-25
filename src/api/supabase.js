export const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  || "https://cakmipiqchlotuhahuds.supabase.co/functions/v1";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNha21pcGlxY2hsb3R1aGFodWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM1NzEsImV4cCI6MjA4OTk0OTU3MX0.VfucK_bIfQGdA30KWehZhjGN71QmsK1YgdZ71I06FW0";

export async function apiPost(path, body, token = null) {
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${ANON_KEY}` };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiDelete(path, body, token) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function getRates() {
  const res = await fetch(`${FUNCTIONS_URL}/get-rates`, {
    headers: { "Authorization": `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error("Failed to load rates");
  const data = await res.json();
  return data.rates || {};
}
