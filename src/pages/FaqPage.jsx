import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B, FF } from "../theme/tokens";
import { PageHero } from "../components/layout/PageHero";

const faqs = [
  {
    q: "Do you handle general cargo or only specialised shipments?",
    a: "General cargo is exactly our focus — garments, fabrics, cotton yarn, food products, FMCG, kitchenware, paper, towels, agro commodities, engineering goods and machinery. We are not a project cargo, reefer, or oversized freight forwarder.",
  },
  {
    q: "Which ports do you ship from?",
    a: "We handle FCL exports from JNPT (Nhava Sheva), Mundra, Chennai and Cochin. These four ports cover the majority of India-origin general cargo moving to Gulf, Red Sea and Africa trade lanes.",
  },
  {
    q: "What container types do you work with?",
    a: "Standard dry containers — 20GP, 40GP and 40HC. We do not handle reefer, open-top, flat rack or out-of-gauge cargo as a standard service.",
  },
  {
    q: "Which destinations do you cover?",
    a: "Our primary lanes are India to Gulf (Jebel Ali, Dammam, Jeddah, Muscat), Red Sea (Aqaba, Djibouti, Port Sudan), East Africa (Mombasa, Dar es Salaam), South Africa (Durban, Maputo) and select West Africa ports. We also handle Europe on a case-by-case basis, particularly for DG and specialty cargo.",
  },
  {
    q: "How fast do you respond to quote requests?",
    a: "Within 4 working hours on standard quote requests submitted through the site. For urgent or time-sensitive shipments, WhatsApp or phone is faster — +91 9136 121 123.",
  },
  {
    q: "Can I submit an enquiry if my route is not in the rate system?",
    a: "Yes. Supported lanes may show indicative pricing after OTP verification. For other routes, submit your shipment details and the team will come back with a manual review. No route is automatically excluded.",
  },
  {
    q: "Do you support first-time exporters?",
    a: "Yes. We handle the documentation coordination and exporter-side guidance — so first-time exporters are not left to figure out BL instructions, SI submission or certificate requirements alone. We stay involved through departure.",
  },
  {
    q: "What documentation do you coordinate?",
    a: "Shipping instruction (SI) submission, bill of lading (BL) review and corrections, certificate of origin, phytosanitary certificates where applicable, and DG documentation for hazardous cargo. We validate the document chain at origin before cargo moves.",
  },
  {
    q: "Is this service only useful for large exporters?",
    a: "No. The site and team are built for any exporter who moves FCL cargo regularly and wants stronger coordination — whether that is 1 container a month or 20. The value is in execution quality, not shipment volume.",
  },
  {
    q: "What makes Sattva different from larger freight forwarders?",
    a: "We are India-side focused and personally involved. You are not routed through a call centre or handed off to an ops team after the quote is sent. The same person who quotes the shipment handles the execution — documentation, booking, cut-off coordination and pre-departure follow-up.",
  },
  {
    q: "Do you handle DG or hazardous cargo?",
    a: "Yes, on a case-by-case basis — particularly specialty and aroma chemicals on the Europe lane. DG shipments require MSDS verification, DG classification, carrier hazmat approval and full pre-shipment documentation. Contact us directly for DG enquiries.",
  },
  {
    q: "How does the process work from enquiry to shipment?",
    a: "Share your route, cargo type, container requirement and shipment window. We confirm route fit and pricing. For supported lanes, indicative rates are available online. For others, we do a manual commercial review. Once confirmed, we handle booking, documentation coordination, factory-to-port milestones and pre-departure follow-up.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export function FaqPage({ st, I }) {
  return (
    <>
      <Helmet>
        <title>Freight Forwarding FAQ — India FCL Exports | Sattva Global</title>
        <meta
          name="description"
          content="Common questions about FCL freight forwarding from India to Gulf, Red Sea and Africa — ports, containers, documentation, response times and how we work."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/faq" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <PageHero
        eyebrow="Common Questions"
        headline="What exporters ask before they enquire"
        sub="Answers to the most common questions about FCL freight forwarding from India — ports, lanes, documentation, containers and how the process works."
        st={st}
      />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {faqs.map(({ q, a }) => (
            <div
              key={q}
              style={{
                ...st.cd,
                borderLeft: `4px solid ${B.primary}`,
                padding: "24px 28px",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: B.dark,
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                {q}
              </h2>
              <p style={{ ...st.bd, fontSize: 14, lineHeight: 1.75, color: "#374151" }}>
                {a}
              </p>
            </div>
          ))}
        </div>

        <CTA
          eyebrow="Still have a question?"
          headline="Send your shipment details — we'll take it from there"
          copy="If your question is not covered here, the fastest answer is a direct conversation. Submit a quote request or reach us on WhatsApp."
          primaryLabel="Get a Freight Quote"
          primaryTo="/quote"
          secondaryLabel="WhatsApp Us"
          secondaryTo="https://wa.me/919136121123"
          st={st}
          I={I}
        />
      </div>
    </>
  );
}
