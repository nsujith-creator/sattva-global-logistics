import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { CarrierBadge } from "../components/shared/CarrierBadge";
import { CARRIERS } from "../data/carriers";
import { LANES } from "../data/lanes";
import { B, FF } from "../theme/tokens";
import { useIsMobile } from "../hooks/useIsMobile";

export function LanePage({ st, I }) {
  const { slug } = useParams();
  const go = useNavigate();
  const m = useIsMobile();
  const lane = LANES.find((l) => l.slug === slug);

  if (!lane) {
    return (
      <div style={{ paddingTop: 120, minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
        <h2 style={{ ...st.h2, color: B.dark }}>Lane not found</h2>
        <p style={{ ...st.bd, color: B.g5 }}>This route page does not exist yet.</p>
        <button onClick={() => go("/trade-lanes")} style={st.bp}>View All Trade Lanes</button>
      </div>
    );
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: lane.metaTitle,
    description: lane.metaDesc,
    provider: {
      "@type": "Organization",
      name: "Sattva Global Logistics",
      url: "https://www.sattvaglobal.in",
    },
    areaServed: lane.pod,
    serviceType: "FCL Freight Forwarding",
    url: `https://www.sattvaglobal.in/lane/${lane.slug}`,
  };

  return (
    <>
      <Helmet>
        <title>{lane.metaTitle}</title>
        <meta name="description" content={lane.metaDesc} />
        <link rel="canonical" href={`https://www.sattvaglobal.in/lane/${lane.slug}`} />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      {/* ── HERO ── */}
      <section style={{ background: B.dark, paddingTop: m ? 100 : 110, paddingBottom: 56 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 14 }}>
            {lane.region} · FCL Freight Lane
          </div>
          <h1 style={{ ...st.h1, color: "#ffffff", maxWidth: 740, marginBottom: 16 }}>
            {lane.pol} to {lane.pod} — FCL Freight Forwarding
          </h1>
          <p style={{ ...st.bd, fontSize: m ? 15 : 17, color: "rgba(255,255,255,0.78)", maxWidth: 640, marginBottom: 32 }}>
            Operator-managed FCL exports on this lane — routing decisions, documentation coordination and pre-departure follow-up handled directly.
          </p>

          {/* Route stats strip */}
          <div style={{ display: "flex", gap: m ? 24 : 40, flexWrap: "wrap" }}>
            {[
              ["Typical Transit", lane.transitTypical],
              ["Routing", lane.routingType.split(";")[0]],
              ["Service Type", "FCL · Full Container Load"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", maxWidth: 260, lineHeight: 1.5 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => go("/quote")} style={{ ...st.bp, fontSize: 14 }}>
              Get FCL Freight Quote <I.Ar />
            </button>
            <a
              href="https://wa.me/919136121123"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...st.bs, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.35)" }}
            >
              WhatsApp Shipment Details
            </a>
          </div>
        </div>
      </section>

      {/* ── ROUTING DETAIL ── */}
      <section style={{ background: B.g1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 32 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Routing</div>
              <p style={{ ...st.bd, fontSize: 15, lineHeight: 1.75, marginBottom: 16 }}>{lane.routingType}</p>
              <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", lineHeight: 1.65, padding: "12px 16px", background: "#fff", borderLeft: `3px solid ${B.accent}`, borderRadius: 6 }}>
                {lane.transitNote}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Carriers Active on This Lane</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                {lane.carriers.map((c) =>
                  CARRIERS[c]
                    ? <CarrierBadge key={c} name={c} size="sm" />
                    : <span key={c} style={{ fontSize: 13, fontWeight: 600, color: B.dark, background: "#f3f4f6", borderRadius: 6, padding: "5px 12px" }}>{c}</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>Carrier selection is based on current routing fit, schedule reliability and equipment availability — not just published rate.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── OPERATIONAL INTELLIGENCE ── */}
      <section>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 10 }}>Operational Intelligence</div>
            <h2 style={{ ...st.h2, maxWidth: 600 }}>What this lane actually looks like in practice</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(3,1fr)", gap: 20 }}>
            {lane.intelligence.map((item) => (
              <div key={item.heading} style={{ ...st.cd, borderTop: `3px solid ${B.primary}`, padding: "24px 24px" }}>
                <h3 style={{ ...st.h3, fontSize: 15, marginBottom: 10 }}>{item.heading}</h3>
                <p style={{ ...st.bd, fontSize: 13, lineHeight: 1.75 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCUMENTATION ── */}
      <section style={{ background: B.g1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>Documentation</div>
          <h2 style={{ ...st.h2, marginBottom: 16, maxWidth: 560 }}>What the document chain looks like for this destination</h2>
          <div style={{ ...st.cd, padding: "24px 28px", maxWidth: 800, borderLeft: `4px solid ${B.primary}` }}>
            <p style={{ ...st.bd, fontSize: 14, lineHeight: 1.8 }}>{lane.docNote}</p>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 14, lineHeight: 1.6 }}>
            Documentation requirements vary by commodity and buyer. We validate the full document chain at origin before the container departs the CFS — not after the vessel sails.
          </p>
        </div>
      </section>

      {/* ── OTHER LANES ── */}
      <section>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 16 }}>Other Active Lanes</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {LANES.filter((l) => l.slug !== lane.slug).map((l) => (
              <button
                key={l.slug}
                onClick={() => go(`/lane/${l.slug}`)}
                style={{ fontSize: 13, fontWeight: 600, color: B.primary, background: `${B.primary}08`, border: `1px solid ${B.primary}22`, borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
              >
                {l.pol.split(" ")[0]} → {l.pod.split(",")[0]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: B.g1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>
          <CTA
            eyebrow="Ready to Move?"
            headline={`Enquire on the ${lane.pol.split(" ")[0]} to ${lane.pod.split(",")[0]} lane`}
            copy="Share your cargo, container type and shipment window — we'll confirm route fit and come back with options."
            primaryLabel="Get FCL Freight Quote"
            primaryTo="/quote"
            secondaryLabel="View All Trade Lanes"
            secondaryTo="/trade-lanes"
            st={st}
            I={I}
          />
        </div>
      </section>
    </>
  );
}
