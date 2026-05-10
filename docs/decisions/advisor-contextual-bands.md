# Decision · Advisor contextual bands cross-breakpoint

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Tesis

Después del pill `[💬 Advisor]` en el header (commit `ddb3728`), faltaba el siguiente nivel: **CTAs contextuales** en páginas de alta intención que llevan al chat con la pregunta ya pre-poblada. El skill `monzahaus-growth` lo describe así: la conversión a Pistons sube cuando la pregunta llega "con contexto" — no `Hi, can you help?` sino `Tell me about this 964 Jubiläumsmodell, what to verify before bidding`.

## Componente shared

Nuevo `src/components/advisor/AdvisorBand.tsx`. Reusable en mobile y desktop. Props:

```tsx
<AdvisorBand
  eyebrow?         // default "Advisor"
  title?           // default "Need an opinion?"
  subtitle?        // default "Ask anything — from inspection to fair value"
  prompt?          // contextual question, URL-encoded into ?prompt=
  className?
/>
```

Cuando `prompt` está presente, el `<Link>` apunta a `/advisor?prompt=…`. El `AdvisorPageShell` lee ese query param y lo pasa a `AdvisorConversation` como `autoSendOnMount` (prop ya existente). El usuario aterriza dentro de una conversación abierta, sin teclear.

Estilo: typography-led con eyebrow tracking-wide + Cormorant title + subtitle en muted. Cero AI-iconography. Mismo gradient lavender que el `MobileAdvisorBand` original.

## Flow de query param

1. Click en banda → `/advisor?prompt=Tell%20me%20about%20this%201993%20Porsche%20964…`
2. `app/[locale]/advisor/page.tsx` (server component) lee `searchParams.prompt`, lo trim a 300 chars (defensa contra abuse), lo pasa a `<AdvisorPageShell autoSendOnMount={...} />`.
3. `AdvisorPageShell` propaga el prop a `<AdvisorConversation autoSendOnMount={...} />`.
4. `AdvisorConversation` ya tiene una `useEffect` con `autoSentRef` que dispara `stream.send(text, ...)` exactamente una vez en el mount.

Cero cambios de backend. Todo front. El advisor recibe el mensaje como si el usuario lo hubiera tipeado.

## Inyección por página

| Página | Eyebrow | Title | Subtitle | Prompt |
|---|---|---|---|---|
| **Home feed** (mobile + desktop) | `Advisor` | `Need an opinion?` | `Ask anything — from inspection to fair value` | (none) |
| **Home desktop final del feed** | `Advisor` | `Not sure which Porsche fits?` | `The advisor reads the market with you — inspections, fair value, comps.` | (none — discovery handoff) |
| **Car detail** (mobile + desktop) | `Advisor` | `Questions about this one?` | `Inspection points, fair value, what to negotiate.` | `Tell me what to know before buying this {year} {make} {model}{trim}. Inspection priorities, fair value, and red flags.` |
| **Report final** | `Advisor` | `Anything still unclear?` | `The advisor can dig deeper on any signal in this report.` | `I just read the full report on this {year} {make} {model}{trim}. Walk me through the most important risks and what to verify before bidding.` |

Patrón:
- **Mobile home feed**: cada 6 cards (existente — `MobileAdvisorBand` ahora wrap del shared).
- **Desktop home**: una al final del column central, después de todos los `FamilyCard`s. Discovery → ask handoff.
- **Car detail**: una en mobile (al final del scroll continuo) y una en desktop (column central, después del Full Investment Report CTA).
- **Report**: una al final, después de Verdict + Landed Cost. Cuando el usuario consumió el dossier completo, lo más natural es preguntar.

## Por qué no más?

No agregué la banda en `/cars/porsche` (browse list), `/knowledge` ni `/indices`:
- Browse list ya tiene Advisor band en el feed mobile cada 6 cards y el header pill desktop. Doble exposición.
- Knowledge / Indices son páginas de lectura amplia sin "una pieza específica" sobre la cual preguntar — el prompt contextual no aporta sobre el header pill.
- `/get-started` tiene su propio CTA ("Generate your first Porsche report — free →") que ya conecta el funnel.

Si más adelante el data muestra que algún flow específico convierte mejor con banda contextual, agregamos sin tocar el componente.

## Archivos tocados

- **Nuevo:** `src/components/advisor/AdvisorBand.tsx` — single source of truth
- `src/app/[locale]/advisor/page.tsx` — lee `searchParams.prompt`, pasa a Shell
- `src/components/advisor/AdvisorPageShell.tsx` — nueva prop `autoSendOnMount`, pasa a Conversation
- `src/components/dashboard/DashboardClient.tsx`:
  - `MobileAdvisorBand` ahora es un wrapper que renderiza `<AdvisorBand />`
  - Desktop column B: agrega `<AdvisorBand>` al final del feed con copy "Not sure which Porsche fits?"
- `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`:
  - Mobile: `<AdvisorBand>` al final del scroll continuo con prompt contextual
  - Desktop column B: `<AdvisorBand>` después del "Full Investment Report" CTA
- `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`:
  - Al final del report (después de Landed Cost) con prompt contextual

## Tradeoffs

- **Auto-send on mount es una decisión de UX fuerte**: el usuario click la banda y ya está chateando, sin chance de revisar la pregunta antes de enviar. Para nosotros eso es lo correcto — el copy del prompt es nuestro, sabemos que es bueno. Si en algún momento queremos darle al usuario edit-before-send, agregamos una variante `autoFillOnMount` (pre-popular sin enviar).
- **Pistons cost**: cada click consume 1 Piston (instant tier). Como el prompt es bueno, el value es alto. Si en algún flow vemos que los usuarios click sin querer y se quejan del débito, agregamos confirmación.
- **Prompt fijo, no editable por la banda**: si en el futuro queremos prompts dinámicos (por ej. *"compare this with the 996 Turbo"*), podemos extender `AdvisorBand` para aceptar `getPrompt(car)` callback.

## Lo que NO se tocó (back-end intocado, como pediste)

- No se cambió ningún tool del advisor.
- No se cambió `useAdvisorStream`.
- No se cambió la persistencia de conversaciones.
- `autoSendOnMount` ya existía en `AdvisorConversation` — solo lo conectamos.
