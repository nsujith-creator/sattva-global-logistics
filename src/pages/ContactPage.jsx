import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B, FF } from "../theme/tokens";
import { PageHero } from "../components/layout/PageHero";
import { trackEmailClick } from "../utils/analytics";

export function ContactPage({ st, I }) {
  return (
    <>
      <Helmet>
        <title>Get an FCL Freight Quote | Contact Sattva Global Logistics</title>
        <meta
          name="description"
          content="Request an FCL freight quote for India-origin exports — Gulf, Red Sea, East Africa, and Europe. Share your shipment details and we respond within 4 working hours."
        />
        <link rel="canonical" href="https://www.sattvaglobal.in/contact" />
        <meta property="og:title" content="Get an FCL Freight Quote | Contact Sattva Global Logistics" />
        <meta
          property="og:description"
          content="Request an FCL freight quote for India-origin exports — Gulf, Red Sea, East Africa, and Europe. Share your shipment details and we respond within 4 working hours."
        />
        <meta property="og:url" content="https://www.sattvaglobal.in/contact" />
        <meta name="twitter:title" content="Get an FCL Freight Quote | Contact Sattva Global Logistics" />
        <meta
          name="twitter:description"
          content="Request an FCL freight quote for India-origin exports — Gulf, Red Sea, East Africa, and Europe. Share your shipment details and we respond within 4 working hours."
        />
      </Helmet>

      <PageHero
        tag="Contact"
        headline="Get an FCL Freight Quote"
        sub="India-origin FCL exports to Gulf, Red Sea, East Africa, and Europe. Share your shipment details and we respond within 4 working hours."
        st={st}
        I={I}
      />

      <section style={{ background: B.w, padding: "56px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          <div style={{ marginBottom: 48 }}>
            <h2 style={{ ...st?.h2, color: B.dark, marginBottom: 8 }}>
              Reach us directly
            </h2>
            <p style={{ ...st?.bd, color: B.g5, marginBottom: 32 }}>
              For time-sensitive enquiries, WhatsApp or phone is fastest. For standard quote requests, use the form below or email us.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: B.brand ?? "#050A30",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                }}>
                  <I.Ph />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: B.g5, fontFamily: FF?.mono ?? "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                    Phone / WhatsApp
                  </div>
                  <a
                    href="tel:+919136121123"
                    style={{ fontSize: 17, fontWeight: 600, color: B.dark, textDecoration: "none" }}
                  >
                    +91 9136 121 123
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: B.brand ?? "#050A30",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                }}>
                  <I.Ma />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: B.g5, fontFamily: FF?.mono ?? "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                    Email
                  </div>
                  <a
                    href="mailto:quotes@sattvaglobal.in"
                    onClick={() => trackEmailClick('contact-page')}
                    style={{ fontSize: 17, fontWeight: 600, color: B.dark, textDecoration: "none" }}
                  >
                    quotes@sattvaglobal.in
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: B.brand ?? "#050A30",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                }}>
                  <I.Pi />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: B.g5, fontFamily: FF?.mono ?? "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                    Location
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 600, color: B.dark }}>
                    Mumbai, India
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            borderTop: `1px solid ${B.g2 ?? "#e2e8f0"}`,
            paddingTop: 40,
          }}>
            <p style={{ ...st?.bd, color: B.g5, marginBottom: 4 }}>
              <strong style={{ color: B.dark }}>Response time:</strong> Within 4 working hours on standard quote requests. Urgent shipments — call or WhatsApp directly.
            </p>
            <p style={{ ...st?.bd, color: B.g5 }}>
              <strong style={{ color: B.dark }}>Cargo types:</strong> General dry FCL — garments, FMCG, agro, engineering goods. No reefer, no oversized.
            </p>
          </div>
        </div>
      </section>

      <CTA
        primaryTo="/quote"
        secondaryTo="/trade-advisory"
        secondaryLabel="View freight advisory"
        st={st}
        I={I}
      />
    </>
  );
}
