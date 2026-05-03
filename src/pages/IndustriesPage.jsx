import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";
import { PageHero } from "../components/layout/PageHero";

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
        <title>Freight Forwarding for Indian Export Industries | Garments, FMCG, Agro, Engineering | Sattva</title>
        <meta
          name="description"
          content="Industry-specific freight forwarding for garments, fabrics, cotton yarn, food products, FMCG, paper, towels, agro commodities, engineering goods and machinery exports from India to Gulf, Red Sea and Africa."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/industries" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "url": "https://www.sattvaglobal.in/industries",
          "name": "Freight Forwarding for Indian Export Industries — Sattva Global Logistics",
          "description": "FCL export freight for garments, fabrics, FMCG, agro commodities, engineering goods and machinery from India to Gulf, Red Sea and Africa.",
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.sattvaglobal.in/"},
              {"@type": "ListItem", "position": 2, "name": "Industries", "item": "https://www.sattvaglobal.in/industries"}
            ]
          },
          "about": [
            {"@type": "Thing", "name": "Readymade garment export freight from India"},
            {"@type": "Thing", "name": "Fabric and cotton yarn export logistics"},
            {"@type": "Thing", "name": "FMCG export freight India to Gulf"},
            {"@type": "Thing", "name": "Agro commodity export freight India"},
            {"@type": "Thing", "name": "Engineering goods export logistics India"},
            {"@type": "Thing", "name": "Machinery export freight from JNPT"}
          ],
          "publisher": {"@id": "https://www.sattvaglobal.in/#organization"}
        })}</script>
      </Helmet>

      {/* ── HERO ── */}
      <PageHero>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#F5A623", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>Industries We Support</div>
        <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)", color: "#fff" }}>
          Freight forwarding for <span style={{ color: "#5CB6F9" }}>Indian general cargo exporters</span>
        </h1>
        <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 720, color: "rgba(255,255,255,0.82)" }}>
          Every industry carries different buyer pressures, documentation requirements and shipment sensitivities. We support exporters who need a forwarder that understands the difference.
        </p>
      </PageHero>

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
