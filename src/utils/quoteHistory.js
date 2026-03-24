// Quote history per verified user — FAIL-17: now uses storage-safe wrapper
// FAIL-16: email keys normalised with trim().toLowerCase()
const KEY = 'sattva_quote_history';

function getStore() {
  for (const t of ["localStorage", "sessionStorage"]) {
    try {
      const s = window[t];
      s.setItem("__t__", "1");
      s.removeItem("__t__");
      return s;
    } catch {}
  }
  return null;
}

function getAll() {
  try {
    for (const t of ["localStorage", "sessionStorage"]) {
      try {
        const raw = window[t]?.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return {};
  } catch { return {}; }
}

export function saveQuoteHistory(email, pol, pod, cargo) {
  if (!email) return;
  const key = email.trim().toLowerCase(); // FAIL-16: normalise email
  const all = getAll();
  const user = all[key] || { polHistory: [], podHistory: [], cargoHistory: [], routes: [] };

  if (pol && !user.polHistory.includes(pol))
    user.polHistory = [pol, ...user.polHistory].slice(0, 5);
  if (pod && !user.podHistory.includes(pod))
    user.podHistory = [pod, ...user.podHistory].slice(0, 5);
  if (cargo && !user.cargoHistory.includes(cargo))
    user.cargoHistory = [cargo, ...user.cargoHistory].slice(0, 5);
  if (pol && pod) {
    const route = `${pol}→${pod}`;
    user.routes = [route, ...user.routes.filter(r => r !== route)].slice(0, 5);
  }

  all[key] = user;
  try { getStore()?.setItem(KEY, JSON.stringify(all)); } catch {}
}

export function getQuoteHistory(email) {
  if (!email) return { polHistory: [], podHistory: [], cargoHistory: [], routes: [] };
  const key = email.trim().toLowerCase(); // FAIL-16: normalise email
  const all = getAll();
  return all[key] || { polHistory: [], podHistory: [], cargoHistory: [], routes: [] };
}
