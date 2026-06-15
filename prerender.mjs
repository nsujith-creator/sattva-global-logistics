// prerender.mjs — zero-dependency post-build static HTML patching
// Runs after `vite build`. Reads dist/index.html, writes per-route HTML files
// with route-specific title, description, canonical, and OG tags so that
// static crawlers and AI crawlers see correct metadata without JS execution.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DIST = 'dist';
const base = readFileSync(join(DIST, 'index.html'), 'utf8');

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

function patch(html, { title, description, canonical, ogUrl }) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,  `$1${description}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/,        `$1${canonical}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${title}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${description}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,         `$1${ogUrl}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${title}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,`$1${description}$2`);
  return html;
}

for (const route of routes) {
  const html = patch(base, route);
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
