import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

function formatUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export interface DataOgImageOptions {
  kicker: string;
  title: string;
  tagline: string;
  median?: number | null;
  yoyPct?: number | null;
  sampleSize?: number | null;
  accent?: string;
}

export function dataOgImage({
  kicker,
  title,
  tagline,
  median,
  yoyPct,
  sampleSize,
  accent = "#E1CCE5",
}: DataOgImageOptions): ImageResponse {
  // v2.1 brand: Emerald Mint for growth, Burnt Orange for risk — never red.
  const yoyColor =
    yoyPct == null ? "rgba(232,226,222,0.5)" : yoyPct >= 0 ? "#34D399" : "#FB923C";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(145deg, #0E0E0D 0%, #161114 50%, #0E0E0D 100%)",
          fontFamily: "system-ui, serif",
          position: "relative",
          padding: "64px 72px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "75%",
            transform: "translate(-50%, -50%)",
            width: "800px",
            height: "600px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accent}18 0%, transparent 60%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(90deg, transparent 10%, ${accent} 50%, transparent 90%)`,
            opacity: 0.7,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#E8E2DE",
              letterSpacing: "1px",
            }}
          >
            Monza<span style={{ color: accent }}>Haus</span>
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(232,226,222,0.45)",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            · {kicker}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: "20px", maxWidth: "900px" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 300,
              color: "#E8E2DE",
              letterSpacing: "-2px",
              lineHeight: 1.05,
              display: "flex",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 400,
              color: "rgba(232,226,222,0.65)",
              lineHeight: 1.4,
              display: "flex",
              maxWidth: "780px",
            }}
          >
            {tagline}
          </div>
        </div>

        {median != null && (
          <div
            style={{
              display: "flex",
              gap: "40px",
              marginTop: "48px",
              borderTop: "1px solid rgba(232,226,222,0.12)",
              paddingTop: "24px",
              alignItems: "baseline",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "rgba(232,226,222,0.45)",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                }}
              >
                Current Median
              </span>
              <span style={{ fontSize: "42px", fontWeight: 400, color: "#E8E2DE", letterSpacing: "-1px" }}>
                {formatUsd(median)}
              </span>
            </div>
            {yoyPct != null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "rgba(232,226,222,0.45)",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                  }}
                >
                  YoY Change
                </span>
                <span style={{ fontSize: "32px", fontWeight: 400, color: yoyColor, letterSpacing: "-0.5px" }}>
                  {formatPct(yoyPct)}
                </span>
              </div>
            )}
            {sampleSize != null && sampleSize > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "rgba(232,226,222,0.45)",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                  }}
                >
                  Sample
                </span>
                <span style={{ fontSize: "32px", fontWeight: 400, color: "rgba(232,226,222,0.75)" }}>
                  n = {sampleSize.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(90deg, transparent 10%, ${accent} 50%, transparent 90%)`,
            opacity: 0.4,
          }}
        />
      </div>
    ),
    { ...OG_SIZE }
  );
}
