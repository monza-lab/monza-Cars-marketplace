// src/app/api/analyze/v3/route.ts
import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"
import { runV3Pipeline } from "@/lib/reports/pipeline"
import { createV3Executors } from "@/lib/reports/agents"
import { saveReportSection, hasV3Report, fetchReportSections } from "@/lib/reports/reportSections"
import {
  getOrCreateUser,
  checkAndResetFreeCredits,
  hasAlreadyGenerated,
  deductCredit,
  REPORT_PISTON_COST,
  hasUnlimitedReportAccess,
} from "@/lib/reports/queries"
import { saveHausReport, saveSignals } from "@/lib/reports/queries"
import type { PipelineProgress } from "@/lib/reports/types-v3"
import type { HausReport } from "@/lib/fairValue/types"
import type { HausReportV3 } from "@/lib/reports/types-v3"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — V3 pipeline runs 10 AI steps, typically 60-120s

function isCompleteV3Report(report: HausReportV3): boolean {
  return report.stepsFailed === 0 && Boolean(report.finalSynthesis?.executiveSummary)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { listingId, force } = body

  if (!listingId) {
    return new Response(JSON.stringify({ error: "Missing listingId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // User + credit initialization
  const dbUser = await getOrCreateUser(user.id, user.email ?? "", user.user_metadata?.full_name)
  const credits = await checkAndResetFreeCredits(dbUser.id)
  const alreadyGenerated = await hasAlreadyGenerated(dbUser.id, listingId)
  const hasUnlimited = hasUnlimitedReportAccess(credits)

  // Cache check
  if (!force && await hasV3Report(listingId)) {
    if (!alreadyGenerated) {
      const creditResult = await deductCredit(dbUser.id, listingId, listingId)
      if (!creditResult.success) {
        const status = creditResult.error === "INSUFFICIENT_CREDITS" ? 402 : 500
        return new Response(JSON.stringify({ error: creditResult.error }), {
          status,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    const sections = await fetchReportSections(listingId, 1)
    return new Response(JSON.stringify({
      cached: true,
      version: 3,
      sections: sections.map(s => ({ key: s.section_key, data: s.section_data })),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Credit check
  if (!alreadyGenerated && !hasUnlimited) {
    const balance = (credits.credits_balance ?? 0) + (credits.pack_credits_balance ?? 0)
    if (balance < REPORT_PISTON_COST) {
      return new Response(JSON.stringify({ error: "Insufficient credits", balance }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  // Fetch listing
  const car = await fetchLiveListingById(listingId)
  if (!car) {
    return new Response(JSON.stringify({ error: "Listing not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Stream may have been closed by client
        }
      }

      const executors = createV3Executors()

      try {
        const { report, results } = await runV3Pipeline({
          listingId,
          car,
          executors,
          onProgress: (p: PipelineProgress) => {
            send("progress", p)
          },
          onStepComplete: async (result) => {
            await saveReportSection(listingId, 1, result)
          },
        })

        if (!isCompleteV3Report(report)) {
          send("error", {
            message: "V3 report incomplete: one or more scrape, database, or AI sections failed.",
            stepsCompleted: report.stepsCompleted,
            stepsFailed: report.stepsFailed,
          })
          return
        }

        // Also persist fair value to existing tables (backward compat)
        const fairValueResult = results.find(r => r.sectionKey === "fair_value")
        if (fairValueResult?.data) {
          try {
            const fv = fairValueResult.data as HausReport
            await saveHausReport(listingId, fv)
            if (fv.signals_detected?.length) {
              await saveSignals(
                listingId,
                randomUUID(),
                "v3.0",
                fv.signals_detected
              )
            }
          } catch (err) {
            console.error("[v3/route] Failed to persist V2 backward compat:", err)
          }
        }

        // Deduct credit
        if (!alreadyGenerated) {
          const creditResult = await deductCredit(dbUser.id, listingId, listingId)
          if (!creditResult.success) {
            send("error", {
              message:
                creditResult.error === "INSUFFICIENT_CREDITS"
                  ? "Insufficient credits"
                  : creditResult.error,
            })
            return
          }
        }

        send("complete", {
          report,
          stepsCompleted: report.stepsCompleted,
          stepsFailed: report.stepsFailed,
          totalDurationMs: report.totalDurationMs,
        })
      } catch (err) {
        console.error("[v3/route] Pipeline error:", err)
        send("error", {
          message: err instanceof Error ? err.message : "Pipeline failed",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
