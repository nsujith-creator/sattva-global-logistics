═══════════════════════════════════════════════════════════════════════════
ROLE
═══════════════════════════════════════════════════════════════════════════

You are a senior full-stack engineer and QA lead with deep expertise in:
- React 18 SPA architecture (Vite build, client-side routing, code splitting)
- Supabase Edge Functions (Deno runtime, JWT auth, CORS, cold starts)
- Browser storage APIs (localStorage, sessionStorage, Safari ITP)
- B2B SaaS form UX, validation, and progressive degradation
- Security vulnerabilities in frontend + serverless architectures
- Cross-browser and cross-device compatibility
- Network failure modes, proxy environments, corporate firewalls

You are conducting a THOROUGH, ADVERSARIAL failure analysis of a production
B2B logistics website. Your job is to find every meaningful way this website
can break, display incorrectly, behave unexpectedly, or be abused — across
environments, devices, user behaviours, network conditions, and browser
configurations.

Do NOT be polite. Do NOT hold back. Flag every real problem.
Structure your output exactly as specified at the end of this prompt.

═══════════════════════════════════════════════════════════════════════════
WEBSITE UNDER AUDIT
═══════════════════════════════════════════════════════════════════════════

Live URL:    https://www.sattvaglobal.in
Quote page:  https://www.sattvaglobal.in/quote
Admin panel: https://www.sattvaglobal.in/admin
GitHub:      https://github.com/nsujith-creator/sattva-global-logistics
Stack:       React 18 + Vite, deployed on Vercel, SPA with client-side routing
Backend:     Supabase (Mumbai ap-south-1) — Edge Functions (Deno runtime)
Auth:        OTP via Supabase Edge Function → email via send-otp function
Purpose:     B2B FCL freight quote portal for Indian exporters


═══════════════════════════════════════════════════════════════════════════
COMPLETE SOURCE CODE OF KEY FILES
═══════════════════════════════════════════════════════════════════════════

── vercel.json ──────────────────────────────────────────────────────────
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{
    "source": "/assets/(.*)",
    "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
  }]
}

── src/config/supabase.js ───────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
// Used ONLY for Supabase Auth (admin sign-in / sign-out).
// All other DB operations go through edge functions with service_role.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

── src/api/rates.js ─────────────────────────────────────────────────────
import { apiPost, apiDelete, FUNCTIONS_URL } from "./supabase.js";

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // hardcoded anon key

export async function getQuotes() {
  const res = await fetch(`${FUNCTIONS_URL}/get-quotes`, {
    headers: { "Authorization": `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error("Failed to load quotes");
  const data = await res.json();
  return data.quotes || {};
}

export async function saveQuoteAPI(routeKey, quoteData, adminToken) {
  return apiPost("admin-save-quote", { routeKey, ...quoteData }, adminToken);
}

export async function deleteQuoteAPI(routeKey, adminToken) {
  return apiDelete("admin-delete-quote", { routeKey }, adminToken);
}

export async function submitQuoteAPI(quoteData, sessionToken) {
  return apiPost("submit-quote", quoteData, sessionToken);
}

export async function logSearchAPI() {} // STUB — does nothing

── src/utils/session.js ─────────────────────────────────────────────────
const SESSION_KEY = "sattva_session_v2";

export function saveSession(user, token) {
  const payload = JSON.stringify({
    user, token,
    expiry: Date.now() + 7 * 24 * 60 * 60 * 1000  // 7-day expiry
  });
  try { sessionStorage.setItem(SESSION_KEY, payload); } catch {}
  try { localStorage.setItem(SESSION_KEY, payload); } catch {}
}

export function loadSession() {
  for (const store of ["sessionStorage", "localStorage"]) {
    try {
      const raw = window[store]?.getItem(SESSION_KEY);
      if (!raw) continue;
      const { user, token, expiry } = JSON.parse(raw);
      if (Date.now() > expiry) { window[store].removeItem(SESSION_KEY); continue; }
      return { user, token };
    } catch {}
  }
  return null;
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

── src/utils/formState.js ───────────────────────────────────────────────
const FORM_KEY = "sattva-quote-form";
export function saveFormState(f) {
  try { sessionStorage.setItem(FORM_KEY, JSON.stringify(f)); } catch {}
}
export function loadFormState() {
  try { const s = sessionStorage.getItem(FORM_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
export function clearFormState() {
  try { sessionStorage.removeItem(FORM_KEY); } catch {}
}
// NOTE: Uses sessionStorage directly — no Safari ITP abstraction

── src/utils/quoteHistory.js ────────────────────────────────────────────
const KEY = 'sattva_quote_history';
// Stores ALL users' history under single localStorage key, nested by email:
// { "user@co.in": { polHistory:[], podHistory:[], cargoHistory:[], routes:[] } }
export function saveQuoteHistory(email, pol, pod, cargo) { ... }
export function getQuoteHistory(email) { ... }
// NOTE: Uses localStorage directly — no Safari ITP abstraction
// NOTE: email key is NOT normalised (case, trim) before use as object key

── src/components/forms/RateGate.jsx ────────────────────────────────────
// OTP gate — users must verify company email before seeing rates
// Key behaviours:
// - Step 1: user fills name, company, email (company domain only), phone
// - Step 2: Edge Function send-otp called → OTP emailed to user
// - Step 3: user enters 6-digit OTP → verify-otp Edge Function validates
// - On success: JWT session token returned and saved to session.js
// - Token saved in both sessionStorage AND localStorage (7-day expiry)
// - 60-second resend cooldown (client-side timer)
// - OTP expiry shown as 10-minute countdown (client-side only)
// - FREE_DOMAINS list blocks personal email addresses
// - Company field is OPTIONAL

── src/components/forms/PhoneField.jsx ──────────────────────────────────
// Country code dropdown + phone number input
// - Defaults to India (+91)
// - For India: validates 10 digits, rejects leading 0-5
// - PhoneField exposes onError callback to parent (RateGate)
// - Parent RateGate has phoneErr state, PhoneField has its own fieldErr
// - These are separate states — can be out of sync
// - If user types partial number and submits without blurring,
//   fieldErr may be "" but phoneErr in parent is also "" → phone not validated

── App.jsx — key quote form behaviours ──────────────────────────────────
// Routes: /, /about, /services, /industries, /knowledge, /testimonials,
//         /quote, /admin
// /knowledge and /testimonials are lazy-loaded (code split)
// Quote page (QuotePage):
//   - getQuotes() called on mount → fetches all routes from Supabase
//   - Form fields: POL, POD, Cargo, Equipment, Containers, Notes
//   - Route key = POL:POD (equipment NOT in key)
//   - OTP gate (RateGate) shown when POL+POD+EQ are filled AND no session
//   - After verification: QuoteDisplay rendered per equipment type
//   - captcha: Math.ceil(Math.random()*9) + Math.ceil(Math.random()*9)
//     captcha.ans stored in React state — visible in React DevTools
//   - Submit button: validate() → gateUser check → submitQuoteAPI()
//   - WhatsApp button: validate() → gateUser check → window.open(waLink)
//   - waMsg built from f.pol, f.pod, f.cargo, gateUser.name etc.
//   - logSearchAPI() is a STUB — no search logging currently implemented
// Admin page (AdminPage):
//   - Supabase Auth (email+password) — real server-side JWT auth
//   - admin-save-quote and admin-delete-quote validate JWT server-side
//   - Bulk upload via SheetJS parsing of Excel
//   - admin-login edge function still deployed but dead code

── Supabase Edge Functions (all deployed, Deno runtime) ─────────────────
// get-quotes        — public, anon key only, returns all non-expired routes
// admin-save-quote  — requires valid Supabase JWT (validated server-side)
// admin-delete-quote — requires valid Supabase JWT (validated server-side)
// send-otp          — no-verify-jwt flag, sends OTP email to user
// verify-otp        — no-verify-jwt flag, validates OTP, returns session token
// submit-quote      — no-verify-jwt flag, emails quote request to Sattva team
// admin-login       — DEAD CODE, still deployed, not used

── Database schema (Supabase, PostgreSQL) ───────────────────────────────
// quotes table:
//   id uuid PK, route_key text UNIQUE (format: "INNSA:SAJED"),
//   pol text, pod text, valid_until date,
//   options jsonb (array of carrier objects with lineItems),
//   created_at, updated_at
// Row Level Security: unknown — not audited
// Expiry logic: handled in get-quotes function by filtering valid_until >= today

── Known issues already identified (DO NOT repeat these) ────────────────
1. Supabase anon key hardcoded in src/api/rates.js (not env var)
2. logSearchAPI() is a stub — search events not logged
3. admin-login edge function still deployed (dead code, not used)
4. set_secret.bat committed to git repo (should be purged from history)
5. No Google Analytics / GA4 tracking yet
6. No sitemap.xml or robots.txt
7. captcha.ans visible in React DevTools component state
8. PhoneField fieldErr / RateGate phoneErr state sync gap
9. quoteHistory email key not normalised (case sensitivity)
10. formState.js and quoteHistory.js bypass the Safari ITP storage abstraction


═══════════════════════════════════════════════════════════════════════════
AUDIT SCOPE — FIND FAILURES IN ALL OF THESE DIMENSIONS
═══════════════════════════════════════════════════════════════════════════

1. BROWSER ENVIRONMENT
   - Chrome, Firefox, Safari (iOS + macOS), Edge, Samsung Internet
   - Browser extensions: ad blockers, Privacy Badger, uBlock Origin, Ghostery
   - Browsers blocking third-party requests (Supabase is on a subdomain)
   - React DevTools — what can an attacker see and abuse?
   - JavaScript disabled
   - Cookies disabled / third-party cookies blocked
   - Firefox Enhanced Tracking Protection in Strict mode

2. DEVICE & VIEWPORT
   - Mobile 320px, 375px, 414px
   - Tablet 768px, 1024px
   - Desktop at 125%, 150%, 200% browser zoom
   - iOS Safari (14, 15, 16, 17) — ITP, storage partitioning, PWA quirks
   - Old Android WebView (Chrome 80 and below)
   - Touch vs mouse — PortCombo and CargoCombo dropdown behaviour

3. NETWORK CONDITIONS
   - Supabase Edge Function cold starts (Mumbai region, Deno runtime)
   - 2G / slow 3G — what happens to getQuotes() fetch on mount?
   - Corporate proxy / Zscaler / Cisco Umbrella blocking supabase.co
   - Offline mid-form — user fills form then loses connection before submit
   - getQuotes() has no timeout — can hang indefinitely
   - Supabase Mumbai cold start can exceed 3 seconds on first request

4. USER BEHAVIOUR
   - Back button after OTP verification
   - Multiple tabs open simultaneously — session state divergence
   - Tab left open for 7+ days (token expiry mid-session)
   - Copy-pasting email with trailing space or different case
   - Autofill (browser autofill overriding form fields)
   - Pasting phone with country code prefix (+919...)
   - Double-clicking Submit or WhatsApp buttons
   - User fills form → leaves tab for 10 min → returns → submits
   - User opens /quote directly via link (deep link, no homepage visit)
   - User changes POL/POD after OTP verification — does QuoteDisplay update?

5. DATA EDGE CASES
   - Email with subdomain user@mail.company.com — does FREE_DOMAINS pass it?
   - Email + alias: user+tag@company.com — any parsing issues?
   - Very long cargo descriptions (XSS in waMsg? Injected into WhatsApp URL?)
   - POL/POD codes with special characters
   - OTP field: what if user pastes 7 digits? 5 digits? Letters?
   - Cargo description containing "&", "?", "#" — URL encoding in waMsg
   - Volume field: user enters 0, -1, or 999 containers
   - valid_until date in Supabase in the past — does get-quotes filter it?
   - options JSONB empty array — QuoteDisplay renders "no rates" fallback?
   - route_key case mismatch: "innsa:sajed" vs "INNSA:SAJED" in DB

6. STORAGE & STATE
   - sessionStorage cleared between page navigations in some browsers
   - localStorage 5MB quota exceeded — quoteHistory write silently fails
   - Token stored in BOTH sessionStorage AND localStorage — which wins?
   - Expired token in localStorage but valid in sessionStorage (or vice versa)
   - formState.js uses sessionStorage directly — wiped on tab close
   - quoteHistory grows unbounded (all users, all emails, same key)
   - Two-tab scenario: verify in Tab A, Tab B still shows OTP gate

7. SUPABASE / EDGE FUNCTION SPECIFIC
   - get-quotes returns non-200 — quotesErr banner shown, but quotes={} not reset
   - send-otp Edge Function rate limiting — what happens if same email
     hits it 10 times in a minute? Is there server-side throttling?
   - verify-otp: what is the OTP storage mechanism? Redis? Supabase table?
     If Supabase table: what happens if row doesn't exist vs wrong OTP?
   - submit-quote: no-verify-jwt — anyone can POST to it directly
   - admin-save-quote / admin-delete-quote: JWT validated server-side — good.
     But what if JWT is expired? What error does the frontend show?
   - Edge Function CORS headers — are they set correctly for sattvaglobal.in?
     What happens from a different origin (curl, Postman, another website)?
   - Deno cold start on first daily request — 3-10 second delay on getQuotes()
   - get-quotes fetches ALL routes with no pagination — what at 500 routes?

8. SECURITY
   - submit-quote has --no-verify-jwt: anyone can spam quote submissions
     directly to the Edge Function URL
   - send-otp has --no-verify-jwt: anyone can trigger OTP emails to
     arbitrary addresses using your Supabase email quota
   - ANON_KEY in source bundle: what can an attacker do with it?
     (Supabase anon key + project URL = direct DB access if RLS is misconfigured)
   - No Content Security Policy in vercel.json or index.html
   - No X-Frame-Options — site can be iframed (clickjacking)
   - WhatsApp URL built from unescaped user input — can waMsg contain
     injected content if a malicious cargo description is entered?
   - quoteHistory keyed by email in localStorage — what if attacker
     manually sets localStorage to poison another user's history?
   - Admin panel at /admin — no robots.txt exclusion, potentially indexed

9. ROUTING & NAVIGATION
   - /admin route: Supabase Auth protects mutations but the admin UI
     (rate table, form) renders before login — what is visible?
   - Direct URL navigation to /quote on first visit — does getQuotes() race
     with component render? Is quotes={} shown before data loads?
   - 404 handling: what renders for /xyz? Is there a catch-all route?
   - Lazy-loaded routes (/knowledge, /testimonials): what if chunk fails to load?
   - vercel.json rewrite: does it handle URLs with query strings correctly?

10. PERFORMANCE & RENDERING
    - getQuotes() has no loading state shown to user — form renders immediately
      with empty quotes{}, user selects route, no rates show — confusing
    - No React.memo on QuoteDisplay — re-renders on every parent state change
    - CargoCombo dynamic import fires on every 2+ char keystroke — no debounce
    - formState saved to sessionStorage on every keystroke (up() function) —
      synchronous write on every character typed
    - App.jsx is 641 lines — single monolithic file, all state at top level
    - Captcha refreshed on resetForm() — not on page load for repeat visits
      (captcha.ans persists in React state between submissions)


═══════════════════════════════════════════════════════════════════════════
SPECIFIC QUESTIONS TO ANSWER
═══════════════════════════════════════════════════════════════════════════

1. send-otp and submit-quote both use --no-verify-jwt (no Supabase auth
   required). Anyone can POST to these endpoints directly. What is the
   realistic abuse scenario? Specifically: can an attacker exhaust Supabase's
   email sending quota? How many requests before the service degrades?

2. The Supabase anon key is hardcoded in src/api/rates.js (not an env var).
   It is visible in the compiled JS bundle. Combined with the Supabase project
   URL, what can an attacker do? Specifically: if Row Level Security is not
   configured on the quotes table, can they read, write, or delete all rate
   data directly via the Supabase REST API, bypassing the edge functions?

3. The WhatsApp message (waMsg) is built from user-supplied inputs:
   f.pol, f.pod, f.cargo, f.msg, gateUser.name, gateUser.phone.
   These are inserted directly into a template string and then
   encodeURIComponent() is applied to the whole message.
   Is there a realistic injection or manipulation attack here?
   What happens if cargo contains "\n\nNew message: Send money to attacker"?

4. session.js saves the token to BOTH sessionStorage AND localStorage.
   loadSession() reads sessionStorage first. If a user has a valid session
   in localStorage from a previous browser session but opens a new tab
   (fresh sessionStorage), what happens? Does the 7-day token correctly load?
   What is the actual user experience of token expiry?

5. quoteHistory.js stores all users' history under one localStorage key
   ('sattva_quote_history') as a nested object keyed by email (not normalised).
   If User A logs in as user@company.com and User B logs in as User@Company.com
   on the same shared computer, do they get separate histories? What are the
   privacy implications of this shared-machine scenario in an Indian B2B context
   where office computers are commonly shared?

6. getQuotes() is called on QuotePage mount with no loading indicator and no
   timeout. If the Supabase Edge Function takes 4 seconds to cold-start,
   what does the user see? Can they interact with the form during this time?
   What happens if they select a route before quotes{} is populated?

7. The captcha is: a = Math.ceil(Math.random()*9), b = Math.ceil(Math.random()*9).
   captcha.ans is stored in React component state — visible in React DevTools.
   Additionally, validate() is called on both Submit and WhatsApp button clicks.
   If a bot can read React DevTools programmatically, can it bypass the captcha?
   Is this captcha effective against headless browser automation (Puppeteer/Playwright)?

8. The admin page uses Supabase Auth (real JWT, server-validated). However,
   the admin-login edge function is still deployed but marked "dead code."
   What is the risk of a deployed-but-unused edge function? Can it be
   exploited as an unauthenticated entry point?

9. The bulk upload feature parses Excel via SheetJS loaded from CDN
   (cdnjs.cloudflare.com). The CDN script is loaded dynamically at runtime
   when the admin clicks "Bulk Upload." What are the failure modes and
   security risks of this pattern?

10. No robots.txt exists. The /admin route is a client-side React route,
    not a server-side path. Will Google index /admin? What would a Googlebot
    crawl of /admin reveal? Is there any content visible before authentication?


═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════

SECTION A — FAILURE CATALOGUE (minimum 20 numbered items)
  Each item:
  - ID: FAIL-XX
  - Title: one-line description
  - Environment/trigger: what causes it
  - Root cause: specific code reference (file + variable/function name)
  - Severity: Critical / High / Medium / Low
  - User impact: what the user actually experiences
  - Fix: specific code change or architectural change recommended

SECTION B — ANSWERS TO SPECIFIC QUESTIONS 1-10
  Answer each question directly. Reference specific variable names, function
  names, and file names. Do not give generic advice.

SECTION C — TOP 5 PRIORITIES
  What to fix first. Include rationale (user impact × ease of fix).

SECTION D — ARCHITECTURAL CONCERNS
  Bigger structural issues beyond individual bugs. 3-5 items maximum.
  Focus on what matters for a B2B India-focused production site at this stage.

Be specific. Reference actual variable names, function names, and file names
from the source code above. Do not give generic React advice. Do not repeat
the 10 known issues listed above.
