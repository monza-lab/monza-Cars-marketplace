import { SchemaType, type Schema } from "@google/generative-ai"

import { generateJson } from "./gemini"
import { loadSkill } from "./skills/loader"
import { computeSourceHash, type RewriterSource } from "./sourceHash"
import {
  readCachedRewrite,
  writeCachedRewrite,
  type CachedRewriteRow,
} from "./listingRewriterDb"

export type RewriterLocale = "en" | "es" | "de" | "ja"

export interface RewriterInput {
  listingId: string
  locale: RewriterLocale
  source: RewriterSource
}

export interface RewriteOutput {
  headline: string
  highlights: string[]
  promptVersion: string
  model: string
  sourceHash: string
  generatedAt: string
}

const SKILL_NAME = "listing-rewriter"

const LISTING_HOOK_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description:
    "Editorial hook for a single vehicle listing, in the target locale. " +
    "Do not invent facts. Do not paraphrase the seller's original description verbatim.",
  properties: {
    headline: {
      type: SchemaType.STRING,
      description:
        "One sentence (12–28 words) positioning this car: what it is, why a collector would care. " +
        "No hype, no generic filler. No verbatim phrases >4 words from the seller description.",
    },
    highlights: {
      type: SchemaType.ARRAY,
      minItems: 2,
      maxItems: 5,
      description:
        "Between 2 and 5 concise factual bullets (≤180 chars each), in the target locale. " +
        "Prefer provenance, originality, service history, rare options, and condition specifics. " +
        "If the seller description is sparse, produce fewer bullets grounded in structured facts " +
        "rather than padding with filler. Never include bullets unsupported by the input.",
      items: { type: SchemaType.STRING, description: "One highlight bullet." },
    },
  },
  required: ["headline", "highlights"],
}

export async function rewriteListing(
  input: RewriterInput,
): Promise<RewriteOutput | null> {
  try {
    const skill = loadSkill(SKILL_NAME)
    const sourceHash = computeSourceHash(input.source)

    const cached = await readCachedRewrite(input.listingId, input.locale)
    if (
      cached &&
      cached.source_hash === sourceHash &&
      cached.prompt_version === skill.version &&
      cached.model === skill.model
    ) {
      return rowToOutput(cached, sourceHash)
    }

    const userPrompt = renderUserPrompt(skill.userPromptTemplate, input)

    const resp = await generateJson<{ headline: string; highlights: string[] }>({
      systemPrompt: skill.systemPrompt,
      userPrompt,
      model: skill.model,
      temperature: skill.temperature,
      maxOutputTokens: 1024,
      responseSchema: LISTING_HOOK_SCHEMA,
    })

    if (!resp.ok) {
      logEvent("rewrite_failed", {
        listing_id: input.listingId,
        locale: input.locale,
        reason: `gemini_error: ${resp.error}`,
      })
      return null
    }

    const validated = validatePayload(resp.data)
    if (!validated) {
      logEvent("rewrite_failed", {
        listing_id: input.listingId,
        locale: input.locale,
        reason: "schema_invalid",
      })
      return null
    }

    const generatedAt = new Date().toISOString()
    const row: CachedRewriteRow = {
      headline: validated.headline,
      highlights: validated.highlights,
      source_hash: sourceHash,
      prompt_version: skill.version,
      model: skill.model,
      generated_at: generatedAt,
    }

    try {
      await writeCachedRewrite(input.listingId, input.locale, row)
    } catch (err) {
      // DB write failures are logged but do not invalidate the payload.
      logEvent("rewrite_failed", {
        listing_id: input.listingId,
        locale: input.locale,
        reason: `db_write: ${err instanceof Error ? err.message : String(err)}`,
      })
    }

    logEvent("rewrite_generated", {
      listing_id: input.listingId,
      locale: input.locale,
    })

    return {
      headline: validated.headline,
      highlights: validated.highlights,
      promptVersion: skill.version,
      model: skill.model,
      sourceHash,
      generatedAt,
    }
  } catch (err) {
    logEvent("rewrite_failed", {
      listing_id: input.listingId,
      locale: input.locale,
      reason: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function renderUserPrompt(template: string, input: RewriterInput): string {
  const s = input.source
  const table: Record<string, string> = {
    locale: input.locale,
    listing_id: input.listingId,
    year: String(s.year),
    make: s.make,
    model: s.model,
    trim: s.trim ?? "—",
    mileage: s.mileage != null ? String(s.mileage) : "—",
    mileage_unit: s.mileage_unit ?? "",
    vin: s.vin ?? "—",
    color_exterior: s.color_exterior ?? "—",
    color_interior: s.color_interior ?? "—",
    engine: s.engine ?? "—",
    transmission: s.transmission ?? "—",
    body_style: s.body_style ?? "—",
    location: s.location ?? "—",
    platform: s.platform ?? "—",
    description_text: s.description_text ?? "(no seller description provided)",
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => table[k] ?? `{{${k}}}`)
}

function validatePayload(
  data: unknown,
): { headline: string; highlights: string[] } | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const headline = typeof d.headline === "string" ? d.headline.trim() : ""
  if (headline.length < 20 || headline.length > 240) return null

  if (!Array.isArray(d.highlights)) return null
  const highlights = d.highlights
    .map(h => (typeof h === "string" ? h.trim() : ""))
    .filter(h => h.length > 0 && h.length <= 240)
  if (highlights.length < 2 || highlights.length > 5) return null

  return { headline, highlights }
}

function rowToOutput(row: CachedRewriteRow, sourceHash: string): RewriteOutput {
  return {
    headline: row.headline,
    highlights: row.highlights,
    promptVersion: row.prompt_version,
    model: row.model,
    sourceHash,
    generatedAt: row.generated_at,
  }
}

function logEvent(event: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ...payload }))
}
