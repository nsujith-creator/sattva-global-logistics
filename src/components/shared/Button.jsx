const SIZES = {
  sm: { padding: "9px 18px",  fontSize: 12 },
  md: { padding: "13px 24px", fontSize: 14 },
  lg: { padding: "15px 28px", fontSize: 15 },
};

const VARIANTS = {
  primary:   { background: "var(--sg-primary)",   color: "#fff",              boxShadow: "var(--shadow-btn)" },
  secondary: { background: "transparent",         color: "var(--sg-primary)", border: "2px solid var(--sg-primary)" },
  ghost:     { background: "rgba(2,74,171,0.07)", color: "var(--sg-primary)", border: "2px solid rgba(2,74,171,0.15)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)" },
  light:     { background: "#fff",                color: "var(--sg-dark)" },
  whatsapp:  { background: "var(--sg-green)",     color: "#fff" },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  disabled = false,
  style,
  ...rest
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: "var(--radius-md)",
    fontWeight: "var(--fw-semibold)",
    fontFamily: "var(--font-sans)",
    cursor: disabled ? "not-allowed" : "pointer",
    border: "2px solid transparent",
    textDecoration: "none",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    transition: "all var(--dur-fast) var(--ease-standard)",
    opacity: disabled ? 0.55 : 1,
    ...SIZES[size],
    ...VARIANTS[variant] || VARIANTS.primary,
    ...style,
  };

  const Tag = href ? "a" : "button";
  return (
    <Tag href={href} style={base} disabled={!href ? disabled : undefined} {...rest}>
      {children}
    </Tag>
  );
}
