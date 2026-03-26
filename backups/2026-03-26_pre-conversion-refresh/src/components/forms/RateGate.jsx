/**
 * RateGate.jsx — OTP gate for rate access
 * Styled card with 2-column grid layout, PhoneField with country codes + flags.
 */
import { useState, useEffect, useRef } from "react";
import { apiPost } from "../../api/supabase.js";
import { saveSession } from "../../utils/session.js";
import { PhoneField } from "./PhoneField.jsx";

const FREE_DOMAINS = [
  "gmail.com","yahoo.com","yahoo.in","yahoo.co.in","hotmail.com","outlook.com",
  "live.com","msn.com","icloud.com","me.com","mac.com","aol.com","protonmail.com",
  "proton.me","tutanota.com","zoho.com","rediffmail.com","ymail.com","inbox.com",
  "mail.com","gmx.com","gmx.net","fastmail.com","hushmail.com","lycos.com",
  "excite.com","usa.com","email.com","consultant.com","contractor.net",
];

function isCompanyEmail(email) {
  const domain = email.trim().toLowerCase().split("@")[1] || "";
  return !FREE_DOMAINS.includes(domain);
}

export default function RateGate({ onUnlock, isMobile, st }) {
  const [step, setStep]           = useState("details");
  const [sending, setSending]     = useState(false);
  const [errs, setErrs]           = useState({});
  const [phoneErr, setPhoneErr]   = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [timeLeft, setTimeLeft]   = useState(600);

  const timerRef = useRef(null);
  const countRef = useRef(null);

  const [g, setG] = useState({ name: "", company: "", email: "", phone: "", otp: "" });

  // OTP expiry countdown
  useEffect(() => {
    if (step !== "verify" || !otpExpiry) return;
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.round((otpExpiry - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs <= 0) clearInterval(timerRef.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, otpExpiry]);

  // Resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    countRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(countRef.current); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(countRef.current);
  }, [countdown]);

  const set = (field) => (e) => setG(p => ({ ...p, [field]: e.target.value }));

  const inp = (err) => ({
    width: "100%", padding: "11px 14px",
    border: `1.5px solid ${err ? "#dc2626" : "#b8cde8"}`,
    borderRadius: 8, fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", background: "#fff",
  });
  const lb = {
    fontSize: 12, fontWeight: 600, color: "#334155",
    marginBottom: 5, display: "block", letterSpacing: 0.3,
  };
  const errStyle = { fontSize: 11, color: "#dc2626", marginTop: 3 };

  const btnPrimary = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "12px 24px", background: "#024aab", color: "#fff",
    borderRadius: 8, fontWeight: 600, fontSize: 14, border: "none",
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 14px rgba(2,74,171,0.25)",
    opacity: sending ? 0.7 : 1,
  };
  const btnLink = {
    background: "none", border: "none", color: "#64748b",
    fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit",
  };

  // ── Step 1: Send OTP ─────────────────────────────────────────────
  async function sendOtp(e) {
    e.preventDefault();
    const newErrs = {};
    if (!g.name.trim())  newErrs.name  = "Name is required.";
    if (!g.email.trim()) newErrs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) newErrs.email = "Invalid email address.";
    else if (!isCompanyEmail(g.email)) newErrs.email = "Please use your company email address.";
    if (phoneErr) newErrs.phone = phoneErr;
    if (Object.keys(newErrs).length) { setErrs(newErrs); return; }

    setErrs({});
    setSending(true);
    try {
      await apiPost("send-otp", {
        email:   g.email.trim().toLowerCase(),
        name:    g.name.trim(),
        company: g.company.trim() || undefined,
        phone:   g.phone.trim()   || undefined,
      });
      setStep("verify");
      setOtpExpiry(Date.now() + 10 * 60 * 1000);
      setTimeLeft(600);
      setCountdown(60);
    } catch (err) {
      setErrs({ submit: err.message || "Failed to send OTP. Please try again." });
    } finally {
      setSending(false);
    }
  }

  // ── Step 2: Verify OTP ───────────────────────────────────────────
  async function verifyOtp(e) {
    e.preventDefault();
    if (!g.otp.trim() || !/^\d{6}$/.test(g.otp.trim())) {
      setErrs({ otp: "Please enter the 6-digit code from your email." });
      return;
    }
    setErrs({});
    setSending(true);
    try {
      const { token, user } = await apiPost("verify-otp", {
        email:   g.email.trim().toLowerCase(),
        otp:     g.otp.trim(),
        name:    g.name.trim(),
        company: g.company.trim() || undefined,
        phone:   g.phone.trim()   || undefined,
      });
      saveSession(user, token);
      onUnlock(user, token);
    } catch (err) {
      setErrs({ otp: err.message || "Verification failed. Please try again." });
    } finally {
      setSending(false);
    }
  }

  // ── Resend OTP ───────────────────────────────────────────────────
  async function resendOtp() {
    if (countdown > 0) return;
    setSending(true);
    setErrs({});
    try {
      await apiPost("send-otp", {
        email:   g.email.trim().toLowerCase(),
        name:    g.name.trim(),
        company: g.company.trim() || undefined,
        phone:   g.phone.trim()   || undefined,
      });
      setOtpExpiry(Date.now() + 10 * 60 * 1000);
      setTimeLeft(600);
      setCountdown(60);
    } catch (err) {
      setErrs({ submit: err.message || "Failed to resend OTP." });
    } finally {
      setSending(false);
    }
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Render: Details step ─────────────────────────────────────────
  if (step === "details") {
    return (
      <form onSubmit={sendOtp} noValidate>
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
            <label style={lb}>Company Email *</label>
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
          {sending ? "Sending code…" : "Send Verification Code →"}
        </button>
      </form>
    );
  }

  // ── Render: Verify step ──────────────────────────────────────────
  return (
    <form onSubmit={verifyOtp} noValidate>
      <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
        A 6-digit code was sent to <strong>{g.email}</strong>.{" "}
        {timeLeft > 0
          ? <>Expires in <strong style={{ color: "#024aab" }}>{fmt(timeLeft)}</strong>.</>
          : <span style={{ color: "#dc2626" }}>Code has expired — please request a new one.</span>
        }
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={lb}>Enter 6-digit Code *</label>
          <input style={{ ...inp(errs.otp), fontSize: 22, fontWeight: 700, letterSpacing: 6, textAlign: "center" }}
            type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
            value={g.otp} onChange={set("otp")} placeholder="——————"
            autoComplete="one-time-code" autoFocus/>
          {errs.otp && <div style={errStyle}>{errs.otp}</div>}
        </div>
        <button type="submit" style={{ ...btnPrimary, marginTop: 22, whiteSpace: "nowrap" }} disabled={sending}>
          {sending ? "Verifying…" : "Verify & Unlock →"}
        </button>
      </div>

      {errs.submit && <div style={{ ...errStyle, marginTop: 10, fontSize: 13 }}>{errs.submit}</div>}

      <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>Didn't receive it? Check spam.</span>
        {countdown > 0
          ? <span style={{ fontSize: 12, color: "#64748b" }}>Resend in {countdown}s</span>
          : <button type="button" style={{ ...btnLink, color: "#024aab", fontWeight: 600, fontSize: 12 }}
              onClick={resendOtp} disabled={sending}>Resend Code</button>
        }
        <button type="button" style={btnLink}
          onClick={() => { setStep("details"); setErrs({}); }}>
          ← Use different email
        </button>
      </div>
    </form>
  );
}
