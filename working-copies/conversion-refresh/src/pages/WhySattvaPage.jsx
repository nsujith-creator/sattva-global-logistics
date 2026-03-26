import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B } from "../theme/tokens";

export function WhySattvaPage({ st, I }) {
  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>Why Choose Sattva Global Logistics | Honest Answer for Indian Exporters</title>
        <meta
          name="description"
          content="Exporters leave forwarders over poor follow-up and avoidable problems — not just price. See how Sattva is built differently for Indian FCL exporters shipping to Gulf, Red Sea and Africa."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/why-sattva" />
      </Helmet>

      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(160deg,${B.primary}05,${B.w})`, padding: "clamp(56px,8vw,88px) 20px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.primary, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>Why Choose Sattva</div>
          <h1 style={{ ...st.h1, fontSize: "clamp(30px,4vw,44px)" }}>
            Most exporters do not leave a forwarder over price.{" "}
            <span style={{ color: B.primary }}>They leave over everything that happens after the quote.</span>
          </h1>
          <p style={{ ...st.bd, fontSize: 17, marginTop: 20, maxWidth: 760 }}>
            Weak follow-up. Unclear communication. Problems caught too late. A booking confirmation sent and then silence. That is the pattern Sattva was built to fix.
          </p>
        </div>
      </section>

      <div style={st.sec}>
        {/* ── HONEST POSITIONING ── */}
        <div style={{ ...st.cd, borderTop: `4px solid ${B.primary}`, marginBottom: 28 }}>
          <h2 style={{ ...st.h2, textAlign: "left", marginBottom: 14 }}>The honest answer — what makes the difference</h2>
          <p style={{ ...st.bd, fontSize: 15 }}>
            Freight forwarding is not a complicated service to describe. But the difference between a good forwarding partner and a bad one is entirely in the execution. Sattva is built for exporters who have experienced the gap between what was promised and what was actually delivered — and want something steadier.
          </p>
        </div>

        {/* ── DIFFERENTIATORS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 24 }}>
          {[
            ["The team that quotes is the team that executes", "You are not handed off to a junior coordinator after the booking confirmation. The people who reviewed your route and quoted the shipment are the same people managing the movement."],
            ["Commercial clarity before you commit", "We explain what is included, what assumptions apply and where cost or timing can change — before the cargo moves. Not in a post-problem conversation."],
            ["Execution-first thinking", "Most shipment problems are predictable. We look for them early — in the documentation flow, the inland timing, the cut-off window — not after the cargo misses the vessel."],
            ["India-origin expertise on routes we know", "We are not a global forwarder trying to cover every lane. Our focus is India to Gulf, Red Sea and Africa — and we know these lanes the way a forwarder who has worked them for 16 years knows them."],
          ].map(([t, d]) => (
            <div key={t} style={{ ...st.cd, borderTop: `3px solid ${B.primary}` }}>
              <h3 style={{ ...st.h3, marginBottom: 10 }}>{t}</h3>
              <p style={{ ...st.bd, fontSize: 14 }}>{d}</p>
            </div>
          ))}
        </div>

        {/* ── FIT / NO-FIT ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24, marginTop: 28 }}>
          <div style={{ ...st.cd, borderLeft: `4px solid ${B.primary}` }}>
            <h3 style={{ ...st.h3, marginBottom: 14 }}>When Sattva is the better fit</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                "When the shipment is commercially important — buyer relationship, letter of credit, repeat order",
                "When documentation accuracy affects payment or destination clearance",
                "When the cargo moves repeatedly and consistency matters more than a one-time deal",
                "When you want a forwarder who can flag problems early, not explain them later",
                "When India-side execution — dispatch timing, CFS coordination, cut-off management — is where things usually go wrong",
              ].map((t) => (
                <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ color: B.primary, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>✓</div>
                  <span style={{ fontSize: 13, color: B.g7, lineHeight: 1.7 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...st.cd, borderLeft: `4px solid ${B.g3}` }}>
            <h3 style={{ ...st.h3, marginBottom: 14 }}>When we may not be the right fit</h3>
            <p style={{ ...st.bd, fontSize: 14 }}>
              If your only requirement is the lowest visible number with no coordination expectations, Sattva is probably not the right match. We are not the cheapest option in the market — and we do not try to be.
            </p>
            <p style={{ ...st.bd, fontSize: 14, marginTop: 12 }}>
              Our value is strongest where execution quality, documentation discipline and consistent communication matter alongside freight cost. If that is not a priority, a volume-driven discount forwarder will serve you better.
            </p>
          </div>
        </div>

        <CTA
          eyebrow="Ready to Talk?"
          headline="Tell us about your shipment — we will be direct about whether we are the right fit"
          copy="No sales pressure. Share your route, cargo and what has frustrated you with past forwarders. We will give you an honest view."
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
