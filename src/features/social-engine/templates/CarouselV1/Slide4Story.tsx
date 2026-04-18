import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide4Story({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 2);
  const l = data.listing;

  const facts = [
    l.mileage != null ? `${l.mileage.toLocaleString()} documented miles` : null,
    l.color_exterior ? `Original paint · ${l.color_exterior}` : null,
    l.engine && l.transmission ? `${l.engine} · ${l.transmission}` : null,
    l.platform === "BRING_A_TRAILER" ? "Listed via Bring a Trailer" : null,
  ].filter(Boolean) as string[];

  return (
    <SlideFrame theme="light">
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "45%",
        backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", top: "45%", left: 0, right: 0, bottom: 0,
        padding: "64px 72px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "#7A2E4A",
          }}>
            Why this one matters
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 56,
            lineHeight: 1.15, letterSpacing: "-0.01em",
            color: "#2A2320", marginTop: 28,
          }}>
            {l.trim || "A collector example"}.
          </div>
          <div style={{
            fontSize: 24, lineHeight: 1.55, color: "#4a4038", marginTop: 32,
          }}>
            {data.thesis}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {facts.map((f, i) => (
            <div key={i} style={{
              fontSize: 22, color: "#2A2320", paddingLeft: 28, position: "relative",
            }}>
              <span style={{ position: "absolute", left: 0, color: "#7A2E4A", fontWeight: 500 }}>—</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
