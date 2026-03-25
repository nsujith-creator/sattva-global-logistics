import { getRates as _getRates, apiPost, apiDelete } from "./supabase.js";

// Drop-in replacement for existing lr() call in QuotePage
export const lr = _getRates;

export async function saveRateAPI(key, entry, adminToken) {
  return apiPost(
    "admin-save-rate",
    {
      routeKey:     key,
      carrier:      entry.carrier      || "",
      oceanFreight: entry.oceanFreight || 0,
      thcOrigin:    entry.thcOrigin    || 0,
      thcDest:      entry.thcDest      || 0,
      blFee:        entry.blFee        || 0,
      surcharges:   entry.surcharges   || 0,
      total:        entry.total        || 0,
      validFrom:    entry.validFrom    || null,
      validTo:      entry.validTo      || null,
    },
    adminToken
  );
}

export async function deleteRateAPI(key, adminToken) {
  return apiDelete("admin-delete-rate", { routeKey: key }, adminToken);
}

export async function submitQuoteAPI(quoteData, sessionToken) {
  return apiPost("submit-quote", quoteData, sessionToken);
}

// Now handled server-side inside submit-quote edge function
export async function logSearchAPI() {}
