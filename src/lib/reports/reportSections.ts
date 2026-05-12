// src/lib/reports/reportSections.ts
import { createAdminClient } from "@/lib/supabase/server"
import type { ReportSectionKey, PipelineStepResult } from "./types-v3"

export interface ReportSectionRow {
  id: string
  listing_id: string
  report_version: number
  section_key: ReportSectionKey
  section_data: unknown
  agent_model: string | null
  generation_duration_ms: number | null
  created_at: string
}

/**
 * Upsert a single pipeline step result into report_sections.
 */
export async function saveReportSection(
  listingId: string,
  reportVersion: number,
  result: PipelineStepResult
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from("report_sections").upsert(
    {
      listing_id: listingId,
      report_version: reportVersion,
      section_key: result.sectionKey,
      section_data: result.data,
      agent_model: result.agentModel,
      generation_duration_ms: result.durationMs,
    },
    { onConflict: "listing_id,report_version,section_key" }
  )
  if (error) {
    console.error(`[reportSections] Failed to save ${result.sectionKey}:`, error)
    throw error
  }
}

/**
 * Fetch all sections for a listing+version.
 */
export async function fetchReportSections(
  listingId: string,
  reportVersion: number
): Promise<ReportSectionRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("report_sections")
    .select("*")
    .eq("listing_id", listingId)
    .eq("report_version", reportVersion)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[reportSections] Failed to fetch sections:", error)
    return []
  }
  return (data ?? []) as ReportSectionRow[]
}

/**
 * Check if a V3 report has already been generated (cache hit).
 */
export async function hasV3Report(
  listingId: string,
  reportVersion: number = 1
): Promise<boolean> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from("report_sections")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("report_version", reportVersion)
    .eq("section_key", "final_synthesis")

  if (error) return false
  return (count ?? 0) > 0
}

/**
 * Delete all sections for a listing (for regeneration).
 */
export async function deleteReportSections(
  listingId: string,
  reportVersion: number
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("report_sections")
    .delete()
    .eq("listing_id", listingId)
    .eq("report_version", reportVersion)

  if (error) {
    console.error("[reportSections] Failed to delete sections:", error)
    throw error
  }
}
