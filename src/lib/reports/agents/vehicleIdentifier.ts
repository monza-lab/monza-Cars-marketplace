import { extractSeries, getSeriesConfig, matchVariant, deriveBodyType } from "@/lib/brandConfig"
import { getListingType } from "@/lib/listingMode"
import type { PipelineContext } from "../pipeline"
import type { VehicleIdentity } from "../types-v3"

export async function executeVehicleIdentifier(
  ctx: PipelineContext
): Promise<{ data: VehicleIdentity; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car, listingScrape } = ctx

  const year = listingScrape?.year ?? car.year ?? 0
  const make = listingScrape?.make ?? car.make ?? "Porsche"
  const model = listingScrape?.model ?? car.model ?? ""
  const trim = listingScrape?.trim ?? car.trim ?? null
  const title = car.title ?? `${year} ${make} ${model}`

  const series = extractSeries(model, year, make, title) ?? "unknown"
  const seriesConfig = getSeriesConfig(series, make)
  const variant = matchVariant(model, trim ?? "", series, make, title) ?? null
  const bodyStyle = listingScrape?.bodyStyle ?? deriveBodyType(model, trim ?? "", "", make, year) ?? null
  const generationYears = seriesConfig ? `${seriesConfig.yearRange[0]}-${seriesConfig.yearRange[1]}` : "unknown"
  const family = seriesConfig?.family?.replace(" Family", "") ?? "unknown"

  const specialEditionVariants = ["GT3 RS", "GT2 RS", "Sport Classic", "Speedster", "R", "GT"]
  const isSpecialEdition = variant
    ? specialEditionVariants.some((se) => variant.toUpperCase().includes(se.toUpperCase()))
    : false

  const factoryOptions = listingScrape?.equipmentList ?? []
  const listingType = getListingType(car.platform)

  const identity: VehicleIdentity = {
    year, make, model, series, family, variant, trim,
    generationYears,
    engine: listingScrape?.engine ?? null,
    transmission: listingScrape?.transmission ?? car.transmission ?? null,
    drivetrain: listingScrape?.drivetrain ?? null,
    bodyStyle,
    horsepower: listingScrape?.horsepower ?? null,
    factoryOptions, isSpecialEdition, listingType,
  }

  return { data: identity, durationMs: Date.now() - t0, agentModel: null }
}
