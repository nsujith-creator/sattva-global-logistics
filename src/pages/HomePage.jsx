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
import { pageWhatsAppLink } from "../utils/links";
import { trackWhatsAppClick, trackQuoteSubmit } from "../utils/analytics";

/* ── Full homepage quote card — submits directly, no redirect ── */
function HomeQuoteCard({ st, I, mode = "light" }) {
  const BLANK = { pol: "", pod: "", cargo: "", eq: "", name: "", phone: "", email: "" };
  const [f, setF] = useState(BLANK);
  const [phoneErr, setPhoneErr] = useState("");
  const [errs, setErrs] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));

  const dk = mode === "dark";
  const cardBg = dk ? { background:"rgba(5,10,48,0.08)", border:"1px solid rgba(255,255,255,0.13)", borderTop:"3px solid #F5A623", borderRadius:14 } : { borderTop:`4px solid ${B.primary}` };
  const lblC   = dk ? "rgba(255,255,255,0.85)" : B.g5;
  const headC  = dk ? "#ffffff" : undefined;
  const eyeC   = dk ? "#F5A623" : B.primary;
  const metaC  = dk ? "rgba(255,255,255,0.38)" : B.g5;

  const validate = () => {
    const e = {};
    if (!f.pol)          e.pol   = "Required";
    if (!f.pod)          e.pod   = "Required";
    if (!f.eq)           e.eq    = "Required";
    if (!f.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Invalid email";
    if (showDetails && phoneErr) e.phone = phoneErr;
    setErrs(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (sending || !validate()) return;
    setSending(true); setSendErr("");
    const polName = POL.find(p => p.c === f.pol)?.n || f.pol;
    const podName = ALL_POD.find(p => p.c === f.pod)?.n || f.pod;
    try {
      await submitQuoteAPI({ pol: `${polName} (${f.pol})`, pod: `${podName} (${f.pod})`, equipment: `${EQ_L[f.eq] || f.eq} (${f.eq})`, containers: 1, cargo: f.cargo || "", notes: "", name: f.name, company: "", email: f.email, phone: f.phone || "", rateFound: false }, "anon");
      trackQuoteSubmit({ origin: polName, destination: podName, containerType: f.eq });
      setDone(true);
    } catch {
      setSendErr("Submission failed — please call +91 9136 121 123 or email quotes@sattvaglobal.in");
    } finally { setSending(false); }
  };

  const errEl = (id, msg) => msg
    ? <div id={id} role="alert" style={{ fontSize: 11, color: B.red, marginTop: 3 }}>{msg}</div>
    : null;

  if (done) return (
    <div style={{ ...st.cd, ...cardBg, maxWidth: 470, width: "100%", padding: 32, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
      </div>
      <h3 style={{ ...st.h3, fontSize: 18, marginBottom: 8 }}>Quote Request Received</h3>
      <p style={{ fontSize: 13, color: B.g5, lineHeight: 1.7 }}>We'll come back within 4 working hours. Urgent? Call <a href="tel:+919136121123" style={{ color: B.primary, fontWeight: 600 }}>+91 9136 121 123</a></p>
      <button onClick={() => setDone(false)} style={{ ...st.bs, marginTop: 16, fontSize: 12 }}>Submit another</button>
    </div>
  );

  return (
    <div style={{ ...st.cd, ...cardBg, maxWidth: 470, width: "100%" }}>
      <div style={{ padding: "28px 28px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: eyeC, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>Get a Quote</div>
        <h3 style={{ ...st.h3, fontSize: 19, marginBottom: 20, color: headC }}>We confirm within 4 working hours</h3>
      </div>
      <form onSubmit={handleSubmit} noValidate style={{ padding: "0 28px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 5 always-visible fields */}
          <HomePortCombo label="From (POL) *" value={f.pol} onChange={v => { up("pol", v); setErrs(p => ({ ...p, pol: "" })); }} options={POL} placeholder="JNPT, Mundra, Chennai, Cochin…" error={errs.pol} lblC={lblC} />
          <HomePortCombo label="To (POD) *" value={f.pod} onChange={v => { up("pod", v); setErrs(p => ({ ...p, pod: "" })); }} options={ALL_POD} placeholder="Jebel Ali, Dammam, Mombasa…" error={errs.pod} lblC={lblC} />
          <HomeCargoCombo value={f.cargo} onChange={v => up("cargo", v)} lblC={lblC} />
          <div>
            <label htmlFor="hq-eq" style={{ ...st.lb, color: lblC }}>Container Type *</label>
            <select id="hq-eq" aria-invalid={!!errs.eq} aria-describedby={errs.eq ? "hq-eq-err" : undefined}
              style={{ ...st.inp, borderColor: errs.eq ? B.red : undefined }} value={f.eq}
              onChange={e => { up("eq", e.target.value); setErrs(p => ({ ...p, eq: "" })); }}>
              <option value="">Select container type</option>
              {EQ.map(e => <option key={e} value={e}>{EQ_L[e]} ({e})</option>)}
            </select>
            {errEl("hq-eq-err", errs.eq)}
          </div>
          <div>
            <label htmlFor="hq-email" style={{ ...st.lb, color: lblC }}>Contact Email *</label>
            <input id="hq-email" type="email" aria-invalid={!!errs.email} aria-describedby={errs.email ? "hq-email-err" : undefined}
              style={{ ...st.inp, borderColor: errs.email ? B.red : undefined }} value={f.email}
              onChange={e => { up("email", e.target.value); setErrs(p => ({ ...p, email: "" })); }} placeholder="you@company.com" />
            {errEl("hq-email-err", errs.email)}
          </div>

          {/* Progressive disclosure */}
          {!showDetails && (
            <button type="button" onClick={() => setShowDetails(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: eyeC, fontWeight: 600, fontSize: 12, textAlign: "left", padding: 0, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              + Add name &amp; phone (optional)
            </button>
          )}
          {showDetails && (
            <>
              <div>
                <label htmlFor="hq-name" style={{ ...st.lb, color: lblC }}>Name</label>
                <input id="hq-name" type="text" style={st.inp} value={f.name}
                  onChange={e => up("name", e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <label htmlFor="hq-phone" style={{ ...st.lb, color: lblC }}>Phone</label>
                <PhoneField value={f.phone} onChange={v => up("phone", v)} error={errs.phone || phoneErr} onError={setPhoneErr} st={st} />
              </div>
            </>
          )}
        </div>

        {sendErr && <div role="alert" style={{ fontSize: 12, color: B.red, marginTop: 12, padding: "10px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>{sendErr}</div>}
        <button type="submit" disabled={sending} style={{ ...st.bp, width: "100%", justifyContent: "center", marginTop: 16, opacity: sending ? 0.7 : 1 }}>
          {sending ? "Submitting…" : <>Submit Quote Request <I.Ar /></>}
        </button>
        <div style={{ fontSize: 11, color: metaC, textAlign: "center", marginTop: 8 }}>We respond within 4 working hours · Urgent: <a href="tel:+919136121123" style={{ color: metaC }}>+91 9136 121 123</a></div>
      </form>
    </div>
  );
}
function HomePortCombo({ label, value, onChange, options, placeholder, error, lblC }) {
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
  const inp = { width: "100%", padding: "10px 12px", border: `1.5px solid ${error ? B.red : "#d1d5db"}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" };
  const inputId = `hpc-${label.replace(/\s+/g,"").toLowerCase()}`;
  const errId = `${inputId}-err`;
  return (
    <div ref={el => ref.current = el} style={{ position: "relative" }} onBlur={e => { if (!ref.current?.contains(e.relatedTarget)) { setOpen(false); setFocused(false); setQ(""); } }}>
      <label htmlFor={inputId} style={{ fontSize: 11, fontWeight: 700, color: lblC || B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>{label}</label>
      <input id={inputId} type="text" value={display} style={inp} placeholder={placeholder} autoComplete="off"
        aria-invalid={!!error} aria-describedby={error ? errId : undefined}
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
      {error && <div id={errId} role="alert" style={{ fontSize: 11, color: B.red, marginTop: 3 }}>{error}</div>}
    </div>
  );
}

/* ── Mini CargoCombo for homepage ── */
function HomeCargoCombo({ value, onChange, lblC }) {
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
      <label htmlFor="hq-cargo" style={{ fontSize: 11, fontWeight: 700, color: lblC || B.g5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Cargo Type</label>
      <input id="hq-cargo" type="text" value={value} style={inp} placeholder="Garments, FMCG, Agro, Engineering…" autoComplete="off"
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
          text: "Yes. Submit your shipment details and the team will review it directly. Supported lanes help us respond faster; complex or new routes are reviewed and quoted directly.",
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

  const fieldNotes = [
    {
      sector: "Heavy Engineering & Industrial Equipment",
      route: "JNPT → Jebel Ali",
      notes: "Industrial equipment — bag filters, rotary dryers, industrial fans — requires cargo dimensioning and CFS loading coordination before booking. The wrong container type causes rollover or port detention. We confirm equipment dimensions upfront, check carrier weight limits, and pre-clear the BL before the container leaves the CFS.",
      quote: "The difference was having someone who asked the right questions before the cargo reached the port — not after.",
      attribution: "Export Director, Industrial Equipment Manufacturer",
    },
    {
      sector: "Specialty & Aroma Chemicals",
      route: "JNPT → Europe",
      notes: "Specialty chemical exports require DG classification, MSDS verification and carrier hazmat approval before the container is accepted. Most delays on this lane come from documentation gaps at origin — not from the carrier or port. We validate the DG checklist and confirm carrier acceptance before cargo moves.",
      quote: "We had tried three forwarders before. The issues were always the same — DG rejection at the last minute, panic calls, missed vessel. That stopped when documentation started being checked properly at the front end.",
      attribution: "Logistics Head, Specialty Chemicals Exporter",
    },
    {
      sector: "Readymade Garments & Denim",
      route: "JNPT → Jebel Ali / Dammam",
      notes: "Garment exporters on Gulf lanes work under tight seasonal deadlines. A late vessel means the cargo misses the buyer's import window. Cut-off management, early booking and factory-dispatch alignment matter far more than the freight rate. We manage vessel schedules proactively and flag cut-off risk the moment it surfaces.",
      quote: "We stopped chasing our forwarder for updates. Now they tell us before we have to ask.",
      attribution: "Operations Manager, Garment Export House",
    },
    {
      sector: "Printed Fabrics & African Market Textiles",
      route: "JNPT → Lagos / Tema",
      notes: "India-origin fabric cargo bound for West Africa moves through ports with variable transit reliability. Routing choice — direct versus transhipment — affects both transit time and delay risk. We advise on carrier selection based on current port conditions and coordinate arrival window expectations with buyers before the vessel is fixed.",
      quote: "West Africa routing is not straightforward. We needed someone who understood that — not someone who gave us a number and disappeared.",
      attribution: "Director, Fabric & Textile Export Company",
    },
    {
      sector: "Food Products & FMCG",
      route: "JNPT → Dammam / Jeddah",
      notes: "Food cargo into Saudi Arabia requires phytosanitary certificates, halal certification where applicable, accurate HS classification and SABER compliance. A single mismatch between the BL description and the certificate wording can hold cargo at destination. We validate the full document chain at origin before the container departs the CFS.",
      quote: "Our previous forwarder cost us a 12-day hold at Jeddah because the BL description did not match the phytosanitary certificate. That kind of problem should be caught before the ship sails.",
      attribution: "Export Manager, Food & FMCG Exporter",
    },
  ];

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
          background: "#050A30",
        }}
      >
        <HeroMap bg />
        <div style={{ position:"absolute", inset:0, zIndex:1,
          background: m
            ? "rgba(5,10,48,0.52)"
            : "linear-gradient(to right,rgba(5,10,48,0.55) 0%,rgba(5,10,48,0.22) 50%,rgba(5,10,48,0.05) 100%)" }} />
        <div
          style={{
            ...st.sec,
            position: "relative", zIndex: 2,
            display: "grid",
            gridTemplateColumns: m ? "1fr" : "1.08fr .92fr",
            gap: m ? 32 : 56,
            alignItems: "center",
            paddingTop: m ? 100 : 110,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 16 }}>
              FCL Freight Specialist · India to Gulf, Red Sea & East Africa
            </div>
            <h1 style={{ ...st.h1, color: "#ffffff" }}>
              Experience-Led FCL Freight from India —{" "}
              <span style={{ color: "#F5A623" }}>Direct Attention, Not a Platform</span>
            </h1>
            <p style={{ ...st.bd, fontSize: m ? 15 : 17, marginTop: 20, maxWidth: 640, color: "rgba(255,255,255,0.82)" }}>
              FCL exports from JNPT, Mundra, Chennai and Cochin — handled by an experienced freight team, not routed through a call centre. Routing decisions, documentation and shipment follow-up stay with the same desk from quote through departure.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <button onClick={() => go("/quote")} style={{ ...st.bp, fontSize: m ? 13 : 14 }}>
                Get FCL Freight Quote <I.Ar />
              </button>
              <a
                href={pageWhatsAppLink("/")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('hero')}
                style={{ ...st.bs, fontSize: m ? 13 : 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                WhatsApp Shipment Details
              </a>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              {["JNPT", "Mundra", "Chennai", "Cochin", "20GP · 40GP · 40HC", "Gulf · Red Sea", "East & South Africa", "Maersk · CMA CGM · Hapag"].map((chip) => (
                <span
                  key={chip}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 999,
                    padding: "6px 10px",
                    letterSpacing: 0.3,
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>Part of DFA Network</span>
              <span>— Global freight forwarder network across 190+ countries</span>
            </div>
            <div style={{ display: "flex", gap: m ? 24 : 36, marginTop: 36, flexWrap: "wrap" }}>
              {[
                ["20+", "Years on India-Gulf, Red Sea & Africa lanes"],
                ["1,000+", "FCL shipments — garments, chemicals, food, engineering"],
                ["Direct", "Freight desk contact from quote through departure"],
                ["4 hrs", "Typical response on quote requests"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div style={{ fontSize: m ? 24 : 28, fontWeight: 800, color: "#F5A623", fontFamily: FF }}>{n}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", maxWidth: 150, lineHeight: 1.6 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          {m ? (
            <div style={{ background:"rgba(5,10,48,0.7)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.12)", borderTop:"3px solid #F5A623", borderRadius:12, padding:"20px 18px", marginTop:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#F5A623", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Get a Quote</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:14 }}>We confirm within 4 working hours</div>
              <button onClick={() => go("/quote")} style={{ ...st.bp, width:"100%", justifyContent:"center", fontSize:14 }}>
                Start Quote Request →
              </button>
              <a href="tel:+919136121123" style={{ display:"block", textAlign:"center", marginTop:10, fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.6)", textDecoration:"none" }}>
                Or call +91 9136 121 123
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <HomeQuoteCard st={st} I={I} mode="dark" />
            </div>
          )}
        </div>
        {/* bottom fade — bridges dark hero into white sections */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:120, zIndex:3,
          background:"linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.88) 100%)",
          pointerEvents:"none" }} />
      </section>

      <section style={{ background: B.g1, padding: m ? "22px 16px 0" : "28px 24px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: m ? "1fr" : "1fr auto",
              alignItems: "center",
              gap: 16,
              padding: m ? "18px 18px" : "20px 24px",
              background: "rgba(255,255,255,0.86)",
              border: `1px solid ${B.primary}18`,
              borderLeft: `4px solid ${B.primary}`,
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(5,10,48,0.05)",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: B.primary, textTransform: "uppercase", letterSpacing: 2.2, marginBottom: 6 }}>
                New: Sattva Freight Intelligence Desk
              </div>
              <p style={{ ...st.bd, margin: 0, color: B.g7, fontSize: 14 }}>
                India-lane freight signals for exporters, importers, and logistics teams.
              </p>
            </div>
            <a
              href="/freight-intelligence-desk"
              onClick={(e) => { e.preventDefault(); go("/freight-intelligence-desk"); }}
              style={{ ...st.bs, padding: "10px 16px", fontSize: 13, justifyContent: "center", textDecoration: "none" }}
            >
              View Freight Intelligence Desk <I.Ar />
            </a>
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

      {/* ── OPERATIONAL PROOF ───────────────────────────────────────────── */}
      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>From the Field</div>
            <h2 style={st.h2}>What these lanes actually look like in practice</h2>
            <p style={st.sub}>Every export category has its own rhythm — documentation requirements, cut-off pressures, routing constraints. Here is how that plays out across the shipments we handle.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(2,1fr)", gap: 20 }}>
            {fieldNotes.map((note) => (
              <div key={note.sector} style={{ ...st.cd, borderTop: `3px solid ${B.primary}`, padding: "28px 28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 1.5 }}>{note.sector}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>{note.route}</span>
                </div>
                <p style={{ ...st.bd, fontSize: 14, marginBottom: 18, lineHeight: 1.75 }}>{note.notes}</p>
                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
                  <p style={{ fontSize: 13, fontStyle: "italic", color: "#374151", lineHeight: 1.65, marginBottom: 8 }}>"{note.quote}"</p>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>{note.attribution}</div>
                </div>
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
          <p style={{ fontSize: 11, color: B.g5, textAlign: "center", marginTop: 20, lineHeight: 1.6, maxWidth: 680, margin: "20px auto 0" }}>
            Carrier logos indicate booking experience and commonly used carriers — not partnership, endorsement, preferred contract, or guaranteed allocation. All marks are the property of their respective owners.
          </p>
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

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
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

      {/* ── REASSURANCE ─────────────────────────────────────────────────────── */}
      <section style={{ background: "#ffffff" }}>
        <div style={{ ...st.sec, paddingTop: 8, paddingBottom: 48 }}>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(3,1fr)", gap: 14 }}>
            {[
              ["How fast do you respond?", "Within 4 working hours on quote requests. Urgent shipments can be discussed directly by phone or WhatsApp."],
              ["Do you support first-time exporters?", "Yes. We handle documentation and coordination — so first-time exporters are not left to figure it out alone."],
              ["Which ports do you handle?", "JNPT (Nhava Sheva), Mundra, Chennai and Cochin — FCL exports to Gulf, Red Sea and Africa destinations."],
            ].map(([q, a]) => (
              <div key={q} style={{ padding: "18px 20px", background: "#f8fafc", borderRadius: 10, borderLeft: `3px solid ${B.primary}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: B.dark, marginBottom: 6 }}>{q}</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
