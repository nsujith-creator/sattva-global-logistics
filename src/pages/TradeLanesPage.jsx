import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";

export function TradeLanesPage({ st, I }) {
  const lanes = [
    {
      title: "Middle East & Upper Gulf",
      routes: [
        "JNPT → Jebel Ali (Dubai)",
        "Mundra → Jebel Ali (Dubai)",
        "JNPT → Dammam (Saudi Arabia)",
        "JNPT → Jeddah (Saudi Arabia)",
        "Mundra → Sohar (Oman)",
      ],
      cargo: "Garments, fabrics, cotton yarn, kitchenware, paper products, engineering goods",
      copy: "The Gulf remains the highest-volume destination for Indian general cargo exports. Strong carrier frequency, good transit times and established buyer relationships make this the most active lane we support.",
    },
    {
      title: "Red Sea & East Africa",
      routes: [
        "JNPT → Mombasa (Kenya)",
        "Mundra → Mombasa (Kenya)",
        "JNPT → Dar es Salaam (Tanzania)",
        "JNPT → Djibouti",
      ],
      cargo: "FMCG cargo, food products, towels, agro commodities, general engineering cargo",
      copy: "East Africa is a growing lane for Indian exporters — particularly for FMCG, food products and consumer goods. We understand the transit dynamics and destination clearance sensitivities on this lane.",
    },
    {
      title: "Select Africa Markets",
      routes: [
        "JNPT → Durban (South Africa)",
        "JNPT → Maputo (Mozambique)",
        "Mundra → Lagos (Nigeria)",
        "JNPT → Tema (Ghana)",
      ],
      cargo: "Engineering goods, machinery, agro commodities, general consumer cargo",
      copy: "Africa beyond East Africa requires more specific route planning, carrier matching and transit awareness. We support select markets where our route familiarity and carrier relationships translate into reliable execution.",
    },
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>India Export Trade Lanes | JNPT, Mundra to Gulf, Red Sea & Africa | Sattva Global Logistics</title>
        <meta
          name="description"
          content="FCL export trade lanes from JNPT, Mundra, Chennai and Cochin to Gulf, Red Sea and Africa. Route guidance and shipment coordination for Indian exporters."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/trade-lanes" />
      </Helmet>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(80px,10vw,110px) clamp(16px,4vw,24px) clamp(32px,4vw,48px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>Trade Lanes</div>
          <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)" }}>
            Routes we have worked for years —{" "}
            <span style={{ color: B.primary }}>India to Gulf, Red Sea & Africa</span>
          </h1>
          <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 760 }}>
            Route familiarity is not a claim — it shows up in how problems are anticipated, how carriers are matched and how the shipment is managed when something changes. This is where 16 years on India-origin export lanes makes a real difference.
          </p>
        </div>
      </section>

      <div style={st.sec}>
        {/* ── INTRO ── */}
        <div style={{ ...st.cd, borderTop: `4px solid ${B.primary}`, marginBottom: 28 }}>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 14 }}>Focused lanes, not a global brochure</h2>
          <p style={{ ...st.bd, fontSize: 15 }}>
            We do not claim to cover every port in the world. Our strongest fit is for FCL cargo moving from India to the Gulf, Red Sea and Africa — the lanes where Indian exporters move the most general cargo and where our route experience, carrier relationships and execution discipline translate into real value.
          </p>
        </div>

        {/* ── LANE CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
          {lanes.map((lane) => (
            <div key={lane.title} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
              <h3 style={{ ...st.h3, marginBottom: 10 }}>{lane.title}</h3>
              <p style={{ ...st.bd, fontSize: 14, marginBottom: 16 }}>{lane.copy}</p>
              <div style={{ marginBottom: 14 }}>
                {lane.routes.map((r) => (
                  <div key={r} style={{ padding: "9px 0", borderBottom: `1px solid ${B.g1}`, fontSize: 13, color: B.g7, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: B.primary, fontWeight: 700 }}>→</span> {r}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: B.primary, background: `${B.primary}08`, padding: "6px 12px", borderRadius: 6 }}>
                Common cargo: {lane.cargo}
              </div>
            </div>
          ))}
        </div>

        {/* ── ROUTE CONTEXT ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20, marginTop: 28 }}>
          {[
            ["Origin ports covered", "JNPT (Nhava Sheva), Mundra, Chennai and Cochin — the four major FCL export gateways for Indian general cargo exporters."],
            ["Carrier relationships", "Working relationships with major lines on these lanes — CMA CGM, Maersk, MSC, ONE, Hapag-Lloyd, Evergreen and others."],
            ["Not on this list?", "Submit your route details on the quote page. If we have coverage or can access it through our network, we will come back to you directly."],
          ].map(([t, d]) => (
            <div key={t} style={{ ...st.cd }}>
              <h3 style={{ ...st.h3, marginBottom: 8 }}>{t}</h3>
              <p style={{ ...st.bd, fontSize: 14 }}>{d}</p>
            </div>
          ))}
        </div>

        <CTA
          eyebrow="Route Enquiry"
          headline="Is your lane on this list? Start your quote now."
          copy="Enter your origin port, destination and cargo details. For supported lanes you may see indicative pricing. For others, we will review manually and come back to you."
          primaryLabel="Check Route & Get Quote"
          primaryTo="/quote"
          secondaryLabel="Why Sattva"
          secondaryTo="/why-sattva"
          st={st}
          I={I}
        />
      </div>
    </div>
  );
}
