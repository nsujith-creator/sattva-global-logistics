export function Eyebrow({ children, tone = "primary", style, ...rest }) {
  const color =
    tone === "gold"   ? "var(--sg-gold)"
    : tone === "accent" ? "var(--sg-accent)"
    : "var(--sg-primary)";
  return (
    <div
      style={{
        fontSize: "var(--fs-eyebrow)",
        fontWeight: "var(--fw-bold)",
        color,
        textTransform: "uppercase",
        letterSpacing: "var(--tracking-eyebrow-wide)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
