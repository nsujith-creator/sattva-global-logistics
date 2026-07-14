import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { B, F } from "../../theme/tokens";

export function Nav({ st }) {
  const go = useNavigate();
  const loc = useLocation();
  const page = loc.pathname.replace("/", "") || "home";
  const [sc, setSc] = useState(false);
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const h = () => setSc(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (open && navRef.current && !navRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);

  useEffect(() => {
    const h = () => { if (window.innerWidth > 860) setOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const glassBg = sc || open
    ? "linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9))"
    : "linear-gradient(180deg,rgba(255,255,255,.82),rgba(255,255,255,.68))";

  const lk = [
    ["why-sattva", "Why Sattva"],
    ["services", "Services"],
    ["trade-lanes", "Trade Lanes"],
    ["freight-intelligence-desk", "Intelligence Desk"],
    ["india-uk-ceta", "India–UK CETA"],
    ["knowledge", "Knowledge"],
    ["track-container", "Track Shipment"],
  ];

  const goTo = (id) => {
    if (id === "india-uk-ceta") window.location.href = "/india-uk-ceta";
    else go(id === "home" ? "/" : `/${id}`);
    setOpen(false);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Site navigation"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: glassBg,
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
        boxShadow: sc ? "0 10px 30px rgba(5,10,48,.08)" : "0 1px 0 rgba(255,255,255,.3)",
        borderBottom: "1px solid rgba(5,10,48,0.08)",
        transition: "background .3s, box-shadow .3s",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => goTo("home")}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && goTo("home")}
          aria-label="Sattva Global Logistics — home"
        >
          <img src="/sattva-global-logistics-logo-vector-SWIRL-VERIFIED.svg" alt="Sattva Global Logistics" style={{ height: 44, width: "auto", display: "block" }} />
        </div>

        <div className="sg-nav-links" style={{ alignItems: "center", gap: 4 }}>
          <ul style={{ display: "flex", gap: 12, listStyle: "none", margin: 0, padding: 0 }}>
            {lk.map(([id, lb]) => {
              const isActive = page === id;
              const isCeta = id === "india-uk-ceta";
              const isTrack = id === "track-container";
              return (
                <li key={id}>
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={() => goTo(id)}
                    onKeyDown={(e) => e.key === "Enter" && goTo(id)}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      color: isActive ? B.primary : isCeta ? "#b45309" : isTrack ? "#00C9A7" : B.g7,
                      fontWeight: isActive || isCeta || isTrack ? 700 : 600,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: F,
                      borderBottom: isActive ? `2px solid ${B.primary}` : "2px solid transparent",
                      background: isCeta ? "rgba(245,166,35,0.12)" : isTrack && !isActive ? "rgba(0,201,167,0.10)" : "transparent",
                      border: isCeta ? "1.5px solid rgba(245,166,35,0.42)" : isTrack && !isActive ? "1.5px solid rgba(0,201,167,0.35)" : undefined,
                      borderRadius: isCeta || isTrack ? 6 : 0,
                      padding: isCeta || isTrack ? "5px 9px" : undefined,
                      transition: "color .2s, border-color .2s",
                      display: "inline-block",
                      whiteSpace: "nowrap",
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
              fontSize: 12, fontWeight: 700, color: B.primary, textDecoration: "none",
              whiteSpace: "nowrap", marginLeft: 8, padding: "8px 11px", borderRadius: 8,
              border: `1px solid ${B.primary}26`, background: "rgba(2,74,171,0.07)",
              letterSpacing: 0.2, transition: "background .2s, border-color .2s", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
            }}
          >
            +91 9136 121 123
          </a>
          <button onClick={() => go("/quote")} style={{ ...st.bp, padding: "9px 18px", fontSize: 12, marginLeft: 8 }}>
            Get Quote
          </button>
        </div>

        <button
          className="sg-nav-hamburger"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="sg-nav-drawer"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 8, flexDirection: "column", gap: 5 }}
        >
          <span style={{ display: "block", width: 22, height: 2, background: B.dark, transition: "transform .25s, opacity .25s", transform: open ? "rotate(45deg) translate(5px,5px)" : "none" }} />
          <span style={{ display: "block", width: 22, height: 2, background: B.dark, transition: "transform .25s, opacity .25s", opacity: open ? 0 : 1 }} />
          <span style={{ display: "block", width: 22, height: 2, background: B.dark, transition: "transform .25s, opacity .25s", transform: open ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
        </button>
      </div>

      {open && (
        <div
          id="sg-nav-drawer"
          className="sg-nav-drawer"
          style={{ background: "rgba(255,255,255,.97)", borderTop: `1px solid ${B.g3}33`, padding: "8px 24px 24px" }}
        >
          {lk.map(([id, lb]) => {
            const isCeta = id === "india-uk-ceta";
            return (
              <div
                key={id}
                onClick={() => goTo(id)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && goTo(id)}
                aria-current={page === id ? "page" : undefined}
                style={{
                  padding: "13px 0", fontSize: 15,
                  fontWeight: page === id || isCeta ? 700 : 500,
                  color: page === id ? B.primary : isCeta ? "#b45309" : B.dark,
                  cursor: "pointer",
                  borderBottom: `1px solid ${B.g1}`,
                  fontFamily: F,
                }}
              >
                {isCeta ? "NEW · India–UK CETA Guide" : lb}
              </div>
            );
          })}
          <button onClick={() => goTo("quote")} style={{ ...st.bp, width: "100%", justifyContent: "center", marginTop: 16 }}>
            Get Quote
          </button>
          <a href="tel:+919136121123" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 14, fontWeight: 700, color: B.primary, textDecoration: "none" }}>
            +91 9136 121 123
          </a>
        </div>
      )}

      {loc.pathname === "/" && !open && (
        <a
          href="/india-uk-ceta"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            minHeight: 42, padding: "8px 16px", textDecoration: "none",
            background: "linear-gradient(90deg,#fff4da,#fffaf0)",
            borderTop: "1px solid rgba(245,166,35,.34)",
            borderBottom: "1px solid rgba(245,166,35,.42)",
            color: B.dark, fontFamily: F, textAlign: "center",
          }}
        >
          <span style={{ background: "#f5a623", color: B.dark, borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>NEW</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>India–UK CETA is live — 5 checks before assuming zero duty</span>
          <span aria-hidden="true" style={{ color: "#b45309", fontWeight: 900 }}>→</span>
        </a>
      )}
    </nav>
  );
}
