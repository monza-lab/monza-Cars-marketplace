"use client";

import { useState, useMemo } from "react";
import { decodePorscheVin, type PorscheVinDecode } from "@/lib/vin/porscheVin";

const SAMPLES: { label: string; vin: string }[] = [
  { label: "1992 964 Carrera", vin: "WP0ZZZ96ZNS400001" },
  { label: "1996 993 Carrera", vin: "WP0ZZZ99ZTS320001" },
  { label: "2010 997.2 GT3 RS", vin: "WP0ZZZ99ZAS783001" },
];

export function VinDecoderClient() {
  const [vin, setVin] = useState("");
  const [decoded, setDecoded] = useState<PorscheVinDecode | null>(null);

  const stats = useMemo(() => {
    if (!decoded || !decoded.valid) return null;
    return [
      { label: "Manufacturer (WMI)", value: `${decoded.wmi} — ${decoded.wmiDescription ?? "—"}` },
      {
        label: "Model year",
        value: decoded.modelYear
          ? decoded.modelYearAmbiguous
            ? `${decoded.modelYear} (or ${decoded.modelYearAlternatives?.join(", ")} — cross-check with body code)`
            : String(decoded.modelYear)
          : "—",
      },
      { label: "Generation hint", value: decoded.bodyHint ?? "No match in MonzaHaus pattern library" },
      { label: "Plant", value: decoded.plantDescription ? `${decoded.plant} — ${decoded.plantDescription}` : decoded.plant ?? "—" },
      { label: "Serial number", value: decoded.serial ?? "—" },
      { label: "Check digit (position 9)", value: decoded.checkDigit ?? "—" },
    ];
  }, [decoded]);

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col sm:flex-row gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setDecoded(decodePorscheVin(vin));
        }}
      >
        <input
          type="text"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          placeholder="Enter 17-character Porsche VIN (e.g. WP0ZZZ96ZNS400001)"
          maxLength={17}
          className="flex-1 px-4 py-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 text-sm font-mono tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition"
        />
        <button
          type="submit"
          className="px-6 py-3 rounded-lg bg-amber-500 text-black font-medium text-sm hover:bg-amber-400 transition"
        >
          Decode VIN
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-zinc-500">Try a sample:</span>
        {SAMPLES.map((s) => (
          <button
            key={s.vin}
            onClick={() => {
              setVin(s.vin);
              setDecoded(decodePorscheVin(s.vin));
            }}
            className="px-2 py-1 rounded border border-zinc-800 text-amber-400 hover:border-amber-500 transition"
          >
            {s.label}
          </button>
        ))}
      </div>

      {decoded && !decoded.valid && (
        <div className="border border-red-900/50 bg-red-950/30 rounded-lg p-4">
          <h3 className="text-red-300 font-medium mb-2">Cannot decode this VIN</h3>
          <ul className="text-sm text-red-200/80 space-y-1">
            {decoded.errors.map((err, i) => (
              <li key={i}>· {err}</li>
            ))}
          </ul>
        </div>
      )}

      {decoded && decoded.valid && stats && (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="text-xs uppercase tracking-[0.2em] text-amber-500 mb-4">
              Decoded VIN
            </h3>
            <div className="font-mono text-lg tracking-wider text-zinc-100 mb-5">
              {decoded.vin.split("").map((c, i) => (
                <span
                  key={i}
                  className={`inline-block px-1 ${
                    [0, 1, 2].includes(i)
                      ? "text-amber-400"
                      : i === 9
                        ? "text-emerald-400"
                        : i === 10
                          ? "text-blue-400"
                          : i >= 11
                            ? "text-zinc-400"
                            : "text-zinc-300"
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
            <dl className="grid grid-cols-1 gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between gap-4 flex-wrap border-b border-zinc-900 pb-2 last:border-b-0"
                >
                  <dt className="text-xs text-zinc-500 shrink-0 uppercase tracking-wider">
                    {s.label}
                  </dt>
                  <dd className="text-sm text-zinc-200 text-right max-w-xl">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-xs text-zinc-500">
            This decoder extracts structural VIN data (manufacturer, year, plant,
            serial). It does NOT confirm authenticity, matching-numbers status, or
            trim/option-level details — for those you need the Porsche Certificate
            of Authenticity (COA) and a pre-purchase inspection.
          </p>
        </div>
      )}
    </div>
  );
}
