// Quote history per verified user — stored in localStorage keyed by email
const KEY = 'sattva_quote_history';

function getAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function saveQuoteHistory(email, pol, pod, cargo) {
  if (!email) return;
  const all = getAll();
  const user = all[email] || { polHistory: [], podHistory: [], cargoHistory: [], routes: [] };

  // Add to POL history (max 5, deduped)
  if (pol && !user.polHistory.includes(pol)) {
    user.polHistory = [pol, ...user.polHistory].slice(0, 5);
  }
  // Add to POD history (max 5, deduped)
  if (pod && !user.podHistory.includes(pod)) {
    user.podHistory = [pod, ...user.podHistory].slice(0, 5);
  }
  // Add to cargo history (max 5, deduped)
  if (cargo && !user.cargoHistory.includes(cargo)) {
    user.cargoHistory = [cargo, ...user.cargoHistory].slice(0, 5);
  }
  // Save POL→POD route combo (max 5 recent, deduped by key)
  if (pol && pod) {
    const route = `${pol}→${pod}`;
    user.routes = [route, ...user.routes.filter(r => r !== route)].slice(0, 5);
  }

  all[email] = user;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
}

export function getQuoteHistory(email) {
  if (!email) return { polHistory: [], podHistory: [], cargoHistory: [], routes: [] };
  const all = getAll();
  return all[email] || { polHistory: [], podHistory: [], cargoHistory: [], routes: [] };
}
