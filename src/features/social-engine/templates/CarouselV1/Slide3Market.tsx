import { SlideFrame } from "./SlideFrame";
import type { SlideData } from "./templateData";

export function Slide3Market({ data }: { data: SlideData }) {
  const { comps } = data;

  if (!comps) {
    return (
      <SlideFrame theme="rose">
        <div style={{ padding: "96px 72px", display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
          }}>
            Market Position
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 72,
            lineHeight: 1.15, color: "#fff",
          }}>
            A rare enough car that there are not enough recent comparables to triangulate.
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>
            Scarcity itself is the thesis.
          </div>
        </div>
      </SlideFrame>
    );
  }

  const positionPct = comps.thisPrice != null
    ? Math.min(100, Math.max(0, ((comps.thisPrice - comps.low) / (comps.high - comps.low)) * 100))
    : 50;
  const isPositive = (comps.deltaPct ?? 0) >= 0;

  return (
    <SlideFrame theme="rose">
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(60% 40% at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)",
      }} />

      <div style={{
        position: "relative", height: "100%",
        padding: "96px 72px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
        }}>
          Market Position
        </div>

        <div>
          <div style={{
            fontSize: 22, letterSpacing: "0.15em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)", marginBottom: 12,
          }}>
            Last {comps.windowMonths} months · {comps.sampleSize} comparables
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 500, fontSize: 130,
            color: "#fff", letterSpacing: "-0.02em", lineHeight: 1,
          }}>
            ${Math.round(comps.avg / 1000)}k
          </div>
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.75)", marginTop: 28, lineHeight: 1.5 }}>
            Average clearing price for comparable examples in recent sales.
          </div>

          <div style={{ marginTop: 48 }}>
            <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.2)" }}>
              <div style={{
                position: "absolute", top: -10, left: `${positionPct}%`,
                width: 4, height: 24, background: "#34D399",
                transform: "translateX(-50%)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 16,
              fontFamily: "Geist Mono, monospace", fontSize: 20, color: "rgba(255,255,255,0.7)",
            }}>
              <span>${Math.round(comps.low / 1000)}k</span>
              <span>${Math.round(comps.high / 1000)}k</span>
            </div>
          </div>

          {comps.deltaPct != null && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              marginTop: 40, padding: "12px 24px",
              background: isPositive ? "rgba(52,211,153,0.15)" : "rgba(251,146,60,0.15)",
              border: `1px solid ${isPositive ? "rgba(52,211,153,0.4)" : "rgba(251,146,60,0.4)"}`,
              borderRadius: 40,
              fontFamily: "Geist Mono, monospace", fontSize: 22,
              color: isPositive ? "#34D399" : "#FB923C",
            }}>
              {isPositive ? "▲" : "▼"} {Math.abs(comps.deltaPct)}% vs avg
            </div>
          )}
        </div>

        <div style={{
          fontSize: 20, letterSpacing: "0.2em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}>
          MonzaHaus · market intelligence
        </div>
      </div>
    </SlideFrame>
  );
}
