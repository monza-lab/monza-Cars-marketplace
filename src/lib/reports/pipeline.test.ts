import { describe, expect, it } from "vitest"
import type { CollectorCar } from "@/lib/curatedCars"
import { runV3Pipeline, STEP_DEFS, type StepExecutor } from "./pipeline"
import type { PipelineProgress, ReportSectionKey } from "./types-v3"

const car = {
  id: "listing-1",
  make: "Porsche",
  model: "911",
  year: 1997,
} as CollectorCar

describe("V3 report pipeline progress", () => {
  it("uses the listing analysis label for the first step", () => {
    expect(STEP_DEFS[0].label).toBe("Analyzing Listing")
  })

  it("emits the executor completion note on the completed progress event", async () => {
    const progress: PipelineProgress[] = []
    const note = "Listing details analyzed."
    const executors = Object.fromEntries(
      STEP_DEFS.map((step): [ReportSectionKey, StepExecutor] => [
        step.sectionKey,
        async () => ({
          data: { sectionKey: step.sectionKey },
          durationMs: 12,
          agentModel: null,
          completionNote: step.stepId === 1 ? note : undefined,
        }),
      ])
    ) as Record<ReportSectionKey, StepExecutor>

    await runV3Pipeline({
      listingId: "listing-1",
      car,
      executors,
      onProgress: (event) => progress.push(event),
    })

    const completed = progress.find(
      (event) => event.sectionKey === "listing_scrape" && event.status === "completed"
    )

    expect(completed).toMatchObject({
      label: "Analyzing Listing",
      completionNote: note,
    })
  })

  it("marks a step failed when its executor returns no section data", async () => {
    const progress: PipelineProgress[] = []
    const persisted: ReportSectionKey[] = []
    const executors = Object.fromEntries(
      STEP_DEFS.map((step): [ReportSectionKey, StepExecutor] => [
        step.sectionKey,
        async () => ({
          data: step.sectionKey === "technical_analysis" ? null : { sectionKey: step.sectionKey },
          durationMs: 12,
          agentModel: null,
        }),
      ])
    ) as Record<ReportSectionKey, StepExecutor>

    const { report, results } = await runV3Pipeline({
      listingId: "listing-1",
      car,
      executors,
      onProgress: (event) => progress.push(event),
      onStepComplete: async (result) => {
        persisted.push(result.sectionKey)
      },
    })

    expect(progress).toContainEqual(
      expect.objectContaining({
        sectionKey: "technical_analysis",
        status: "failed",
        completionNote: expect.stringContaining("No data"),
      })
    )
    expect(results.some((result) => result.sectionKey === "technical_analysis")).toBe(false)
    expect(persisted).not.toContain("technical_analysis")
    expect(report.technicalAnalysis).toBeNull()
    expect(report.stepsCompleted).toBe(9)
    expect(report.stepsFailed).toBe(1)
  })
})
