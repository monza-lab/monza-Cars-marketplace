// ---------------------------------------------------------------------------
// Featured Auctions - Curated Real-World Data
// ---------------------------------------------------------------------------
// These are manually curated, verified listings from real auction platforms.
// DO NOT use generic placeholder images - each image must match the specific chassis.
// ---------------------------------------------------------------------------

export interface FeaturedAuction {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  currentBid: number
  bidCount: number
  status: "SOLD" | "ACTIVE" | "ENDING_SOON"
  endTime: string
  platform: "BRING_A_TRAILER" | "RM_SOTHEBYS" | "GOODING" | "BONHAMS"
  platformUrl: string
  engine: string
  transmission: string
  mileage: number
  mileageUnit: string
  exteriorColor: string
  interiorColor: string
  location: string
  images: string[]
  provenance: string
  highlight: string
  verified: boolean
}

export const featuredAuctions: FeaturedAuction[] = [
  // ---------------------------------------------------------------------------
  // SLOT 1: The "Hero" Car - 1988 Porsche 959 Komfort (BaT)
  // Source: https://bringatrailer.com/listing/1988-porsche-959-komfort-7/
  // ---------------------------------------------------------------------------
  {
    id: "featured-959-komfort",
    title: "1988 Porsche 959 Komfort",
    make: "Porsche",
    model: "959",
    year: 1988,
    trim: "Komfort",
    currentBid: 1254959,
    bidCount: 43,
    status: "SOLD",
    endTime: "2025-02-07T00:00:00Z",
    platform: "BRING_A_TRAILER",
    platformUrl: "https://bringatrailer.com/listing/1988-porsche-959-komfort-7/",
    engine: "2.85L Twin-Turbo Flat-6",
    transmission: "6-Speed Manual",
    mileage: 59000,
    mileageUnit: "miles",
    exteriorColor: "Grand Prix White",
    interiorColor: "Black Leather",
    location: "Portland, OR",
    images: [
      "https://bringatrailer.com/wp-content/uploads/2025/01/1988_porsche_959-komfort_IMG_2863-01999.jpeg",
    ],
    provenance: "One of 292 Komfort examples. Sequential twin turbos, all-wheel drive, adjustable suspension.",
    highlight: "Sold for $1,254,959 — The legend that defined supercar engineering",
    verified: true,
  },

  // ---------------------------------------------------------------------------
  // SLOT 2: The "Exotic" - 1989 Ferrari F40 (RM Sotheby's)
  // Source: https://rmsothebys.com/auctions/lf24/lots/r0053-1989-ferrari-f40/
  // ---------------------------------------------------------------------------
  {
    id: "featured-f40-rosso",
    title: "1989 Ferrari F40",
    make: "Ferrari",
    model: "F40",
    year: 1989,
    trim: null,
    currentBid: 2500000, // ~£1,973,750 converted
    bidCount: 0,
    status: "SOLD",
    endTime: "2024-11-02T00:00:00Z",
    platform: "RM_SOTHEBYS",
    platformUrl: "https://rmsothebys.com/auctions/lf24/lots/r0053-1989-ferrari-f40/",
    engine: "2.9L Twin-Turbo V8",
    transmission: "5-Speed Manual",
    mileage: 13000,
    mileageUnit: "miles",
    exteriorColor: "Rosso Corsa",
    interiorColor: "Stoffa Vigogna",
    location: "London, UK",
    images: [
      "https://cdn.rmsothebys.com/c/e/7/d/f/c/ce7dfc037b433b1a7d7041ce3256ac387da3fcdf.webp",
    ],
    provenance: "Ferrari Classiche Certified. Matching numbers. One of 1,311 produced.",
    highlight: "Sold for £1.97M — The ultimate analog supercar, Classiche certified",
    verified: true,
  },

  // ---------------------------------------------------------------------------
  // SLOT 3: The "Modern Classic" - 2005 Porsche Carrera GT (BaT)
  // Source: https://bringatrailer.com/listing/2005-porsche-carrera-gt-23/
  // ---------------------------------------------------------------------------
  {
    id: "featured-cgt-silver",
    title: "2005 Porsche Carrera GT",
    make: "Porsche",
    model: "Carrera GT",
    year: 2005,
    trim: null,
    currentBid: 1199999,
    bidCount: 67,
    status: "SOLD",
    endTime: "2024-02-25T00:00:00Z",
    platform: "BRING_A_TRAILER",
    platformUrl: "https://bringatrailer.com/listing/2005-porsche-carrera-gt-23/",
    engine: "5.7L V10",
    transmission: "6-Speed Manual",
    mileage: 7000,
    mileageUnit: "miles",
    exteriorColor: "GT Silver Metallic",
    interiorColor: "Ascot Brown Leather",
    location: "California, USA",
    images: [
      "https://bringatrailer.com/wp-content/uploads/2024/01/2005_porsche_carrera-gt_IMG-14503-05933-scaled.jpg",
    ],
    provenance: "7,000 miles. Recent service including oil change, brake/clutch fluid flush.",
    highlight: "Sold for $1.2M — The last true analog Porsche supercar",
    verified: true,
  },
]

// Helper to format platform display name
export function getPlatformDisplayName(platform: FeaturedAuction["platform"]): string {
  const names: Record<FeaturedAuction["platform"], string> = {
    BRING_A_TRAILER: "BaT",
    RM_SOTHEBYS: "RM Sotheby's",
    GOODING: "Gooding & Co",
    BONHAMS: "Bonhams",
  }
  return names[platform]
}
