# CONTEXT.md — Sattva Global Logistics Website
> Complete project context for Claude or any AI assistant picking up this project

---

## 1. Business Overview

**Company:** Sattva Global Logistics  
**Website:** https://www.sattvaglobal.in  
**Owner:** Sujith Nair  
**Location:** Mumbai, India  
**Business:** International freight forwarding — specialising in FCL ocean exports from India to the Middle East, Red Sea corridor, and Africa  
**Key differentiator:** Documentation accuracy, compliance, proactive coordination — NOT competing on rates alone  
**Experience:** 20+ years | 1000+ shipments handled | 40+ destinations served  
**Contact:** sujith@sattvaglobal.in | quotes@sattvaglobal.in (alias) | +91 9136 121 123  
**Brand colour:** #024AAB (Sattva Blue)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React (JSX) |
| Build tool | Vite 5.4.21 |
| Architecture | Single Page Application (SPA) — one App.jsx file |
| Styling | Inline styles only (no CSS files) |
| Fonts | Poppins + Quicksand via Google Fonts |
| Email | EmailJS (@emailjs/browser) |
| Data storage | Google Sheets via Apps Script Web App |
| Hosting | Vercel (free tier) |
| Domain | sattvaglobal.in (.in ccTLD) |
| Email provider | Zoho Mail (sujith@sattvaglobal.in) |

---

## 3. Project Location & Deployment

**Local path:** `C:\sattva\` (deliberately outside OneDrive — OneDrive caused build failures)  
**Vercel project:** `nsujith-creators-projects / sattva-global-logistics`  
**Deploy commands (always these 3, in order):**
```
cd "C:\sattva"
npm run build
npx vercel --prod
```
**After deploying:** Always hard refresh with Ctrl+Shift+R  
**OneDrive copy exists** at a longer path but is NOT used for building

---

## 4. File Structure

```
C:\sattva\
├── src/
│   └── App.jsx          ← ENTIRE website (all pages, components, logic ~1400 lines)
├── index.html           ← Single HTML shell — loads fonts, favicon, theme colour
├── package.json
├── vercel.json
└── public/
    ├── sattva-logo.png          ← Nav logo (transparent, dark)
    ├── sattva-logo-white.png    ← Footer logo (white version)
    ├── favicon.ico / favicon.png / favicon-192.png / apple-touch-icon.png
    └── carriers/
        ├── maersk.png
        ├── msc.svg
        ├── cma-cgm.svg
        ├── hapag-lloyd.png
        ├── one.png
        ├── oocl.svg
        ├── cosco.png
        ├── pil.png
        ├── hmm.png
        └── wanhai.png
```

---

## 5. All Pages & What They Contain

### Home (`page === "home"`)
- Hero: "Mumbai's Most Reliable Middle East, Red Sea & Africa Freight Forwarder"
- Stats: 20+ Years Experience | 1000+ Shipments Handled | 40+ Destinations Served
- Trade lane map (dark section): 15 corridors across Gulf, East Africa, Southern/West Africa with transit times
- Recent Shipments block: 6 cargo examples with route, equipment, transit
- Core Services: 4 cards (FCL Ocean Freight, Customs & Documentation, End-to-End Forwarding, Inland Transport)
- Carrier Network: 10 shipping lines with real logos
- Why Exporters Choose Sattva: side-by-side vs typical forwarder
- 6-step export process

### About (`page === "about"`)
- 4 pillar cards: Our Mission, Mumbai Advantage, IMEA Network, Compliance First

### Services (`page === "services"`)
- 4 detailed service sections with bullet points

### Industries (`page === "industries"`)
- 8 industry cards: Textiles, Pharma, Chemicals, Engineering, Food, Auto, Electronics, Machinery

### Knowledge (`page === "knowledge"`)
- Tabbed reference hub: Incoterms 2020 (all 11), Export Documents, FCL Ocean Freight, Customs Clearance, Container Guide, Rate Components

### Testimonials (`page === "testimonials"`)
- 6 named testimonials with route badges (e.g. "JNPT → Jebel Ali")
- 3 full case studies: Garments/Mumbai, Food-FMCG/Gujarat, Pharma/Mumbai
  - Each has: challenge, solution, 3 stats, direct quote

### Get a Quote (`page === "quote"`)
- POL: 7 Indian ports (JNPT, Mundra, Chennai, Kattupalli, Pipavav, Tuticorin, Cochin)
- POD: 12 regions, 200+ ports and ICDs globally
- Equipment: 20GP, 40GP, 40HC, 20RF, 40RH, 20OT, 40OT, 20FR, 40FR, ISO Tank
- OT/FR: shows extra fields for dimensions, packing type (17 types), file upload
- Rate gate (OTP): appears after POL+POD+Equipment selected
- Instant rate display if loaded
- Math captcha before submit
- WhatsApp button with pre-filled message

### Admin Panel — ✅ DEPLOYED (confirmed 19 Mar 2026)
- NVOCC added to carrier dropdown
- Dynamic extra charge line items — "+ Add Charge Line" button adds label + amount rows, × to remove, total updates live
- Extra items saved to Google Sheets and shown in rate breakdown on quote page
- All Rates tab: view, edit, delete rates
- Add Rate tab: POL/Region/POD/Equipment/Carrier/Dates + Rate Components with dynamic extra charge lines
- Bulk Import: paste JSON to load multiple rates
- Export: download all rates as JSON

---

## 6. Key Components

### RateGate (Email OTP Verification)
- Triggered when visitor selects POL + POD + Equipment
- Collects: name, company, company email, phone (with country flag/dial code selector)
- Blocks personal emails: gmail, yahoo, hotmail, outlook, rediffmail etc.
- Sends 6-digit OTP via EmailJS to company email
- OTP expires: 10 minutes | Resend cooldown: 60 seconds
- Session saved to localStorage for 30 days (returning visitors skip gate)
- Every unlock logged to Google Sheets SearchLog tab

### PhoneField Component — ✅ DEPLOYED (confirmed 19 Mar 2026)
- Left side: country flag + dial code dropdown (55 countries, searchable)
- Default: 🇮🇳 India +91
- Right side: number-only input
- Real-time per-country validation (India: 10 digits starting 6-9, UAE: 9 digits etc.)
- Shows inline error if format invalid (e.g. "Invalid India number. Expected: 10 digits starting with 6-9")
- Form blocks submission if phone format wrong

### CarrierBadge Component
- Shows real logo image on white card for homepage carrier network section
- Falls back to text if logo fails to load
- Size "sm" = coloured pill used in rate display and admin table

### Floating WhatsApp Button
- Fixed bottom-right, visible on all pages except Admin
- Opens WhatsApp with pre-filled: "Hi, I'd like to enquire about freight forwarding services from Sattva Global Logistics."
- Number: +91 9136 121 123

---

## 7. EmailJS Configuration

| Key | Value |
|---|---|
| Service ID | service_19yldqj |
| Quote Template ID | template_6n1jgzr |
| OTP Template ID | template_hn8h6jg |
| Public Key | mEeQ8ZUINXOPAeM8F |
| Sending account | sujith@sattvaglobal.in (Zoho, App Password auth) |
| Delivery address | quotes@sattvaglobal.in (alias → sujith inbox) |
| Free tier | 200 emails/month, resets monthly |

**Important:** `quotes@sattvaglobal.in` is an **alias only** — it has no mailbox and cannot authenticate SMTP. Always use `sujith@sattvaglobal.in` for authentication.

---

## 8. Google Sheets Backend

| Key | Value |
|---|---|
| Sheet name | Sattva Rates & Log |
| Spreadsheet ID | 1XL5ICRovFqrYD0IzAiMW_PJ3WF5iQdwqFwONVes8iEg |
| Apps Script URL | https://script.google.com/macros/s/AKfycbzSAfny0ojMT7pMLmmMdD-DfppV7vrIksFgOI_iCA-WO5YhbQsT5YF7fU8l4XUgArHhCw/exec |
| Tab: Rates | Stores freight rates keyed as `POL:POD:EQUIPMENT` e.g. `INNSA:AEJEA:20GP` |
| Tab: SearchLog | Every gate unlock + quote submit logged with name/email/company/phone/route/rate found |

**Rate entry format:**
```json
{
  "INNSA:AEJEA:20GP": {
    "oceanFreight": 650, "thcOrigin": 130, "thcDest": 180,
    "blFee": 45, "surcharges": 25,
    "extraItems": [{"label": "CAF", "value": "50"}],
    "total": 1080,
    "carrier": "Maersk",
    "validFrom": "2026-03-01", "validTo": "2026-03-31"
  }
}
```

**Timeout:** All fetch calls to Apps Script have a 5-second AbortController timeout — page loads even if Sheets is unreachable.

---

## 9. Carriers

10 carriers configured with real logos:
`Maersk, MSC, CMA CGM, Hapag-Lloyd, ONE, OOCL, COSCO, PIL, HMM, Wan Hai, NVOCC`

Logo files stored in `public/carriers/`. If logo fails to load, component falls back to carrier name text.

---

## 10. Port Data

**POL (7 Indian ports):**
JNPT/Nhava Sheva, Mundra, Chennai, Kattupalli, Pipavav, Tuticorin, Cochin

**Removed from POL:** Mumbai Port (INBOM), Kolkata (INCCL), Visakhapatnam (INVISP)

**POD Regions (12) with 200+ ports/ICDs:**
1. Gulf & Upper Gulf (UAE, Saudi, Oman, Qatar, Bahrain, Kuwait, Iraq, Yemen)
2. Red Sea & East Africa (Egypt, Sudan, Djibouti, Ethiopia, Somalia, Eritrea, Kenya, Tanzania + landlocked ICDs: Rwanda, Burundi, Uganda, Malawi, Zambia, DRC, Mozambique)
3. Southern Africa (SA incl. Johannesburg City Deep ICD, Zimbabwe, Botswana, Namibia, Eswatini, Lesotho, Madagascar, Mauritius, Seychelles)
4. West Africa (Nigeria, Ghana, Ivory Coast, Senegal + 5 landlocked ICDs: Mali, Niger, Burkina Faso, etc.)
5. Mediterranean & Black Sea
6. North Europe
7. Far East & China
8. Indian Subcontinent (Bangladesh, Sri Lanka, Pakistan, Nepal, Maldives)
9. Oceania
10. North America
11. Latin America & Caribbean
12. (Red Sea moved into East Africa region)

---

## 11. Known Bugs Fixed

| Bug | Fix |
|---|---|
| Page load hanging | 5s AbortController timeout on Google Sheets fetch |
| Wrong EmailJS template ID (schkt1b) | Fixed to template_6n1jgzr |
| Footer logo not clickable | Added onClick → go("home") |
| Submit failing | Fixed template ID + Sheets fallback on email fail |
| Horizontal overflow on mobile | overflowX:hidden on root + clamp() font sizes |
| Scroll restoration on refresh | history.scrollRestoration = "manual" |

---

## 12. What's PENDING / Not Yet Done

### High Priority
- [ ] **SEO fixes** — dynamic page titles + meta descriptions per page, sitemap.xml in /public, JSON-LD structured data, better homepage title tag
- [ ] **Google Analytics 4 (GA4)** — visitor tracking (country, source, page, device)
- [ ] **Microsoft Clarity** — heatmaps + session recordings (free)
- [ ] **URL routing** — proper `/services`, `/industries`, `/quote` etc. URLs for SEO (requires react-router + Vercel rewrites)

### Medium Priority
- [ ] **Trade lane landing pages** — 15 dedicated pages e.g. "Shipping from India to Dubai", "Freight Forwarder India to Kenya" — biggest SEO opportunity
- [ ] **Industry pages** — "Ceramic Tile Export Logistics", "Pharma Export Freight India" etc.
- [ ] **Port pages** — "Freight Forwarder JNPT", "Shipping from Mundra"
- [ ] **Google Search Console** — sitemap submitted, indexing verified

### Low Priority / Future
- [ ] Freightify integration (live rates) — Sujith spoke with Freightify, update pending
- [ ] Maersk Schedules API — rejected due to low volume, suggested reply with customer ID requesting Schedules API only
- [ ] CMA CGM API — requires EDI contract, not viable

---

## 13. SEO Current State (March 2026)

- **Indexed pages:** 1 (homepage only)
- **Root cause:** React SPA — all pages share one URL, Google cannot distinguish them
- **Immediate fix available:** Meta tags per page (no URL routing needed, partial fix)
- **Full fix:** URL routing with react-router (bigger change)
- **Search Console:** Submitted, ownership verified
- **Sitemap:** NOT yet created

---

## 14. Style Constants (for any new code)

```js
const B = {
  primary: "#024aab",   // Sattva Blue
  pl: "#233dff",        // Bright blue
  pd: "#12229d",        // Deep blue
  accent: "#5cb6f9",    // Sky blue
  dark: "#050a30",      // Deep navy (footer)
  g7: "#334155", g5: "#64748b", g3: "#b8cde8", g1: "#f4f6fc",
  w: "#fff",
  green: "#059669", gBg: "#ecfdf5",
  red: "#dc2626", amber: "#d97706", aBg: "#fffbeb",
  lightBlue: "#cae8ff",
};
const F = "'Poppins',sans-serif";
const FF = "'Quicksand',sans-serif";
```

**Key style rules:**
- No CSS files — all inline styles
- `st.sec` = section wrapper: `{padding:"72px 20px", maxWidth:1200, margin:"0 auto"}`
- `st.bp` = primary button (blue filled)
- `st.bs` = secondary button (outlined)
- `st.cd` = card style
- `st.inp` = form input
- `useIsMobile()` hook returns true below 768px

---

## 15. Important Rules (Do Not Break)

1. **Never mention LCL consolidation anywhere on the website**
2. **Do not change OTP validation flow or form structure** (asked explicitly by owner)
3. **Always use `sujith@sattvaglobal.in` for SMTP** — `quotes@` is alias only
4. **Build path must be `C:\sattva`** — not inside OneDrive
5. **Deploy is always 3 commands** — cd, npm run build, npx vercel --prod
6. **Stats are fixed:** 20+ Years | 1000+ Shipments | 40+ Destinations — use these everywhere consistently
7. **No 99% On-Time Rate** — removed, was aspirational
8. **No "50+ Global Ports"** — replaced with "40+ Destinations"

---

## 17. Deployment Status & Workflow Rules

### Rule: Never proceed to next change without confirmed deployment
- Every time a zip file is generated, Claude must ask: **"Please confirm you've deployed this before I proceed."**
- If Sujith forgets to confirm, Claude must ask before making further code changes
- This CONTEXT.md is updated after every confirmed deployment and re-sent as a file

### Deployment Status Log

| Feature | Status | Date |
|---|---|---|
| Full website launch | ✅ Deployed | Mar 2026 |
| Email OTP rate gate | ✅ Deployed | Mar 2026 |
| 30-day session persistence | ✅ Deployed | Mar 2026 |
| Floating WhatsApp button | ✅ Deployed | Mar 2026 |
| Hero headline updated | ✅ Deployed | Mar 2026 |
| 99% stat removed | ✅ Deployed | Mar 2026 |
| Trade lane map (15 corridors + transit times) | ✅ Deployed | Mar 2026 |
| Recent shipments block (6 examples) | ✅ Deployed | Mar 2026 |
| Carrier network with real logos | ✅ Deployed | Mar 2026 |
| Named testimonials with route badges | ✅ Deployed | Mar 2026 |
| 3 case studies (Garments, Food, Pharma) | ✅ Deployed | Mar 2026 |
| POL reduced to 7 ports | ✅ Deployed | Mar 2026 |
| POD expanded to 200+ ports / 12 regions | ✅ Deployed | Mar 2026 |
| PhoneField with country flag + validation | ✅ Deployed | 19 Mar 2026 |
| NVOCC added to carrier dropdown | ✅ Deployed | 19 Mar 2026 |
| Dynamic extra charge lines in admin | ✅ Deployed | 19 Mar 2026 |
| Mobile overflow fixes | ✅ Deployed | Mar 2026 |
| Footer logo clickable | ✅ Deployed | Mar 2026 |
| Google Sheets timeout fix | ✅ Deployed | Mar 2026 |
| EmailJS template ID fix (template_6n1jgzr) | ✅ Deployed | Mar 2026 |
| SEO meta tags + sitemap + GA4 + Clarity | ⏳ Pending | — |
| URL routing (/services, /industries etc.) | ⏳ Pending | — |
| Trade lane landing pages (15 pages) | ⏳ Pending | — |
| Industry landing pages | ⏳ Pending | — |

- `sattva-website-updates-march2026.docx` — summary of all website changes (shareable with contacts)
- `sattva-technical-reference.docx` — full technical documentation for the business owner
