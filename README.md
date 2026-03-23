# Sattva Global Logistics - Website

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
