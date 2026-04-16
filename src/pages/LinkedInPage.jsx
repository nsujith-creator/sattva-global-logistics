import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { B, F, FF } from "../theme/tokens";
import { CTA } from "../components/layout/CTA";

export function LinkedInPage({ st, I }) {
  const go = useNavigate();

  const dmOpenerForeign = `Hi [Name], I noticed you've been following the Hormuz updates — appreciate it. Quick question, genuinely not a pitch: when you're sourcing from India or managing Indian suppliers, where does things most often go wrong for you? Trying to understand where overseas buyers feel most exposed — happy to share what I'm seeing from the ground here in Mumbai.`;

  const dmOpenerReferral = `[Name], quick one — I've started working directly with overseas buyers who need a reliable India-side contact for supplier coordination and freight, not just booking. If any of your foreign buyers ever mention frustration with the India side — communication gaps, documentation issues, shipment follow-up — I'd appreciate you pointing them my way. No pressure, just thought I'd mention it.`;

  const services = [
    "Freight Forwarding",
    "Supplier Sourcing",
    "Export Coordination",
    "India Market Entry",
    "Logistics Consulting",
    "Shipping Advisory",
    "Supply Chain Coordination",
  ];

  const linkedInServiceTags = [
    { category: "Operations", tags: ["Supply Chain Management", "Logistics", "Procurement", "Project Management"] },
    { category: "Consulting", tags: ["Business Consulting", "Management Consulting"] },
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <Helmet>
        <title>India-Side Coordination for Overseas Buyers | Sattva Global Logistics</title>
        <meta
          name="description"
          content="India-side coordination for overseas buyers — supplier sourcing, shipment follow-up, documentation, and freight. 18 years on India's export lanes. Gulf · Red Sea · Africa · Europe."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/linkedin" />
      </Helmet>

      {/* ── HERO ── */}
      <section
        style={{
          background: `linear-gradient(160deg,${B.primary}07,${B.w})`,
          padding: "clamp(80px,10vw,110px) clamp(16px,4vw,24px) clamp(32px,4vw,56px)",
          borderBottom: `1px solid ${B.primary}12`,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#0077b5",
              color: "#fff",
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              marginBottom: 18,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn Profile Kit
          </div>
          <h1 style={{ ...st.h1, fontSize: "clamp(26px,4vw,42px)", marginBottom: 20 }}>
            India-Side Coordination for Overseas Buyers
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: B.g5, maxWidth: 760, marginBottom: 24 }}>
            Supplier Sourcing · Shipment &amp; Documentation · Ground-Level Follow-Up
            &nbsp;|&nbsp; FCL Exports &nbsp;|&nbsp; Gulf · Red Sea · Africa · Europe
          </p>
          <div
            style={{
              display: "inline-block",
              background: `${B.primary}08`,
              border: `1.5px solid ${B.primary}30`,
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 13,
              color: B.g7,
              fontWeight: 500,
            }}
          >
            18 Years on India's Export Lanes
          </div>
        </div>
      </section>

      <div style={st.sec}>

        {/* ── ABOUT / POSITIONING ── */}
        <div
          style={{
            ...st.cd,
            borderTop: `4px solid ${"#0077b5"}`,
            marginBottom: 32,
            maxWidth: 800,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#0077b5",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            LinkedIn About Section
          </div>
          <h2 style={{ ...st.h3, fontSize: 18, marginBottom: 16 }}>
            Updated About Copy — ready to paste
          </h2>
          <div
            style={{
              background: B.g1,
              borderRadius: 10,
              padding: "20px 24px",
              fontSize: 14,
              lineHeight: 1.85,
              color: B.g7,
              whiteSpace: "pre-wrap",
              fontFamily: F,
              border: `1px solid ${B.g3}44`,
            }}
          >
{`If you're buying from India — or planning to — and you need one reliable person on the ground who actually follows through, that's what I do.

I'm Sujith, based in Mumbai. For 18 years I've worked on FCL export freight out of India to the Gulf, Red Sea, East Africa, and Europe. But beyond freight, I help overseas buyers with the harder problem: navigating India itself.

That means supplier shortlisting and background checks, coordinating directly with Indian factories and vendors, catching documentation errors before they delay your shipment, managing your forwarder and customs broker on the ground, and translating freight market chaos — like the current Hormuz crisis — into plain English before it costs you money.

Most overseas buyers have the same frustration: their Indian supplier doesn't proactively communicate, their forwarder disappears when things go wrong, and nobody on the India side is actually accountable to them. I fill that gap.

Whether you're still finding the right supplier or you already have one and need someone to make sure the shipment actually moves cleanly — I'm your India-side point of contact.

📩 sujith@sattvaglobal.in`}
          </div>
        </div>

        {/* ── HEADLINE ── */}
        <div style={{ ...st.cd, marginBottom: 32, maxWidth: 800 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#0077b5",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            LinkedIn Headline
          </div>
          <div
            style={{
              background: B.g1,
              borderRadius: 10,
              padding: "16px 20px",
              fontSize: 14,
              lineHeight: 1.75,
              color: B.dark,
              fontWeight: 600,
              border: `1px solid ${B.g3}44`,
            }}
          >
            India-Side Coordination for Overseas Buyers | Supplier Sourcing · Shipment &amp; Documentation · Ground-Level Follow-Up | FCL Exports | Gulf · Red Sea · Africa · Europe | 18 Years on India's Export Lanes
          </div>
        </div>

        {/* ── SERVICES TAGS ── */}
        <div style={{ ...st.cd, marginBottom: 32, maxWidth: 800 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#0077b5",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            Services Section Tags
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {services.map((s) => (
              <span
                key={s}
                style={{
                  padding: "6px 14px",
                  background: `${B.primary}10`,
                  color: B.primary,
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${B.primary}30`,
                }}
              >
                {s}
              </span>
            ))}
          </div>
          <div
            style={{
              fontSize: 13,
              color: B.g5,
              lineHeight: 1.7,
              padding: "12px 16px",
              background: B.aBg,
              borderRadius: 8,
              border: `1px solid ${B.amber}33`,
            }}
          >
            <strong style={{ color: B.amber }}>LinkedIn categories to use:</strong>
            {linkedInServiceTags.map((g) => (
              <div key={g.category} style={{ marginTop: 8 }}>
                <span style={{ fontWeight: 600, color: B.g7 }}>Under {g.category}:</span>{" "}
                {g.tags.join(" · ")}
              </div>
            ))}
          </div>
        </div>

        {/* ── DM OPENERS ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 24,
            marginBottom: 32,
          }}
        >
          {[
            {
              label: "DM — Foreign Contacts (LinkedIn)",
              color: "#0077b5",
              text: dmOpenerForeign,
            },
            {
              label: "DM — Referral Ask (Existing Exporter Clients)",
              color: B.primary,
              text: dmOpenerReferral,
            },
          ].map(({ label, color, text }) => (
            <div key={label} style={{ ...st.cd, borderTop: `4px solid ${color}` }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 14,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  background: B.g1,
                  borderRadius: 10,
                  padding: "16px 18px",
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: B.g7,
                  whiteSpace: "pre-wrap",
                  fontFamily: F,
                  border: `1px solid ${B.g3}44`,
                  marginBottom: 14,
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>

        {/* ── LINKEDIN PROFILE LINK ── */}
        <div
          style={{
            ...st.cd,
            marginBottom: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            background: "#f0f7ff",
            border: `1.5px solid #0077b533`,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: B.dark, marginBottom: 4 }}>
              Your LinkedIn Profile
            </div>
            <div style={{ fontSize: 13, color: B.g5 }}>
              linkedin.com/in/sattva-global
            </div>
          </div>
          <a
            href="https://www.linkedin.com/in/sattva-global/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "#0077b5",
              color: "#fff",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
              fontFamily: F,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Open LinkedIn Profile
          </a>
        </div>

        <CTA
          eyebrow="India-Side Contact"
          headline="Need someone on the ground in India?"
          copy="Whether you're sourcing for the first time or managing an existing supplier — get a direct conversation with Sujith, no middlemen."
          primaryLabel="Email sujith@sattvaglobal.in"
          primaryTo="/quote"
          secondaryLabel="View FCL Freight Services"
          secondaryTo="/services"
          st={st}
          I={I}
        />
      </div>
    </div>
  );
}
