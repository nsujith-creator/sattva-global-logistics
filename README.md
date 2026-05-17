# Sattva Global Logistics - Website

## EEPC India Exporter Scraper

This workspace includes a CommonJS Playwright scraper for EEPC India's exporter listings:

```bash
npm install
node scrape.js
```

The scraper visits `https://www.eepcindia.org/exporters-home-page`, waits for the rendered exporter table, extracts visible rows on each pagination page, follows the table's Next Page control until it is disabled, and writes incremental progress to `exporters.csv` after every page.

CSV columns:

```text
company_name, contact_name, designation, email, phone, mobile, website, address, city, state, country, exporter_details, source_url
```

The EEPC listing itself currently exposes company name, website, and exporter details. If EEPC adds same-origin exporter detail links later, the scraper will open those pages headlessly with retry logic and try to enrich email, phone, mobile, address, city, state, and country from visible page text and `mailto:`/`tel:` links. External company websites are recorded as `website` but are not crawled as EEPC detail pages. Records are deduplicated by `company_name + email`.

Runtime behavior:

- Headless Playwright Chromium.
- 1-2 second randomized delay between page/detail requests.
- Navigation retry logic.
- Incremental `exporters.csv` writes after each listing page.
- Stops only when the EEPC Next Page button is confirmed disabled.

International freight forwarding company website with:
- Instant rate lookup & quote system
- Knowledge Center (Incoterms, Export Docs, FCL Process, Customs, Container Guide)
- Admin panel for rate management
- Carrier branding (Maersk, MSC, CMA CGM, etc.)
- Email/WhatsApp quote delivery

## Deploy to Vercel

### Option A: GitHub + Vercel (Recommended)
1. Push this entire folder to a GitHub repository
2. Go to https://vercel.com → Sign up / Log in
3. Click "Add New Project" → Import your GitHub repo
4. Framework: Vite (auto-detected)
5. Click "Deploy" — done!

### Option B: Vercel CLI
```bash
npm install -g vercel
cd sattva-vercel
vercel --prod
```

## Connect sattvaglobal.in Domain

1. In Vercel Dashboard → Your project → Settings → Domains
2. Add: sattvaglobal.in
3. Vercel will show you DNS records to set
4. Go to your domain registrar (GoDaddy/Namecheap/etc.)
5. Update nameservers OR add the A/CNAME records Vercel provides
6. Wait 5-30 min for propagation → Site is LIVE!

## Development
```bash
npm install
npm run dev
```
