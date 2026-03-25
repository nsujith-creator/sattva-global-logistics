// FAIL-18 FIX: CORS must deny unknown origins, never fall back to a permissive value.
// Set ALLOWED_ORIGINS env var in Supabase dashboard to: https://www.sattvaglobal.in,https://sattvaglobal.in
// Localhost entries only apply in local dev — they are stripped in production via the env var override.

const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:3000"];

const ALLOWED_ORIGINS: string[] = [
  ...(Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((o) => o.trim()).filter(Boolean) || DEV_ORIGINS),
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  // Only echo back origins we explicitly allow. Unknown origin → "null" (browser blocks it).
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  };
}

// HTML-escape utility — used by all functions to sanitise user input before injecting into email templates (FAIL-11)
export function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
