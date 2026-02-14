import { notFound } from "next/navigation"
import { CURATED_CARS } from "@/lib/curatedCars"
import { fetchLiveListingsAsCollectorCars } from "@/lib/supabaseLiveListings"
import { ModelPageClient } from "./ModelPageClient"

interface ModelPageProps {
  params: Promise<{ make: string; model: string }>
}

export async function generateMetadata({ params }: ModelPageProps) {
  const { make, model } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")
  const decodedModel = decodeURIComponent(model).replace(/-/g, " ")

  const curated = CURATED_CARS.filter(
    car =>
      car.make !== "Ferrari" &&
      car.make.toLowerCase() === decodedMake.toLowerCase() &&
      car.model.toLowerCase() === decodedModel.toLowerCase()
  )
  const live = await fetchLiveListingsAsCollectorCars()
  const liveModel = live.filter(
    car =>
      car.make.toLowerCase() === decodedMake.toLowerCase() &&
      car.model.toLowerCase() === decodedModel.toLowerCase()
  )
  const cars = [...curated, ...liveModel]

  if (cars.length === 0) {
    return { title: "Not Found | Monza Lab" }
  }

  const makeName = cars[0].make
  const modelName = cars[0].model
  const avgPrice = cars.reduce((sum, c) => sum + c.currentBid, 0) / cars.length
  const avgTrend = cars.reduce((sum, c) => sum + c.trendValue, 0) / cars.length

  return {
    title: `${makeName} ${modelName} Market Analysis | Monza Lab`,
    description: `Investment analysis for ${makeName} ${modelName}. Average market value $${(avgPrice / 1000).toFixed(0)}K with +${avgTrend.toFixed(0)}% annual appreciation. ${cars.length} vehicles tracked.`,
  }
}

export async function generateStaticParams() {
  const combinations = new Map<string, { make: string; model: string }>()

  CURATED_CARS.filter(c => c.make !== "Ferrari").forEach(car => {
    const key = `${car.make}|${car.model}`
    if (!combinations.has(key)) {
      combinations.set(key, {
        make: car.make.toLowerCase().replace(/\s+/g, "-"),
        model: car.model.toLowerCase().replace(/\s+/g, "-"),
      })
    }
  })

  return Array.from(combinations.values())
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { make, model } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")
  const decodedModel = decodeURIComponent(model).replace(/-/g, " ")

  const curated = CURATED_CARS.filter(
    car =>
      car.make !== "Ferrari" &&
      car.make.toLowerCase() === decodedMake.toLowerCase() &&
      car.model.toLowerCase() === decodedModel.toLowerCase()
  )
  const live = await fetchLiveListingsAsCollectorCars()
  const liveModel = live.filter(
    car =>
      car.make.toLowerCase() === decodedMake.toLowerCase() &&
      car.model.toLowerCase() === decodedModel.toLowerCase()
  )
  const cars = [...curated, ...liveModel]

  if (cars.length === 0) {
    notFound()
  }

  return (
    <ModelPageClient
      make={cars[0].make}
      model={cars[0].model}
      cars={cars}
    />
  )
}
