import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { CarrierBadge } from "../components/shared/CarrierBadge";
import { CARRIERS } from "../data/carriers";
import { B, FF } from "../theme/tokens";
import { useIsMobile } from "../hooks/useIsMobile";
import { POL, ALL_POD } from "../data/ports";
import { PhoneField } from "../components/forms/PhoneField";
import { submitQuoteAPI } from "../api/rates";
import { EQ, EQ_L } from "../data/equipment";
import { HeroMap } from "../components/shared/HeroMap";

/* ── Full homepage quote card — submits directly, no redirect ── */
function HomeQuoteCard({ st, I }) {
  const BLANK = { pol: "", pod: "", cargo: "", eq: "", name: "", phone: "", email: "" };
  const [f, setF] = useState(BLANK);
  const [phoneErr, setPhoneErr] = useState("");
  const [errs, setErrs] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!f.pol) e.pol = "Required";
    if (!f.pod) e.pod = "Required";
    if (!f.eq) e.eq = "Required";
    if (!f.name.trim()) e.name = "Required";
    if (!f.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Invalid email";
    if (phoneErr) e.phone = phoneErr;
    setErrs(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (sending || !validate()) return;
    setSending(true); setSendErr("");
    const polName = POL.find(p => p.c === f.pol)?.n || f.pol;
    const podName = ALL_POD.find(p => p.c === f.pod)?.n || f.pod;
    try {
      await submitQuoteAPI({ pol: `${polName} (${f.pol})`, pod: `${podName} (${f.pod})`, equipment: `${EQ_L[f.eq] || f.eq} (${f.eq})`, containers: 1, cargo: f.cargo || "", notes: "", name: f.name, company: "", email: f.email, phone: f.phone || "", rateFound: false }, "anon");
      setDone(true);
    } catch {
      setSendErr("Submission failed — please call +91 9136 121 123 or email quotes@sattvaglobal.in");
    } finally { setSending(false); }
  };

  if (done) return (
    <div style={{ ...st.cd, maxWidth: 470, width: "100%", padding: 32, borderTop: `4px solid #16a34a`, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
      </div>
      <h3 style={{ ...st.h3, fontSize: 18, marginBottom: 8 }}>Quote Request Received</h3>
      <p style={{ fontSize: 13, color: B.g5, lineHeight: 1.7 }}>We'll come back to you within 4 working hours. Urgent? Call <a href="tel:+919136121123" style={{ color: B.primary, fontWeight: 600 }}>+91 9136 121 123</a></p>
      <button onClick={() => setDone(false)} style={{ ...st.bs, marginTop: 16, fontSize: 12 }}>Submit another</button>
    </div>
  );

  return (
    <div style={{ ...st.cd, maxWidth: 470, width: "100%", padding: 32, borderTop: `4px solid ${B.primary}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Get a Quote</div>
      <h3 style={{ ...st.h3, fontSize: 19, marginBottom: 20 }}>We confirm within 4 working hours</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <HomePortCombo label="From (POL) *" value={f.pol} onChange={v => { up("pol", v); setErrs(p => ({ ...p, pol: "" })); }} options={POL} placeholder="JNPT, Mundra, Chennai, Cochin…" error={errs.pol} />
        <HomePortCombo label="To (POD) *" value={f.pod} onChange={v => { up("pod", v); setErrs(p => ({ ...p, pod: "" })); }} options={ALL_POD} placeholder="Jebel Ali, Dammam, Mombasa…" error={errs.pod} />
        <HomeCargoCombo value={f.cargo} onChange={v => up("cargo", v)} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Equipment *</div>
          <select style={{ ...st.inp, borderColor: errs.eq ? B.red : undefined }} value={f.eq} onChange={e => { up("eq", e.target.value); setErrs(p => ({ ...p, eq: "" })); }}>
            <option value="">Select container type</option>
            {EQ.map(e => <option key={e} value={e}>{EQ_L[e]} ({e})</option>)}
          </select>
          {errs.eq && <div style={{ fontSize: 11, color: B.red, marginTop: 3 }}>{errs.eq}</div>}
        </div>
        <div style={{ borderTop: `1px solid ${B.g2}`, paddingTop: 12, marginTop: 4 }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Name *</div>
          <input style={{ ...st.inp, borderColor: errs.name ? B.red : undefined }} type="text" value={f.name} onChange={e => { up("name", e.target.value); setErrs(p => ({ ...p, name: "" })); }} placeholder="Your full name" />
          {errs.name && <div style={{ fontSize: 11, color: B.red, marginTop: 3 }}>{errs.name}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Email *</div>
          <input style={{ ...st.inp, borderColor: errs.email ? B.red : undefined }} type="email" value={f.email} onChange={e => { up("email", e.target.value); setErrs(p => ({ ...p, email: "" })); }} placeholder="you@company.com" />
          {errs.email && <div style={{ fontSize: 11, color: B.red, marginTop: 3 }}>{errs.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Phone</div>
          <PhoneField value={f.phone} onChange={v => up("phone", v)} error={errs.phone || phoneErr} onError={setPhoneErr} st={st} />
        </div>
      </div>
      {sendErr && <div style={{ fontSize: 12, color: B.red, marginTop: 12, padding: "10px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>{sendErr}</div>}
      <button onClick={handleSubmit} disabled={sending} style={{ ...st.bp, width: "100%", justifyContent: "center", marginTop: 16, opacity: sending ? 0.7 : 1 }}>
        {sending ? "Submitting…" : <>Submit Quote Request <I.Ar /></>}
      </button>
      <div style={{ fontSize: 11, color: B.g5, textAlign: "center", marginTop: 8 }}>Typical response: within 4 working hours</div>
    </div>
  );
}
function HomePortCombo({ label, value, onChange, options, placeholder }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useState(() => ({ current: null }))[0];
  const selected = options.find(o => o.c === value);
  const display = focused ? q : (selected ? `${selected.n} (${selected.c})` : "");
  const items = q.length > 0
    ? options.filter(o => o.n.toLowerCase().includes(q.toLowerCase()) || o.c.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : [];
  const pick = (code) => { onChange(code); setQ(""); setOpen(false); setFocused(false); };
  const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" };
  return (
    <div ref={el => ref.current = el} style={{ position: "relative" }} onBlur={e => { if (!ref.current?.contains(e.relatedTarget)) { setOpen(false); setFocused(false); setQ(""); } }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <input type="text" value={display} style={inp} placeholder={placeholder} autoComplete="off"
        onChange={e => { setQ(e.target.value); if (!e.target.value) onChange(""); setOpen(true); }}
        onFocus={() => { setFocused(true); setQ(selected ? `${selected.n} (${selected.c})` : ""); setOpen(true); }} />
      {open && items.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999, background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 200, overflowY: "auto", marginTop: 2 }}>
          {items.map(o => (
            <div key={o.c} onMouseDown={() => pick(o.c)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={e => e.currentTarget.style.background = "#e8f0ff"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <span>{o.n}</span><span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>{o.c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mini CargoCombo for homepage ── */
function HomeCargoCombo({ value, onChange }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" };
  const handleChange = (e) => {
    const v = e.target.value; setQ(v); onChange(v); setOpen(true);
    if (v.length >= 2) { import("../utils/cargoSearch").then(m => setResults(m.searchCargo(v, 8))).catch(() => setResults([])); }
    else setResults([]);
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Cargo Type</div>
      <input type="text" value={value} style={inp} placeholder="Garments, FMCG, Agro, Engineering…" autoComplete="off"
        onChange={handleChange} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999, background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 200, overflowY: "auto", marginTop: 2 }}>
          {results.map((o, i) => (
            <div key={i} onMouseDown={() => { onChange(o.name); setQ(o.name); setOpen(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={e => e.currentTarget.style.background = "#e8f0ff"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <span>{o.name}</span>{o.code && <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 600 }}>HS {o.code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HomePage({ st, I }) {
  const go = useNavigate();
  const m = useIsMobile();
  const [hqPol, setHqPol] = useState("");
  const [hqPod, setHqPod] = useState("");
  const [hqCargo, setHqCargo] = useState("");

  const cargoFocus = [
    "Readymade garments",
    "Fabrics & cotton yarn",
    "Food products & FMCG",
    "Kitchen utensils",
    "Paper products",
    "Towels & home textiles",
    "Agro commodities",
    "Engineering goods",
    "Machinery",
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What kind of cargo does Sattva work best with?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sattva specialises in FCL general cargo from India — garments, fabrics, cotton yarn, food products, FMCG cargo, kitchenware, paper products, towels, agro commodities, engineering goods and machinery.",
        },
      },
      {
        "@type": "Question",
        name: "Which ports do you operate from?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We handle FCL exports from JNPT (Nhava Sheva), Mundra, Chennai and Cochin to Gulf, Red Sea and Africa destinations.",
        },
      },
      {
        "@type": "Question",
        name: "Can I still enquire if my route is not preloaded?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. If indicative pricing is available for your route you will see it after verification. If not, you can still submit the shipment details and our team will review it directly.",
        },
      },
      {
        "@type": "Question",
        name: "How is Sattva different from other freight forwarders?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most exporters do not leave a forwarder over price. They leave over poor follow-up, unclear communication and avoidable last-minute problems. Sattva is built for exporters who want a forwarder that stays engaged from quote through departure.",
        },
      },
    ],
  };

  return (
    <>
      <Helmet>
        <title>FCL Freight Forwarding India to Gulf, Red Sea & Africa | Sattva Global</title>
        <meta
          name="description"
          content="FCL freight rates from JNPT &amp; Mundra to Jebel Ali, Dammam, Jeddah and Mombasa. India export specialists with 20+ years experience. Request a quote today."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(160deg,${B.lightBlue}55 0%,${B.w} 50%,${B.g1} 100%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: `radial-gradient(circle,${B.primary}08,transparent 70%)`,
          }}
        />
        <div
          style={{
            ...st.sec,
            display: "grid",
            gridTemplateColumns: m ? "1fr" : "1.08fr .92fr",
            gap: m ? 32 : 56,
            alignItems: "center",
            paddingTop: m ? 100 : 110,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 16 }}>
              FCL Export Freight from India · 20+ Years in Ocean Freight
            </div>
            <h1 style={st.h1}>
              Export Freight from India to West Asia & Africa —{" "}
              <span style={{ color: B.primary }}>Done Properly</span>
            </h1>
            <p style={{ ...st.bd, fontSize: m ? 15 : 17, marginTop: 20, maxWidth: 640 }}>
              20+ years handling real shipments out of JNPT, Mundra, Chennai and Cochin. We focus on repeat FCL export cargo — garments, FMCG, agro, engineering goods — where execution actually matters.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <button onClick={() => go("/quote")} style={{ ...st.bp, fontSize: m ? 13 : 14 }}>
                Get a Freight Quote <I.Ar />
              </button>
              <button onClick={() => go("/why-sattva")} style={{ ...st.bs, fontSize: m ? 13 : 14 }}>
                Why Exporters Choose Sattva
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              {["JNPT", "Mundra", "Chennai", "Cochin", "FCL", "General Cargo", "Gulf · Red Sea · Africa"].map((chip) => (
                <span
                  key={chip}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: B.primary,
                    background: `${B.primary}10`,
                    borderRadius: 999,
                    padding: "6px 10px",
                    letterSpacing: 0.3,
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: B.g5, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, color: B.g7 }}>Part of DFA Network</span>
              <span>— Global freight forwarder network across 190+ countries</span>
            </div>
            <div style={{ display: "flex", gap: m ? 24 : 36, marginTop: 36, flexWrap: "wrap" }}>
              {[
                ["20+", "Years in ocean freight & export logistics"],
                ["JNPT", "Focused India-origin export handling"],
                ["West Asia", "Gulf · Red Sea · Africa trade lanes"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div style={{ fontSize: m ? 24 : 28, fontWeight: 800, color: B.primary, fontFamily: FF }}>{n}</div>
                  <div style={{ fontSize: 12, color: B.g5, maxWidth: 150, lineHeight: 1.6 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          {!m && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <HomeQuoteCard st={st} I={I} />
            </div>
          )}
        </div>
      </section>

      {/* ── TRADE NETWORK MAP ──────────────────────────────────────────── */}
      <HeroMap />

      {/* ── CARGO FOCUS ─────────────────────────────────────────────────── */}
      <section>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 38 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Cargo We Handle</div>
            <h2 style={st.h2}>General export cargo from India — this is our core</h2>
            <p style={st.sub}>We are not a niche or project cargo forwarder. Our entire operation is built around the mainstream general cargo that Indian exporters ship every week.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr 1fr" : "repeat(3,1fr)", gap: 16 }}>
            {cargoFocus.map((cargo) => (
              <div key={cargo} style={{ ...st.cd, padding: "20px 22px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${B.primary}08`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <I.Ck />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.dark }}>{cargo}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={() => go("/industries")} style={{ ...st.bs }}>
              See industries we support <I.Ar />
            </button>
          </div>
        </div>
      </section>

      {/* ── WHY SATTVA TEASER ────────────────────────────────────────────── */}
      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Why It Matters</div>
            <h2 style={st.h2}>Most forwarder problems happen after the quote is sent</h2>
            <p style={st.sub}>Exporters do not usually switch forwarders because of price. They switch because follow-up stops, communication gets vague, and problems surface after the cargo has left the factory — too late to fix cleanly.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(3,1fr)", gap: 20 }}>
            {[
              ["Commercial clarity before you commit", "Know what is included, what assumptions apply and where cost or timing can shift — before the cargo moves, not after."],
              ["A forwarder who stays in the loop", "From booking through cut-off and vessel departure, the team stays close to the shipment and keeps you informed without you having to chase."],
              ["Route experience that saves time", "We understand how India-origin cargo actually moves to the Gulf, Red Sea and Africa — and what the practical issues look like on each lane."],
            ].map(([t, d]) => (
              <div key={t} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
                <h3 style={{ ...st.h3, marginBottom: 10 }}>{t}</h3>
                <p style={{ ...st.bd, fontSize: 14 }}>{d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={() => go("/why-sattva")} style={{ ...st.bs }}>
              Full picture — why exporters choose Sattva <I.Ar />
            </button>
          </div>
        </div>
      </section>

      {/* ── TRADE LANES DARK SECTION ─────────────────────────────────────── */}
      <section style={{ background: B.dark, padding: m ? "40px 16px" : "64px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Trade Lanes</div>
            <h2 style={{ ...st.h2, color: "#fff", margin: 0 }}>Routes we know well — India to Gulf, Red Sea & Africa</h2>
            <p style={{ ...st.sub, color: "rgba(255,255,255,.72)", marginTop: 16 }}>FCL cargo from major Indian ports into the markets that matter for Indian exporters.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
            {[
              { region: "Middle East & Upper Gulf", color: B.accent, lanes: ["JNPT → Jebel Ali", "Mundra → Jebel Ali", "JNPT → Dammam", "JNPT → Jeddah"] },
              { region: "Red Sea & East Africa", color: "#10b981", lanes: ["JNPT → Mombasa", "Mundra → Mombasa", "JNPT → Dar es Salaam", "JNPT → Djibouti"] },
              { region: "Select Africa Markets", color: "#f59e0b", lanes: ["JNPT → Durban", "JNPT → Maputo", "Mundra → Lagos", "JNPT → Tema"] },
            ].map((r) => (
              <div key={r.region} style={{ background: "rgba(255,255,255,.05)", borderRadius: 12, padding: 24, border: "1px solid rgba(255,255,255,.1)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.color, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>{r.region}</div>
                {r.lanes.map((lane) => (
                  <div key={lane} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.07)", fontSize: 13, color: "rgba(255,255,255,.85)" }}>
                    {lane}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <button onClick={() => go("/trade-lanes")} style={{ ...st.bp, background: "#fff", color: B.dark }}>
              View All Trade Lanes <I.Ar />
            </button>
          </div>
        </div>
      </section>

      {/* ── SERVICES OVERVIEW ────────────────────────────────────────────── */}
      <section>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>What We Do</div>
            <h2 style={st.h2}>More than a booking — export shipment coordination from India</h2>
            <p style={st.sub}>Getting a container number is the easy part. What exporters need is a forwarder who handles what happens between the factory and the vessel.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
            {[
              { icon: <I.Sh />, t: "FCL ocean freight from India", d: "Bookings on major carriers from JNPT, Mundra, Chennai and Cochin to Gulf, Red Sea and Africa trade flows." },
              { icon: <I.Sd />, t: "Documentation-conscious execution", d: "Cleaner handling when the shipment depends on getting the paperwork right before cargo moves — not correcting it after." },
              { icon: <I.Gl />, t: "Route and shipment planning", d: "Practical guidance on route fit, transit times, carrier options and the commercial implications of the movement." },
              { icon: <I.Tr />, t: "Factory-to-port coordination", d: "Better alignment between factory dispatch, CFS handover, port cut-off milestones and vessel departure." },
            ].map((x) => (
              <div key={x.t} style={{ ...st.cd, padding: "34px 28px" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${B.primary}08`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{x.icon}</div>
                <h3 style={{ ...st.h3, marginBottom: 10 }}>{x.t}</h3>
                <p style={{ ...st.bd, fontSize: 14 }}>{x.d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={() => go("/services")} style={{ ...st.bs }}>
              Full services overview <I.Ar />
            </button>
          </div>
        </div>
      </section>

      {/* ── HOW WE WORK ──────────────────────────────────────────────────── */}
      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 38 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>How We Work</div>
            <h2 style={st.h2}>From first enquiry to shipment departure — here is what to expect</h2>
            <p style={st.sub}>A straightforward process designed to reduce back-and-forth and get your export moving without last-minute confusion.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(4,1fr)", gap: 18 }}>
            {[
              ["01", "Share your route & cargo", "Tell us your port, destination, cargo type, equipment need and any shipment-specific context."],
              ["02", "We check route fit", "We confirm whether the lane is supported and what the right next step looks like commercially."],
              ["03", "Get pricing or manual review", "Supported lanes may show indicative pricing. Others go into direct commercial review with the team."],
              ["04", "Execute the shipment together", "We stay with the movement — booking, documentation, inland coordination and pre-departure milestones."],
            ].map(([n, t, d]) => (
              <div key={n} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: B.primary, fontFamily: FF, marginBottom: 10 }}>{n}</div>
                <h3 style={{ ...st.h3, marginBottom: 8 }}>{t}</h3>
                <p style={{ ...st.bd, fontSize: 13 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CARRIER NETWORK ──────────────────────────────────────────────── */}
      <section>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Carrier Relationships</div>
            <h2 style={st.h2}>Working relationships with the carriers your buyers expect</h2>
            <p style={st.sub}>Carrier access is the baseline. The real value is using that access inside a more organised export workflow — so your container is not just booked, it actually moves on time.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            {Object.entries(CARRIERS).map(([name]) => <CarrierBadge key={name} name={name} size="md" />)}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Common Questions</div>
            <h2 style={st.h2}>What exporters ask before they enquire</h2>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {[
              ["Do you handle general cargo or only specialised shipments?", "General cargo is exactly our focus — garments, fabrics, yarn, food products, FMCG, kitchenware, paper, towels, agro commodities, engineering goods and machinery. We are not a project cargo or reefer forwarder."],
              ["Can I submit an enquiry if my route is not in the system?", "Yes. Supported lanes may show indicative pricing after verification. For other lanes, you can submit details and we will come back to you with a manual review."],
              ["Is this only useful for large exporters?", "No. The site and team are built for any exporter who moves FCL cargo regularly and wants stronger coordination — not just a rate PDF and silence."],
              ["What makes Sattva different from the larger freight forwarders?", "We are India-side focused and personally involved. You are not routed through a call centre. The team that quotes the shipment is the same team that executes it."],
            ].map(([q, a]) => (
              <div key={q} style={{ ...st.cd }}>
                <h3 style={{ ...st.h3, fontSize: 17, marginBottom: 8 }}>{q}</h3>
                <p style={{ ...st.bd, fontSize: 14 }}>{a}</p>
              </div>
            ))}
          </div>
          <CTA
            eyebrow="Ready to Move?"
            headline="Tell us your route and cargo — we'll take it from there"
            copy="Start with the quote form for supported lanes. If your shipment needs a direct conversation, the team is ready for that too."
            primaryLabel="Get a Freight Quote"
            primaryTo="/quote"
            secondaryLabel="View Trade Lanes"
            secondaryTo="/trade-lanes"
            st={st}
            I={I}
          />
        </div>
      </section>
    </>
  );
}
