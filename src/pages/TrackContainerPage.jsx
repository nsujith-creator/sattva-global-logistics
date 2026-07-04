import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { B, F, FF } from "../theme/tokens";
import { useIsMobile } from "../hooks/useIsMobile";
import { trackShipment } from "../api/tracking";
import { waLink } from "../utils/links";

// ─── Data ───────────────────────────────────────────────────────────────────

const EVENT_LABELS = {
  EMSH: "Empty to Shipper",
  GTIN: "Gate In",
  GTOU: "Gate Out",
  LOAD: "Loaded on Board",
  DEPA: "Vessel Departed",
  ARRV: "Vessel Arrived",
  DISC: "Discharged",
  AVDP: "Available for Delivery",
  DLVR: "Delivered",
};

const STATUS_LABELS = {
  NEW: "Tracking Started",
  INPROGRESS: "Tracking in Progress",
  BOOKED: "Booked",
  LOADED: "Loaded at Port",
  SAILING: "Sailing",
  ARRIVED: "Arrived",
  DISCHARGED: "Discharged",
  UNTRACKED: "Untracked",
};

const STATUS_STYLE = {
  SAILING:    { bg: "#ecfdf5", color: "#059669", border: "#bbf7d0" },
  ARRIVED:    { bg: "#ecfdf5", color: "#059669", border: "#bbf7d0" },
  DISCHARGED: { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
  LOADED:     { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  BOOKED:     { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  NEW:        { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  INPROGRESS: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  UNTRACKED:  { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

const CARRIERS = [
  { scac: "",     name: "Auto-detect / I don't know" },
  { scac: "MAEU", name: "Maersk Line" },
  { scac: "MSCU", name: "MSC Mediterranean" },
  { scac: "CMDU", name: "CMA CGM" },
  { scac: "HLCU", name: "Hapag-Lloyd" },
  { scac: "ONEY", name: "ONE (Ocean Network Express)" },
  { scac: "EGLV", name: "Evergreen Marine" },
  { scac: "COSU", name: "COSCO Shipping" },
  { scac: "YMLU", name: "Yang Ming" },
  { scac: "ZIMU", name: "ZIM Integrated" },
  { scac: "OOLU", name: "OOCL" },
  { scac: "PABV", name: "PIL (Pacific International Lines)" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function carrierName(scac) {
  return CARRIERS.find(c => c.scac === scac)?.name || scac || "Unknown";
}

function buildWA(trackingNumber, carrier, status) {
  const msg = [
    "Hi Sattva, I checked this shipment on your website.",
    "",
    `Tracking number: ${trackingNumber}`,
    `Carrier: ${carrierName(carrier)}`,
    `Status shown: ${STATUS_LABELS[status] || status || "Unknown"}`,
    "",
    "Please help me understand the shipment status.",
  ].join("\n");
  return waLink(msg);
}

function WAIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.564l4.682-1.463A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.156 0-4.154-.695-5.785-1.873l-.413-.281-2.776.868.854-2.703-.302-.436A9.713 9.713 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75S21.75 6.615 21.75 12s-4.365 9.75-9.75 9.75z" />
    </svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ResultCard({ result, trackingNumber, carrier, st, m, onReset }) {
  const shipment = result?.shipment ?? {};
  const route = shipment.route ?? {};
  const pol = route.port_of_loading?.location ?? {};
  const pod = route.port_of_discharge ?? {};
  const podLoc = pod.location ?? {};
  const containers = shipment.containers ?? [];
  const container = containers[0] ?? {};
  const movements = container.movements ?? [];
  const status = shipment.status ?? "NEW";
  const ss = STATUS_STYLE[status] ?? STATUS_STYLE.NEW;
  const pct = route.transit_percentage ?? 0;
  const tsCount = route.ts_count ?? 0;
  const isDelayed = pod.date_of_discharge && pod.date_of_discharge_initial &&
    pod.date_of_discharge !== pod.date_of_discharge_initial;
  const cname = shipment.carrier?.name || carrierName(carrier);
  const waHref = buildWA(trackingNumber, carrier, status);

  const containerTypeLabel = {
    DC: "Dry", HC: "High Cube", RF: "Reefer", OT: "Open Top", FR: "Flat Rack",
  };

  return (
    <div>
      {/* Header card */}
      <div style={{ ...st.cd, marginBottom: 16, borderTop: `3px solid ${ss.color}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <span style={{ padding: "4px 12px", borderRadius: 6, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, fontSize: 12, fontWeight: 700 }}>
            {STATUS_LABELS[status] || status}
          </span>
          {isDelayed && (
            <span style={{ padding: "4px 12px", borderRadius: 6, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", fontSize: 12, fontWeight: 700 }}>
              ⚠ Delay Detected
            </span>
          )}
          <span style={{ fontSize: 12, color: B.g5, marginLeft: "auto" }}>{cname}</span>
        </div>

        {/* POL → POD */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: B.dark, fontFamily: FF }}>{pol.name || "—"}</div>
            <div style={{ fontSize: 11, color: B.g5 }}>{pol.country?.code || ""}</div>
            <div style={{ fontSize: 12, color: B.g7, marginTop: 2 }}>
              {fmtDate(route.port_of_loading?.date_of_loading)}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "center", color: B.g5, position: "relative" }}>
            <div style={{ borderTop: `2px solid ${B.g3}`, margin: "10px 8px" }} />
            {tsCount > 0 && (
              <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 6px", fontSize: 10, color: B.g5, whiteSpace: "nowrap" }}>
                {tsCount} T/S
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: B.dark, fontFamily: FF }}>{podLoc.name || "—"}</div>
            <div style={{ fontSize: 11, color: B.g5 }}>{podLoc.country?.code || ""}</div>
            <div style={{ fontSize: 12, color: isDelayed ? "#c2410c" : B.g7, marginTop: 2, fontWeight: isDelayed ? 700 : 400 }}>
              ETA {fmtDate(pod.date_of_discharge)}
              {isDelayed && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>(was {fmtDate(pod.date_of_discharge_initial)})</span>}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {pct > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: B.g5, marginBottom: 4 }}>
              <span>Journey progress</span><span>{pct}%</span>
            </div>
            <div style={{ height: 6, background: B.g2, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: ss.color, borderRadius: 3 }} />
            </div>
          </div>
        )}

        {/* Container info */}
        {container.number && (
          <div style={{ fontSize: 12, color: B.g5 }}>
            Container: <strong style={{ color: B.g7 }}>{container.number}</strong>
            {container.size && ` · ${container.size}ft`}
            {container.type && ` · ${containerTypeLabel[container.type] || container.type}`}
          </div>
        )}
      </div>

      {/* Movements timeline */}
      {movements.length > 0 && (
        <div style={{ ...st.cd, marginBottom: 16 }}>
          <h3 style={{ ...st.h3, fontSize: 15, marginBottom: 16, textAlign: "left" }}>Shipment Movements</h3>
          {movements.map((mv, i) => {
            const isAct = mv.status === "ACT";
            const label = EVENT_LABELS[mv.event] || mv.event;
            const prevVessel = i > 0 ? movements[i - 1]?.vessel?.name : null;
            const showVessel = mv.vessel?.name && mv.vessel.name !== prevVessel;
            return (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, marginTop: 3 }}>
                  {isAct ? (
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    </div>
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${B.g3}`, background: "#fff" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isAct ? B.dark : B.g5 }}>{label}</span>
                    <span style={{ fontSize: 12, color: B.g5 }}>{fmtDate(mv.timestamp)}{!isAct && <span style={{ marginLeft: 4, fontSize: 10 }}>(est.)</span>}</span>
                  </div>
                  <div style={{ fontSize: 12, color: B.g5, marginTop: 1 }}>
                    {mv.location?.name}{mv.location?.country?.code ? `, ${mv.location.country.code}` : ""}
                  </div>
                  {showVessel && (
                    <div style={{ fontSize: 11, color: B.accent, marginTop: 2 }}>
                      {mv.vessel.name}{mv.voyage ? ` / Voyage ${mv.voyage}` : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
        <p style={{ fontSize: 13, color: B.g5, fontStyle: "italic", marginBottom: 16, lineHeight: 1.7 }}>
          Tracking tells you where the shipment is. Sattva helps you understand what it means, what can go wrong next, and what action to take.
        </p>
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          style={{ ...st.bp, textDecoration: "none", width: "100%", justifyContent: "center", boxSizing: "border-box" }}>
          <WAIcon /> Discuss this Shipment on WhatsApp
        </a>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={onReset} style={{ background: "none", border: "none", color: B.g5, fontSize: 13, cursor: "pointer", fontFamily: F }}>
            ← Track another shipment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function TrackContainerPage({ st }) {
  const m = useIsMobile();
  const [step, setStep] = useState("input"); // input | gate | loading | result | pending | error
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");

  function reset() {
    setStep("input");
    setTrackingNumber("");
    setCarrier("");
    setName("");
    setWhatsapp("");
    setErrors({});
    setResult(null);
    setApiError("");
  }

  function validateInput() {
    const e = {};
    if (!trackingNumber.trim()) e.trackingNumber = "Enter a BL, booking, or container number";
    setErrors(e);
    return !Object.keys(e).length;
  }

  function validateGate() {
    const e = {};
    if (!name.trim()) e.name = "Required";
    if (!whatsapp.trim() || whatsapp.replace(/\D/g, "").length < 7)
      e.whatsapp = "Enter a valid WhatsApp number";
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleInputSubmit() {
    if (!validateInput()) return;
    setErrors({});
    setStep("gate");
  }

  async function handleGateSubmit() {
    if (!validateGate()) return;
    setErrors({});
    setStep("loading");
    setApiError("");
    try {
      const res = await trackShipment({
        trackingNumber: trackingNumber.trim(),
        carrier,
        name: name.trim(),
        whatsapp: whatsapp.trim(),
      });
      if (!res.success) throw new Error(res.error || "Tracking failed");
      const data = res.data;
      if (data?.error === "tracking_unavailable" || !data?.shipment) {
        setStep("error");
        return;
      }
      const shipment = data.shipment;
      const containers = shipment.containers ?? [];
      const hasMovements = containers.some(c => (c.movements ?? []).length > 0);
      const status = shipment.status ?? "NEW";
      setResult({ shipment: data.shipment });
      if (!hasMovements && ["NEW", "INPROGRESS"].includes(status)) {
        setStep("pending");
      } else {
        setStep("result");
      }
    } catch (err) {
      setApiError(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  const inp = { ...st.inp };
  const lb = { ...st.lb };
  const waFallback = buildWA(trackingNumber || "—", carrier, null);

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Track Your Container | Sattva Global Logistics</title>
        <meta name="description" content="Track your FCL container, BL, or booking number across major carriers. Sattva helps you understand shipment status, delays, and next steps." />
        <link rel="canonical" href="https://www.sattvaglobal.in/track-container" />
      </Helmet>

      {/* Spin animation */}
      <style>{`@keyframes sg-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Hero */}
      <section style={{ background: `linear-gradient(160deg,${B.primary}08,#fff)`, padding: "clamp(72px,10vw,100px) clamp(16px,4vw,24px) 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>
            Container Tracking
          </div>
          <h1 style={{ ...st.h1, fontSize: "clamp(26px,4vw,40px)", textAlign: "left", maxWidth: 640 }}>
            Track Your Container or Vessel
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: B.g5, marginTop: 14, maxWidth: 580, fontFamily: F }}>
            Enter your BL, booking, or container number to check shipment status across major carriers.
            If the movement looks delayed or unclear, Sattva can help you interpret the status and plan the next step.
          </p>
        </div>
      </section>

      {/* Main card area */}
      <div style={{ ...st.sec, maxWidth: 720 }}>

        {/* ─── Step: input ─── */}
        {step === "input" && (
          <div style={{ ...st.cd }}>
            <h2 style={{ ...st.h3, marginBottom: 6, textAlign: "left" }}>Enter Tracking Details</h2>
            <p style={{ fontSize: 13, color: B.g5, marginBottom: 24, fontFamily: F }}>
              Accepts BL number, MBL, booking number, or container number.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>BL / Booking / Container Number *</label>
              <input
                style={{ ...inp, borderColor: errors.trackingNumber ? "#dc2626" : undefined, fontSize: 16 }}
                type="text"
                value={trackingNumber}
                onChange={e => { setTrackingNumber(e.target.value); setErrors({}); }}
                placeholder="e.g. 272172068 or MRKU9410437"
                autoComplete="off"
                onKeyDown={e => e.key === "Enter" && handleInputSubmit()}
              />
              {errors.trackingNumber && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{errors.trackingNumber}</div>}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={lb}>Carrier (optional — improves accuracy)</label>
              <select
                style={{ ...inp, background: "#fff" }}
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
              >
                {CARRIERS.map(c => <option key={c.scac} value={c.scac}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={handleInputSubmit} style={{ ...st.bp, width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 24px" }}>
              Track Shipment →
            </button>
          </div>
        )}

        {/* ─── Step: gate ─── */}
        {step === "gate" && (
          <div style={{ ...st.cd }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setStep("input")} style={{ background: "none", border: `1.5px solid ${B.g3}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: B.g5, fontFamily: F }}>
                ← Back
              </button>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.dark }}>{trackingNumber.trim().toUpperCase()}</div>
                {carrier && <div style={{ fontSize: 11, color: B.g5 }}>{carrierName(carrier)}</div>}
              </div>
            </div>
            <h2 style={{ ...st.h3, marginBottom: 6, textAlign: "left" }}>Almost there</h2>
            <p style={{ fontSize: 13, color: B.g5, marginBottom: 24, fontFamily: F }}>
              We need your details to show the tracking result.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={lb}>Your Name *</label>
                <input
                  style={{ ...inp, borderColor: errors.name ? "#dc2626" : undefined }}
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                  placeholder="Full name"
                  autoComplete="name"
                />
                {errors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={lb}>WhatsApp Number *</label>
                <input
                  style={{ ...inp, borderColor: errors.whatsapp ? "#dc2626" : undefined }}
                  type="tel"
                  value={whatsapp}
                  onChange={e => { setWhatsapp(e.target.value); setErrors(p => ({ ...p, whatsapp: "" })); }}
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                />
                {errors.whatsapp && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{errors.whatsapp}</div>}
              </div>
            </div>
            <button onClick={handleGateSubmit} style={{ ...st.bp, width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 24px" }}>
              Show Tracking Status →
            </button>
            <p style={{ fontSize: 11, color: B.g5, marginTop: 10, textAlign: "center", fontFamily: F }}>
              By checking this shipment, Sattva may contact you on WhatsApp about this enquiry.
            </p>
          </div>
        )}

        {/* ─── Step: loading ─── */}
        {step === "loading" && (
          <div style={{ ...st.cd, textAlign: "center", padding: "60px 24px" }}>
            <div style={{ width: 40, height: 40, border: `4px solid ${B.g2}`, borderTopColor: B.primary, borderRadius: "50%", animation: "sg-spin 0.7s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ fontSize: 15, color: B.g7, fontFamily: F }}>Fetching shipment status…</p>
            <p style={{ fontSize: 12, color: B.g5, marginTop: 6, fontFamily: F }}>This usually takes a few seconds.</p>
          </div>
        )}

        {/* ─── Step: result ─── */}
        {step === "result" && result && (
          <ResultCard
            result={result}
            trackingNumber={trackingNumber.trim()}
            carrier={carrier}
            st={st}
            m={m}
            onReset={reset}
          />
        )}

        {/* ─── Step: pending (tracking started, no data yet) ─── */}
        {step === "pending" && (
          <div style={{ ...st.cd }}>
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706", fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              Tracking in Progress
            </span>
            <h2 style={{ ...st.h3, marginBottom: 12, textAlign: "left" }}>Carrier data not yet available</h2>
            <p style={{ fontSize: 14, color: B.g7, lineHeight: 1.7, marginBottom: 16, fontFamily: F }}>
              The tracking request was created, but the carrier hasn't shared movement data yet.
            </p>
            <div style={{ padding: "14px 16px", borderRadius: 8, background: B.g1, marginBottom: 24, fontSize: 13, color: B.g7, lineHeight: 1.8 }}>
              <strong>Possible reasons:</strong><br />
              · Booking is very new (carrier updates may take a few hours)<br />
              · Some carriers share limited data with third-party systems<br />
              · Try a container number instead of the booking number
            </div>
            <a href={waFallback} target="_blank" rel="noopener noreferrer"
              style={{ ...st.bp, textDecoration: "none", width: "100%", justifyContent: "center", boxSizing: "border-box" }}>
              <WAIcon /> Send to Sattva for Manual Tracking
            </a>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={reset} style={{ background: "none", border: "none", color: B.g5, fontSize: 13, cursor: "pointer", fontFamily: F }}>
                ← Track another shipment
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: error ─── */}
        {step === "error" && (
          <div style={{ ...st.cd }}>
            <div style={{ padding: 16, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 6, fontFamily: F }}>Could not fetch shipment status</div>
              <div style={{ fontSize: 13, color: "#374151", fontFamily: F }}>
                {apiError || "We could not retrieve tracking data for this shipment automatically."}
              </div>
            </div>
            <div style={{ fontSize: 13, color: B.g7, marginBottom: 20, lineHeight: 1.8, fontFamily: F }}>
              <strong>Possible reasons:</strong><br />
              · BL or booking number entered differently from carrier records<br />
              · Carrier not covered by the tracking system (CMA CGM has limited data)<br />
              · Shipment is too new or not yet in carrier system<br />
              · Container number may return better results than a booking number
            </div>
            <a href={waFallback} target="_blank" rel="noopener noreferrer"
              style={{ ...st.bp, textDecoration: "none", width: "100%", justifyContent: "center", boxSizing: "border-box", marginBottom: 12 }}>
              <WAIcon /> Send to Sattva on WhatsApp
            </a>
            <div style={{ textAlign: "center" }}>
              <button onClick={() => setStep("input")} style={{ background: "none", border: "none", color: B.g5, fontSize: 13, cursor: "pointer", fontFamily: F }}>
                ← Try a different number
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
