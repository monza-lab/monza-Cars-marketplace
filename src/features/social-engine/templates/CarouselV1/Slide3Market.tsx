// Note: brand-tokens.css is loaded via src/app/internal/carousel/layout.tsx
// for the Next.js render path, and inlined by scripts/generate-daily-batch.ts
// for the v0.5 CLI path.
import { SlideFrame } from "./SlideFrame";
import type { SlideData } from "./templateData";

function DataLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.12)",
    }}>
      <div style={{
        fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.6)",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: accent ? "Cormorant, serif" : "Geist Mono, monospace",
        fontWeight: accent ? 500 : 400,
        fontSize: accent ? 36 : 22,
        color: "#fff",
        letterSpacing: accent ? "-0.01em" : "0.03em",
      }}>
        {value}
      </div>
    </div>
  );
}

export function Slide3Market({ data }: { data: SlideData }) {
  const { comps, listing } = data;

  if (!comps) {
    const trim = listing.trim ?? "";
    return (
      <SlideFrame theme="rose">
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(60% 40% at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)",
        }} />
        <div style={{
          position: "relative", height: "100%", padding: "96px 72px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.3em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
          }}>
            Market Position
          </div>
          <div>
            <div style={{
              fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 72,
              lineHeight: 1.1, color: "#fff", marginBottom: 36,
            }}>
              Rare enough that comparables don&apos;t triangulate.
            </div>
            <div style={{
              fontSize: 22, lineHeight: 1.5, color: "rgba(255,255,255,0.78)",
              maxWidth: "85%",
            }}>
              When supply is this thin, scarcity itself is the thesis. Price discovery happens one transaction at a time — and this {trim || "example"} is the transaction.
            </div>
          </div>
          <div style={{
            fontSize: 18, letterSpacing: "0.3em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
          }}>
            MonzaHaus · market intelligence
          </div>
        </div>
      </SlideFrame>
    );
  }

  const positionPct = comps.thisPrice != null && comps.high > comps.low
    ? Math.min(100, Math.max(0, ((comps.thisPrice - comps.low) / (comps.high - comps.low)) * 100))
    : 50;
  const isPositive = (comps.deltaPct ?? 0) >= 0;
  const deltaText = comps.deltaPct != null
    ? `${isPositive ? "▲" : "▼"} ${Math.abs(comps.deltaPct).toFixed(1)}% vs avg`
    : null;

  return (
    <SlideFrame theme="rose">
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(65% 45% at 78% 18%, rgba(255,255,255,0.14) 0%, transparent 60%)",
      }} />

      <div style={{
        position: "relative", height: "100%", padding: "80px 72px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 22, fontWeight: 500, letterSpacing: "0.3em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
        }}>
          Market Position
        </div>

        <div>
          <div style={{
            fontSize: 20, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)", marginBottom: 12,
          }}>
            Average clearing price · last {comps.windowMonths} months
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 500, fontSize: 140,
            color: "#fff", letterSpacing: "-0.03em", lineHeight: 0.95,
          }}>
            ${Math.round(comps.avg / 1000)}k
          </div>
          {deltaText && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              marginTop: 28, padding: "10px 22px",
              background: isPositive ? "rgba(52,211,153,0.15)" : "rgba(251,146,60,0.15)",
              border: `1px solid ${isPositive ? "rgba(52,211,153,0.45)" : "rgba(251,146,60,0.45)"}`,
              borderRadius: 40,
              fontFamily: "Geist Mono, monospace", fontSize: 20,
              color: isPositive ? "#34D399" : "#FB923C",
              letterSpacing: "0.02em",
            }}>
              {deltaText}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <DataLine label="Sample size" value={`${comps.sampleSize} comparables`} />
          <DataLine label="Price range" value={`$${Math.round(comps.low / 1000)}k – $${Math.round(comps.high / 1000)}k`} />
          {comps.thisPrice != null && (
            <DataLine
              label="This listing"
              value={`$${Math.round(comps.thisPrice / 1000)}k`}
              accent
            />
          )}
          <div style={{ position: "relative", marginTop: 8 }}>
            <div style={{
              height: 3, background: "rgba(255,255,255,0.18)", position: "relative",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0,
                height: "100%", width: `${positionPct}%`,
                background: "rgba(255,255,255,0.45)",
              }} />
              <div style={{
                position: "absolute", top: -8, left: `${positionPct}%`,
                width: 3, height: 19, background: "#34D399",
                transform: "translateX(-50%)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 10,
              fontFamily: "Geist Mono, monospace", fontSize: 14,
              color: "rgba(255,255,255,0.55)", letterSpacing: "0.05em",
            }}>
              <span>LOW</span><span>HIGH</span>
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 18, letterSpacing: "0.3em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}>
          MonzaHaus · market intelligence
        </div>
      </div>
    </SlideFrame>
  );
}
