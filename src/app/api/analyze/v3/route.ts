// src/app/api/analyze/v3/route.ts
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
} from "@/lib/reports/queries"
import { saveHausReport, saveSignals } from "@/lib/reports/queries"
import type { PipelineProgress } from "@/lib/reports/types-v3"
import type { HausReport } from "@/lib/fairValue/types"

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase())
  return admins.includes(email.toLowerCase())
}

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — V3 pipeline runs 10 AI steps, typically 60-120s

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
  await checkAndResetFreeCredits(dbUser.id)
  const alreadyGenerated = await hasAlreadyGenerated(dbUser.id, listingId)

  // Cache check
  if (!force && await hasV3Report(listingId)) {
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
  const userIsAdmin = isAdmin(user.email)
  if (!alreadyGenerated && !dbUser.unlimited_reports && !userIsAdmin) {
    const balance = (dbUser.credits_balance ?? 0) + (dbUser.pack_credits_balance ?? 0)
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
        })

        // Persist sections in parallel
        await Promise.all(
          results.map((result) => saveReportSection(listingId, 1, result))
        )

        // Also persist fair value to existing tables (backward compat)
        const fairValueResult = results.find(r => r.sectionKey === "fair_value")
        if (fairValueResult?.data) {
          try {
            const fv = fairValueResult.data as HausReport
            await saveHausReport(listingId, fv)
            if (fv.signals_detected?.length) {
              await saveSignals(
                listingId,
                `v3-${Date.now()}`,
                "v3.0",
                fv.signals_detected
              )
            }
          } catch (err) {
            console.error("[v3/route] Failed to persist V2 backward compat:", err)
          }
        }

        // Deduct credit
        if (!alreadyGenerated && !userIsAdmin) {
          await deductCredit(dbUser.id, listingId, listingId)
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
