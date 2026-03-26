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
  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 24px",
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
        <button onClick={() => go(primaryTo)} style={st.bp}>
          {primaryLabel} <I.Ar />
        </button>
        <button onClick={() => go(secondaryTo)} style={st.bs}>
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}
