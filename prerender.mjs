// prerender.mjs — zero-dependency post-build static HTML patching
// Runs after `vite build`. Reads dist/index.html, writes per-route HTML files
// with route-specific title, description, canonical, and OG tags so that
// static crawlers and AI crawlers see correct metadata without JS execution.
//
// Part A (2026-06-17): Also fetches trade_advisory from Supabase at build time
// and injects a static advisory article into /trade-advisory/index.html #root.
// React createRoot().render() replaces #root content on mount — browser view
// is unaffected. Non-JS crawlers and Googlebot first-wave see real content.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv(filePath) {
  try {
    const env = {};
    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}
const ENV = loadEnv('.env.local');
const SUPABASE_URL     = ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;

// ── HTML-safe escape ──────────────────────────────────────────────────────────
function esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Fetch current advisory from Supabase REST ─────────────────────────────────
async function fetchAdvisory() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[prerender] Supabase env vars missing — skipping advisory injection.');
    return null;
  }
  try {
    const url = `${SUPABASE_URL}/rest/v1/trade_advisory?id=eq.current&select=*&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[prerender] Supabase fetch failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    const advisory = rows?.[0] ?? null;
    if (advisory) console.log(`[prerender] Advisory fetched. updated_at: ${advisory.updated_at}`);
    else console.warn('[prerender] Advisory row not found in Supabase response.');
    return advisory;
  } catch (err) {
    console.warn('[prerender] Supabase fetch error:', err.message);
    return null;
  }
}

// ── Build static advisory article (injected inside #root for /trade-advisory) ─
function buildAdvisoryArticle(advisory) {
  if (!advisory) return '';

  const updatedAt = advisory.updated_at
    ? new Date(advisory.updated_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      }) + ' IST'
    : '';

  const situation   = esc(advisory.situation   ?? '');
  const indiaImpact = esc(advisory.india_impact ?? '');
  const tags        = Array.isArray(advisory.source_tags) ? advisory.source_tags : [];
  const tagsHtml    = tags.length
    ? `<p style="margin:16px 0 0;font-size:12px;color:#666;">Sources: ${tags.map(esc).join(' &middot; ')}</p>`
    : '';

  const parts = [
    `<article id="ssr-advisory" aria-label="Sattva Global Logistics Trade Advisory"`,
    ` style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:40px 24px 32px;color:#111;">`,
    `<header style="margin-bottom:20px;">`,
    `<h1 style="font-size:1.5rem;color:#050A30;margin:0 0 6px;">Middle East Shipping Crisis — India Export Advisory</h1>`,
    updatedAt
      ? `<p style="font-size:13px;color:#555;margin:0;">Last updated: <time datetime="${esc(advisory.updated_at)}">${updatedAt}</time></p>`
      : '',
    `</header>`,
    situation
      ? `<section style="margin-bottom:20px;"><h2 style="font-size:1rem;font-weight:700;color:#024AAB;margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px;">Current Situation</h2><p style="line-height:1.8;font-size:14px;margin:0;">${situation}</p></section>`
      : '',
    indiaImpact
      ? `<section style="margin-bottom:20px;"><h2 style="font-size:1rem;font-weight:700;color:#024AAB;margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px;">India Exporter Impact &amp; Actions</h2><p style="line-height:1.8;font-size:14px;margin:0;">${indiaImpact}</p></section>`
      : '',
    tagsHtml,
    `</article>`,
  ];
  return parts.join('');
}

const DIST = 'dist';
const base = readFileSync(join(DIST, 'index.html'), 'utf8');

// Regex to match the entire <noscript>...</noscript> block in the HTML body
const NOSCRIPT_RE = /<noscript>[\s\S]*?<\/noscript>/;

const routes = [
  {
    path: '/',
    title: 'FCL Freight Forwarding from India | Sattva Global Logistics',
    description: 'Freight forwarding for Indian exporters — garments, FMCG, agro, engineering goods. FCL from JNPT, Mundra, Chennai, Cochin to Gulf, Red Sea and Africa. Stronger coordination, cleaner execution.',
    canonical: 'https://www.sattvaglobal.in/',
    ogUrl: 'https://www.sattvaglobal.in/',
  },
  {
    path: '/trade-advisory',
    title: 'Freight Market Intelligence — India Gulf & Red Sea Export Advisory | Sattva Global Logistics',
    description: 'Live freight market intelligence for Indian exporters on Gulf, Red Sea and East Africa shipping. Carrier status, active surcharges, and port workarounds for JNPT and Mundra cargo.',
    canonical: 'https://www.sattvaglobal.in/trade-advisory',
    ogUrl: 'https://www.sattvaglobal.in/trade-advisory',
    noscript: '<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:40px 24px;color:#111;"><h1 style="font-size:1.6rem;color:#050A30;margin-bottom:12px;">Middle East Shipping Crisis — India Export Advisory</h1><p style="font-size:1rem;margin-bottom:20px;">Live freight market intelligence for Indian FCL exporters on Gulf, Red Sea and Middle East shipping disruptions. Updated twice daily — 9:00 AM IST and 3:00 PM IST — from live carrier advisories.</p><h2 style="font-size:1.1rem;color:#024AAB;margin:20px 0 8px;">Disruptions Covered</h2><ul style="line-height:2;padding-left:20px;"><li>Strait of Hormuz — carrier routing and booking status</li><li>Gulf of Aden and Red Sea — security advisories (UKMTO/JMIC)</li><li>Active carrier surcharges — MSC, Maersk, CMA CGM, Hapag-Lloyd</li><li>India port impact — JNPT (Nhava Sheva), Mundra, Ennore, Kolkata</li><li>India-specific exporter actions and booking guidance</li></ul><p style="margin-top:20px;">Contact: <a href="mailto:sujith@sattvaglobal.in">sujith@sattvaglobal.in</a> &bull; <a href="https://www.sattvaglobal.in/">www.sattvaglobal.in</a></p></div>',
  },
  {
    path: '/contact',
    title: 'Get an FCL Freight Quote | Contact Sattva Global Logistics',
    description: 'Request an FCL freight quote for India-origin exports — Gulf, Red Sea, East Africa, and Europe. Share your shipment details and we respond within 4 working hours.',
    canonical: 'https://www.sattvaglobal.in/contact',
    ogUrl: 'https://www.sattvaglobal.in/contact',
  },
  {
    path: '/freight-intelligence-desk',
    title: 'Sattva Freight Intelligence Desk | India-lane Freight Market Intelligence',
    description: 'India-lane freight intelligence for exporters, importers and logistics teams. Market signals translated into booking, routing, quote-validity and customer-communication actions.',
    canonical: 'https://www.sattvaglobal.in/freight-intelligence-desk',
    ogUrl: 'https://www.sattvaglobal.in/freight-intelligence-desk',
  },
  // Lane pages — data-backed (LANES entries exist in src/data/lanes.js)
  {
    path: '/lane/jnpt-to-jebel-ali',
    title: 'JNPT to Jebel Ali FCL Freight | India to UAE Container Shipping | Sattva Global',
    description: 'FCL freight from JNPT (Nhava Sheva) to Jebel Ali — carrier options, transit times, routing notes and documentation guidance for India-UAE FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/jnpt-to-jebel-ali',
    ogUrl: 'https://www.sattvaglobal.in/lane/jnpt-to-jebel-ali',
  },
  {
    path: '/lane/jnpt-to-mombasa',
    title: 'JNPT to Mombasa FCL Freight | India to Kenya Container Shipping | Sattva Global',
    description: 'FCL freight from JNPT to Mombasa — carrier options, transit times, East Africa routing notes and documentation guidance for India-Kenya FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/jnpt-to-mombasa',
    ogUrl: 'https://www.sattvaglobal.in/lane/jnpt-to-mombasa',
  },
  {
    path: '/lane/jnpt-to-jeddah',
    title: 'JNPT to Jeddah FCL Freight | India to Saudi Arabia Container Shipping | Sattva Global',
    description: 'FCL freight from JNPT to Jeddah — carrier options, Red Sea routing status, SABER compliance notes and documentation guidance for India-Saudi FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/jnpt-to-jeddah',
    ogUrl: 'https://www.sattvaglobal.in/lane/jnpt-to-jeddah',
  },
  // Lane pages — sitemap-listed, no LANES entry yet (show "Lane not found" in app until lanes.js is extended)
  {
    path: '/lane/mundra-to-jebel-ali',
    title: 'Mundra to Jebel Ali FCL Freight | India to UAE Container Shipping | Sattva Global',
    description: 'FCL freight from Mundra to Jebel Ali — carrier options, transit times, routing notes and documentation guidance for India-UAE FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/mundra-to-jebel-ali',
    ogUrl: 'https://www.sattvaglobal.in/lane/mundra-to-jebel-ali',
  },
  {
    path: '/lane/mundra-to-dammam',
    title: 'Mundra to Dammam FCL Freight | India to Saudi Arabia Container Shipping | Sattva Global',
    description: 'FCL freight from Mundra to Dammam — carrier options, transit times, Gulf routing notes and documentation guidance for India-Saudi Arabia FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/mundra-to-dammam',
    ogUrl: 'https://www.sattvaglobal.in/lane/mundra-to-dammam',
  },
  {
    path: '/lane/chennai-to-mombasa',
    title: 'Chennai to Mombasa FCL Freight | India to Kenya Container Shipping | Sattva Global',
    description: 'FCL freight from Chennai to Mombasa — carrier options, transit times, East Africa routing notes and documentation guidance for India-Kenya FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/chennai-to-mombasa',
    ogUrl: 'https://www.sattvaglobal.in/lane/chennai-to-mombasa',
  },
  {
    path: '/lane/cochin-to-djibouti',
    title: 'Cochin to Djibouti FCL Freight | India to East Africa Container Shipping | Sattva Global',
    description: 'FCL freight from Cochin to Djibouti — carrier options, transit times, East Africa routing notes and documentation guidance for India-Djibouti FCL exports.',
    canonical: 'https://www.sattvaglobal.in/lane/cochin-to-djibouti',
    ogUrl: 'https://www.sattvaglobal.in/lane/cochin-to-djibouti',
  },
];

function patch(html, { title, description, canonical, ogUrl, noscript }) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,  `$1${description}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/,        `$1${canonical}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${title}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${description}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,         `$1${ogUrl}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${title}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,`$1${description}$2`);
  // Replace noscript block with route-specific content if provided
  if (noscript) {
    html = html.replace(NOSCRIPT_RE, `<noscript>${noscript}</noscript>`);
  }
  return html;
}

// ── Main (top-level await — Node 14.8+ ESM; running Node 22) ─────────────────
const advisory        = await fetchAdvisory();
const advisoryArticle = buildAdvisoryArticle(advisory);

for (const route of routes) {
  let html = patch(base, route);

  // For /trade-advisory: inject static article inside <div id="root">
  // React createRoot().render() replaces #root children on browser mount — no browser impact
  if (route.path === '/trade-advisory' && advisoryArticle) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${advisoryArticle}</div>`,
    );
    console.log('[prerender] Advisory article injected into #root for /trade-advisory');
  }

  if (route.path === '/') {
    writeFileSync(join(DIST, 'index.html'), html);
    console.log('Patched: /');
  } else {
    const dir = join(DIST, route.path.slice(1));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    console.log(`Patched: ${route.path}`);
  }
}
console.log('Prerender complete.');
