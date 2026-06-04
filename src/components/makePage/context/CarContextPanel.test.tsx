// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { CollectorCar } from "@/lib/curatedCars"
import { CarContextPanel } from "./CarContextPanel"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/lib/CurrencyContext", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value.toLocaleString("en-US")}`,
  }),
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/components/dashboard/cards/SafeImage", () => ({
  SafeImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}))

const baseCar: CollectorCar = {
  id: "listing-1",
  title: "2021 Porsche 911 GT3",
  year: 2021,
  make: "Porsche",
  model: "911 GT3",
  trim: null,
  price: 218000,
  trend: "stable",
  trendValue: 0,
  thesis: "Documented GT car.",
  image: "/cars/placeholder.svg",
  images: [],
  engine: "4.0L Flat-6",
  transmission: "6-Speed Manual",
  mileage: 12450,
  mileageUnit: "mi",
  location: "Miami, FL",
  region: "US",
  fairValueByRegion: {
    US: { currency: "$", low: 200000, high: 240000 },
    EU: { currency: "€", low: 190000, high: 230000 },
    UK: { currency: "£", low: 170000, high: 210000 },
    JP: { currency: "¥", low: 30000000, high: 36000000 },
  },
  history: "One-owner example.",
  platform: "AUTO_TRADER",
  status: "ACTIVE",
  currentBid: 225000,
  bidCount: 0,
  endTime: new Date("2026-07-01T12:00:00Z"),
  category: "GT",
  askingPriceUsd: 225000,
}

describe("CarContextPanel", () => {
  it("shows listing facts before report generation and removes market positioning", () => {
    render(<CarContextPanel car={baseCar} make="Porsche" siblingCars={[]} />)

    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Listing price")).toBeInTheDocument()
    expect(screen.getAllByText("$225,000")).toHaveLength(2)
    expect(screen.getByText("12,450 mi")).toBeInTheDocument()
    expect(screen.getByText("6-Speed Manual")).toBeInTheDocument()

    expect(screen.queryByText(/Position vs Market/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Market Position/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fair value range/i)).not.toBeInTheDocument()
  })
})
