import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Monza Lab — Investment-Grade Automotive Assets"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0E0A0C 0%, #1a1a2e 50%, #0E0A0C 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Subtle accent glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,115,138,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, transparent, #D4738A, transparent)",
          }}
        />

        {/* Logo text */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "4px",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontSize: "72px",
              fontWeight: 800,
              color: "#E8E2DE",
              letterSpacing: "-2px",
            }}
          >
            MONZA
          </span>
          <span
            style={{
              fontSize: "72px",
              fontWeight: 300,
              color: "#D4738A",
              letterSpacing: "-2px",
            }}
          >
            LAB
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "24px",
            fontWeight: 400,
            color: "#6B6365",
            letterSpacing: "6px",
            textTransform: "uppercase",
          }}
        >
          Investment-Grade Automotive Assets
        </div>

        {/* Bottom decorative */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, #564E50)",
            }}
          />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#564E50",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Collector Vehicle Intelligence
          </span>
          <div
            style={{
              width: "40px",
              height: "1px",
              background: "linear-gradient(90deg, #564E50, transparent)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
