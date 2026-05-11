# Decision · Advisor tool calls — editorial labels en vez de log técnico

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Antes

Cuando el advisor llamaba a un tool durante una respuesta streaming, debajo del mensaje aparecía:

```
✓ search_listings: Found 0 matches for series=997, variant=turbo; top 3: none
```

Problemas:
1. **Lee como error log** — checkmark + nombre técnico + "Found 0 matches" hace pensar al usuario que algo falló o que el producto no funcionó.
2. **Expone implementación interna** — `search_listings`, `compute_price_position`, `get_comparable_sales` son nombres de funciones, no UX.
3. **Duplica info** — el advisor ya narra el outcome en su respuesta natural ("Aún no veo ningún 997 Turbo en el inventario actual…"). Mostrar el raw también es ruido.

## Ahora

Cada tool call rendea con **frase editorial** alineada a voz de marca:

```
• Browsing listings…              ← loading: dot pulsing primary
— Browsed listings                ← done: em-dash sutil, sin checkmark
```

- **Loading state:** punto lavender pulsing (`animate-pulse`) + label en presente continuous + ellipsis animado.
- **Done state:** em-dash en `muted-foreground/60` + label en past simple.
- **Sin checkmark `✓`** (lee como log técnico). Sin nombre del tool. Sin summary técnico.

## Mapeo (17 tools)

| Tool técnico | Loading | Done |
|---|---|---|
| `search_listings` | Browsing listings | Browsed listings |
| `get_listing` | Pulling listing details | Read listing |
| `get_comparable_sales` | Finding comparable sales | Compared sales |
| `get_price_history` | Reviewing price history | Reviewed history |
| `get_regional_valuation` | Comparing US/EU/UK/JP | Compared regions |
| `compute_price_position` | Locating fair-value position | Located in range |
| `get_series_profile` | Reading the series profile | Read series |
| `list_knowledge_topics` | Looking through guides | Searched guides |
| `get_knowledge_article` | Opening the guide | Read guide |
| `get_variant_details` | Pulling variant details | Read variant |
| `get_inspection_checklist` | Reviewing inspection checklist | Read checklist |
| `assess_red_flags` | Checking red flags | Checked red flags |
| `compare_listings` | Comparing listings | Compared listings |
| `web_search` | Searching the web | Searched the web |
| `fetch_url` | Fetching reference | Read reference |
| `trigger_report` | Triggering full report | Report triggered |
| `navigate_to` | Navigating | Navigated |

**Fallback** (tool no mapeado): `snake_case → Sentence case` + ellipsis cuando loading. Esto garantiza que un tool nuevo nunca rompa la UI ni exponga el `_` underscore.

## Voz / criterio

- **Verbos en gerundio para loading**, en pasado para done — feel "asistente que está actuando" vs "log técnico que pasó".
- **Sin números crudos.** Si el tool devuelve `Found 0 matches`, eso lo dice el advisor en su respuesta natural ("Todavía no veo ningún 997 Turbo en EU…"). El indicator no.
- **Curado, no genérico.** Se evitan labels tipo "Loading…" o "Searching…" — se nombra el dominio (listings, comparables, guides).

## Debug en development

`process.env.NODE_ENV !== 'production'` muestra el `summary` raw (truncado a 60 chars) al final del row, en `text-muted-foreground/50`. Útil para verificar qué devolvió el tool durante desarrollo. **Nunca visible en producción.**

## Archivos tocados

- `src/components/advisor/AdvisorConversation.tsx` — `MessageBubble` + nuevo `ToolCallRow` + `TOOL_LABELS` + `formatToolCallLabel` + `SHOW_TOOL_DEBUG` flag

## Cambios futuros sugeridos (no en este pase)

- Si un tool comienza a tener una "razón" estable que el usuario quiera ver (ej. `web_search` mostrando la query usada: `Searching the web for "997 turbo VIN ranges"`), expandir el mapeo de "done" para aceptar templates con argumentos. Pero solo cuando aporte valor — **nunca exponer el JSON crudo**.
