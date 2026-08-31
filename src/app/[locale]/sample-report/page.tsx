import { redirect } from "next/navigation"
import { PUBLIC_SAMPLE_REPORT_LISTING_ID } from "@/lib/sampleReport"

export default async function SampleReportPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/cars/porsche/${PUBLIC_SAMPLE_REPORT_LISTING_ID}/report?sample=1`)
}
