import type { CollectorCar } from "@/lib/curatedCars"
import type { ChatContext, Suggestion } from "./types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function carName(car: CollectorCar | null): string {
  if (!car) return "this Porsche"
  return `${car.year} ${car.make} ${car.model}`
}

/** Ensure exactly 4 suggestions: slice if more, pad with surface fallback if fewer. */
function normalize(suggestions: Suggestion[], fallback: Suggestion[]): Suggestion[] {
  if (suggestions.length >= 4) return suggestions.slice(0, 4)
  const needed = 4 - suggestions.length
  return [...suggestions, ...fallback.slice(0, needed)]
}

// ─── Surface fallback (used as padding when a section has < 4 items) ─────────

const OTHER_FALLBACK: Suggestion[] = [
  {
    label: "What does MonzaHaus do?",
    prompt: "What does MonzaHaus do, and how can it help me?",
  },
  {
    label: "How do reports work?",
    prompt: "How do Haus Reports work, and what do they include?",
  },
  {
    label: "What are Pistons?",
    prompt: "What are Pistons, and what do I need them for?",
  },
  {
    label: "Getting started help",
    prompt: "I'm new here. How should I start exploring?",
  },
]

// ─── Report section suggestions ───────────────────────────────────────────────

function reportSuggestions(
  activeSection: ChatContext["activeSection"],
  car: CollectorCar | null
): Suggestion[] {
  const name = carName(car)
  const currentYear = new Date().getFullYear()

  switch (activeSection) {
    case "summary":
      return [
        {
          label: "Summarize the findings",
          prompt: `Summarize the key findings from the ${name} report in 3 bullets.`,
        },
        {
          label: "What matters most?",
          prompt: `What is the most important thing I should know before evaluating this ${name}?`,
        },
        {
          label: "Getting started help",
          prompt: "I'm new here. How should I start exploring?",
        },
        {
          label: "How do reports work?",
          prompt: "How do Haus Reports work, and what do they include?",
        },
      ]

    case "identity":
      return [
        {
          label: "Explain this VIN",
          prompt: `Explain what this ${name} VIN tells us about its factory, generation, and equipment.`,
        },
        {
          label: "Is the color rare?",
          prompt: `How rare is the color on this ${name}? Is there a market premium for it?`,
        },
        {
          label: "Documents to request",
          prompt: `What documentation should I ask the seller of this ${name} for?`,
        },
        {
          label: "Common issues",
          prompt: `What are the common mechanical issues on a ${name}?`,
        },
      ]

    case "valuation":
      return [
        {
          label: "Why this fair value?",
          prompt: `Explain how the report arrives at the fair value for this ${name}. Which comparables were used?`,
        },
        {
          label: "Above or below market?",
          prompt: `Is the asking price of this ${name} above or below market versus recent comparables?`,
        },
        {
          label: "How much has it appreciated?",
          prompt: `How much has a ${name} appreciated over the last 5 years? Which version has risen the most?`,
        },
        {
          label: "How is the market?",
          prompt: `How is the market for the ${name} right now? Is this a good moment?`,
        },
      ]

    case "performance":
      return [
        {
          label: "How much has it appreciated?",
          prompt: `How much has a ${name} appreciated over the last 5 years? Which version has risen the most?`,
        },
        {
          label: "Which version is rising fastest?",
          prompt: `Among the ${name} variants, which one has appreciated the most, and why?`,
        },
        {
          label: "Why this fair value?",
          prompt: `Explain how the report arrives at the fair value for this ${name}. Which comparables were used?`,
        },
        {
          label: "How is the market?",
          prompt: `How is the market for the ${name} right now? Is this a good moment?`,
        },
      ]

    case "risk":
      return [
        {
          label: "Explain the risk score",
          prompt: `Explain the risk score for this ${name}. Which signals matter most?`,
        },
        {
          label: "Which inspections matter?",
          prompt: `Which critical inspections should I do before buying this ${name}?`,
        },
        {
          label: "Common issues",
          prompt: `What are the common mechanical issues on a ${name}?`,
        },
        {
          label: "Documents to request",
          prompt: `What documentation should I ask the seller of this ${name} for?`,
        },
      ]

    case "dueDiligence":
      return [
        {
          label: "Documents to request",
          prompt: `What documentation should I ask the seller of this ${name} for?`,
        },
        {
          label: "Verify service history",
          prompt: `How do I verify that the service history of this ${name} is legitimate?`,
        },
        {
          label: "Which inspections matter?",
          prompt: `Which critical inspections should I do before buying this ${name}?`,
        },
        {
          label: "Explain the risk score",
          prompt: `Explain the risk score for this ${name}. Which signals matter most?`,
        },
      ]

    case "marketContext":
      return [
        {
          label: "How is the market?",
          prompt: `How is the market for the ${name} right now? Is this a good moment?`,
        },
        {
          label: "Is now the time to buy?",
          prompt: `Is this a good time to buy a ${name} in ${currentYear}?`,
        },
        {
          label: "How much has it appreciated?",
          prompt: `How much has a ${name} appreciated over the last 5 years? Which version has risen the most?`,
        },
        {
          label: "Above or below market?",
          prompt: `Is the asking price of this ${name} above or below market versus recent comparables?`,
        },
      ]

    case "similar":
      return [
        {
          label: "Compare with others",
          prompt: `Show me 3 similar cars to this ${name} that are for sale today.`,
        },
        {
          label: "Options at this price",
          prompt: `What other Porsches can I buy at the same price as this ${name}?`,
        },
        {
          label: "Above or below market?",
          prompt: `Is the asking price of this ${name} above or below market versus recent comparables?`,
        },
        {
          label: "Why this fair value?",
          prompt: `Explain how the report arrives at the fair value for this ${name}. Which comparables were used?`,
        },
      ]

    case "verdict":
      return [
        {
          label: "Why this verdict?",
          prompt: `Explain the verdict for this ${name}'s report. What weighs most heavily?`,
        },
        {
          label: "What would change the verdict?",
          prompt: `What would need to happen for the verdict on this ${name} to change?`,
        },
        {
          label: "How is the market?",
          prompt: `How is the market for the ${name} right now? Is this a good moment?`,
        },
        {
          label: "Is now the time to buy?",
          prompt: `Is this a good time to buy a ${name} in ${currentYear}?`,
        },
      ]

    default:
      // activeSection is null — generic report suggestions
      return normalize(
        [
          {
            label: "Summarize the findings",
            prompt: `Summarize the key findings from the ${name} report in 3 bullets.`,
          },
          {
            label: "Why this fair value?",
            prompt: `Explain how the report arrives at the fair value for this ${name}. Which comparables were used?`,
          },
          {
            label: "Explain the risk score",
            prompt: `Explain the risk score for this ${name}. Which signals matter most?`,
          },
          {
            label: "Why this verdict?",
            prompt: `Explain the verdict for this ${name}'s report. What weighs most heavily?`,
          },
        ],
        OTHER_FALLBACK
      )
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildSuggestions(context: ChatContext): Suggestion[] {
  const { surface, car, activeSection } = context

  switch (surface) {
    case "dashboard":
      return [
        {
          label: "Weekly movers",
          prompt: "Which Porsches moved up the most this week?",
        },
        {
          label: "Best generation to start with",
          prompt: "If I want to start collecting Porsches, which generation do you recommend?",
        },
        {
          label: "Compare 992 vs 991",
          prompt: "Compare the 992 generation versus the 991 in terms of appreciation.",
        },
        {
          label: "Market trends",
          prompt: "Summarize collector Porsche market trends this month.",
        },
      ]

    case "marketplace-series":
      return [
        {
          label: "GT3 vs Turbo comparison",
          prompt: "What should I look for when comparing GT3 versus Turbo S versions of this generation?",
        },
        {
          label: "Typical fair value",
          prompt: "What is the typical fair value for models in this generation?",
        },
        {
          label: "Best entry point",
          prompt: "What is the best entry point within this generation for a first Porsche?",
        },
        {
          label: "Weekly movers",
          prompt: "Which models in this generation moved the most in price this week?",
        },
      ]

    case "car-detail": {
      const name = carName(car)
      return [
        {
          label: "Is the report worth it?",
          prompt: `Is it worth generating the Haus Report for this ${name}?`,
        },
        {
          label: "Model weak points",
          prompt: `What are the known weak points of a ${name}?`,
        },
        {
          label: "Compare with others",
          prompt: `Compare this ${name} against other same-year cars currently for sale.`,
        },
        {
          label: "Reasonable price?",
          prompt: `At first glance, is the asking price for this ${name} reasonable?`,
        },
      ]
    }

    case "report":
      return reportSuggestions(activeSection, car)

    case "other":
    default:
      return [...OTHER_FALLBACK]
  }
}
