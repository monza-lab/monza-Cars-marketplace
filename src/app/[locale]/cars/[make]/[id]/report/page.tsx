import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import { ReportClient } from "./ReportClient"

interface ReportPageProps {
  params: Promise<{ make: string; id: string }>
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params
  const car = CURATED_CARS.find(c => c.id === id)

  if (!car) {
    return { title: "Not Found | Monza Lab" }
  }

  return {
    title: `Investment Dossier: ${car.title} | Monza Lab`,
    description: `Comprehensive investment analysis for ${car.title}. Valuation, risk assessment, ownership economics, and market context.`,
  }
}

export async function generateStaticParams() {
  return CURATED_CARS.map(car => ({
    make: car.make.toLowerCase().replace(/\s+/g, "-"),
    id: car.id,
  }))
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params
  const car = CURATED_CARS.find(c => c.id === id)

  if (!car) {
    notFound()
  }

  const similarCars = CURATED_CARS.filter(
    c => c.id !== car.id && (c.category === car.category || c.make === car.make)
  ).slice(0, 6)

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0b10] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-zinc-800" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-[#F8B4D9] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-zinc-500">Loading report...</p>
          </div>
        </div>
      }
    >
      <ReportClient car={car} similarCars={similarCars} />
    </Suspense>
  )
}
