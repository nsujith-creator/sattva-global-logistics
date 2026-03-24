// Persist quote form state — uses same storage abstraction as session.js (FAIL-17 fix)
// sessionStorage preferred; falls back gracefully if blocked (Safari ITP, strict privacy modes)
const FORM_KEY = "sattva-quote-form";

function getStore() {
  for (const t of ["sessionStorage", "localStorage"]) {
    try {
      const s = window[t];
      s.setItem("__t__", "1");
      s.removeItem("__t__");
      return s;
    } catch {}
  }
  return null;
}

export function saveFormState(f) {
  try { getStore()?.setItem(FORM_KEY, JSON.stringify(f)); } catch {}
}

export function loadFormState() {
  try {
    for (const t of ["sessionStorage", "localStorage"]) {
      try {
        const raw = window[t]?.getItem(FORM_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  } catch { return null; }
}

export function clearFormState() {
  try { sessionStorage.removeItem(FORM_KEY); } catch {}
  try { localStorage.removeItem(FORM_KEY); } catch {}
}
