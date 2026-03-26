import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B, F } from "../theme/tokens";

export function KnowledgePage({ st, I }) {
  const [tab, setTab] = useState("incoterms");
  const tabs = [
    ["incoterms", "Incoterms 2020"],
    ["docs", "Export Documents"],
    ["fcl", "FCL Process"],
    ["customs", "Customs Clearance"],
    ["containers", "Container Guide"],
    ["rates", "Rate Components"],
  ];

  const incoterms = [
    { code: "FOB", title: "Free on Board", desc: "Still one of the most common terms for Indian exporters. Seller manages export clearance and loads the cargo on board at origin; buyer handles freight onward." },
    { code: "CFR", title: "Cost and Freight", desc: "Seller arranges ocean freight to the destination port, but risk still transfers at the loading port. Common when the exporter is expected to quote with freight included." },
    { code: "CIF", title: "Cost, Insurance and Freight", desc: "Like CFR, but the seller also arranges minimum marine insurance. Exporters should understand exactly what level of cover is being provided." },
    { code: "FCA", title: "Free Carrier", desc: "Useful when handover to the carrier needs to be clearly defined. Often more precise than FOB in multimodal or inland handover situations." },
    { code: "EXW", title: "Ex Works", desc: "The buyer takes on most of the movement responsibility. Indian exporters should use it carefully because export control and execution can become unclear." },
    { code: "DAP/DDP", title: "Delivered Terms", desc: "These can sound buyer-friendly, but they push much more cost and execution responsibility onto the seller. Use them only when the commercial structure is fully understood." },
  ];

  const docs = [
    ["Commercial Invoice", "The core commercial document. It should match the cargo, buyer details, values, Incoterms and product description cleanly."],
    ["Packing List", "Confirms cartons, packages, gross weight, net weight, dimensions and cargo breakdown. One of the easiest places for preventable shipment mistakes."],
    ["Bill of Lading Draft", "Needs careful checking before release. Consignee details, marks, description and shipment terms should match the commercial understanding."],
    ["Certificate of Origin", "Frequently needed where buyer requirements or duty treatment depend on the product origin declaration."],
    ["Shipping Instructions", "The handover point where many avoidable errors begin. The forwarder should receive clean, commercially aligned information before filing and release steps start."],
    ["Cargo-Specific Support Documents", "Depending on the product, exporters may also need FSSAI, phytosanitary, fumigation, inspection or buyer-specific documentation."],
  ];

  const fclSteps = [
    ["Shipment planning", "Route, cargo profile, equipment, cargo readiness and buyer timelines are aligned before the booking is treated as final."],
    ["Booking coordination", "Space is secured with the shipping line based on the agreed route and shipment window."],
    ["Container and dispatch readiness", "Factory dispatch, handover timing and equipment planning are matched to port and carrier cut-offs."],
    ["Document alignment", "Shipping instructions, invoice, packing list and related details are checked before they create delay later."],
    ["Customs and port-side execution", "Cargo is processed through the India-side export steps and moved toward vessel loading."],
    ["Departure and follow-through", "The movement only feels smooth when communication remains clear after the booking stage, not only before it."],
  ];

  const customs = [
    ["Prepare the basics early", "IEC, AD code, GST details, buyer details and shipment documentation should be aligned before cut-off pressure begins."],
    ["File the Shipping Bill correctly", "HS classification, cargo description, values and scheme-related details should match the commercial and operational reality of the shipment."],
    ["Treat examination risk as normal", "Even good exporters can face customs checks. The goal is to make sure cargo and paperwork stand up cleanly if the shipment is examined."],
    ["Avoid last-minute corrections", "Many customs delays are really documentation or coordination mistakes discovered too late."],
    ["Keep commercial and operational teams aligned", "When the sales side and execution side say different things about the cargo, customs is often where the problem becomes visible."],
  ];

  const containers = [
    { type: "20GP", use: "Dense or heavier cargo", cargo: "Agro commodities, paper products, engineering items, machinery parts" },
    { type: "40GP", use: "Balanced commercial FCL cargo", cargo: "Kitchenware, general consumer goods, food products, export-packed cargo" },
    { type: "40HC", use: "Volume-sensitive cargo", cargo: "Readymade garments, fabrics, towels, cotton yarn and other cube-heavy shipments" },
  ];

  const rateComponents = [
    ["Ocean Freight", "The base line-haul charge for moving the container from origin port to destination port."],
    ["Origin Terminal Charges", "Handling-related charges at the Indian port or terminal side."],
    ["Documentation / BL Charges", "Fees tied to line documentation, BL issuance and related paperwork handling."],
    ["Inland Movement", "Factory-to-port, CFS, ICD or handover-related transport charges depending on the shipment structure."],
    ["Fuel and Carrier Surcharges", "BAF, PSS or similar line-applied surcharges that change by trade lane and season."],
    ["Destination-Side Charges", "Important for commercial clarity even when the exporter is not paying them directly. Buyers often ask for this context."],
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Export Knowledge Hub | Incoterms, FCL, Documents | Sattva Global Logistics</title>
        <meta
          name="description"
          content="Practical guides on Incoterms, export documentation, FCL shipping, customs clearance, container choice and freight pricing for Indian exporters."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/knowledge" />
      </Helmet>

      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(56px,8vw,88px) 20px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>Knowledge Center</div>
          <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)" }}>
            Export <span style={{ color: B.primary }}>Knowledge</span> Hub
          </h1>
          <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 720 }}>
            Practical guidance for Indian exporters moving garments, fabrics, yarn, food products, FMCG cargo, paper, towels, agro cargo, engineering goods and machinery.
          </p>
        </div>
      </section>

      <div style={st.sec}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 32 }}>
          {tabs.map(([id, lb]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                fontFamily: F,
                background: tab === id ? B.primary : "#fff",
                color: tab === id ? "#fff" : B.g5,
                boxShadow: tab === id ? `0 2px 8px ${B.primary}33` : "0 1px 3px rgba(0,0,0,.06)",
              }}
            >
              {lb}
            </button>
          ))}
        </div>

        {tab === "incoterms" && (
          <div>
            <h2 style={{ ...st.h2, textAlign: "left" }}>Incoterms 2020 for Indian exporters</h2>
            <p style={{ ...st.bd, marginTop: 10, marginBottom: 28 }}>
              Incoterms shape who pays for freight, where risk transfers and how much shipment control the exporter keeps. Choosing the wrong term can create pricing confusion long before cargo sails.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {incoterms.map((item) => (
                <div key={item.code} style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: B.primary, marginBottom: 6 }}>{item.code}</div>
                  <h3 style={{ ...st.h3, marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ ...st.bd, fontSize: 13 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "docs" && (
          <div>
            <h2 style={{ ...st.h2, textAlign: "left" }}>Export documents exporters should get right early</h2>
            <p style={{ ...st.bd, marginTop: 10, marginBottom: 28 }}>
              Most shipment problems show up in documents before they show up on the vessel. Strong export execution starts with paperwork that matches the cargo and the commercial understanding.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
              {docs.map(([title, desc]) => (
                <div key={title} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
                  <h3 style={{ ...st.h3, fontSize: 16, marginBottom: 8 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: B.g5, lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "fcl" && (
          <div>
            <h2 style={{ ...st.h2, textAlign: "left" }}>How FCL ocean freight works</h2>
            <p style={{ ...st.bd, marginTop: 10, marginBottom: 28 }}>
              FCL is the normal path for a large share of India-origin export cargo, but the shipment only feels simple when the coordination behind it is clean.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {fclSteps.map(([title, desc], i) => (
                <div key={title} style={{ ...st.cd, display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "start" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${B.primary}08`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: B.primary }}>{i + 1}</div>
                  <div>
                    <h3 style={{ ...st.h3, fontSize: 16, marginBottom: 6 }}>{title}</h3>
                    <p style={{ ...st.bd, fontSize: 13 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "customs" && (
          <div>
            <h2 style={{ ...st.h2, textAlign: "left" }}>Export customs clearance in India</h2>
            <p style={{ ...st.bd, marginTop: 10, marginBottom: 28 }}>
              Customs clearance is usually smoother when the exporter treats it as part of the shipment planning process, not as the last box to tick before sailing.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {customs.map(([title, desc]) => (
                <div key={title} style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
                  <h3 style={{ ...st.h3, fontSize: 16, marginBottom: 8 }}>{title}</h3>
                  <p style={{ ...st.bd, fontSize: 13 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "containers" && (
          <div>
            <h2 style={{ ...st.h2, textAlign: "left" }}>Container guide for mainstream export cargo</h2>
            <p style={{ ...st.bd, marginTop: 10, marginBottom: 28 }}>
              Most exporters on these lanes are deciding between 20GP, 40GP and 40HC. The right choice depends on cargo density, cube and the commercial profile of the shipment.
            </p>
            <div style={{ display: "grid", gap: 18 }}>
              {containers.map((item) => (
                <div key={item.type} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
                  <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: `${B.primary}10`, color: B.primary, display: "inline-block", fontWeight: 700, marginBottom: 10 }}>{item.type}</div>
                  <h3 style={{ ...st.h3, marginBottom: 8 }}>{item.use}</h3>
                  <p style={{ ...st.bd, fontSize: 13 }}>
                    Commonly used for: {item.cargo}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ ...st.cd, marginTop: 18 }}>
              <h3 style={{ ...st.h3, marginBottom: 8 }}>What about specialized equipment?</h3>
              <p style={{ ...st.bd, fontSize: 13 }}>
                Specialized equipment exists when the cargo genuinely needs it, but most exporter enquiries on this site are for standard general cargo moving in normal FCL containers.
              </p>
            </div>
          </div>
        )}

        {tab === "rates" && (
          <div>
            <h2 style={{ ...st.h2, textAlign: "left" }}>Freight rate components in plain language</h2>
            <p style={{ ...st.bd, marginTop: 10, marginBottom: 28 }}>
              A freight quote becomes easier to compare when the exporter understands which charges belong to the ocean leg, the India-side handling and the destination-side commercial structure.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {rateComponents.map(([title, desc]) => (
                <div key={title} style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
                  <h3 style={{ ...st.h3, fontSize: 16, marginBottom: 8 }}>{title}</h3>
                  <p style={{ ...st.bd, fontSize: 13 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <CTA
          eyebrow="Need Practical Help?"
          headline="Use the quote page when you are ready to move from information to shipment planning"
          copy="If you already know the route and cargo, start with the quote flow. If you need a manual commercial review, the team can take it from there."
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
