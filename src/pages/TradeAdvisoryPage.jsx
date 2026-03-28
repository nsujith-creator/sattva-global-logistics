import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { B, F, FF } from "../theme/tokens";
import { useIsMobile } from "../hooks/useIsMobile";
import { supabase } from "../config/supabase";

const STATUS_COLOR = {
  normal: B.green,
  disrupted: B.amber,
  suspended: B.red,
  diverted: B.amber,
};

const STATUS_BG = {
  normal: B.gBg,
  disrupted: B.aBg,
  suspended: "#fef2f2",
  diverted: B.aBg,
};

function StatusPill({ status }) {
  const s = (status || "normal").toLowerCase();
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        padding: "3px 10px",
        borderRadius: 999,
        color: STATUS_COLOR[s] ?? B.g5,
        background: STATUS_BG[s] ?? B.g1,
        border: `1px solid ${STATUS_COLOR[s] ?? B.g3}44`,
        fontFamily: F,
      }}
    >
      {s}
    </span>
  );
}

export function TradeAdvisoryPage({ st, I }) {
  const m = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    supabase
      .from("trade_advisory")
      .select("*")
      .eq("id", "current")
      .single()
      .then(({ data: d, error: e }) => {
        if (e) setErr(true);
        else setData(d);
        setLoading(false);
      });
  }, []);

  const fmtDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
    }) + " IST";
  };

  return (
    <>
      <Helmet>
        <title>Middle East Shipping Advisory — India Export Impact | Sattva Global Logistics</title>
        <meta
          name="description"
          content="Live trade advisory for Indian exporters shipping to Gulf, Red Sea and Middle East. Carrier disruptions, surcharges, port workarounds, India-specific impact. Updated twice daily."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/trade-advisory" />
      </Helmet>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <section
        style={{
          background: `linear-gradient(160deg, #fff5f5 0%, ${B.w} 55%, ${B.g1} 100%)`,
          paddingTop: m ? 96 : 112,
          paddingBottom: m ? 32 : 48,
          borderBottom: `1px solid ${B.red}18`,
        }}
      >
        <div style={st.sec}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#fef2f2",
              border: `1px solid ${B.red}44`,
              borderRadius: 999,
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: B.red, display: "inline-block", animation: "pulse 1.8s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: B.red, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: F }}>
              Live Trade Advisory
            </span>
          </div>

          <h1 style={{ ...st.h1, maxWidth: 780 }}>
            Middle East Shipping Disruption —{" "}
            <span style={{ color: B.red }}>India Export Advisory</span>
          </h1>

          <p style={{ ...st.bd, fontSize: m ? 14 : 16, marginTop: 16, maxWidth: 680 }}>
            Carrier service updates, port workarounds, active surcharges and India-specific impact for exporters shipping to the Gulf, Red Sea and Middle East trade lanes. Updated twice daily from live carrier advisories.
          </p>

          {data?.updated_at && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
              <span style={{ fontSize: 12, color: B.g5, fontFamily: F }}>
                Last updated: <strong style={{ color: B.g7 }}>{fmtDate(data.updated_at)}</strong>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── LOADING / ERROR ──────────────────────────────────────────────── */}
      {loading && (
        <section>
          <div style={{ ...st.sec, textAlign: "center", paddingTop: 60, paddingBottom: 60 }}>
            <p style={{ ...st.bd, color: B.g5 }}>Loading advisory…</p>
          </div>
        </section>
      )}

      {err && (
        <section>
          <div style={{ ...st.sec, textAlign: "center", paddingTop: 60, paddingBottom: 60 }}>
            <p style={{ ...st.bd, color: B.red }}>Advisory could not be loaded. Please refresh or check back shortly.</p>
          </div>
        </section>
      )}

      {data && !loading && (
        <>
          {/* ── SITUATION SUMMARY ────────────────────────────────────────── */}
          <section>
            <div style={st.sec}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 2.4, fontFamily: F }}>
                  Current Situation
                </span>
              </div>
              <div style={{ ...st.cd, borderLeft: `4px solid ${B.red}`, borderRadius: "0 14px 14px 0", padding: m ? "20px 20px" : "28px 32px" }}>
                <p style={{ ...st.bd, fontSize: m ? 14 : 15, margin: 0, whiteSpace: "pre-line" }}>{data.situation}</p>
              </div>
            </div>
          </section>

          {/* ── CARRIER NOTES ────────────────────────────────────────────── */}
          {data.carrier_notes?.length > 0 && (
            <section style={{ background: B.g1 }}>
              <div style={st.sec}>
                <div style={{ marginBottom: 28 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 2.4, fontFamily: F }}>
                    Carrier Status
                  </span>
                  <h2 style={{ ...st.h2, textAlign: "left", fontSize: m ? 22 : 28, marginTop: 8 }}>
                    Carrier-by-carrier service notes
                  </h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(2,1fr)", gap: 16 }}>
                  {data.carrier_notes.map((c, i) => (
                    <div key={i} style={{ ...st.cd, padding: m ? "18px 20px" : "22px 26px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: B.dark, fontFamily: F }}>{c.carrier}</span>
                        <StatusPill status={c.status} />
                      </div>
                      <p style={{ ...st.bd, fontSize: 13, margin: 0 }}>{c.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── SURCHARGES ───────────────────────────────────────────────── */}
          {data.surcharges?.length > 0 && (
            <section>
              <div style={st.sec}>
                <div style={{ marginBottom: 28 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 2.4, fontFamily: F }}>
                    Active Surcharges
                  </span>
                  <h2 style={{ ...st.h2, textAlign: "left", fontSize: m ? 22 : 28, marginTop: 8 }}>
                    Surcharges in effect for India origin cargo
                  </h2>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: B.g1 }}>
                        {["Surcharge", "Amount", "Currency", "Trade Lane", "Effective"].map((h) => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.g5, textTransform: "uppercase", letterSpacing: 0.8, borderBottom: `2px solid ${B.g3}55` }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.surcharges.map((s, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${B.g1}` }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: B.dark }}>{s.name}</td>
                          <td style={{ padding: "12px 16px", color: B.red, fontWeight: 700 }}>{s.amount}</td>
                          <td style={{ padding: "12px 16px", color: B.g5 }}>{s.currency}</td>
                          <td style={{ padding: "12px 16px", color: B.g7 }}>{s.trade}</td>
                          <td style={{ padding: "12px 16px", color: B.g5 }}>{s.effective}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ── INDIA IMPACT ─────────────────────────────────────────────── */}
          {data.india_impact && (
            <section style={{ background: B.g1 }}>
              <div style={st.sec}>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 2.4, fontFamily: F }}>
                    India-Specific Impact
                  </span>
                </div>
                <div style={{ ...st.cd, borderTop: `3px solid ${B.primary}`, maxWidth: 820 }}>
                  <p style={{ ...st.bd, fontSize: m ? 14 : 15, margin: 0, whiteSpace: "pre-line" }}>{data.india_impact}</p>
                </div>
              </div>
            </section>
          )}

          {/* ── SOURCE TAGS ──────────────────────────────────────────────── */}
          {data.source_tags?.length > 0 && (
            <section>
              <div style={{ ...st.sec, paddingTop: 24, paddingBottom: 24 }}>
                <span style={{ fontSize: 11, color: B.g5, fontFamily: F }}>Sources referenced in this advisory: </span>
                {data.source_tags.map((tag, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: B.primary, background: `${B.primary}0d`, borderRadius: 6, padding: "2px 8px", marginLeft: 6, fontFamily: F }}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ background: B.dark, padding: m ? "40px 16px" : "56px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 14, fontFamily: F }}>
            Need Help Navigating This
          </div>
          <h2 style={{ ...st.h2, color: "#fff", margin: 0 }}>
            Talk to us before your next Gulf or Red Sea booking
          </h2>
          <p style={{ ...st.sub, color: "rgba(255,255,255,.72)", marginTop: 14 }}>
            We work these lanes every day. If you have a shipment pending or want to understand how this disruption affects your specific cargo, get in touch.
          </p>
          <a
            href={`https://wa.me/919136121123?text=${encodeURIComponent("Hi, I'm planning a shipment to Gulf/Red Sea and would like to understand how the current disruption affects my cargo.")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...st.bp,
              background: "#25D366",
              marginTop: 28,
              display: "inline-flex",
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(37,211,102,.4)",
            }}
          >
            WhatsApp Us
          </a>
        </div>
      </section>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
