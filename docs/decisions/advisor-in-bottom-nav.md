# Decision · Advisor en bottom nav (reemplaza Explore)

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Antes

Bottom nav: `Home · Explore · Search · Account`

- Explore navegaba a `/cars/porsche` (el listing browse).
- Home ya tenía `DISCOVER BY FAMILY` chips + `LATEST REPORTS` feed que cubrían el mismo intento.
- Resultaba redundante: dos botones (Home, Explore) llevaban a discovery de Porsches.

## Ahora

Bottom nav: `Home · Advisor · Search · Account`

- Advisor navega a `/advisor` con icono `MessageCircle` (Lucide).
- Label `Advisor`.
- Active state cuando `pathname?.startsWith("/advisor")`.

## Por qué

1. **Tesis del producto.** MonzaHaus se vende como "intelligence, not a marketplace". El chat con el advisor es la forma interactiva de esa inteligencia — diferenciador clave vs competidores que solo listan precios.
2. **Monetización.** Pistons se gastan principalmente al hacer queries al advisor. Bottom nav lo hace 1-tap desde cualquier pantalla → más conversion al funnel de Pistons.
3. **Retención.** El skill `monzahaus-growth` documenta el advisor como motor de retención. Visibilidad permanente refuerza el hábito.
4. **Precedente UX.** Apps de wealth-tech (Wealthfront, Robinhood) y plataformas con AI conversacional priorizan el chat en la barra inferior.

## Por qué Explore se elimina sin pérdida

| Función original de Explore | Reemplazo |
|---|---|
| Acceso rápido a `/cars/porsche` | `View all 16,382 reports →` al final del feed Home |
| Discovery por marca/familia | `DISCOVER BY FAMILY` chips en Home (911 Family, GT & Hypercars, etc) |
| Browse general | Search sheet (rediseñado — ver `search-redesign.md`) |

## Iconografía

- Icono: `MessageCircle` (Lucide) — clásico chat, cero AI-vibes
- **No usar** Sparkles, Wand2, Bot, Brain (memoria `feedback-no-ai-iconography.md`)

## Active state

```tsx
const isAdvisor = pathname?.startsWith("/advisor")
```

Mismo patrón que `isHome` para consistencia visual del bottom nav.

## Archivos tocados

- `src/components/mobile/MobileBottomNav.tsx` — reemplazo del segundo tab
