import { apiPost, apiDelete, FUNCTIONS_URL } from "./supabase.js";

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNha21pcGlxY2hsb3R1aGFodWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzM1NzEsImV4cCI6MjA4OTk0OTU3MX0.VfucK_bIfQGdA30KWehZhjGN71QmsK1YgdZ71I06FW0";

export async function getQuotes() {
  const res = await fetch(`${FUNCTIONS_URL}/get-quotes`, {
    headers: { "Authorization": `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error("Failed to load quotes");
  const data = await res.json();
  return data.quotes || {};
}

export async function saveQuoteAPI(routeKey, quoteData, adminToken) {
  return apiPost("admin-save-quote", {
    routeKey,
    validUntil: quoteData.validUntil || null,
    options:    quoteData.options || [],
  }, adminToken);
}

export async function deleteQuoteAPI(routeKey, adminToken) {
  return apiDelete("admin-delete-quote", { routeKey }, adminToken);
}

export async function submitQuoteAPI(quoteData, sessionToken) {
  return apiPost("submit-quote", quoteData, sessionToken);
}

export async function logSearchAPI() {}
