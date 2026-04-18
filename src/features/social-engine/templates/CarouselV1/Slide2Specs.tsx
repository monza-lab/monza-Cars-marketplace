// Note: brand-tokens.css is loaded via src/app/internal/carousel/layout.tsx
// for the Next.js render path, and inlined by scripts/generate-daily-batch.ts
// for the v0.5 CLI path.
import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

function SpecLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        fontSize: 16, fontWeight: 500, letterSpacing: "0.3em",
        textTransform: "uppercase", color: "rgba(232,226,222,0.6)",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 36,
        letterSpacing: "-0.01em", color: "#E8E2DE", lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

export function Slide2Specs({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 1);
  const l = data.listing;
  const price = l.final_price ?? l.current_bid;

  return (
    <SlideFrame theme="dark">
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${photo})`,
        backgroundSize: "cover", backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(14,10,12,0.55) 0%, rgba(14,10,12,0.1) 25%, rgba(14,10,12,0.2) 50%, rgba(14,10,12,0.88) 78%, rgba(14,10,12,0.98) 100%)",
      }} />

      <div style={{
        position: "absolute", top: 64, left: 64, zIndex: 2,
        fontSize: 22, fontWeight: 500, letterSpacing: "0.3em",
        textTransform: "uppercase", color: "#D4738A",
      }}>
        The Car
      </div>

      <div style={{
        position: "absolute", top: 64, right: 64, zIndex: 2,
        fontFamily: "Cormorant, serif", fontWeight: 500, fontSize: 28,
        letterSpacing: "-0.02em", color: "rgba(232,226,222,0.7)",
      }}>
        MonzaHaus
      </div>

      <div style={{
        position: "absolute", bottom: 96, left: 64, right: 64, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 28,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 36, rowGap: 28 }}>
          <SpecLine label="Engine" value={l.engine} />
          <SpecLine label="Gearbox" value={l.transmission} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 36, rowGap: 28 }}>
          <SpecLine label="Mileage" value={l.mileage != null ? `${l.mileage.toLocaleString()} mi` : null} />
          <SpecLine label="Exterior" value={l.color_exterior} />
          {price != null && <SpecLine label="Price" value={`$${price.toLocaleString()}`} />}
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 48, left: 64, right: 64, zIndex: 2,
        fontSize: 16, letterSpacing: "0.3em", textTransform: "uppercase",
        color: "rgba(232,226,222,0.45)",
      }}>
        Live on {l.platform?.replace(/_/g, " ").toLowerCase()}
        {l.location ? ` · ${l.location.split(",")[0]}` : ""}
      </div>
    </SlideFrame>
  );
}
