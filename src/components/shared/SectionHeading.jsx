import { Eyebrow } from "./Eyebrow";

export function SectionHeading({
  eyebrow,
  title,
  sub,
  tone = "light",
  align = "center",
  style,
  ...rest
}) {
  const dark = tone === "dark";
  return (
    <div style={{ textAlign: align, ...style }} {...rest}>
      {eyebrow && (
        <Eyebrow tone={dark ? "accent" : "primary"} style={{ marginBottom: 12 }}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        style={{
          fontSize: "var(--fs-h2)",
          fontWeight: "var(--fw-bold)",
          color: dark ? "#fff" : "var(--sg-dark)",
          lineHeight: "var(--lh-heading)",
          fontFamily: "var(--font-display)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          style={{
            fontSize: "var(--fs-lead)",
            lineHeight: "var(--lh-body)",
            color: dark ? "rgba(255,255,255,0.72)" : "var(--sg-slate-5)",
            maxWidth: 620,
            margin: align === "center" ? "16px auto 0" : "16px 0 0",
            fontFamily: "var(--font-sans)",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
