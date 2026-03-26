import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";

export function IndustriesPage({ st, I }) {
  const industries = [
    {
      t: "Readymade Garments",
      d: "Garment exports run on tight buyer windows. One late booking, one missed cut-off or one documentation error can affect the buyer's receiving plan. We are built for the kind of repeat, disciplined coordination that garment exporters need on Gulf and Africa lanes.",
      pain: "Buyer schedules, repeat shipments, cut-off discipline",
    },
    {
      t: "Fabrics & Cotton Yarn",
      d: "Volume-driven cargo where route reliability, competitive freight cost and commercial clarity matter together. Exporters moving yarn and fabric need a forwarder who understands the commercial sensitivity of the cargo and keeps the movement predictable.",
      pain: "Route reliability, volume consistency, commercial clarity",
    },
    {
      t: "Food Products & FMCG",
      d: "FMCG and food exports need packaging discipline, correct documentation and timing that aligns with buyer stock cycles. Delays or document errors can cause destination clearance issues. We keep the pre-departure coordination tighter to reduce those risks.",
      pain: "Documentation accuracy, timing, packaging compliance",
    },
    {
      t: "Kitchen Utensils & Consumer Goods",
      d: "Consumer goods exporters moving to Gulf and African retail markets need consistent coordination across repeat lanes. Container utilisation, dispatch timing and buyer schedules all need to work together. That is what we are built for.",
      pain: "Repeat lane consistency, retail buyer timelines",
    },
    {
      t: "Paper Products & Towels",
      d: "Cube-sensitive cargo that needs good loading discipline, accurate documentation and predictable dispatch timing. We handle the coordination between factory, CFS and port to keep the movement clean from start to finish.",
      pain: "Cube planning, dispatch timing, pre-departure discipline",
    },
    {
      t: "Agro Commodities",
      d: "Agro exports carry phytosanitary documentation requirements and shipment timing sensitivities that go beyond standard FCL handling. We understand the document flow and keep the movement organised from origin to vessel departure.",
      pain: "Phytosanitary docs, seasonal timing, documentation flow",
    },
    {
      t: "Engineering Goods",
      d: "Engineering exports are often commercially important, one-off or relationship-driven shipments where route fit and shipment control matter more than generic freight handling. We stay close to the movement and help keep buyer commitments realistic.",
      pain: "Commercially important cargo, route fit, buyer commitments",
    },
    {
      t: "Machinery",
      d: "Machinery shipments need stronger pre-shipment planning, equipment matching, documentation coordination and communication — especially when the movement involves buyer financing or letters of credit. We provide the India-side discipline that these shipments require.",
      pain: "Pre-shipment planning, LC documentation, equipment match",
    },
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Freight Forwarding for Indian Export Industries | Garments, FMCG, Agro, Engineering Goods | Sattva</title>
        <meta
          name="description"
          content="Freight forwarding support for garments, fabrics, cotton yarn, food products, FMCG, paper, towels, agro commodities, engineering goods and machinery exports from India to Gulf, Red Sea and Africa."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/industries" />
      </Helmet>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(56px,8vw,88px) 20px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>Industries We Support</div>
          <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)" }}>
            Freight forwarding for <span style={{ color: B.primary }}>Indian general cargo exporters</span>
          </h1>
          <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 720 }}>
            Every industry carries different buyer pressures, documentation requirements and shipment sensitivities. We support exporters who need a forwarder that understands the difference.
          </p>
        </div>
      </section>

      <div style={st.sec}>
        {/* ── INTRO ── */}
        <div style={{ ...st.cd, borderTop: `4px solid ${B.primary}`, marginBottom: 28 }}>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 14 }}>Industry knowledge that shows up in execution, not just in brochures</h2>
          <p style={{ ...st.bd, fontSize: 15 }}>
            A garment shipment has different pressures than an agro commodity export. An FMCG shipment has different documentation sensitivities than an engineering goods movement. Generic freight handling misses these differences. Sattva is built for exporters who need a forwarder that actually understands their industry — and handles the shipment accordingly.
          </p>
        </div>

        {/* ── INDUSTRY CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {industries.map((x) => (
            <div key={x.t} style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
              <h3 style={{ ...st.h3, fontSize: 17, marginBottom: 8 }}>{x.t}</h3>
              <p style={{ ...st.bd, fontSize: 13, marginBottom: 12 }}>{x.d}</p>
              <div style={{ fontSize: 11, fontWeight: 700, color: B.primary, background: `${B.primary}08`, padding: "4px 10px", borderRadius: 6, display: "inline-block" }}>
                {x.pain}
              </div>
            </div>
          ))}
        </div>

        <CTA
          eyebrow="Industry Fit"
          headline="Tell us what you export — we'll tell you if we're the right fit"
          copy="Share your commodity, destination and shipment context. We will give you an honest view on route fit and what the coordination looks like."
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
