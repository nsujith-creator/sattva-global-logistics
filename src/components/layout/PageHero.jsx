import { HeroMap } from "../shared/HeroMap";

/**
 * PageHero — shared dark navy hero with animated map background.
 * Drop-in replacement for the white gradient hero section on every inner page.
 * Children render over the map with white text context.
 */
export function PageHero({ children }) {
  return (
    <section style={{
      position: "relative",
      overflow: "hidden",
      background: "#050A30",
      padding: "clamp(80px,10vw,110px) clamp(16px,4vw,24px) clamp(48px,5vw,64px)",
    }}>
      <HeroMap bg />
      {/* uniform overlay so text stays legible over the map */}
      <div style={{ position:"absolute", inset:0, zIndex:1, background:"rgba(5,10,48,0.52)", pointerEvents:"none" }} />
      {/* content */}
      <div style={{ position:"relative", zIndex:2, maxWidth:1200, margin:"0 auto", color:"#fff" }}>
        {children}
      </div>
      {/* bottom fade — dissolves navy into the white page body */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:100, zIndex:3,
        background:"linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.92) 100%)",
        pointerEvents:"none" }} />
    </section>
  );
}
