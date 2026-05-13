# CONTEXT.md — Sattva Global Logistics Website
> Last updated: 13 May 2026. Update this file after every confirmed deployment.

---

## 1. Business Overview

**Company:** Sattva Global Logistics
**Website:** https://www.sattvaglobal.in
**Owner:** Sujith Nair
**Location:** Mumbai / Navi Mumbai, India
**Business:** International freight forwarding — FCL ocean exports from India to Gulf, Red Sea, East Africa, South Africa, West Africa, Europe
**Key differentiator:** Documentation accuracy, compliance, proactive India-side coordination — NOT competing on rates alone
**Stats (fixed — never change):** 20+ Years Experience | 1000+ Shipments | 40+ Destinations
**Contact:** sujith@sattvaglobal.in | quotes@sattvaglobal.in (alias) | +91 9136 121 123

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite (SPA) |
| Styling | Inline styles only (no CSS files) |
| Fonts | Poppins + Quicksand + DM Mono via Google Fonts |
| Backend | Supabase (Edge Functions, Auth, Postgres DB) |
| Email | Resend (sattvaglobal.in domain, US East region) |
| Hosting | Vercel (auto-deploy on GitHub push) |
| Analytics | GA4 (Measurement ID: G-PZ93GPEX4C) |
| Domain | sattvaglobal.in |

**Old stack (removed — do not reference):** EmailJS, Google Sheets Apps Script, Zoho Mail SMTP — all replaced by Supabase + Resend.

---

## 3. Project Location & Deployment

**Local path:** `C:\sattva\` (outside OneDrive — OneDrive caused build failures)
**GitHub repo:** `nsujith-creator/sattva-global-logistics`
**Vercel:** Auto-deploys on every push to `main`. No manual deploy step needed.

**Deploy workflow:**
```
git add .
git commit -m "description"
git push
```
Vercel picks it up automatically. Hard refresh with Ctrl+Shift+R after deploy.

**Rule:** Always confirm deployment before proceeding to next change.

---

## 4. File Structure (key files)

```
C:\sattva\
├── src/
│   ├── App.jsx                  ← Monolithic component (all pages + logic)
│   ├── CONTEXT.md               ← This file
│   ├── api/
│   │   ├── supabase.js          ← apiPost, apiDelete, FUNCTIONS_URL, ANON_KEY (hardcoded public)
│   │   └── rates.js             ← Rate fetch helpers
│   ├── components/
│   │   └── layout/
│   │       └── AdvisoryBanner.jsx  ← Live trade advisory banner (Supabase Realtime + polling)
│   ├── pages/
│   │   └── TradeAdvisoryPage.jsx   ← /trade-advisory page
│   └── utils/
│       └── session.js           ← Session key: sattva_session_v2
├── supabase/
│   ├── functions/
│   │   ├── _shared/cors.ts      ← Shared CORS headers + escapeHtml utility
│   │   ├── send-otp/            ← Sends OTP via Resend (IP+email dual throttle)
│   │   ├── verify-otp/          ← Verifies OTP, writes verified_sessions
│   │   ├── submit-quote/        ← Writes quote_requests
│   │   ├── get-quotes/          ← Returns quotes (service role)
│   │   ├── get-rates/           ← Returns rates (service role)
│   │   ├── admin-save-quote/    ← Admin write
│   │   ├── admin-delete-quote/  ← Admin delete
│   │   ├── admin-save-rate/     ← Admin write
│   │   ├── admin-delete-rate/   ← Admin delete
│   │   └── update-advisory/     ← Updates trade_advisory (requires ADVISORY_SECRET header)
│   └── migrations/
│       └── 20260513154342_harden_data_api_grants.sql  ← May 2026 security hardening
├── public/
│   ├── sattva-logo.png / sattva-logo-white.png
│   ├── favicon.ico / favicon.png / favicon-192.png / apple-touch-icon.png
│   └── carriers/                ← maersk.png, msc.svg, cma-cgm.svg, hapag-lloyd.png,
│                                   one.png, oocl.svg, cosco.png, pil.png, hmm.png, wanhai.png
└── .gitignore                   ← Includes: node_modules, dist, .env, .env.local,
                                    enrich-contacts.js, exporters.csv, scrape.js,
                                    docs/advisories/*.pdf
```

---

## 5. Supabase Configuration

**Project ref:** `cakmipiqchlotuhahuds`
**Region:** ap-south-1 (Mumbai)
**Dashboard:** https://supabase.com/dashboard/project/cakmipiqchlotuhahuds
**Admin panel:** /admin (not publicly linked)

**Secrets (set globally, accessible via Deno.env.get):**
- `SERVICE_ROLE_KEY` — Supabase service role (not `SUPABASE_SERVICE_ROLE_KEY`, that name is reserved)
- `RESEND_API_KEY` — Resend API key
- `ALLOWED_ORIGINS` — CORS whitelist (includes https://www.sattvaglobal.in)
- `ADVISORY_SECRET` — Required header for update-advisory function

**Supabase CLI:**
- Installed via Scoop (not npm — npm install fails on Windows)
- Must run from `C:\sattva`
- Link: `npx supabase link --project-ref cakmipiqchlotuhahuds`
- Deploy: `npx supabase functions deploy [name] --no-verify-jwt`
- Docker not required (WARNING: Docker is not running is non-blocking)

**Auth:**
- One user: sujith@sattvaglobal.in
- Email provider: Supabase default (not Resend — Resend handles transactional only)
- No public signup flows

---

## 6. Database Schema & Security Model

### Tables

| Table | Purpose | Access model |
|---|---|---|
| `trade_advisory` | Live trade advisory content | Public SELECT (anon + authenticated). Service role ALL. |
| `quotes` | Quote records | Service role only |
| `quote_requests` | Inbound enquiry leads | Service role only |
| `rates` | Freight rate data (474 rows, 59 routes) | Service role only |
| `otp_challenges` | OTP hashes + IP + throttle data | Service role only |
| `verified_sessions` | Session tokens + lead info | Service role only |
| `search_logs` | Behavioural/search data | Service role only |

### Security posture (hardened May 2026)

- RLS enabled on all 7 tables
- `anon` and `authenticated` grants revoked from all sensitive tables (otp_challenges, verified_sessions, quote_requests, search_logs, quotes, rates)
- `trade_advisory`: anon/authenticated SELECT only; no INSERT/UPDATE/DELETE
- Explicit service-only RLS policies on all 6 private tables
- Explicit public read policy on trade_advisory
- Migration file: `supabase/migrations/20260513154342_harden_data_api_grants.sql`
- Compliant with Supabase Oct 30 2026 Data API grant enforcement

### New table protocol (for any future table)
```sql
REVOKE ALL ON public.new_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.new_table TO service_role;
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "new_table_service_only" ON public.new_table
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Security Advisor status (as of 13 May 2026)
- Errors: 0
- Warnings: 1 (Leaked Password Protection Disabled — inapplicable: no password auth flows, single admin user, Resend handles transactional email outside Supabase Auth)

---

## 7. Resend Configuration

**Domain:** sattvaglobal.in (verified)
**Region:** US East
**From address:** noreply@sattvaglobal.in
**Used for:** OTP emails (send-otp Edge Function)
**quotes@sattvaglobal.in** is an alias → routes to sujith@sattvaglobal.in inbox

---

## 8. Rate Data Model

- 474 rows across 59 routes (loaded via admin Excel bulk upload)
- One Supabase row per POL:POD route (not per equipment type)
- Equipment encoded as line item basis (Per 20', Per 40HC)
- Multiple carrier options per route with dynamic line items (description, basis, amount, currency, PREPAID/COLLECT, category)
- Freightify API integration deferred (break-even requires 11–16 bookings/month, premature at current traffic)

---

## 9. Trade Advisory System

- Page: `/trade-advisory`
- Component: `AdvisoryBanner.jsx` (shown site-wide)
- Supabase table: `trade_advisory`
- Update method: POST to `update-advisory` Edge Function with `ADVISORY_SECRET` header
- Realtime: Supabase Realtime subscription + 5-minute polling fallback
- JSON-LD: NewsArticle + FAQPage + BreadcrumbList schema on advisory page
- Stale content is unacceptable — updates reflect within 1–2 seconds of digest POST

---

## 10. Pages & Content

### Home (`page === "home"`)
- D3 + TopoJSON animated trade route map as hero background
- Stats: 20+ Years | 1000+ Shipments | 40+ Destinations (never change)
- Trade lane map: 15 corridors across Gulf, East Africa, Southern/West Africa with transit times
- Recent Shipments: 6 cargo examples with route, equipment, transit
- Core Services: 4 cards
- Carrier Network: 10 shipping lines with real logos
- Why Exporters Choose Sattva: side-by-side comparison
- 6-step export process

### Other pages
- About, Services, Industries (8 sectors), Knowledge (tabbed reference hub), Testimonials (6 + 3 case studies), Get a Quote, Trade Advisory (`/trade-advisory`)
- Admin panel at `/admin` (not publicly linked)

### Quote form
- POL: 7 Indian ports (JNPT, Mundra, Chennai, Kattupalli, Pipavav, Tuticorin, Cochin)
- POD: 12 regions, 200+ ports and ICDs
- Equipment: 20GP, 40GP, 40HC, 20RF, 40RH, 20OT, 40OT, 20FR, 40FR, ISO Tank

---

## 11. SEO

- GA4 live (G-PZ93GPEX4C)
- Google Search Console verified, sitemap submitted
- Organization + LocalBusiness schema
- Dynamic meta tags per page
- URL routing still hash-based SPA (not true multi-route) — refactor pending

---

## 12. Style Constants

```js
const B = {
  primary: "#024aab",   // Sattva Blue
  navy: "#050a30",      // Deep navy (footer)
  accent: "#5cb6f9",    // Sky blue
  teal: "#00c9a7",
  gold: "#c8a84b",
  pl: "#233dff", pd: "#12229d",
  g7: "#334155", g5: "#64748b", g3: "#b8cde8", g1: "#f4f6fc",
  w: "#fff",
  green: "#059669", gBg: "#ecfdf5",
  red: "#dc2626", amber: "#d97706", aBg: "#fffbeb",
};
const F = "'Poppins',sans-serif";
const FF = "'Quicksand',sans-serif";
const FM = "'DM Mono',monospace";
```

---

## 13. Hard Rules

1. **Never mention LCL** anywhere on the website
2. **Stats are fixed:** 20+ Years | 1000+ Shipments | 40+ Destinations
3. **quotes@sattvaglobal.in is alias only** — no mailbox, cannot authenticate SMTP
4. **Build path:** `C:\sattva` — never inside OneDrive
5. **Deploy = git push** — Vercel auto-deploys, no manual build step
6. **Confirm deployment before next change**
7. **`_shared` folder** cannot be deployed standalone — bundled automatically with send-otp/submit-quote
8. **`.env.local` BOM issue** — BOM encoding breaks Vite + Supabase CLI; anon key is public, hardcode in src/api/supabase.js
9. **PowerShell:** no `&&` separator — run commands sequentially. `curl` = `Invoke-WebRequest`
10. **Supabase secrets** starting with `SUPABASE_` are reserved — use `SERVICE_ROLE_KEY`

---

## 14. Known Patterns & Gotchas

- **CORS NetworkError** (no HTTP status) = CORS failure, not function crash → check ALLOWED_ORIGINS secret
- **HTTP 500** = actual function crash
- **Supabase secrets** set via dashboard UI are not queryable via SQL — only via `Deno.env.get()` inside functions
- **Secrets are global** to the project — one `secrets set` updates all functions
- **service_role bypasses RLS** — no policies needed for Edge Function writes
- **Realtime** on trade_advisory depends on public SELECT grant — do not revoke

---

## 15. Pending Items

| Item | Priority | Notes |
|---|---|---|
| Microsoft Clarity setup | High | Project ID still needed |
| URL routing refactor (hash → true multi-route) | Medium | Reserve for Windsurf/Cursor |
| Surcharge tracker cluster pages | Low | Contingent on Search Console impressions |
| Quote request log in admin panel | Low | — |
| Freightify Carrier Rates API | Deferred | Table structure retained in Supabase |

---

## 16. Deployment Log

| Feature | Status | Date |
|---|---|---|
| Full website launch | ✅ | Mar 2026 |
| Supabase backend migration (replaced EmailJS + Sheets) | ✅ | Mar 2026 |
| D3 + TopoJSON animated hero map | ✅ | Mar 2026 |
| Trade Advisory system (/trade-advisory, AdvisoryBanner, Realtime) | ✅ | Mar 2026 |
| Bulk rate upload (474 rows, 59 routes) | ✅ | Mar 2026 |
| GA4 live (G-PZ93GPEX4C) | ✅ | Mar 2026 |
| Google Search Console verified + sitemap | ✅ | Mar 2026 |
| SEO schema (Org, LocalBusiness, NewsArticle, FAQPage) | ✅ | Mar 2026 |
| Security audit (22 Codex failures fixed) | ✅ | Mar 2026 |
| CORS hardening (ALLOWED_ORIGINS secret) | ✅ | Mar 2026 |
| IP+email dual throttle on send-otp | ✅ | Mar 2026 |
| XSS escaping via shared escapeHtml utility | ✅ | Mar 2026 |
| git history cleaned (purged set_secret.bat) | ✅ | Mar 2026 |
| admin-login edge function deleted, ADMIN_PASSWORD rotated | ✅ | Mar 2026 |
| Supabase Data API grant hardening (May 2026 enforcement) | ✅ | 13 May 2026 |
| .gitignore updated (scraping files excluded) | ✅ | 13 May 2026 |
| Microsoft Clarity | ⏳ Pending | — |
| URL routing refactor | ⏳ Pending | — |
