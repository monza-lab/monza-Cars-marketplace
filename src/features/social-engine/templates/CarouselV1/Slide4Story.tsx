// Note: brand-tokens.css is loaded via src/app/internal/carousel/layout.tsx
// for the Next.js render path, and inlined by scripts/generate-daily-batch.ts
// for the v0.5 CLI path.
import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide4Story({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 2);
  const l = data.listing;

  const facts = [
    l.mileage != null ? `${l.mileage.toLocaleString()} documented miles` : null,
    l.color_exterior ? `${l.color_exterior}` : null,
    l.engine && l.transmission ? `${l.engine} · ${l.transmission}` : (l.engine || l.transmission),
    l.platform === "BRING_A_TRAILER" ? "Listed via Bring a Trailer"
      : l.platform === "ELFERSPOT" ? "Listed via Elferspot"
      : l.platform === "AUTO_SCOUT_24" ? "Listed via AutoScout24"
      : null,
  ].filter(Boolean) as string[];

  return (
    <SlideFrame theme="dark">
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${photo})`,
        backgroundSize: "cover", backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(14,10,12,0.5) 0%, rgba(14,10,12,0) 22%, rgba(14,10,12,0.15) 45%, rgba(14,10,12,0.92) 72%, rgba(14,10,12,0.98) 100%)",
      }} />

      <div style={{
        position: "absolute", top: 64, left: 64, right: 64, zIndex: 2,
        fontSize: 22, fontWeight: 500, letterSpacing: "0.3em",
        textTransform: "uppercase", color: "#E1CCE5",
      }}>
        Why this one matters
      </div>

      <div style={{
        position: "absolute", bottom: 64, left: 64, right: 64, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 32,
      }}>
        <div style={{
          fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 72,
          lineHeight: 1.05, letterSpacing: "-0.02em", color: "#E8E2DE",
        }}>
          {l.trim && l.trim.length > 2 ? l.trim : "A collector example"}.
        </div>
        <div style={{
          fontSize: 24, lineHeight: 1.5, color: "rgba(232,226,222,0.82)",
          maxWidth: "90%",
        }}>
          {data.thesis}
        </div>
        {facts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {facts.map((f, i) => (
              <div key={i} style={{
                fontFamily: "Geist Mono, monospace", fontSize: 18,
                color: "rgba(212,115,138,0.9)", letterSpacing: "0.02em",
              }}>
                — {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
