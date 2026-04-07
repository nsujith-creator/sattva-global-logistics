import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";

export function AboutPage({ st, I }) {
  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>About Sattva Global Logistics | FCL Freight Forwarder Mumbai, 20+ Years in Ocean Freight</title>
        <meta
          name="description"
          content="Sattva Global Logistics is a Mumbai-based FCL freight forwarder with 20+ years in ocean freight. India to Gulf, Red Sea and Africa — garments, FMCG, agro, engineering goods, machinery."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/about" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "url": "https://www.sattvaglobal.in/about",
          "name": "About Sattva Global Logistics",
          "description": "Sattva Global Logistics is a Mumbai-based FCL freight forwarder with 20+ years of hands-on experience in ocean freight, specialising in India exports to Gulf, Red Sea and Africa trade lanes.",
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.sattvaglobal.in/"},
              {"@type": "ListItem", "position": 2, "name": "About", "item": "https://www.sattvaglobal.in/about"}
            ]
          },
          "publisher": {
            "@type": "Organization",
            "@id": "https://www.sattvaglobal.in/#organization",
            "name": "Sattva Global Logistics"
          }
        })}</script>
      </Helmet>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(80px,10vw,110px) clamp(16px,4vw,24px) clamp(32px,4vw,48px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>About Sattva</div>
          <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)" }}>
            20+ years in ocean freight. <span style={{ color: B.primary }}>Still personally involved in every shipment.</span>
          </h1>
          <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 760 }}>
            Sattva Global Logistics was built by people who have worked ocean freight from the India side for over a decade and a half — handling FCL exports across Gulf, Red Sea and Africa lanes for Indian manufacturers, traders and exporters.
          </p>
        </div>
      </section>

      <div style={st.sec}>
        {/* ── POSITIONING STATEMENT ── */}
        <div style={{ ...st.cd, borderTop: `4px solid ${B.primary}`, marginBottom: 28 }}>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 14 }}>We are not trying to be everything to everyone</h2>
          <p style={{ ...st.bd, fontSize: 15 }}>
            We do not compete on being the largest or the cheapest. We compete on being the most useful forwarding partner for Indian exporters who ship general cargo to the Gulf, Red Sea and Africa and need someone who stays genuinely engaged from first enquiry through departure.
          </p>
          <p style={{ ...st.bd, fontSize: 15, marginTop: 14 }}>
            That means stronger route thinking on the lanes we know well, documentation-conscious coordination, and a team that does not disappear after sending the booking confirmation.
          </p>
        </div>

        {/* ── VALUES GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
          {[
            ["What exporters actually need", "Clearer communication, practical route guidance and a team that stays engaged when the shipment becomes commercially important. Not just a rate PDF and silence."],
            ["How we work", "We focus on FCL exports from India — from pre-shipment planning through cut-off, vessel departure and documentation sign-off. We stay close to the movement, not just the first quote."],
            ["Who we work best with", "Exporters moving garments, fabrics, cotton yarn, food products, FMCG cargo, kitchenware, paper products, towels, agro commodities, engineering goods and machinery on repeat lanes."],
            ["What makes Sattva different", "Personal accountability. The team that quotes the shipment handles the execution. We do not route exporters through call centres or junior coordinators once the booking is confirmed."],
          ].map(([t, d]) => (
            <div key={t} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
              <h3 style={{ ...st.h3, marginBottom: 10 }}>{t}</h3>
              <p style={{ ...st.bd, fontSize: 14 }}>{d}</p>
            </div>
          ))}
        </div>

        {/* ── DOMAIN AUTHORITY SIGNAL ── */}
        <div style={{ ...st.cd, marginTop: 28, background: `${B.primary}04`, borderLeft: `4px solid ${B.primary}` }}>
          <h3 style={{ ...st.h3, marginBottom: 12 }}>The experience behind the operation</h3>
          <p style={{ ...st.bd, fontSize: 14 }}>
            Our team carries over 20 years of hands-on experience in international freight forwarding — managing FCL shipments, carrier rate negotiations, surcharge disputes, documentation coordination and export advisory across major Indian ports including JNPT, Mundra, Chennai and Cochin. We understand how India-origin export cargo actually moves, and what goes wrong when it does not.
          </p>
        </div>

        <CTA
          eyebrow="Work With Sattva"
          headline="If the shipment matters, your forwarder should too"
          copy="Share your route and cargo details. We will help you figure out the right next step — quote, planning conversation or direct route review."
          primaryLabel="Get a Freight Quote"
          primaryTo="/quote"
          secondaryLabel="Why Exporters Choose Sattva"
          secondaryTo="/why-sattva"
          st={st}
          I={I}
        />
      </div>
    </div>
  );
}
