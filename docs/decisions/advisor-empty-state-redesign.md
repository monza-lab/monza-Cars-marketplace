# Decision · Advisor mobile chat — empty state editorial + Pistons en vez de Sparkles

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Problema

1. **Empty state insípido.** El chat sin mensajes mostraba 4 chips genéricos `bg-primary/8 px-3 py-1.5` flotando sin jerarquía. Sin contexto de qué hace el advisor, sin marca, sin invitación a actuar.
2. **Sparkles `⭐⭐` en Deep Research.** Icono típico de "AI tool". Memoria `feedback-no-ai-iconography.md`: cero AI-vibes en MonzaHaus. Sparkles choca con la estética Salon.
3. **Send button con número crudo `500`.** Cuando se activaba Deep Research, el botón mostraba solo "500" sin contexto.
4. **i18n key duplicada.** `tierPillDeepResearch` decía `"Deep Research · ~25 Pistons"` con el costo embebido — y mi código sumaba `· 500 Pistons` adicional, resultando en `"Deep Research · ~25 Pistons · 500 Pistons"` (doble).

## Cambios

### Empty state editorial

Antes (chips flotantes):
```
[Compare top 3 997.2 GT3s]  [993 inspection checklist]
[Best 992 value this quarter] [IMS risk by era]
```

Después (jerarquía editorial):
```
            ⌣ Casco MonzaHaus oficial ⌣
            (lavender círculo, 24px, sutil)

            Ask the Advisor               ← Cormorant 22px
   Real-time Porsche intelligence —       ← Karla 12px muted
   inspections, fair value, comps,
   regional arbitrage.

   ───────  TRY ASKING  ───────           ← eyebrow tracking-wide

   ┌─ Compare top 3 997.2 GT3s    → ┐    ← rows estilo "list",
   ├─ 993 inspection checklist    → ┤      no pills; ArrowRight
   ├─ Best 992 value this quarter → ┤      con translate animado
   └─ IMS risk by era             → ┘      al active

   Or type your own question below
```

### Marca

- **Casco oficial MonzaHaus** (`MonzaHausHelmet` con `tone="lavender-deep"`, `size={24}`) en círculo lavender con border `primary/20`. Quiet, no loud — la marca acompaña, no grita.
- Sin Sparkles, sin Wand2, sin Bot.

### Deep Research toggle

Antes:
```
☐ ⭐⭐ Deep Research · ~25 Pistons   PRO only
```

Después:
```
☐ ⚙ Deep Research                   PRO ONLY
```

- Icono `Sparkles` → `Piston` (el icono interno de la marca, ya existe en `components/icons/Piston`). On-brand.
- Color del icono y del label cambian a `text-primary`/`text-foreground` cuando el toggle está activo (feedback visual claro).
- `· 500 Pistons` solo aparece cuando `canDeepResearch === true` (usuario PRO). Free user solo ve "Deep Research" + "PRO ONLY" alineado derecha.

### Send button

Antes (con Deep Research activo):
```
[ 500 ]            ← solo número, sin contexto
```

Después:
```
[ ⚙ 500 ]          ← Piston + número tabular-nums
```

Más rounded (`rounded-2xl`), más alto (`size-11`), `bg-primary` sólido (no `bg-primary/15` débil) — el send button es la acción principal, debe tener peso visual.

### Input area

- Padding interno aumentado (`px-4 py-3`).
- Border más sutil con focus state lavender.
- `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]` — respeta notch iOS.
- `bg-background/95 backdrop-blur-md` — sticky bottom con efecto glass cuando se hace scroll.

### i18n cleanup

`auth.pistons.tierPillDeepResearch` en los 4 locales (en/es/de/ja):
- Antes: `"Deep Research · ~25 Pistons"` (con costo embebido — duplicaba el `· 500 Pistons` que renderizaba el componente)
- Después: solo `"Deep Research"` (en) / `"Investigación Profunda"` (es) / `"Tiefenrecherche"` (de) / `"ディープリサーチ"` (ja). El costo se concatena en el JSX cuando aplica.

## Archivos tocados

- `src/components/advisor/AdvisorConversation.tsx` — empty state editorial, deep research con Piston, send button, input area
- `messages/{en,es,de,ja}.json` — `tierPillDeepResearch` key

## Patrón reutilizable

El empty state pattern (`brand-mark-circle → Cormorant headline → muted subhead → eyebrow divider → list of editorial rows → fallback CTA copy`) puede aplicarse a otros empty states del producto (Watchlist vacía, Saved searches vacías, /search-history) para consistencia editorial.
