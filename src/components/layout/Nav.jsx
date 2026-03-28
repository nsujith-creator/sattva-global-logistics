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

  const lk = [
    ["home", "Home"],
    ["why-sattva", "Why Sattva"],
    ["services", "Services"],
    ["trade-lanes", "Trade Lanes"],
    ["trade-advisory", "⚠ Advisory"],
    ["industries", "Industries"],
    ["knowledge", "Knowledge"],
    ["testimonials", "Proof"],
  ];

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: sc || open ? "rgba(255,255,255,.97)" : "rgba(255,255,255,.9)",
        backdropFilter: "blur(12px)",
        boxShadow: sc ? "0 1px 10px rgba(0,0,0,.07)" : "none",
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
          <img src="/sattva-logo.png" alt="Sattva Global Logistics" style={{ height: 56, width: "auto", display: "block" }} />
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ul style={{ display: "flex", gap: 22, listStyle: "none", margin: 0, padding: 0 }}>
              {lk.map(([id, lb]) => (
                <li key={id}>
                  <span
                    onClick={() => go(id === "home" ? "/" : `/${id}`)}
                    style={{
                      color: id === "trade-advisory"
                        ? B.red
                        : activePage === id || (!activePage && id === "home") ? B.primary : B.g7,
                      fontWeight: activePage === id || (!activePage && id === "home") ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: F,
                    }}
                  >
                    {lb}
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={() => go("/quote")} style={{ ...st.bp, padding: "9px 20px", fontSize: 12, marginLeft: 12 }}>
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
                color: page === id ? B.primary : B.dark,
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
        </div>
      )}
    </nav>
  );
}
