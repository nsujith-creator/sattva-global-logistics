import { useNavigate } from "react-router-dom";
import { B } from "../../theme/tokens";

export function Footer({ I }) {
  const go = useNavigate();
  return (
    <footer style={{ background: B.dark, color: B.g3, padding: "clamp(40px,5vw,56px) clamp(16px,4vw,24px) 28px", overflowX: "hidden" }}>
      {/* ── FOOTER CTA BAR ── */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 0 36px",
          borderBottom: "1px solid #334155",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#c8d7ff", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
            Export Freight from India · Gulf · Red Sea · Africa
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.35 }}>
            Have a shipment in hand?<br />Get clarity before you commit.
          </div>
          <div style={{ fontSize: 13, color: B.g5, maxWidth: 560, lineHeight: 1.7 }}>
            For supported lanes, start with a quote and see indicative pricing. For complex or new routes, speak to the team directly — no hand-off, no call centre.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => go("/quote")} style={{ padding: "12px 24px", background: "#fff", color: B.dark, border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            Get a Freight Quote
          </button>
          <button onClick={() => go("/why-sattva")} style={{ padding: "12px 20px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            Why Sattva
          </button>
        </div>
      </div>

      {/* ── FOOTER COLUMNS ── */}
      <div style={{ maxWidth: 1200, margin: "36px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 36 }}>
        <div>
          <img src="/sattva-logo-white.png" alt="Sattva Global Logistics" onClick={() => go("/")} style={{ height: 80, width: "auto", marginBottom: 14, display: "block", cursor: "pointer" }} />
          <p style={{ fontSize: 13, lineHeight: 1.7, color: B.g5 }}>
            Freight forwarding for Indian exporters shipping FCL general cargo to the Gulf, Red Sea and Africa — with personal involvement, route expertise and consistent pre-departure execution.
          </p>
        </div>
        <div>
          <h4 style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Explore</h4>
          {[
            ["home", "Home"],
            ["why-sattva", "Why Choose Sattva"],
            ["services", "Services"],
            ["trade-lanes", "Trade Lanes"],
            ["industries", "Industries"],
            ["knowledge", "Knowledge Centre"],
            ["testimonials", "Exporter Stories"],
            ["about", "About Sattva"],
            ["quote", "Get a Quote"],
          ].map(([id, label]) => (
            <div key={id} onClick={() => go(id === "home" ? "/" : `/${id}`)} style={{ fontSize: 13, color: B.g5, marginBottom: 9, cursor: "pointer", transition: "color .2s" }}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = B.g5}>
              {label}
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Cargo We Handle</h4>
          {[
            "Readymade garments & fabrics",
            "Cotton yarn & paper products",
            "Food products & FMCG cargo",
            "Kitchenware, towels & home textiles",
            "Agro commodities",
            "Engineering goods & machinery",
          ].map((x) => (
            <div key={x} style={{ fontSize: 13, color: B.g5, marginBottom: 9 }}>{x}</div>
          ))}
        </div>
        <div>
          <h4 style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Contact</h4>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 13, color: B.g5 }}><I.Pi /><span>Navi Mumbai, India</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 13 }}>
            <I.Ma />
            <a href="mailto:quotes@sattvaglobal.in" style={{ color: B.g5, textDecoration: "none" }}>quotes@sattvaglobal.in</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 13 }}>
            <I.Ph />
            <a href="tel:+919136121123" style={{ color: B.g5, textDecoration: "none" }}>+91 9136 121 123</a>
          </div>
          <div style={{ fontSize: 12, color: B.g5, marginTop: 14, lineHeight: 1.7, padding: "10px 12px", background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
            Use the quote page for supported routes or email us directly for manual review and shipment planning.
          </div>
        </div>
      </div>

      {/* ── FOOTER BOTTOM ── */}
      <div style={{ maxWidth: 1200, margin: "20px auto 0", paddingTop: 16, borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: 12, color: B.g5 }}>
        <span>© {new Date().getFullYear()} Sattva Global Logistics Pvt Ltd · Navi Mumbai, India</span>
        <span>FCL Export Freight · India to Gulf, Red Sea & Africa</span>
      </div>
      <div style={{ maxWidth: 1200, margin: "10px auto 0", paddingBottom: 8, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11, color: "#475569" }}>
        <span>GSTIN: 27AEFPN9399L1ZI</span>
        <span>·</span>
        <span>Member – DFA Network</span>
        <span>·</span>
        <span>Mumbai · Navi Mumbai</span>
      </div>
    </footer>
  );
}
