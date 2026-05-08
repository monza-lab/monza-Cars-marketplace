import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "MonzaHaus — Investment-Grade Automotive Assets"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Heritage Lavender palette (v2.1)
const NOIR = "#0E0E0D"
const NOIR_DEEPER = "#161114"
const HERITAGE_LAVENDER = "#E1CCE5"
const LAVENDER_DEEP = "#D6BEDC"
const BONE = "#E8E2DE"

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
          background: `linear-gradient(145deg, ${NOIR} 0%, ${NOIR_DEEPER} 50%, ${NOIR} 100%)`,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Heritage Lavender radial glow */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "700px",
            height: "500px",
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(225, 204, 229, 0.16) 0%, transparent 65%)`,
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
            background: `linear-gradient(90deg, transparent 10%, ${HERITAGE_LAVENDER} 50%, transparent 90%)`,
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
              background: "rgba(225,204,229,0.10)",
              border: "1px solid rgba(225,204,229,0.20)",
            }}
          >
            <div
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: HERITAGE_LAVENDER,
              }}
            />
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: HERITAGE_LAVENDER,
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              AI-Powered
            </span>
          </div>
        </div>

        {/* Wordmark — M + helmet + NZAHAUS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "24px",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "92px",
              fontWeight: 700,
              color: BONE,
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            M
          </span>
          {/* Helmet — substitutes the "O" in MONZAHAUS */}
          <svg
            width={72}
            height={73}
            viewBox="0 0 120 121"
            style={{ marginBottom: "8px" }}
          >
            <path
              d="M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z"
              fill={HERITAGE_LAVENDER}
            />
            <path
              d="M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z"
              fill={NOIR}
            />
            <path
              d="M26 90Q60 86 94 90"
              stroke={NOIR}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span
            style={{
              fontSize: "92px",
              fontWeight: 700,
              color: BONE,
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            NZAHAUS
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "48px",
            height: "1px",
            background: `${LAVENDER_DEEP}66`, // ~40% alpha
            marginBottom: "20px",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: "rgba(232,226,222,0.55)",
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
            background: `linear-gradient(90deg, transparent 10%, ${HERITAGE_LAVENDER} 50%, transparent 90%)`,
            opacity: 0.4,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
