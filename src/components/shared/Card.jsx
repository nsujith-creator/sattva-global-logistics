export function Card({
  children,
  accentTop = false,
  tone = "light",
  padding = 28,
  style,
  ...rest
}) {
  const accentColor =
    accentTop === true ? "var(--sg-primary)"
    : typeof accentTop === "string" ? accentTop
    : null;

  const toneStyle = tone === "dark"
    ? {
        background: "rgba(5,10,48,0.55)",
        border: "1px solid var(--border-on-dark)",
        color: "#fff",
        backdropFilter: "blur(12px)",
      }
    : {
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-card)",
      };

  return (
    <div
      style={{
        borderRadius: "var(--radius-xl)",
        padding,
        boxSizing: "border-box",
        ...toneStyle,
        ...(accentColor ? { borderTop: `var(--border-accent-top) solid ${accentColor}` } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
