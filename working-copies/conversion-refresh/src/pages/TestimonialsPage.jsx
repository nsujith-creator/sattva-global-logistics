import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B, FF } from "../theme/tokens";

export function TestimonialsPage({ st, I }) {
  const quotes = [
    {
      text: "Our buyers stopped raising BL discrepancy concerns after we shifted these shipments to Sattva. The communication is cleaner and the movement feels more controlled.",
      from: "Export Manager",
      co: "Readymade Garments Exporter, Mumbai",
      route: "JNPT to Jebel Ali",
    },
    {
      text: "We handle repeat food product shipments, and what we value most is consistency. Sattva keeps the shipment steps organized instead of reactive.",
      from: "Director",
      co: "Food Products Exporter, Gujarat",
      route: "Mundra to Mombasa",
    },
    {
      text: "For cotton yarn and fabric exports, buyer timing matters. We prefer working with a team that understands that the quote is only the beginning.",
      from: "Commercial Head",
      co: "Textile Exporter, Tamil Nadu",
      route: "Chennai to Jeddah",
    },
    {
      text: "The difference is not just pricing. It is the quality of follow-up once the shipment starts moving.",
      from: "Director",
      co: "Engineering Goods Exporter, Pune",
      route: "JNPT to Dammam",
    },
    {
      text: "We move repeat kitchenware and paper cargo. Sattva gives us a more dependable commercial and operational rhythm than our previous setup.",
      from: "Partner",
      co: "Consumer Goods Exporter, Mumbai",
      route: "Mundra to Jebel Ali",
    },
    {
      text: "For towels and home textile cargo, it helps to have a forwarder that keeps details aligned before the buyer starts asking questions.",
      from: "Logistics Lead",
      co: "Home Textile Exporter, Karur",
      route: "Tuticorin corridor shipments",
    },
  ];

  const cases = [
    {
      tag: "Readymade Garments · Mumbai",
      headline: "Cleaner buyer-facing execution for repeat garment exports into the Gulf",
      challenge: "A garment exporter was not struggling to get quotes. The real issue was inconsistent follow-up, avoidable BL corrections and buyer-side stress whenever dispatch windows tightened.",
      solution: "Sattva introduced a more disciplined pre-shipment coordination flow, cleaner document handling and clearer communication around cargo readiness and shipment movement.",
      stats: [["Repeat FCL", "gulf-bound commercial cargo"], ["Lower friction", "during buyer-facing dispatch cycles"], ["Cleaner docs", "before release and departure"]],
      quote: "The movement feels more controlled now. That matters more to us than headline promises.",
      attr: "Export Manager, Garments Exporter",
    },
    {
      tag: "Food Products & FMCG · Gujarat",
      headline: "A steadier export rhythm for food and FMCG shipments heading into East Africa",
      challenge: "The exporter needed a forwarder that could help keep communication, shipment planning and documentation aligned across repeat cargo movements instead of forcing the team into last-minute firefighting.",
      solution: "Sattva supported the lane with stronger pre-departure coordination, cleaner cargo handover and a more reliable commercial-to-operational flow.",
      stats: [["Repeat cargo", "food and FMCG shipments"], ["East Africa", "better route and handover control"], ["More consistency", "across shipment cycles"]],
      quote: "What we value is consistency. The shipment process feels more predictable now.",
      attr: "Director, Food Products Exporter",
    },
    {
      tag: "Engineering Goods · Maharashtra",
      headline: "More useful follow-through for engineering cargo moving on Gulf routes",
      challenge: "The exporter had no shortage of freight options, but needed better shipment ownership after the quote stage because commercial discussions kept getting disconnected from the actual movement.",
      solution: "Sattva helped tighten route communication, execution follow-through and the general handoff between commercial expectations and shipment action.",
      stats: [["Gulf lanes", "repeat engineering cargo"], ["Better ownership", "after the quote stage"], ["Clearer updates", "through pre-departure execution"]],
      quote: "The difference is in the follow-up. We spend less time chasing the shipment.",
      attr: "Director, Engineering Goods Exporter",
    },
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Client Testimonials | Exporter Success Stories | Sattva Global Logistics</title>
        <meta
          name="description"
          content="Proof and success stories from Indian exporters shipping garments, yarn, food products, FMCG cargo, paper, towels, engineering goods and machinery with Sattva."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/testimonials" />
      </Helmet>

      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(56px,8vw,88px) 20px 48px", textAlign: "center" }}>
        <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)", maxWidth: 720, margin: "0 auto" }}>
          Proof from exporters who value <span style={{ color: B.primary }}>follow-through</span>
        </h1>
        <p style={{ ...st.bd, fontSize: 17, maxWidth: 640, margin: "18px auto 0" }}>
          Practical trust signals for exporters shipping garments, fabrics, yarn, FMCG cargo, paper products, towels, engineering goods and machinery.
        </p>
      </section>

      <div style={st.sec}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
          {quotes.map((t, i) => (
            <div key={i} style={{ ...st.cd, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 2 }}>{[1, 2, 3, 4, 5].map((x) => <I.St key={x} />)}</div>
                <span style={{ fontSize: 11, background: `${B.primary}10`, color: B.primary, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>{t.route}</span>
              </div>
              <p style={{ ...st.bd, fontSize: 14, fontStyle: "italic", flex: 1 }}>&quot;{t.text}&quot;</p>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.dark }}>{t.from}</div>
                <div style={{ fontSize: 12, color: B.g5 }}>{t.co}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 64 }}>
          <h2 style={st.h2}>Exporter success stories</h2>
          <p style={{ ...st.sub, marginBottom: 48 }}>How Indian exporters use Sattva when they want clearer shipment handling instead of generic forwarding language.</p>
          <div style={{ display: "grid", gap: 32 }}>
            {cases.map((c, i) => (
              <div key={i} style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.primary, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>{c.tag}</div>
                <h3 style={{ ...st.h3, fontSize: 20, marginBottom: 14 }}>{c.headline}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.g5, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>The Challenge</div>
                    <p style={{ ...st.bd, fontSize: 13 }}>{c.challenge}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.g5, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>What We Did</div>
                    <p style={{ ...st.bd, fontSize: 13 }}>{c.solution}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                  {c.stats.map(([n, l], j) => (
                    <div key={j} style={{ background: B.g1, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: n.length > 10 ? 13 : 18, fontWeight: 700, color: B.primary, fontFamily: FF }}>{n}</div>
                      <div style={{ fontSize: 11, color: B.g5, marginTop: 4 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: `${B.primary}06`, borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 14, fontStyle: "italic", color: B.g7, margin: "0 0 6px" }}>&quot;{c.quote}&quot;</p>
                  <div style={{ fontSize: 12, fontWeight: 600, color: B.primary }}>- {c.attr}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CTA
          eyebrow="Move Forward"
          headline="Use the quote page when you want the conversation to move beyond generic freight talk"
          copy="If your route and cargo are ready, start with the quote flow. If not, the team can still review the enquiry manually."
          primaryLabel="Get a Freight Quote"
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
