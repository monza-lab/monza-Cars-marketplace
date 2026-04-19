"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { IndexBucket, IndexSeriesDef } from "@/lib/index/factory";

function formatUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function IndexChart<ID extends string>({
  buckets,
  series,
}: {
  buckets: IndexBucket<ID>[];
  series: readonly IndexSeriesDef<ID>[];
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    series.reduce((acc, s) => ({ ...acc, [s.id]: true }), {} as Record<string, boolean>)
  );

  const labelFor = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of series) map[s.id] = s.label;
    return map;
  }, [series]);

  const colorFor = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of series) map[s.id] = s.color;
    return map;
  }, [series]);

  const rows = useMemo(() => {
    const byQuarter = new Map<string, Record<string, number | string>>();
    for (const b of buckets) {
      const existing = byQuarter.get(b.quarter) ?? { quarter: b.quarter };
      existing[b.series] = b.median;
      byQuarter.set(b.quarter, existing);
    }
    return Array.from(byQuarter.values()).sort((a, b) =>
      String(a.quarter).localeCompare(String(b.quarter))
    );
  }, [buckets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {series.map((s) => (
          <button
            key={s.id}
            onClick={() => setEnabled((e) => ({ ...e, [s.id]: !e[s.id] }))}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              enabled[s.id]
                ? "text-zinc-100 bg-zinc-900"
                : "border-zinc-700 text-zinc-500 bg-transparent"
            }`}
            style={enabled[s.id] ? { borderColor: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="h-[420px] w-full rounded-lg border border-zinc-800 bg-black/30 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="quarter"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={{ stroke: "#3f3f46" }}
              axisLine={{ stroke: "#3f3f46" }}
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={{ stroke: "#3f3f46" }}
              axisLine={{ stroke: "#3f3f46" }}
              tickFormatter={formatUsd}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "0.375rem",
                color: "#fafafa",
                fontSize: "12px",
              }}
              formatter={((value: number, name: string) => [
                formatUsd(value),
                labelFor[name] ?? name,
              ]) as unknown as undefined}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }}
              formatter={(value: string) => labelFor[value] ?? value}
            />
            {series.map((s) =>
              enabled[s.id] ? (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  stroke={colorFor[s.id]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
