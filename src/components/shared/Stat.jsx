export function Stat({ value, label, tone = "primary", align = "left", style, ...rest }) {
  const numColor =
    tone === "gold"  ? "var(--sg-gold)"
    : tone === "light" ? "#fff"
    : "var(--sg-primary)";
  const labelColor =
    tone === "light" || tone === "gold"
      ? "rgba(255,255,255,0.55)"
      : "var(--sg-slate-5)";
  return (
    <div style={{ textAlign: align, ...style }} {...rest}>
      <div style={{ fontSize: 28, fontWeight: "var(--fw-extrabold)", color: numColor, fontFamily: "var(--font-display)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: labelColor, maxWidth: 160, lineHeight: 1.6, marginTop: 4, marginInline: align === "center" ? "auto" : undefined }}>
        {label}
      </div>
    </div>
  );
}
