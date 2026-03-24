// Fuzzy cargo search using HS code database
// Scoring: exact name match > alias exact > name contains > alias contains > word overlap
import { HS_CARGO } from '../data/hsCargo.js';

function normalize(str) {
  return str.toLowerCase().replace(/[\/\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordOverlap(query, target) {
  const qWords = normalize(query).split(' ').filter(w => w.length > 2);
  const tWords = normalize(target).split(' ');
  return qWords.filter(w => tWords.some(t => t.includes(w) || w.includes(t))).length;
}

export function searchCargo(query, limit = 12) {
  if (!query || query.trim().length < 2) return [];
  const q = normalize(query);

  const scored = HS_CARGO.map(item => {
    const name = normalize(item.name);
    const aliases = item.aliases.map(normalize);
    let score = 0;

    // Tier 1: exact name match
    if (name === q) score = 1000;
    // Tier 2: name starts with query
    else if (name.startsWith(q)) score = 800;
    // Tier 3: name contains query
    else if (name.includes(q)) score = 600;
    // Tier 4: any alias exact match
    else if (aliases.some(a => a === q)) score = 700;
    // Tier 5: any alias starts with query
    else if (aliases.some(a => a.startsWith(q))) score = 500;
    // Tier 6: any alias contains query
    else if (aliases.some(a => a.includes(q))) score = 400;
    // Tier 7: word overlap on name
    else {
      const nameOverlap = wordOverlap(q, item.name);
      const aliasOverlap = Math.max(...item.aliases.map(a => wordOverlap(q, a)));
      score = Math.max(nameOverlap, aliasOverlap) * 50;
    }

    return { ...item, score };
  });

  return scored
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(i => ({ code: i.code, name: i.name }));
}
