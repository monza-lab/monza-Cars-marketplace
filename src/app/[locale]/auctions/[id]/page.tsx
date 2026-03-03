import type { Metadata } from "next"
import AuctionDetailClient from "./AuctionDetailClient"

interface AuctionPageProps {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// Dynamic metadata generation
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: AuctionPageProps): Promise<Metadata> {
  const { id } = await params

  try {
    // Attempt to fetch basic auction info for metadata.
    // In production this would query the database directly to avoid an HTTP
    // round-trip. We keep it as a fetch so it works in both dev and
    // production builds.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/auctions/${id}`, {
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      return {
        title: "Auction Not Found | Monza Lab",
        description: "The auction you are looking for could not be found.",
      }
    }

    const auction = await res.json()

    const title = `${auction.title} | Monza Lab`
    const description = `${auction.year} ${auction.make} ${auction.model} – ${
      auction.currentBid
        ? `Current bid $${Number(auction.currentBid).toLocaleString()}`
        : "No bids yet"
    }. ${auction.mileage ? `${Number(auction.mileage).toLocaleString()} miles.` : ""} Track, analyze, and get AI insights.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: auction.imageUrl ? [{ url: auction.imageUrl }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: auction.imageUrl ? [auction.imageUrl] : [],
      },
    }
  } catch {
    return {
      title: "Auction | Monza Lab",
      description: "View auction details and get AI-powered analysis.",
    }
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function AuctionDetailPage({ params }: AuctionPageProps) {
  // We await params to satisfy Next.js 15+ dynamic route conventions.
  // The actual data fetching happens client-side inside AuctionDetailClient
  // so we get full interactivity (image gallery, timers, analysis triggers).
  const { id } = await params

  return <AuctionDetailClient />
}
