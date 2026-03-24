// Persist quote form state to sessionStorage so OTP expiry / tab refresh doesn't wipe it
const FORM_KEY = "sattva-quote-form";

export function saveFormState(f) {
  try { sessionStorage.setItem(FORM_KEY, JSON.stringify(f)); } catch {}
}

export function loadFormState() {
  try {
    const s = sessionStorage.getItem(FORM_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearFormState() {
  try { sessionStorage.removeItem(FORM_KEY); } catch {}
}
