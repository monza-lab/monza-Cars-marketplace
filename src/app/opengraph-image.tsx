import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "MonzaHaus — Investment-Grade Automotive Assets"
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
          background: "linear-gradient(145deg, #0E0A0C 0%, #1a1018 40%, #0E0A0C 100%)",
          fontFamily: "system-ui, serif",
          position: "relative",
        }}
      >
        {/* Salon rose glow */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "700px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,115,138,0.10) 0%, transparent 65%)",
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
            background: "linear-gradient(90deg, transparent 10%, #D4738A 50%, transparent 90%)",
            opacity: 0.7,
          }}
        />

        {/* Top label */}
        <div
          style={{
            position: "absolute",
            top: "44px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(232,226,222,0.45)",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Collector Car Intelligence
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "100px",
              background: "rgba(212,115,138,0.10)",
              border: "1px solid rgba(212,115,138,0.20)",
            }}
          >
            <div
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "#D4738A",
              }}
            />
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#D4738A",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              AI-Powered
            </span>
          </div>
        </div>

        {/* Logo text */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              fontSize: "82px",
              fontWeight: 300,
              color: "#E8E2DE",
              letterSpacing: "-2px",
            }}
          >
            Monza
          </span>
          <span
            style={{
              fontSize: "82px",
              fontWeight: 300,
              color: "#D4738A",
              letterSpacing: "-2px",
            }}
          >
            Haus
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "48px",
            height: "1px",
            background: "rgba(212,115,138,0.4)",
            marginBottom: "20px",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: "rgba(232,226,222,0.50)",
            letterSpacing: "6px",
            textTransform: "uppercase",
          }}
        >
          Investment-Grade Automotive Assets
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, transparent 10%, #D4738A 50%, transparent 90%)",
            opacity: 0.4,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
