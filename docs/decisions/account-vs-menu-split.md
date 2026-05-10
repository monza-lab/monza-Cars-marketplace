# Decision · Account (bottom nav) vs Menu (☰) — split por modelo mental

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Problema

Antes ambos botones servían info muy similar:

| Sección | Menu ☰ | Account |
|---|---|---|
| Profile card | ✅ | ✅ |
| Pistons balance + Buy | ✅ | ✅ |
| Watchlist | ✅ (vacía) | ❌ |
| Recent analyses | ✅ | ❌ |
| Sign in/out | ✅ | ✅ |
| Theme | ❌ | ✅ |
| Language | ❌ | ✅ |
| Discover features | ❌ | ❌ |

~70% overlap en lo personal. Knowledge/Indices/Tools/Pricing sin home en navegación.

## Modelo mental

**Account = "TÚ"** — tu data, tu balance, acciones sobre vos mismo.
**Menu ☰ = "LA APP"** — navegar a features + preferencias globales.

## Account (bottom sheet)

Profile card → Pistons balance + Buy → Watchlist (empty honest) → Recent reports (empty honest + Browse CTA) → Current plan + Upgrade/Manage → Sign out.

Sin login: Welcome + Create Free Account + Sign in link.

## Menu ☰ (sheet right)

- **DISCOVER**: Porsche collection · Knowledge guides · Market indices · Market trends · VIN decoder · How to buy a Porsche
- **PLANS & BILLING**: Pricing & Pistons · Billing & history (auth-only)
- **PREFERENCES**: Theme (Light/Dark/System) · Language (EN/ES/DE/JA)
- **HELP & LEGAL**: Talk to the advisor · Privacy · Terms
- Footer: MonzaHaus · v1.0

## Reglas de división

1. Account = entidades del usuario. Menu = navegación + app prefs.
2. Theme/Language → Menu (preferencias de app, no de persona).
3. Pistons "Buy" en Account ("recargá tu balance"). Pricing page en Menu (descubrir tiers).
4. Sign in/out en Account (acción sobre identidad).
5. Header `☀` = Light↔Dark 1-tap. Menu = 3 modos completos. Sin duplicación funcional.

## Modo desktop

NO hay bottom nav en desktop, así que el Menu es la única puerta al usuario. Por eso el Profile card + Pistons summary + Sign Out están en el Menu envueltos en `hidden md:block` — mobile no los ve (viven en Account), desktop sí.

## Backend pendiente

Watchlist y Recent reports muestran empty states honest hasta que existan:
- `/api/user/watchlist` GET
- `/api/user/recent-reports` GET

UI ya estructurada para `useEffect` lazy-load cuando los endpoints estén.

## Tradeoffs

- Account se densifica (~92dvh con scroll interno). Aceptable, es un sheet.
- Menu se vuelve hub de navegación real. Knowledge/Indices/VIN Decoder dejan de estar perdidos.
- Sign in/out sigue accesible desde el header desktop y Account mobile.

## Helpers reusables

`MenuSection`, `MenuLink`, `ThemeRow`, `LanguageRow` en `Header.tsx` a nivel module.

## Archivos tocados

- `src/components/mobile/MobileBottomNav.tsx` — `MobileProfileSheet` rediseñado. Removidos `useTheme` + `MobileLanguageSwitcher`.
- `src/components/layout/Header.tsx` — Sheet rediseñado. Profile/Pistons/SignOut sólo `md:block`. Nuevos imports: BookOpen, Wrench, ScrollText, MessageCircle.
