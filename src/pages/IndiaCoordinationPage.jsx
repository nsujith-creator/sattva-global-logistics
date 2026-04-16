import { Helmet } from "react-helmet-async";
import { B, F, FF } from "../theme/tokens";
import { CTA } from "../components/layout/CTA";

export function IndiaCoordinationPage({ st, I }) {
  const problems = [
    {
      problem: "Supplier doesn't communicate proactively",
      whatWeDo: "We coordinate directly with your Indian factory or vendor — follow up on production timelines, flag delays before they become your problem.",
    },
    {
      problem: "Forwarder disappears when things go wrong",
      whatWeDo: "We stay engaged through departure — managing your forwarder and customs broker on the ground, not just sending booking confirmations.",
    },
    {
      problem: "Documentation errors cause shipment delays",
      whatWeDo: "We review documentation before it reaches the carrier — catching errors in commercial invoices, packing lists, and BL instructions early.",
    },
    {
      problem: "Nobody on the India side is accountable to you",
      whatWeDo: "We are. As your India-side point of contact, our accountability runs to the buyer — not just to the exporter or carrier.",
    },
  ];

  const services = [
    {
      title: "Supplier Sourcing & Verification",
      desc: "Shortlisting suppliers that match your product spec, quantity, and delivery requirements. Background checks on track record, export history, and compliance standing — before you commit.",
    },
    {
      title: "Shipment Follow-Up & Ground Coordination",
      desc: "Active follow-up with Indian factories, vendors, and logistics partners from cargo readiness through vessel departure. You get visibility without chasing.",
    },
    {
      title: "Documentation Review",
      desc: "Pre-shipment review of commercial invoices, packing lists, certificates of origin, and BL instructions. Errors caught here avoid costly corrections or delays at port.",
    },
    {
      title: "Freight Forwarding — FCL Exports",
      desc: "Full container load ocean freight from India to Gulf, Red Sea, East Africa, and Europe. 20+ years on these lanes, working with all major carriers out of JNPT, Mundra, Chennai, and Cochin.",
    },
    {
      title: "Freight Market Intelligence",
      desc: "Plain-English translation of what Hormuz disruptions, Red Sea rerouting, and carrier surcharge cycles mean for your shipment cost and timeline — before it affects your landed price.",
    },
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>India-Side Export Coordination for Overseas Buyers | Sattva Global Logistics</title>
        <meta
          name="description"
          content="Sattva Global Logistics provides India-side coordination for overseas buyers — supplier sourcing, documentation review, shipment follow-up, and FCL freight forwarding. 20+ years on India's export lanes."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/india-coordination" />
      </Helmet>

      {/* ── HERO ── */}
      <section
        style={{
          background: `linear-gradient(160deg,${B.primary}06,${B.w})`,
          padding: "clamp(80px,10vw,110px) clamp(16px,4vw,24px) clamp(36px,5vw,60px)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>
            For Overseas Buyers
          </div>
          <h1 style={{ ...st.h1, fontSize: "clamp(28px,4vw,44px)", marginBottom: 20 }}>
            One Reliable Contact on the India Side.{" "}
            <span style={{ color: B.primary }}>From Supplier to Shipment.</span>
          </h1>
          <p style={{ ...st.bd, fontSize: 16, maxWidth: 720, marginBottom: 32, lineHeight: 1.8 }}>
            If you're sourcing from India — or already working with Indian suppliers — the hardest part
            is rarely the product itself. It's the follow-through: communication gaps, documentation
            errors, a forwarder who goes quiet, and no one on the ground you can actually hold accountable.
            That's the gap Sattva fills.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="mailto:quotes@sattvaglobal.in"
              style={{
                ...st.bp,
                textDecoration: "none",
              }}
            >
              Contact the Team
            </a>
            <a
              href="/quote"
              style={{
                ...st.bs,
                textDecoration: "none",
              }}
            >
              Get a Freight Quote
            </a>
          </div>
        </div>
      </section>

      <div style={st.sec}>

        {/* ── PROBLEM / SOLUTION GRID ── */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 10 }}>
            What Overseas Buyers Run Into
          </div>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 8, fontSize: "clamp(22px,3vw,32px)" }}>
            Most buyers sourcing from India face the same problems.
          </h2>
          <p style={{ ...st.bd, maxWidth: 680, marginBottom: 36 }}>
            We've seen these consistently across 20+ years on India's export lanes.
            The solution is having one accountable contact on the ground — not another intermediary who passes messages.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
            {problems.map(({ problem, whatWeDo }) => (
              <div
                key={problem}
                style={{
                  ...st.cd,
                  borderTop: `3px solid ${B.primary}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: B.red,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Common Problem
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: B.dark, margin: 0, lineHeight: 1.5 }}>
                  {problem}
                </p>
                <div
                  style={{
                    width: 32,
                    height: 2,
                    background: `${B.primary}40`,
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: B.green,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  What Sattva Does
                </div>
                <p style={{ fontSize: 13, color: B.g7, margin: 0, lineHeight: 1.7 }}>
                  {whatWeDo}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── SERVICES ── */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 10 }}>
            What We Handle
          </div>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 36, fontSize: "clamp(22px,3vw,32px)" }}>
            End-to-end, from supplier to shipment
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
            {services.map(({ title, desc }, i) => (
              <div key={title} style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: B.primary,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    marginBottom: 10,
                  }}
                >
                  0{i + 1}
                </div>
                <h3 style={{ ...st.h3, fontSize: 16, marginBottom: 10 }}>{title}</h3>
                <p style={{ ...st.bd, fontSize: 13, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CREDIBILITY BAR ── */}
        <div
          style={{
            ...st.cd,
            background: `${B.primary}05`,
            border: `1px solid ${B.primary}18`,
            display: "flex",
            gap: 40,
            flexWrap: "wrap",
            justifyContent: "space-around",
            alignItems: "center",
            padding: "28px 36px",
            marginBottom: 56,
            textAlign: "center",
          }}
        >
          {[
            ["20+", "Years on India's Export Lanes"],
            ["1,000+", "FCL Shipments Handled"],
            ["40+", "Destinations Served"],
            ["JNPT · Mundra · Chennai · Cochin", "Ports We Work From"],
          ].map(([stat, label]) => (
            <div key={label}>
              <div style={{ fontSize: 26, fontWeight: 700, color: B.primary, fontFamily: FF, lineHeight: 1 }}>
                {stat}
              </div>
              <div style={{ fontSize: 12, color: B.g5, marginTop: 6, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── TRADE LANES ── */}
        <div
          style={{
            ...st.cd,
            borderTop: `4px solid ${B.primary}`,
            marginBottom: 56,
          }}
        >
          <h3 style={{ ...st.h3, marginBottom: 10 }}>Trade Lanes We Operate On</h3>
          <p style={{ ...st.bd, fontSize: 14, marginBottom: 20 }}>
            Our FCL freight and coordination work covers India exports to:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["Gulf (UAE, Saudi Arabia, Oman, Kuwait, Qatar, Bahrain)", "Red Sea (Jeddah, Aqaba, Port Sudan)", "East Africa (Dar es Salaam, Mombasa, Maputo, Beira)", "Europe (via established carrier services)"].map((lane) => (
              <span
                key={lane}
                style={{
                  padding: "7px 14px",
                  background: `${B.primary}08`,
                  border: `1px solid ${B.primary}25`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: B.g7,
                  fontWeight: 500,
                }}
              >
                {lane}
              </span>
            ))}
          </div>
        </div>

        <CTA
          eyebrow="India-Side Coordination"
          headline="Sourcing from India? Let's make sure it actually arrives."
          copy="Whether you're still finding a supplier or you already have one and need someone to make sure the shipment moves cleanly — talk to the Sattva team directly."
          primaryLabel="Get a Freight Quote"
          primaryTo="/quote"
          secondaryLabel="About Sattva"
          secondaryTo="/about"
          st={st}
          I={I}
        />
      </div>
    </div>
  );
}
