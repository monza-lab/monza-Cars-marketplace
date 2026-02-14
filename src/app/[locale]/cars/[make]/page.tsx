import { notFound } from "next/navigation"
import { CURATED_CARS } from "@/lib/curatedCars"
import { fetchLiveListingsAsCollectorCars } from "@/lib/supabaseLiveListings"
import { MakePageClient } from "./MakePageClient"

interface MakePageProps {
  params: Promise<{ make: string }>
}

export async function generateMetadata({ params }: MakePageProps) {
  const { make } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")

  // Curated (non-Ferrari) + live Supabase listings
  const curated = CURATED_CARS.filter(
    car => car.make !== "Ferrari" && car.make.toLowerCase() === decodedMake.toLowerCase()
  )
  const live = await fetchLiveListingsAsCollectorCars()
  const liveMake = live.filter(car => car.make.toLowerCase() === decodedMake.toLowerCase())
  const cars = [...curated, ...liveMake]

  if (cars.length === 0) {
    return { title: "Not Found | Monza Lab" }
  }

  const makeName = cars[0].make
  const totalValue = cars.reduce((sum, c) => sum + c.currentBid, 0)
  const avgAppreciation = cars.reduce((sum, c) => sum + c.trendValue, 0) / cars.length

  return {
    title: `${makeName} Collection | Monza Lab`,
    description: `Explore ${cars.length} investment-grade ${makeName} vehicles. Total market value $${(totalValue / 1_000_000).toFixed(1)}M with +${avgAppreciation.toFixed(0)}% average annual appreciation.`,
  }
}

export async function generateStaticParams() {
  const makes = Array.from(new Set(CURATED_CARS.filter(c => c.make !== "Ferrari").map(car => car.make)))
  return makes.map(make => ({
    make: make.toLowerCase().replace(/\s+/g, "-"),
  }))
}

export default async function MakePage({ params }: MakePageProps) {
  const { make } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")

  // Curated (non-Ferrari) + live Supabase listings for this make
  const curated = CURATED_CARS.filter(
    car => car.make !== "Ferrari" && car.make.toLowerCase() === decodedMake.toLowerCase()
  )
  const live = await fetchLiveListingsAsCollectorCars()
  const liveMake = live.filter(car => car.make.toLowerCase() === decodedMake.toLowerCase())
  const cars = [...curated, ...liveMake]

  if (cars.length === 0) {
    notFound()
  }

  return <MakePageClient make={cars[0].make} cars={cars} />
}
