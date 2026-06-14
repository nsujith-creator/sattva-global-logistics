import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { B, F } from "../../theme/tokens";
import { useIsMobile } from "../../hooks/useIsMobile";

export function Nav({ st }) {
  const go = useNavigate();
  const loc = useLocation();
  const page = loc.pathname.replace("/", "");
  const activePage = page || "home";
  const [sc, setSc] = useState(false);
  const [open, setOpen] = useState(false);
  const m = useIsMobile();

  useEffect(() => {
    const h = () => setSc(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (!m) setOpen(false);
  }, [m]);

  const glassBg = sc || open
    ? "linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9))"
    : "linear-gradient(180deg,rgba(255,255,255,.82),rgba(255,255,255,.68))";

  const lk = [
    ["why-sattva", "Why Sattva"],
    ["services", "Services"],
    ["trade-lanes", "Trade Lanes"],
    ["freight-intelligence-desk", "Intelligence Desk"],
    ["knowledge", "Knowledge"],
  ];

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: glassBg,
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
        boxShadow: sc ? "0 10px 30px rgba(5,10,48,.08)" : "0 1px 0 rgba(255,255,255,.3)",
        borderBottom: "1px solid rgba(5,10,48,0.08)",
        transition: "all .3s",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 68,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => { go("/"); setOpen(false); }}>
          <img src="/sattva-global-logistics-logo-vector-SWIRL-VERIFIED.svg" alt="Sattva Global Logistics" style={{ height: 44, width: "auto", display: "block" }} />
        </div>
        {m ? (
          <button
            onClick={() => setOpen((o) => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}
          >
            <span style={{ display: "block", width: 22, height: 2, background: B.dark, transition: "all .25s", transform: open ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <span style={{ display: "block", width: 22, height: 2, background: B.dark, transition: "all .25s", opacity: open ? 0 : 1 }} />
            <span style={{ display: "block", width: 22, height: 2, background: B.dark, transition: "all .25s", transform: open ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ul style={{ display: "flex", gap: 14, listStyle: "none", margin: 0, padding: 0 }}>
              {lk.map(([id, lb]) => {
                const isActive = activePage === id || (!activePage && id === "home");
                return (
                  <li key={id}>
                    <span
                      onClick={() => go(id === "home" ? "/" : `/${id}`)}
                      style={{
                        color: id === "trade-advisory" ? B.red : isActive ? B.primary : B.g7,
                        fontWeight: isActive ? 700 : 600,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: F,
                        paddingBottom: 4,
                        borderBottom: isActive ? `2px solid ${B.primary}` : "2px solid transparent",
                        transition: "color .2s, border-color .2s",
                      }}
                    >
                      {lb}
                    </span>
                  </li>
                );
              })}
            </ul>
            <a
              href="tel:+919136121123"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: B.primary,
                textDecoration: "none",
                whiteSpace: "nowrap",
                marginLeft: 8,
                padding: "8px 11px",
                borderRadius: 8,
                border: `1px solid ${B.primary}26`,
                background: "rgba(2,74,171,0.07)",
                letterSpacing: 0.2,
                transition: "all .2s",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(2,74,171,0.11)";
                e.currentTarget.style.borderColor = `${B.primary}44`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(2,74,171,0.07)";
                e.currentTarget.style.borderColor = `${B.primary}26`;
              }}
            >
              +91 9136 121 123
            </a>
            <button onClick={() => go("/quote")} style={{ ...st.bp, padding: "9px 20px", fontSize: 12, marginLeft: 8 }}>
              Get Quote
            </button>
          </div>
        )}
      </div>
      {m && open && (
        <div style={{ background: "rgba(255,255,255,.97)", borderTop: `1px solid ${B.g3}33`, padding: "8px 24px 24px" }}>
          {lk.map(([id, lb]) => (
            <div
              key={id}
              onClick={() => {
                go(id === "home" ? "/" : `/${id}`);
                setOpen(false);
              }}
              style={{
                padding: "13px 0",
                fontSize: 15,
                fontWeight: page === id ? 700 : 500,
                color: id === "trade-advisory" ? B.red : page === id ? B.primary : B.dark,
                cursor: "pointer",
                borderBottom: `1px solid ${B.g1}`,
              }}
            >
              {lb}
            </div>
          ))}
          <button onClick={() => { go("/quote"); setOpen(false); }} style={{ ...st.bp, width: "100%", justifyContent: "center", marginTop: 16 }}>
            Get Quote
          </button>
          <a href="tel:+919136121123" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 14, fontWeight: 700, color: B.primary, textDecoration: "none" }}>
            +91 9136 121 123
          </a>
        </div>
      )}
    </nav>
  );
}
