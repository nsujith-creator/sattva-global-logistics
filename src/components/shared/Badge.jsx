const TONES = {
  primary: { background: "rgba(2,74,171,0.10)", color: "var(--sg-primary)" },
  prepaid: { background: "#e0f2fe",              color: "#0369a1" },
  collect: { background: "#ffedd5",              color: "#c2410c" },
  green:   { background: "var(--sg-green-bg)",   color: "var(--sg-green)" },
  amber:   { background: "var(--sg-amber-bg)",   color: "var(--sg-amber)" },
  red:     { background: "var(--sg-red-bg)",     color: "var(--sg-red)" },
  neutral: { background: "#f1f5f9",              color: "var(--sg-slate-5)" },
};

export function Badge({ children, tone = "primary", style, ...rest }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: "var(--radius-sm)",
        fontSize: 11,
        fontWeight: "var(--fw-semibold)",
        fontFamily: "var(--font-sans)",
        lineHeight: 1.6,
        ...t,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
