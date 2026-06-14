import { Helmet } from "react-helmet-async";
import { B, FF } from "../theme/tokens";
import { PageHero } from "../components/layout/PageHero";
import { useIsMobile } from "../hooks/useIsMobile";
import { pageWhatsAppLink } from "../utils/links";

const signals = [
  ["Freight rate pressure", "Spot movement, surcharge risk, GRIs, PSS, emergency charges"],
  ["Capacity and schedule reliability", "Blank sailings, rolled cargo, skipped ports, longer routings"],
  ["Port and terminal conditions", "Congestion, strikes, weather, gate and yard disruption"],
  ["Bunker and oil movement", "Crude and fuel shifts that can feed into BAF and emergency bunker surcharges"],
  ["Geopolitical route risk", "Red Sea, Hormuz, Gulf, sanctions, war-risk zones"],
  ["Trade policy and tariffs", "Duties, restrictions, exemptions, retaliatory measures"],
  ["Forward-looking probability signals", "Market-priced expectations, used only as an early-warning input"],
];

const noteFormat = [
  ["Signal", "what changed"],
  ["Source trail", "where it came from, so you can verify"],
  ["Freight impact", "what it does to cost, routing, or transit"],
  ["Action", "the specific booking, quote, or communication step"],
  ["Confidence", "how firm the read is"],
];

const audiences = [
  "FCL exporters shipping from Indian ports who need to protect quote margins and hold committed transit times",
  "Freight forwarders who have to brief customers before the customer hears it elsewhere",
  "Import procurement teams managing landed cost and delivery risk on India-linked lanes",
];

const pricing = [
  ["7-day preview access", "No charge", "See the notes before you commit."],
  ["Founding member", "₹999/month", "Founding pricing held for early subscribers."],
  ["Founding 3-month plan", "₹2,499", "Payment by Razorpay link. Delivery by WhatsApp."],
];

function SectionHeader({ label, title, copy, align = "center", st }) {
  return (
    <div style={{ textAlign: align, marginBottom: 28 }}>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 10 }}>
          {label}
        </div>
      )}
      <h2 style={{ ...st.h2, textAlign: align, marginBottom: copy ? 10 : 0 }}>{title}</h2>
      {copy && <p style={{ ...st.sub, textAlign: align, margin: align === "center" ? "14px auto 0" : "14px 0 0", maxWidth: 760 }}>{copy}</p>}
    </div>
  );
}

export function FreightIntelligenceDeskPage({ st, I }) {
  const m = useIsMobile();
  const previewWhatsAppLink = pageWhatsAppLink("/freight-intelligence-desk");

  const decisionRows = [
    ["Rate pressure", "quote validity"],
    ["Capacity shift", "booking timing"],
    ["Port disruption", "customer update"],
    ["Route risk", "surcharge exposure"],
    ["Policy change", "shipment check"],
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Sattva Freight Intelligence Desk | India-lane Freight Market Intelligence</title>
        <meta
          name="description"
          content="India-lane freight intelligence for exporters, importers and logistics teams. Market signals translated into booking, routing, quote-validity and customer-communication actions."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/freight-intelligence-desk" />
      </Helmet>

      <PageHero>
        <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "minmax(0,1.05fr) minmax(320px,.95fr)", gap: m ? 34 : 56, alignItems: "center" }}>
          <div>
            <h1 style={{ ...st.h1, fontSize: "clamp(34px,5vw,58px)", color: "#fff", maxWidth: 860 }}>
              India-lane freight intelligence for exporters, importers, and logistics teams.
            </h1>
            <p style={{ ...st.bd, fontSize: m ? 15 : 17, marginTop: 22, maxWidth: 760, color: "rgba(255,255,255,0.82)" }}>
              We track freight-rate pressure, capacity shifts, port congestion, bunker movement, geopolitical disruption, sanctions, trade policy, and forward-looking market signals — then translate them into booking, routing, quote-validity, surcharge, and customer-communication actions.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
              <a href={previewWhatsAppLink} target="_blank" rel="noopener noreferrer" style={{ ...st.bp, textDecoration: "none", fontSize: m ? 13 : 14 }}>
                Join 7-day preview access <I.Ar />
              </a>
            </div>
          </div>
          <div style={{
            background: "rgba(5,10,48,0.62)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderTop: "3px solid #F5A623",
            borderRadius: 14,
            padding: m ? 20 : 28,
            boxShadow: "0 18px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", textTransform: "uppercase", letterSpacing: 2.2, marginBottom: 16 }}>
              Desk output
            </div>
            {decisionRows.map(([signal, outcome]) => (
              <div key={signal} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ color: "rgba(255,255,255,0.76)", fontSize: 13 }}>{signal}</span>
                <span aria-hidden="true" style={{ color: "#F5A623", fontSize: 13, fontWeight: 800 }}>→</span>
                <strong style={{ color: "#fff", fontSize: 13, textAlign: "right" }}>{outcome}</strong>
              </div>
            ))}
            <p style={{ color: "rgba(255,255,255,0.56)", fontSize: 12, lineHeight: 1.7, margin: "16px 0 0" }}>
              Short WhatsApp notes. Source trail included. Freight-desk interpretation on every signal.
            </p>
          </div>
        </div>
      </PageHero>

      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <div style={{ ...st.cd, borderTop: `4px solid ${B.primary}` }}>
            <SectionHeader label="What this is" title="A freight market intelligence desk focused on India-linked ocean lanes." align="left" st={st} />
            <p style={{ ...st.bd, fontSize: 15 }}>
              We aggregate market signals, keep the source trail, add freight-desk interpretation, and convert it into a short list of decisions you can act on the same day.
            </p>
            <p style={{ ...st.bd, fontSize: 15, marginTop: 12 }}>
              It is not a newspaper. Not a forwarder newsletter. Not a betting or trading signal. It sits closer to the freight-intelligence category — shaped by 20+ years of freight forwarding work, not rewritten from headlines.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div style={st.sec}>
          <SectionHeader label="Signals we monitor" title="The pressure points that change freight decisions." st={st} />
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 16 }}>
            {signals.map(([title, copy]) => (
              <div key={title} style={{ ...st.cd, padding: "22px 24px", borderLeft: `4px solid ${B.primary}` }}>
                <h3 style={{ ...st.h3, fontSize: 17, marginBottom: 8 }}>{title}</h3>
                <p style={{ ...st.bd, fontSize: 13, margin: 0 }}>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: B.dark }}>
        <div style={{ ...st.sec, color: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : ".9fr 1.1fr", gap: m ? 30 : 44, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>
                What subscribers receive
              </div>
              <h2 style={{ ...st.h2, color: "#fff", textAlign: "left" }}>
                A short, structured note delivered by WhatsApp.
              </h2>
              <p style={{ ...st.bd, fontSize: 15, color: "rgba(255,255,255,0.74)", marginTop: 16 }}>
                Built to read in under two minutes and act on immediately. Each note carries 3-5 signals. No essays. No padding. The read and the action, with the trail to check it yourself.
              </p>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {noteFormat.map(([label, copy]) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 12, padding: "14px 16px", background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
                  <strong style={{ color: "#fff", fontSize: 13 }}>{label}</strong>
                  <span style={{ color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 1.55 }}>{copy}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: 40,
            background: "#fff",
            color: B.dark,
            borderRadius: 14,
            padding: m ? 22 : 32,
            borderTop: "4px solid #F5A623",
            boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: B.primary, textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 14 }}>
              Sample signal excerpt
            </div>
            {[
              ["Signal", "Two more carriers extend Cape of Good Hope routing on Asia-Europe strings through next month."],
              ["Source trail", "Carrier advisories and maritime/security advisories."],
              ["Freight impact", "Adds 10-14 days transit on affected EU lanes; expect surcharge revisions and tighter space into the next sailing window."],
              ["Action", "Re-confirm quote validity before re-quoting EU-bound FCL. Flag the transit change to customers with live bookings now, not after cut-off."],
              ["Confidence", "High — multiple independent carrier confirmations."],
            ].map(([label, copy]) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "150px 1fr", gap: m ? 4 : 16, padding: "13px 0", borderBottom: `1px solid ${B.g1}` }}>
                <strong style={{ fontSize: 13, color: B.primary }}>{label}</strong>
                <span style={{ fontSize: 14, color: B.g7, lineHeight: 1.7 }}>{copy}</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: B.g5, lineHeight: 1.7, margin: "16px 0 0" }}>
              Abbreviated. A live note carries 3-5 signals across active areas.
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <SectionHeader label="Who it is for" title="Built for teams exposed to rate, capacity, and routing change." st={st} />
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(3,1fr)", gap: 18 }}>
            {audiences.map((copy) => (
              <div key={copy} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
                <p style={{ ...st.bd, fontSize: 14, margin: 0 }}>{copy}</p>
              </div>
            ))}
          </div>
          <p style={{ ...st.sub, maxWidth: 780, marginTop: 28 }}>
            If a rate move, capacity shift, or routing change can cost you a margin or a client conversation, this desk is built for you.
          </p>
        </div>
      </section>

      <section>
        <div style={st.sec}>
          <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 26, alignItems: "start" }}>
            <div>
              <SectionHeader label="Why this is different" title="Narrower than global platforms. More actionable than freight news." align="left" st={st} />
              <p style={{ ...st.bd, fontSize: 15 }}>
                Global freight intelligence platforms are built for broad market coverage and enterprise procurement teams. General freight news tells you a thing happened, not what to do about your booking. Forwarder newsletters mostly sell the forwarder.
              </p>
              <p style={{ ...st.bd, fontSize: 15, marginTop: 12 }}>
                This desk is narrower and more useful for an Indian freight desk: India-lane focus, freight-desk interpretation, and a defined action on every signal.
              </p>
            </div>
            <div style={{ ...st.cd, background: B.g1, borderLeft: `4px solid ${B.primary}` }}>
              <h3 style={{ ...st.h3, marginBottom: 12 }}>The filter</h3>
              <p style={{ ...st.bd, fontSize: 16, color: B.dark, margin: 0 }}>
                Does this change a decision an Indian shipper makes this week, on booking, routing, quote validity, surcharge exposure, or what to tell a customer?
              </p>
              <p style={{ ...st.bd, fontSize: 14, marginTop: 12 }}>
                If the answer is no, it does not go in the note.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: B.g1 }}>
        <div style={st.sec}>
          <div style={{ ...st.cd }}>
            <SectionHeader label="How notes are handled" title="Subscriber use first, controlled public excerpts later." align="left" st={st} />
            <p style={{ ...st.bd, fontSize: 15, margin: 0 }}>
              Paid notes are intended for subscriber use. As the desk evolves, subscriber-specific watermarking and selected public excerpts may be used to control sharing without blocking legitimate circulation. The full note stays with paying subscribers.
            </p>
          </div>

          <div style={{ marginTop: 44 }}>
            <SectionHeader label="Pricing / founding access" title="Visible pricing, quiet commitment." st={st} />
            <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(3,1fr)", gap: 18 }}>
              {pricing.map(([name, price, copy], idx) => (
                <div key={name} style={{ ...st.cd, borderTop: `3px solid ${idx === 0 ? "#F5A623" : B.primary}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B.g7, marginBottom: 10 }}>{name}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: B.dark, fontFamily: FF, marginBottom: 10 }}>{price}</div>
                  <p style={{ ...st.bd, fontSize: 13, margin: 0 }}>{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 30, padding: 22, borderRadius: 12, background: "#fff", border: `1px solid ${B.g3}66` }}>
            <h3 style={{ ...st.h3, fontSize: 16, marginBottom: 8 }}>Compliance note</h3>
            <p style={{ ...st.bd, fontSize: 12, color: B.g5, margin: 0 }}>
              The Sattva Freight Intelligence Desk is a freight market intelligence service for logistics and trade decisions. It is not investment advice, trading guidance, or a betting or prediction service. Forward-looking probability signals are used only as an early-warning input for freight-operational planning. Verify all signals against the source trail provided before acting on them.
            </p>
          </div>
        </div>
      </section>

      <section id="contact">
        <div style={st.sec}>
          <div style={{
            textAlign: "center",
            padding: "clamp(36px,6vw,64px) clamp(18px,5vw,36px)",
            background: `linear-gradient(135deg,${B.primary}08,${B.accent}18)`,
            border: `1px solid ${B.primary}18`,
            borderRadius: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 12 }}>
              Start your 7-day preview access.
            </div>
            <h2 style={{ ...st.h2, marginBottom: 12 }}>See exactly what the desk sends before you pay.</h2>
            <p style={{ ...st.sub, maxWidth: 720 }}>
              If it changes one booking or one customer conversation in that week, it has done its job.
            </p>
            <a href={previewWhatsAppLink} target="_blank" rel="noopener noreferrer" style={{ ...st.bp, marginTop: 24, textDecoration: "none" }}>
              Join 7-day preview access <I.Ar />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
