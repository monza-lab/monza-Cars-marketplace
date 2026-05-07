import type { ToolDef, ToolInvocationContext, ToolResult } from "@/lib/advisor/tools/registry"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"
import { extractSeries } from "@/lib/brandConfig"
import { KNOWLEDGE_ARTICLES } from "@/lib/knowledge/registry"
import { getListing, computePricePosition, searchListings } from "./marketplace"

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

// ─── red-flag assessment ───

interface RedFlag {
  severity: "low" | "medium" | "high"
  issue: string
  evidence: string
}

// Simple heuristic rules. Each rule inspects the listing + matched knowledge
// articles and emits a flag when the listing signals suggest the issue applies.
interface HeuristicRule {
  id: string
  severity: "low" | "medium" | "high"
  appliesToSeries?: (seriesId: string) => boolean
  check: (listing: {
    year: number
    mileage: number
    description: string
    title: string
  }) => { match: boolean; evidence: string }
}

const RED_FLAG_RULES: HeuristicRule[] = [
  {
    id: "ims-bearing-996-997.1",
    severity: "high",
    appliesToSeries: (s) => s === "996" || s === "997",
    check: (l) => {
      const desc = l.description.toLowerCase()
      const hasRetrofit = /ims|bearing retrofit|ims solution|lna/.test(desc)
      if (hasRetrofit) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.title}: IMS bearing retrofit not mentioned in listing text; M96/M97 engines are at risk.`,
      }
    },
  },
  {
    id: "bore-scoring-997.1-3.8",
    severity: "medium",
    appliesToSeries: (s) => s === "997",
    check: (l) => {
      const isEarly = l.year >= 2005 && l.year <= 2008
      if (!isEarly) return { match: false, evidence: "" }
      const scoped = /borescop|cylinder scope|bore scor/i.test(l.description)
      if (scoped) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.year} 997.1 era: bore scoring risk on 3.8L; no borescope evidence in description.`,
      }
    },
  },
  {
    id: "high-mileage-no-records",
    severity: "medium",
    check: (l) => {
      if (l.mileage < 60000) return { match: false, evidence: "" }
      const hasRecords = /service records|maintenance records|binder of receipts|receipts|carfax/i.test(
        l.description,
      )
      if (hasRecords) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.mileage.toLocaleString()} mi with no mention of service records in listing text.`,
      }
    },
  },
  {
    id: "accident-disclosed",
    severity: "high",
    check: (l) => {
      const hit = /accident|collision|repaired damage|repainted after accident/i.test(l.description)
      if (!hit) return { match: false, evidence: "" }
      return { match: true, evidence: "Listing text mentions accident/repair history." }
    },
  },
  {
    id: "repainted",
    severity: "low",
    check: (l) => {
      const hit = /repaint|respray|respray'd|paintwork/i.test(l.description)
      if (!hit) return { match: false, evidence: "" }
      return { match: true, evidence: "Non-original paint disclosed or implied in listing text." }
    },
  },
  // ── New rules ──
  {
    id: "coolant-pipes-cayenne",
    severity: "high",
    appliesToSeries: (s) => s === "cayenne",
    check: (l) => {
      if (l.year < 2003 || l.year > 2010) return { match: false, evidence: "" }
      const hasReplacement = /coolant pipe|water pipe|pipe replacement|plastic pipe/i.test(l.description)
      if (hasReplacement) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.year} Cayenne: plastic coolant pipes fail catastrophically; no mention of replacement in description.`,
      }
    },
  },
  {
    id: "rear-main-seal-m96",
    severity: "medium",
    appliesToSeries: (s) => s === "996" || s === "boxster",
    check: (l) => {
      const hasReseal = /rear main seal|rms|reseal/i.test(l.description)
      if (hasReseal) return { match: false, evidence: "" }
      if (l.mileage < 50000) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `M96 engine at ${l.mileage.toLocaleString()} mi: rear main seal leak is common above 50k mi; not addressed in description.`,
      }
    },
  },
  {
    id: "pdk-mechatronic-991.1",
    severity: "medium",
    appliesToSeries: (s) => s === "991",
    check: (l) => {
      if (l.year > 2016) return { match: false, evidence: "" }
      const isPDK = /pdk|doppelkuppl/i.test(l.description)
      if (!isPDK) return { match: false, evidence: "" }
      const hasService = /mechatronic|clutch pack|pdk service/i.test(l.description)
      if (hasService) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `991.1 PDK: mechatronic unit and clutch pack need service by 60-80k mi; no PDK service mentioned.`,
      }
    },
  },
  {
    id: "water-ingress-986",
    severity: "medium",
    appliesToSeries: (s) => s === "boxster" || s === "718-boxster",
    check: (l) => {
      if (l.year > 2004) return { match: false, evidence: "" }
      const hasCheck = /water ingress|drain|water damage/i.test(l.description)
      if (hasCheck) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `986 Boxster: known water ingress via blocked drains; can damage ECU. Not mentioned in description.`,
      }
    },
  },
  {
    id: "aos-failure-997",
    severity: "medium",
    appliesToSeries: (s) => s === "997",
    check: (l) => {
      if (l.year > 2008) return { match: false, evidence: "" }
      const hasAOS = /aos|air[- ]oil separator|smoke on startup/i.test(l.description)
      if (hasAOS) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `997.1: AOS (air-oil separator) failure causes smoke on startup; no mention in description.`,
      }
    },
  },
  {
    id: "cylinder-scoring-991-3.8",
    severity: "medium",
    appliesToSeries: (s) => s === "991",
    check: (l) => {
      if (l.year < 2012 || l.year > 2016) return { match: false, evidence: "" }
      const is38 = /3\.8|gt3|carrera s|gts/i.test(l.description + " " + (l.title ?? ""))
      if (!is38) return { match: false, evidence: "" }
      const hasScope = /borescop|cylinder|bore scor/i.test(l.description)
      if (hasScope) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `991.1 3.8L: cylinder scoring risk; no borescope evidence in description.`,
      }
    },
  },
  {
    id: "missing-service-records",
    severity: "low",
    check: (l) => {
      if (l.mileage < 30000) return { match: false, evidence: "" }
      const hasRecords = /service history|service record|full history|stamped book|service book/i.test(l.description)
      if (hasRecords) return { match: false, evidence: "" }
      return {
        match: true,
        evidence: `${l.mileage.toLocaleString()} mi without documented service history claim.`,
      }
    },
  },
]

export const assessRedFlags: ToolDef = {
  name: "assess_red_flags",
  description:
    "Cross-reference a listing's year/mileage/description against known-issue rules for its chassis and return a prioritized red-flag list.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      listingId: { type: "string" },
    },
    required: ["listingId"],
  },
  async handler(args) {
    const listingId = typeof args.listingId === "string" ? args.listingId : ""
    if (!listingId) return { ok: false, error: "missing_arg:listingId" }

    const car = await fetchLiveListingById(listingId)
    if (!car) return { ok: false, error: "not_found" }

    const seriesId = extractSeries(car.model, car.year, car.make)
    const desc = [car.description ?? "", car.sellerNotes ?? ""].join("\n")
    const listingFacts = {
      year: car.year,
      mileage: car.mileage,
      description: desc,
      title: `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`,
    }

    const flags: RedFlag[] = []
    for (const rule of RED_FLAG_RULES) {
      if (rule.appliesToSeries && !rule.appliesToSeries(seriesId)) continue
      const result = rule.check(listingFacts)
      if (result.match) {
        flags.push({
          severity: rule.severity,
          issue: rule.id,
          evidence: result.evidence,
        })
      }
    }

    // Suggest follow-up questions based on matched knowledge articles that
    // overlap with this series/engine.
    const relatedArticles = KNOWLEDGE_ARTICLES.filter((a) => {
      const hay = `${a.title} ${a.keywords.join(" ")}`.toLowerCase()
      return hay.includes(seriesId) || hay.includes(car.make.toLowerCase())
    }).slice(0, 3)

    const specificQuestions = flags.map((f) => {
      switch (f.issue) {
        case "ims-bearing-996-997.1":
          return "Was an IMS retrofit performed? Which kit (LN Engineering, Pelican) and at what mileage?"
        case "bore-scoring-997.1-3.8":
          return "Was a borescope inspection of all six cylinders performed? Please share the photos."
        case "high-mileage-no-records":
          return "Can you share service records, maintenance receipts, or a Carfax for the last 5 years?"
        case "accident-disclosed":
          return "Please share the insurance / body-shop records and paint-meter readings per panel."
        case "repainted":
          return "Which panels were repainted and why? Any paint-meter readings?"
        case "coolant-pipes-cayenne":
          return "Have the plastic coolant pipes been replaced with aluminum? What brand/at what mileage?"
        case "rear-main-seal-m96":
          return "Has the rear main seal been replaced? Any oil spots on the garage floor or rear of the engine?"
        case "pdk-mechatronic-991.1":
          return "Has the PDK mechatronic unit and clutch pack been serviced? At what mileage? By which shop?"
        case "water-ingress-986":
          return "Have the front trunk drains been checked and cleared? Any evidence of water damage to the ECU compartment?"
        case "aos-failure-997":
          return "Has the AOS (air-oil separator) been replaced? Any smoke on cold startup?"
        case "cylinder-scoring-991-3.8":
          return "Has a borescope inspection of all six cylinders been performed? Please share the photos."
        case "missing-service-records":
          return "Can you share the full service history or a stamped service book?"
        default:
          return `Clarify: ${f.issue}`
      }
    })

    const high = flags.filter((f) => f.severity === "high").length
    const medium = flags.filter((f) => f.severity === "medium").length
    const low = flags.filter((f) => f.severity === "low").length

    const summary = truncate(
      `${flags.length} red flag${flags.length === 1 ? "" : "s"} found (high: ${high}, medium: ${medium}, low: ${low}) for ${listingFacts.title}.`,
    )

    return {
      ok: true,
      data: {
        listingId,
        seriesId,
        flags,
        specificQuestions,
        relatedArticles: relatedArticles.map((a) => a.slug),
      },
      summary,
    }
  },
}

// ─── compare_listings ───

export const compareListings: ToolDef = {
  name: "compare_listings",
  description: "Side-by-side valuation and risk digest for 2–5 listings.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      listingIds: { type: "array", items: { type: "string" } },
    },
    required: ["listingIds"],
  },
  async handler(args, ctx) {
    const ids = Array.isArray(args.listingIds) ? args.listingIds.filter((i): i is string => typeof i === "string") : []
    if (ids.length < 1) return { ok: false, error: "missing_arg:listingIds" }
    if (ids.length > 5) return { ok: false, error: "too_many_listings: max 5" }

    const rowResults = await Promise.all(
      ids.map(async (id): Promise<{
        id: string
        ok: boolean
        title: string
        currentBid: number | null
        pricePositionPct: number | null
        redFlagCount: number
        error?: string
      }> => {
        const [listingRes, positionRes, flagsRes] = await Promise.all([
          getListing.handler({ id }, ctx),
          computePricePosition.handler({ listingId: id }, ctx),
          assessRedFlags.handler({ listingId: id }, ctx),
        ])

        if (!listingRes.ok) {
          return {
            id,
            ok: false,
            title: id,
            currentBid: null,
            pricePositionPct: null,
            redFlagCount: 0,
            error: listingRes.error,
          }
        }
        const car = listingRes.data as { year: number; make: string; model: string; trim: string | null; currentBid: number }
        const title = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`
        const pct =
          positionRes.ok && typeof (positionRes.data as { percentile?: number }).percentile === "number"
            ? (positionRes.data as { percentile: number }).percentile
            : null
        const flagCount =
          flagsRes.ok && Array.isArray((flagsRes.data as { flags?: unknown[] }).flags)
            ? (flagsRes.data as { flags: unknown[] }).flags.length
            : 0
        return {
          id,
          ok: true,
          title,
          currentBid: car.currentBid ?? null,
          pricePositionPct: pct,
          redFlagCount: flagCount,
        }
      }),
    )

    const valid = rowResults.filter((r) => r.ok)
    if (valid.length === 0) return { ok: false, error: "no_comparable_listings_resolved" }

    const withPct = valid.filter((r) => r.pricePositionPct != null) as typeof valid
    const lowest = withPct.reduce<(typeof valid)[number] | null>(
      (acc, r) => (acc == null || (r.pricePositionPct ?? 999) < (acc.pricePositionPct ?? 999) ? r : acc),
      null,
    )

    const summary = truncate(
      `Compared ${valid.length} listing${valid.length === 1 ? "" : "s"}${
        lowest ? `; lowest percentile: ${lowest.title} at ${lowest.pricePositionPct}%` : ""
      }`,
    )

    return {
      ok: true,
      data: { rows: rowResults },
      summary,
    }
  },
}

// ─── build_shortlist ───

export const buildShortlist: ToolDef = {
  name: "build_shortlist",
  description: "Build a value-ranked shortlist for structured criteria (series, price ceiling, region, year range).",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      seriesId: { type: "string" },
      variantId: { type: "string" },
      priceMaxUsd: { type: "number" },
      region: { type: "string", enum: ["US", "EU", "UK", "JP"] },
      yearMin: { type: "number" },
      yearMax: { type: "number" },
      maxResults: { type: "number" },
    },
    required: ["seriesId"],
  },
  async handler(args, ctx) {
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : ""
    if (!seriesId) return { ok: false, error: "missing_arg:seriesId" }
    const maxResults =
      typeof args.maxResults === "number" && args.maxResults > 0 ? Math.min(20, args.maxResults) : 5

    const searchArgs: Record<string, unknown> = {
      seriesId,
      limit: 30,
    }
    if (typeof args.variantId === "string") searchArgs.variantId = args.variantId
    if (typeof args.region === "string") searchArgs.region = args.region
    if (typeof args.yearMin === "number") searchArgs.yearFrom = args.yearMin
    if (typeof args.yearMax === "number") searchArgs.yearTo = args.yearMax
    if (typeof args.priceMaxUsd === "number") searchArgs.priceToUsd = args.priceMaxUsd

    const searchRes = await searchListings.handler(searchArgs, ctx)
    if (!searchRes.ok) return searchRes

    const data = searchRes.data as {
      results: Array<{
        id: string
        year: number
        make: string
        model: string
        trim: string | null
        currentBid: number
        currency?: string
      }>
    }
    if (data.results.length === 0) {
      return { ok: true, data: { shortlist: [], count: 0 }, summary: "No listings matched the criteria" }
    }

    // Annotate with price position percentile when available.
    const annotated = await Promise.all(
      data.results.slice(0, 20).map(async (r) => {
        const pos = await computePricePosition.handler({ listingId: r.id }, ctx)
        const pct =
          pos.ok && typeof (pos.data as { percentile?: number }).percentile === "number"
            ? (pos.data as { percentile: number }).percentile
            : null
        return {
          id: r.id,
          title: `${r.year} ${r.make} ${r.model}${r.trim ? ` ${r.trim}` : ""}`,
          currentBid: r.currentBid,
          percentile: pct,
        }
      }),
    )

    const withPct = annotated.filter((r) => r.percentile != null)
    const withoutPct = annotated.filter((r) => r.percentile == null)
    withPct.sort((a, b) => (a.percentile ?? 999) - (b.percentile ?? 999))
    const shortlist = [...withPct, ...withoutPct].slice(0, maxResults)
    const top = shortlist[0]

    const summary = truncate(
      `Shortlist of ${shortlist.length} listing${shortlist.length === 1 ? "" : "s"}${
        top ? `; top pick: ${top.title}${top.percentile != null ? ` at ${top.percentile}th percentile` : ""}` : ""
      }`,
    )

    return {
      ok: true,
      data: { shortlist, count: shortlist.length },
      summary,
    }
  },
}

export const analysisTools: ToolDef[] = [assessRedFlags, compareListings, buildShortlist]

// Re-export handler signature type for tests.
export type { ToolInvocationContext, ToolResult }
