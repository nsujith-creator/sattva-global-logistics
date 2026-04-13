/**
 * RateGate.jsx — Identity gate for rate access (no OTP)
 * Collects name, company, email, phone — unlocks immediately on submit.
 */
import { useState } from "react";
import { saveSession } from "../../utils/session.js";
import { PhoneField } from "./PhoneField.jsx";

export default function RateGate({ onUnlock, isMobile, st }) {
  const [sending, setSending] = useState(false);
  const [errs, setErrs]       = useState({});
  const [phoneErr, setPhoneErr] = useState("");
  const [g, setG] = useState({ name: "", company: "", email: "", phone: "" });

  const set = (field) => (e) => setG(p => ({ ...p, [field]: e.target.value }));

  const inp = (err) => ({
    width: "100%", padding: "11px 14px",
    border: `1.5px solid ${err ? "#dc2626" : "#b8cde8"}`,
    borderRadius: 8, fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", background: "#fff",
  });
  const lb = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5, display: "block", letterSpacing: 0.3 };
  const errStyle = { fontSize: 11, color: "#dc2626", marginTop: 3 };
  const btnPrimary = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "12px 24px", background: "#024aab", color: "#fff",
    borderRadius: 8, fontWeight: 600, fontSize: 14, border: "none",
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 14px rgba(2,74,171,0.25)",
    opacity: sending ? 0.7 : 1,
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrs = {};
    if (!g.name.trim())  newErrs.name  = "Name is required.";
    if (!g.email.trim()) newErrs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) newErrs.email = "Invalid email address.";
    if (phoneErr) newErrs.phone = phoneErr;
    if (Object.keys(newErrs).length) { setErrs(newErrs); return; }

    setErrs({});
    setSending(true);
    try {
      const user = {
        name:    g.name.trim(),
        company: g.company.trim() || "",
        email:   g.email.trim().toLowerCase(),
        phone:   g.phone.trim()   || "",
      };
      const token = `guest_${Date.now()}`;
      saveSession(user, token);
      onUnlock(user, token);
    } catch (err) {
      setErrs({ submit: "Something went wrong. Please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div>
          <label style={lb}>Your Name *</label>
          <input style={inp(errs.name)} type="text" value={g.name}
            onChange={set("name")} placeholder="Full name" autoComplete="name"/>
          {errs.name && <div style={errStyle}>{errs.name}</div>}
        </div>
        <div>
          <label style={lb}>Company</label>
          <input style={inp(false)} type="text" value={g.company}
            onChange={set("company")} placeholder="Company name" autoComplete="organization"/>
        </div>
        <div>
          <label style={lb}>Email *</label>
          <input style={inp(errs.email)} type="email" value={g.email}
            onChange={set("email")} placeholder="you@yourcompany.com" autoComplete="email"/>
          {errs.email && <div style={errStyle}>{errs.email}</div>}
        </div>
        <div>
          <label style={lb}>Phone</label>
          <PhoneField
            value={g.phone}
            onChange={v => setG(p => ({ ...p, phone: v }))}
            error={errs.phone || phoneErr}
            onError={setPhoneErr}
            st={st}
          />
        </div>
      </div>
      {errs.submit && <div style={{ ...errStyle, marginTop: 12, fontSize: 13 }}>{errs.submit}</div>}
      <button type="submit" style={{ ...btnPrimary, marginTop: 18 }} disabled={sending}>
        {sending ? "Loading rates…" : "View Freight Rates →"}
      </button>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
        We use this to send you the quote confirmation and follow up on your shipment.
      </div>
    </form>
  );
}
