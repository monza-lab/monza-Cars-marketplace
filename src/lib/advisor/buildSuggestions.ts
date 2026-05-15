import type { CollectorCar } from "@/lib/curatedCars"
import type { ChatContext, Suggestion } from "./types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function carName(car: CollectorCar | null): string {
  if (!car) return "este Porsche"
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
    label: "¿Qué hace MonzaHaus?",
    prompt: "¿Qué hace MonzaHaus y cómo me puede ayudar?",
  },
  {
    label: "¿Cómo funcionan los reportes?",
    prompt: "¿Cómo funcionan los Haus Reports y qué incluyen?",
  },
  {
    label: "¿Qué son los pistons?",
    prompt: "¿Qué son los pistons y para qué los necesito?",
  },
  {
    label: "Ayuda para empezar",
    prompt: "Soy nuevo. ¿Cómo empiezo a explorar?",
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
          label: "Resume los hallazgos",
          prompt: `Resume los hallazgos clave del reporte de ${name} en 3 bullets.`,
        },
        {
          label: "¿Qué es lo más importante?",
          prompt: `¿Qué es lo más importante que debería saber antes de evaluar este ${name}?`,
        },
        {
          label: "Ayuda para empezar",
          prompt: "Soy nuevo. ¿Cómo empiezo a explorar?",
        },
        {
          label: "¿Cómo funcionan los reportes?",
          prompt: "¿Cómo funcionan los Haus Reports y qué incluyen?",
        },
      ]

    case "identity":
      return [
        {
          label: "Explica este VIN",
          prompt: `Explica qué nos dice el VIN de este ${name}, factory, generación, equipamiento.`,
        },
        {
          label: "¿El color es raro?",
          prompt: `¿Qué tan raro es el color de este ${name}? ¿Hay premium de mercado por el color?`,
        },
        {
          label: "Documentos a pedir",
          prompt: `¿Qué documentación debo pedirle al vendedor de este ${name}?`,
        },
        {
          label: "Problemas comunes",
          prompt: `¿Cuáles son los problemas mecánicos comunes de un ${name}?`,
        },
      ]

    case "valuation":
      return [
        {
          label: "¿Por qué este fair value?",
          prompt: `Explica cómo llegan al fair value del reporte para este ${name}. ¿Qué comparables usaron?`,
        },
        {
          label: "¿Está sobre o bajo mercado?",
          prompt: `¿El precio de venta de este ${name} está sobre o bajo mercado vs comparables recientes?`,
        },
        {
          label: "¿Cuánto ha apreciado?",
          prompt: `¿Cuánto ha apreciado un ${name} en los últimos 5 años? ¿Qué versión sube más?`,
        },
        {
          label: "¿Cómo está el mercado?",
          prompt: `¿Cómo está el mercado de ${name} ahora mismo? ¿Es buen momento?`,
        },
      ]

    case "performance":
      return [
        {
          label: "¿Cuánto ha apreciado?",
          prompt: `¿Cuánto ha apreciado un ${name} en los últimos 5 años? ¿Qué versión sube más?`,
        },
        {
          label: "¿Qué versión sube más?",
          prompt: `Entre las variantes de ${name}, ¿cuál ha apreciado más y por qué?`,
        },
        {
          label: "¿Por qué este fair value?",
          prompt: `Explica cómo llegan al fair value del reporte para este ${name}. ¿Qué comparables usaron?`,
        },
        {
          label: "¿Cómo está el mercado?",
          prompt: `¿Cómo está el mercado de ${name} ahora mismo? ¿Es buen momento?`,
        },
      ]

    case "risk":
      return [
        {
          label: "Explica el risk score",
          prompt: `Explica el risk score de este ${name}. ¿Qué señales pesan más?`,
        },
        {
          label: "¿Inspecciones a hacer?",
          prompt: `¿Qué inspecciones críticas debo hacer antes de comprar este ${name}?`,
        },
        {
          label: "Problemas comunes",
          prompt: `¿Cuáles son los problemas mecánicos comunes de un ${name}?`,
        },
        {
          label: "Documentos a pedir",
          prompt: `¿Qué documentación debo pedirle al vendedor de este ${name}?`,
        },
      ]

    case "dueDiligence":
      return [
        {
          label: "Documentos a pedir",
          prompt: `¿Qué documentación debo pedirle al vendedor de este ${name}?`,
        },
        {
          label: "Verificar service history",
          prompt: `¿Cómo verifico que el service history de este ${name} es legítimo?`,
        },
        {
          label: "¿Inspecciones a hacer?",
          prompt: `¿Qué inspecciones críticas debo hacer antes de comprar este ${name}?`,
        },
        {
          label: "Explica el risk score",
          prompt: `Explica el risk score de este ${name}. ¿Qué señales pesan más?`,
        },
      ]

    case "marketContext":
      return [
        {
          label: "¿Cómo está el mercado?",
          prompt: `¿Cómo está el mercado de ${name} ahora mismo? ¿Es buen momento?`,
        },
        {
          label: "¿Es el momento de comprar?",
          prompt: `¿Es buen momento para comprar un ${name} en ${currentYear}?`,
        },
        {
          label: "¿Cuánto ha apreciado?",
          prompt: `¿Cuánto ha apreciado un ${name} en los últimos 5 años? ¿Qué versión sube más?`,
        },
        {
          label: "¿Está sobre o bajo mercado?",
          prompt: `¿El precio de venta de este ${name} está sobre o bajo mercado vs comparables recientes?`,
        },
      ]

    case "similar":
      return [
        {
          label: "Compara con otros",
          prompt: `Muéstrame 3 carros similares a este ${name} a la venta hoy.`,
        },
        {
          label: "Opciones a este precio",
          prompt: `¿Qué otros Porsche puedo comprar al mismo precio que este ${name}?`,
        },
        {
          label: "¿Está sobre o bajo mercado?",
          prompt: `¿El precio de venta de este ${name} está sobre o bajo mercado vs comparables recientes?`,
        },
        {
          label: "¿Por qué este fair value?",
          prompt: `Explica cómo llegan al fair value del reporte para este ${name}. ¿Qué comparables usaron?`,
        },
      ]

    case "verdict":
      return [
        {
          label: "¿Por qué este verdict?",
          prompt: `Explica el verdict del reporte para este ${name}. ¿Qué pesa más?`,
        },
        {
          label: "¿Qué cambiaría el verdict?",
          prompt: `¿Qué tendría que pasar para que el verdict de este ${name} cambie?`,
        },
        {
          label: "¿Cómo está el mercado?",
          prompt: `¿Cómo está el mercado de ${name} ahora mismo? ¿Es buen momento?`,
        },
        {
          label: "¿Es el momento de comprar?",
          prompt: `¿Es buen momento para comprar un ${name} en ${currentYear}?`,
        },
      ]

    default:
      // activeSection is null — generic report suggestions
      return normalize(
        [
          {
            label: "Resume los hallazgos",
            prompt: `Resume los hallazgos clave del reporte de ${name} en 3 bullets.`,
          },
          {
            label: "¿Por qué este fair value?",
            prompt: `Explica cómo llegan al fair value del reporte para este ${name}. ¿Qué comparables usaron?`,
          },
          {
            label: "Explica el risk score",
            prompt: `Explica el risk score de este ${name}. ¿Qué señales pesan más?`,
          },
          {
            label: "¿Por qué este verdict?",
            prompt: `Explica el verdict del reporte para este ${name}. ¿Qué pesa más?`,
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
          label: "Movers de la semana",
          prompt: "¿Qué Porsche subieron más esta semana?",
        },
        {
          label: "Mejor generación para empezar",
          prompt: "Si quiero empezar a coleccionar Porsche, ¿qué generación recomiendas?",
        },
        {
          label: "Comparar 992 vs 991",
          prompt: "Compara la generación 992 contra la 991 en términos de apreciación.",
        },
        {
          label: "Tendencias de mercado",
          prompt: "Resume las tendencias del mercado collector Porsche este mes.",
        },
      ]

    case "marketplace-series":
      return [
        {
          label: "GT3 vs Turbo comparativa",
          prompt: "¿Qué debo buscar al comparar las versiones GT3 vs Turbo S de esta generación?",
        },
        {
          label: "Fair value típico",
          prompt: "¿Cuál es el fair value típico de los modelos de esta generación?",
        },
        {
          label: "Mejor entry point",
          prompt: "¿Cuál es el mejor entry point dentro de esta generación para un primer Porsche?",
        },
        {
          label: "Movers de la semana",
          prompt: "¿Qué modelos de esta generación se movieron más esta semana en precio?",
        },
      ]

    case "car-detail": {
      const name = carName(car)
      return [
        {
          label: "¿Vale la pena el reporte?",
          prompt: `¿Vale la pena generar el Haus Report de este ${name}?`,
        },
        {
          label: "Puntos débiles del modelo",
          prompt: `¿Cuáles son los puntos débiles conocidos de un ${name}?`,
        },
        {
          label: "Comparar con otros",
          prompt: `Compara este ${name} contra otros del mismo año a la venta.`,
        },
        {
          label: "¿Precio razonable?",
          prompt: `A primera vista, ¿el precio de pedida de este ${name} es razonable?`,
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
