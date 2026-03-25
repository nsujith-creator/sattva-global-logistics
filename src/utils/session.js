const SESSION_KEY = "sattva_session_v2";

export function saveSession(user, token) {
  const payload = JSON.stringify({
    user,
    token,
    expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  try { sessionStorage.setItem(SESSION_KEY, payload); } catch {}
  try { localStorage.setItem(SESSION_KEY, payload); } catch {}
}

export function loadSession() {
  for (const store of ["sessionStorage", "localStorage"]) {
    try {
      const raw = window[store]?.getItem(SESSION_KEY);
      if (!raw) continue;
      const { user, token, expiry } = JSON.parse(raw);
      if (Date.now() > expiry) {
        window[store].removeItem(SESSION_KEY);
        continue;
      }
      return { user, token };
    } catch {}
  }
  return null;
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function getSessionToken() {
  return loadSession()?.token || null;
}
