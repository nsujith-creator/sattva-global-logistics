import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { B, F } from "../../theme/tokens";
import { supabase } from "../../config/supabase";

// Slim persistent banner shown at the bottom of every page
// Fetches updated_at from trade_advisory on mount — lightweight, single-field query
// Clicking navigates to /trade-advisory

export function AdvisoryBanner() {
  const go = useNavigate();
  const loc = useLocation();
  const [updatedAt, setUpdatedAt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner on the advisory page itself
  const onAdvisoryPage = loc.pathname === "/trade-advisory";

  useEffect(() => {
    if (onAdvisoryPage) return;
    supabase
      .from("trade_advisory")
      .select("updated_at, situation")
      .eq("id", "current")
      .single()
      .then(({ data }) => {
        if (data?.situation && !data.situation.toLowerCase().includes("no active advisory")) {
          setUpdatedAt(data.updated_at);
        }
      });
  }, [onAdvisoryPage]);

  const fmtShort = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  };

  if (!updatedAt || dismissed || onAdvisoryPage) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 998,
        background: B.dark,
        borderTop: `2px solid ${B.red}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 24px",
        gap: 12,
        boxShadow: "0 -4px 20px rgba(0,0,0,.18)",
        flexWrap: "wrap",
      }}
    >
      {/* Left — alert label + message */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#fef2f2",
            border: `1px solid ${B.red}55`,
            borderRadius: 999,
            padding: "3px 10px",
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: B.red, display: "inline-block", animation: "pulse 1.8s infinite" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: B.red, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: F }}>
            Advisory
          </span>
        </span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,.9)", fontFamily: F, fontWeight: 500 }}>
          Middle East Crisis — Active carrier and surcharge updates for India origin cargo
        </span>
        {updatedAt && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontFamily: F, flexShrink: 0 }}>
            Updated {fmtShort(updatedAt)}
          </span>
        )}
      </div>

      {/* Right — CTA + dismiss */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => go("/trade-advisory")}
          style={{
            padding: "7px 16px",
            background: B.red,
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: F,
            letterSpacing: 0.3,
          }}
        >
          Read Advisory →
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,.4)",
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
            padding: "4px 6px",
            fontFamily: F,
          }}
          title="Dismiss"
        >
          ×
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
