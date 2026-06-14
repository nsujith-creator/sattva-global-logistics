import { useNavigate } from "react-router-dom";
import { B, FF } from "../../theme/tokens";

export function CTA({
  eyebrow,
  headline,
  copy,
  primaryLabel = "Get a Freight Quote",
  primaryTo = "/quote",
  secondaryLabel = "Talk to an Export Specialist",
  secondaryTo = "/quote",
  st,
  I,
}) {
  const go = useNavigate();
  const isExternal = (to) => /^https?:\/\//.test(to) || to.startsWith("tel:") || to.startsWith("mailto:");
  const renderAction = (label, to, style, children) =>
    isExternal(to) ? (
      <a href={to} target={to.startsWith("http") ? "_blank" : undefined} rel={to.startsWith("http") ? "noopener noreferrer" : undefined} style={{ ...style, textDecoration: "none" }}>
        {children || label}
      </a>
    ) : (
      <button onClick={() => go(to)} style={style}>
        {children || label}
      </button>
    );

  return (
    <div
      style={{
        textAlign: "center",
        padding: "clamp(32px,5vw,56px) clamp(16px,4vw,24px)",
        background: `linear-gradient(135deg,${B.primary}06,${B.primary}12)`,
        borderRadius: 20,
        marginTop: 56,
        border: `1px solid ${B.primary}18`,
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: B.primary,
            textTransform: "uppercase",
            letterSpacing: 2.4,
            marginBottom: 12,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h3
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: B.dark,
          fontFamily: FF,
          marginBottom: copy ? 12 : 22,
        }}
      >
        {headline || "Ready to Ship with More Confidence?"}
      </h3>
      {copy && (
        <p style={{ maxWidth: 640, margin: "0 auto 22px", fontSize: 14, lineHeight: 1.7, color: B.g7 }}>
          {copy}
        </p>
      )}
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {renderAction(primaryLabel, primaryTo, st.bp, <>{primaryLabel} <I.Ar /></>)}
        {renderAction(secondaryLabel, secondaryTo, st.bs)}
      </div>
    </div>
  );
}
