// Storage utility — localStorage with sessionStorage fallback (fixes Safari ITP issue #9)
// Safari's ITP can silently fail localStorage writes when site is opened from a link.
// We detect the failure and fall back to sessionStorage transparently.

const SESSION_KEY = "sattva-verified-user";
const SESSION_DAYS = 30;
const PIN_KEY = "sattva-admin-pin";

function storageAvailable(type) {
  try {
    const s = window[type];
    const t = "__test__";
    s.setItem(t, t);
    s.removeItem(t);
    return true;
  } catch { return false; }
}

// Use localStorage if available, fall back to sessionStorage (Safari ITP fix)
function getStore() {
  if (storageAvailable("localStorage")) return localStorage;
  if (storageAvailable("sessionStorage")) return sessionStorage;
  return null; // both blocked (e.g. private browsing with all storage disabled)
}

export function saveSession(user) {
  try {
    const store = getStore();
    if (!store) return;
    store.setItem(SESSION_KEY, JSON.stringify({
      user,
      expiry: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
    }));
  } catch {}
}

export function loadSession() {
  try {
    // Try localStorage first, then sessionStorage
    for (const key of ["localStorage", "sessionStorage"]) {
      try {
        const raw = window[key]?.getItem(SESSION_KEY);
        if (!raw) continue;
        const { user, expiry } = JSON.parse(raw);
        if (Date.now() > expiry) { window[key].removeItem(SESSION_KEY); continue; }
        return user;
      } catch {}
    }
    return null;
  } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

// Admin PIN — use sessionStorage (PIN clears on tab close = more secure, fix #6)
export async function lp() {
  try { return sessionStorage.getItem(PIN_KEY); } catch { return null; }
}
export async function sp(p) {
  try { sessionStorage.setItem(PIN_KEY, p); } catch {}
}
