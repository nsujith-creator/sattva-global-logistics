import { Badge } from "./Badge";

export function TrustCard({ sector, lane, claim, metric, attribution, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        borderTop: "var(--border-accent-top) solid var(--sg-primary)",
        boxShadow: "var(--shadow-card)",
        padding: 28,
        boxSizing: "border-box",
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {sector && (
          <span style={{ fontSize: 11, fontWeight: "var(--fw-bold)", color: "var(--sg-primary)", textTransform: "uppercase", letterSpacing: 1.5 }}>
            {sector}
          </span>
        )}
        {lane && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--sg-slate-7)", background: "var(--sg-slate-1)", borderRadius: "var(--radius-sm)", padding: "3px 10px", whiteSpace: "nowrap" }}>
            {lane}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "var(--sg-slate-7)" }}>{claim}</p>
      {(metric || attribution) && (
        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 14, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          {metric && <Badge tone="green">{metric}</Badge>}
          {attribution && (
            <span style={{ fontSize: 11, fontWeight: "var(--fw-bold)", color: "var(--sg-slate-5)", textTransform: "uppercase", letterSpacing: 1 }}>
              {attribution}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
