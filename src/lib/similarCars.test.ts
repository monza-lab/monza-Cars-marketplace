import { describe, expect, it } from "vitest"
import { findStrictReportPeers } from "./similarCars"
import type { CollectorCar } from "./curatedCars"

function car(input: Partial<CollectorCar> & { id: string; make: string; model: string; currentBid?: number }): CollectorCar {
  return {
    id: input.id,
    make: input.make,
    model: input.model,
    title: input.title ?? `${input.make} ${input.model}`,
    year: input.year ?? 2022,
    currentBid: input.currentBid ?? 100000,
    price: input.currentBid ?? 100000,
    image: "",
    images: [],
    trim: null,
    trend: "stable",
    trendValue: 0,
    thesis: "",
    engine: "",
    mileage: input.mileage ?? 10000,
    mileageUnit: "mi",
    transmission: input.transmission ?? "manual",
    location: "",
    region: "US",
    fairValueByRegion: {
      US: { currency: "$", low: 0, high: 0 },
      EU: { currency: "€", low: 0, high: 0 },
      UK: { currency: "£", low: 0, high: 0 },
      JP: { currency: "¥", low: 0, high: 0 },
    },
    history: "",
    platform: "BRING_A_TRAILER",
    status: "ACTIVE",
    bidCount: 0,
    endTime: new Date("2026-01-01T00:00:00.000Z"),
    category: "",
  } as CollectorCar
}

describe("findStrictReportPeers", () => {
  it("returns only same make and same model variant identity", () => {
    const target = car({ id: "target", make: "Porsche", model: "911 GT3", currentBid: 200000 })
    const peers = findStrictReportPeers(target, [
      car({ id: "gt3", make: "Porsche", model: "911 GT3", currentBid: 210000 }),
      car({ id: "base", make: "Porsche", model: "911", currentBid: 200000 }),
      car({ id: "rs", make: "Porsche", model: "911 GT3 RS", currentBid: 220000 }),
      car({ id: "turbo", make: "Porsche", model: "911 Turbo", currentBid: 205000 }),
    ])

    expect(peers.map((p) => p.car.id)).toEqual(["gt3"])
    expect(peers[0].matchReasons).toEqual(["Same model variant"])
  })

  it("returns empty when target identity is missing", () => {
    const target = car({ id: "target", make: "Porsche", model: "" })
    const peers = findStrictReportPeers(target, [
      car({ id: "candidate", make: "Porsche", model: "911 GT3" }),
    ])

    expect(peers).toEqual([])
  })
})
