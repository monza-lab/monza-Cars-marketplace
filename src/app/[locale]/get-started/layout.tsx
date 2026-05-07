import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Get Started — Free Porsche Market Report",
  description:
    "Generate your first Porsche investment report for free. AI-powered market intelligence from real auction data.",
  robots: { index: false, follow: false },
}

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
