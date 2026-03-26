import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";

export function ServicesPage({ st, I }) {
  const services = [
    {
      icon: <I.Sh />,
      t: "FCL ocean freight from major Indian ports",
      d: "Full container load bookings from JNPT (Nhava Sheva), Mundra, Chennai and Cochin to Gulf, Red Sea and Africa destinations. We work across major carriers with an emphasis on route fit, booking reliability and pre-departure execution.",
      fit: "Right for exporters who want more than a container number.",
    },
    {
      icon: <I.Gl />,
      t: "Shipment planning and route guidance",
      d: "Practical help around route suitability, carrier selection, transit time trade-offs and the difference between a workable movement and a risky one. Especially useful when the exporter is entering a new lane or comparing movement options.",
      fit: "Right for exporters evaluating routes or planning first-time shipments to a new destination.",
    },
    {
      icon: <I.Sd />,
      t: "Documentation-conscious coordination",
      d: "Export documentation is where most avoidable problems originate. We stay close to the document flow — BL instructions, SI submission, certificate coordination and pre-departure review — so the shipment does not hit problems at the port or the destination.",
      fit: "Right for commercially important cargo where documentation accuracy affects buyer payment and clearance.",
    },
    {
      icon: <I.Tr />,
      t: "Factory-to-port and cut-off discipline",
      d: "Better coordination between factory stuffing, CFS handover timing, port cut-off milestones and vessel departure. Especially relevant for exporters managing multiple shipments or tight buyer delivery windows.",
      fit: "Right for exporters running repeat commercial shipments with buyer-side expectations.",
    },
  ];

  const cargo = [
    "Readymade garments",
    "Fabrics and cotton yarn",
    "Food products and FMCG cargo",
    "Kitchen utensils and consumer goods",
    "Paper products and towels",
    "Agro commodities",
    "Engineering goods and machinery",
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Export Freight Services from India | FCL Ocean Freight, Documentation, Shipment Planning | Sattva</title>
        <meta
          name="description"
          content="FCL ocean freight from JNPT, Mundra, Chennai, Cochin. Documentation-conscious coordination, route planning and factory-to-port execution for Indian exporters shipping to Gulf, Red Sea and Africa."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/services" />
      </Helmet>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(80px,10vw,110px) clamp(16px,4vw,24px) clamp(32px,4vw,48px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>Export Logistics Services</div>
          <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)" }}>
            Freight services built around <span style={{ color: B.primary }}>how Indian exports actually move</span>
          </h1>
          <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 720 }}>
            FCL bookings, documentation coordination, route planning and factory-to-port execution — from major Indian ports to Gulf, Red Sea and Africa lanes.
          </p>
        </div>
      </section>

      <div style={st.sec}>
        {/* ── INTRO ── */}
        <div style={{ ...st.cd, borderTop: `4px solid ${B.primary}`, marginBottom: 28 }}>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 14 }}>Services built around actual export execution — not just the booking</h2>
          <p style={{ ...st.bd, fontSize: 15 }}>
            Export logistics is not one service. It is the coordination of booking, routing, timing, documentation and shipment control across multiple moving parts. Sattva supports exporters who need a forwarder that handles the full chain — from pre-shipment planning through vessel departure — not just the rate conversation.
          </p>
        </div>

        {/* ── SERVICE CARDS ── */}
        <div style={{ display: "grid", gap: 24 }}>
          {services.map((x) => (
            <div key={x.t} style={{ ...st.cd }}>
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${B.primary}08`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{x.icon}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ ...st.h3, marginBottom: 12 }}>{x.t}</h3>
                  <p style={{ ...st.bd, fontSize: 14, marginBottom: 10 }}>{x.d}</p>
                  <div style={{ fontSize: 12, color: B.primary, fontWeight: 700, background: `${B.primary}08`, display: "inline-block", padding: "4px 10px", borderRadius: 6 }}>{x.fit}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CARGO TYPES ── */}
        <div style={{ marginTop: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 10 }}>Cargo Categories</div>
            <h2 style={{ ...st.h2, marginBottom: 8 }}>The general cargo these services are built around</h2>
            <p style={st.sub}>We are not a reefer, breakbulk or oversized cargo forwarder. Our entire operation is built around the mainstream FCL general cargo Indian exporters move every week.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {cargo.map((item) => (
              <div key={item} style={{ ...st.cd, padding: "18px 20px", borderLeft: `4px solid ${B.primary}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.dark }}>{item}</div>
              </div>
            ))}
          </div>
        </div>

        <CTA
          eyebrow="Next Step"
          headline="Ready for a forwarder who stays involved after the quote?"
          copy="Share your route, cargo and equipment details and we will help you work out the right next step — whether that is a quote, a route review or a planning discussion."
          primaryLabel="Get a Freight Quote"
          primaryTo="/quote"
          secondaryLabel="View Trade Lanes"
          secondaryTo="/trade-lanes"
          st={st}
          I={I}
        />
      </div>
    </div>
  );
}
