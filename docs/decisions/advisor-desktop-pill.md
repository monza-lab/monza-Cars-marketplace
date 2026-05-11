# Decision · Advisor pill en header desktop

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Problema

En mobile el Advisor está siempre a 1-tap (bottom nav), porque es el motor de retención y conversión a Pistons (skill `monzahaus-growth`). En desktop estaba **escondido** en `Menu ☰ → Help & Legal → Talk to the advisor`. Tres clicks para llegar al feature más diferencial del producto.

## Cambio

Agregado pill `[💬 Advisor]` en el header desktop, entre el Pistons pill y el Account button:

```
[ MONZAHAUS · Monza/Classic · Search · Regions · USD · 💎 300 Pistons · 💬 Advisor · 👤 Edgar · 🌐 EN · ☼ · ☰ MENU ]
                                                                       ↑
                                                              outline lavender
                                                              active when /advisor
```

### Estados visuales

- **Inactive** (`/advisor` no es la ruta actual): outline `border-primary/30 text-primary/85`. Hover llena con `bg-primary/10`.
- **Active** (`pathname.startsWith("/advisor")`): filled `bg-primary/15 border-primary/30 text-primary`.

Cambio visible al navegar — UX clara: sabés cuándo estás dentro del Advisor.

### Por qué outline (no filled primary)

El header ya tiene varios CTAs:
- Pistons pill (filled foreground/5 con icono amber)
- Account button (avatar circular)
- Sign In button (filled primary, solo cuando unauth)

Si el Advisor también fuese filled primary, competiría con el Sign In en visibilidad. Outline lavender lo hace prominente sin gritar — la jerarquía queda: `Account/Sign In` (primary) > `Advisor` (outline lavender) > resto.

### Por qué MessageCircle y no el casco

El casco oficial de MonzaHaus es el **wordmark del producto entero**. El Advisor es una feature dentro del producto. Mezclar el mark de marca con un feature crea confusión visual (¿qué es MonzaHaus, qué es Advisor?). `MessageCircle` (Lucide) es chat clásico, cero AI-vibes — alineado con `feedback-no-ai-iconography`.

## El chat ya estaba listo para desktop

Lo bueno: el redesign del empty state que hice para mobile (commit `07360d4`) funcionaba **igual de bien en desktop** porque las clases son responsive. Verificado visualmente:

- ✅ Casco MonzaHaus en círculo lavender (top center)
- ✅ Cormorant `Ask the Advisor`
- ✅ Subtítulo `Real-time Porsche intelligence — inspections, fair value, comps, regional arbitrage`
- ✅ Eyebrow `── TRY ASKING ──`
- ✅ 4 suggestion list rows estilo card (no pills) con `→` animado
- ✅ `Or type your own question below`
- ✅ Deep Research toggle con icono Piston (no Sparkles)
- ✅ Sidebar izquierda con lista de conversaciones previas (cuando hay)

El usuario nunca llega a un "chat en blanco" — siempre hay copy editorial + sugerencias + invitación clara. Mismo trato que mobile.

## Tabla comparativa

| | Mobile | Desktop |
|---|---|---|
| **Acceso al Advisor** | Bottom nav `[💬 Advisor]` 1-tap | Header `[💬 Advisor]` 1-click |
| **Active state** | Pill llena lavender cuando `/advisor` | Pill llena lavender cuando `/advisor` |
| **Chat empty state** | Casco + Cormorant + 4 suggestions + Deep Research + input | Mismo (responsive) |
| **Sidebar conversaciones** | Drawer (oculto detrás de "≡ New chat") | Sidebar visible 260px |
| **Tool call labels** | Editorial (`Browsing listings…` / `— Read listing`) | Editorial (mismo componente) |

## Archivos tocados

- `src/components/layout/Header.tsx` — pill insertado entre Pistons y Account, con active state basado en `pathname.startsWith("/advisor")`. Solo desktop (`hidden md:inline-flex`); mobile sigue usando el bottom nav.

## Pendientes (para iteraciones futuras)

- **Bandas contextuales en desktop**: el `MobileAdvisorBand` se inyecta cada 6 cards en el feed home mobile. Para desktop habría que agregarla en lugares de alta intención: car detail (`/cars/{id}`), report (`/cars/{id}/report`), tools (`/tools/...`) con prompt pre-poblado tipo *"Ask the advisor about this 1996 993 Turbo →"*. La componente `MobileAdvisorBand` ya está construida — solo es renombrarla y quitar el contexto `md:hidden`.
- **Floating action button**: descartado — choca con tesis Salon (muy AI-tool/Intercom feel).
