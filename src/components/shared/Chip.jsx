export function Chip({ children, tone = "dark", style, ...rest }) {
  const toneStyle = tone === "dark"
    ? { color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }
    : { color: "var(--sg-primary)", background: "rgba(2,74,171,0.07)", border: "1px solid rgba(2,74,171,0.15)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: "var(--fw-bold)",
        fontFamily: "var(--font-sans)",
        borderRadius: "var(--radius-pill)",
        padding: "6px 12px",
        letterSpacing: 0.3,
        ...toneStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
