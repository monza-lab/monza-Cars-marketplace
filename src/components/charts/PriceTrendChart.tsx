"use client"

import { useId } from "react"

interface PriceTrendChartProps {
  values: number[]
  years: number[]
  height?: number
  showLabels?: boolean
  accentColor?: string
}

function formatPrice(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return `${value}`
}

export function PriceTrendChart({
  values,
  years,
  height = 90,
  showLabels = true,
  accentColor = "#F8B4D9",
}: PriceTrendChartProps) {
  const uniqueId = useId()
  if (values.length === 0) return null

  const paddingTop = showLabels ? 18 : 6
  const paddingBottom = showLabels ? 18 : 6
  const paddingX = 8
  const chartHeight = height - paddingTop - paddingBottom
  const chartWidth = 100 // percentage-based, we use viewBox

  const svgWidth = 300
  const svgHeight = height

  const minVal = Math.min(...values) * 0.9
  const maxVal = Math.max(...values) * 1.05
  const range = maxVal - minVal || 1

  // Calculate points
  const points = values.map((v, i) => ({
    x: paddingX + (i / (values.length - 1)) * (svgWidth - paddingX * 2),
    y: paddingTop + chartHeight - ((v - minVal) / range) * chartHeight,
    value: v,
    year: years[i] ?? 2022 + i,
  }))

  // Build smooth line path (catmull-rom to bezier)
  const linePath = (() => {
    if (points.length < 2) return ""
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(i + 2, points.length - 1)]

      const tension = 0.3
      const cp1x = p1.x + (p2.x - p0.x) * tension
      const cp1y = p1.y + (p2.y - p0.y) * tension
      const cp2x = p2.x - (p3.x - p1.x) * tension
      const cp2y = p2.y - (p3.y - p1.y) * tension

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
  })()

  // Area path (line + close at bottom)
  const areaPath = linePath
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : ""

  const gradientId = `priceTrendGrad-${uniqueId}`
  const glowId = `priceTrendGlow-${uniqueId}`

  return (
    <div className="w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={paddingX}
            y1={paddingTop + chartHeight * (1 - pct)}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartHeight * (1 - pct)}
            stroke="white"
            strokeOpacity="0.04"
            strokeWidth="0.5"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line with glow */}
        <path
          d={linePath}
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Outer glow */}
            <circle cx={p.x} cy={p.y} r="4" fill={accentColor} opacity="0.15" />
            {/* Inner dot */}
            <circle cx={p.x} cy={p.y} r="2.5" fill="#0b0b10" stroke={accentColor} strokeWidth="1.5" />

            {/* Price label above */}
            {showLabels && (
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fill={accentColor}
                fontSize="8"
                fontFamily="ui-monospace, monospace"
                opacity="0.9"
              >
                {formatPrice(p.value)}
              </text>
            )}

            {/* Year label below */}
            {showLabels && (
              <text
                x={p.x}
                y={paddingTop + chartHeight + 13}
                textAnchor="middle"
                fill="#6B7280"
                fontSize="7.5"
                fontFamily="ui-monospace, monospace"
              >
                {p.year}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
