# Decision · Desktop Account button — paridad con mobile

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Tesis

El split TÚ vs APP debe sentirse igual en mobile y desktop. En mobile lo hicimos con dos botones (Account abajo, Menu arriba). En desktop había un solo botón (☰ Menu) que mezclaba ambas cosas.

## Antes (desktop)

```
[ MONZAHAUS · Monza/Classic · Search · ALL US UK EU JP · USD · 💎 300 Pistons · 👤 Edgar · 🌐 EN · ☼ · ☰ MENU ]

Click [👤 Edgar] → signOut() directo (terrible UX, te deslogeaba sin querer)
Click [☰ MENU]  → todo: Profile + Pistons + Watchlist + Recent + Sign out
                  + Discover + Plans + Preferences + Help
```

## Ahora (desktop)

```
[ MONZAHAUS · Monza/Classic · Search · ALL US UK EU JP · USD · 💎 300 Pistons · 👤 Edgar · 🌐 EN · ☼ · ☰ MENU ]

Click [👤 Edgar] → ACCOUNT sheet (right side):
                  Profile + Pistons + Watchlist + Recent + Plan + Sign out
Click [☰ MENU]  → MENU sheet (right side):
                  Discover + Plans & Billing + Preferences + Help & Legal
                  (sin Profile/Pistons/SignOut — esos viven en Account)
```

Mismo modelo mental que mobile:
- **Account** = TÚ (datos + acciones sobre tu identidad)
- **Menu** = LA APP (navegar features + preferencias globales)

## Implementación — un solo source of truth

Para evitar duplicación entre mobile bottom-sheet y desktop side-sheet, extraje el contenido del Account a `src/components/account/AccountSheetContent.tsx`:

```tsx
<AccountSheetContent
  onClose={...}
  onOpenAuth={...}
/>
```

El componente renderiza las 6 secciones (Profile, Pistons, Watchlist, Recent reports, Plan, Sign out) con su empty state honest cuando aplica. Auth y unauth states incluidos. Cero hardcoded — usa `useAuth` para leer el profile real.

**Mobile** (`MobileBottomNav.MobileProfileSheet`): wrap en `motion.div` bottom sheet con drag handle.

**Desktop** (`Header.Header` `<Sheet>`): wrap en Radix Sheet right side con SheetHeader Cormorant title.

Cuando agreguemos Watchlist real / Recent reports real desde el backend, **un solo cambio** en `AccountSheetContent` actualiza ambos breakpoints.

## Cambios al Menu hamburger

El bloque `hidden md:block` con Profile + Pistons summary + Sign out **fue eliminado del Menu**. Ahora el Menu es navegación + preferencias en ambos breakpoints. La única diferencia mobile/desktop del Menu es el ancho del Sheet (340px desktop, full-screen mobile).

## El click del avatar

Antes el botón `[👤 Edgar]` en el header desktop tenía `onClick={() => signOut()}`. Eso es trampa: el usuario tap esperando ver su perfil y queda deslogeado.

Ahora `onClick={() => setAccountSheetOpen(true)}` abre el sheet con todo el dashboard personal. Sign out vive **dentro** del sheet, donde lógicamente toca: una acción consciente sobre tu identidad, no un side-effect del primer click.

## Estado sin login

Misma experiencia mobile y desktop:
- Card de Welcome con avatar + Cormorant title + subtítulo
- CTA `Create Free Account` primary
- "Already have an account? Sign in →" secundario

Ambos abren el `AuthModal` (que ya tiene Google + magic link + password collapsible).

## Archivos tocados

- **Nuevo:** `src/components/account/AccountSheetContent.tsx` — single source of truth para el content
- `src/components/mobile/MobileBottomNav.tsx` — `MobileProfileSheet` simplificado a wrapper que usa `AccountSheetContent`
- `src/components/layout/Header.tsx`:
  - import `AccountSheetContent`
  - new state `accountSheetOpen`
  - botón `[👤 Edgar]` desktop ahora `onClick={() => setAccountSheetOpen(true)}` (antes `signOut()`)
  - new `<Sheet>` desktop right side con `<AccountSheetContent>`
  - eliminados los bloques `hidden md:block` con Profile/Pistons summary y Sign out footer del Menu hamburger

## Consistencia visual

| | Mobile | Desktop |
|---|---|---|
| **Account container** | Bottom sheet con drag handle, `max-h-[92dvh]` | Side sheet right, `w-[360px]` |
| **Menu container** | Bottom sheet | Side sheet right, `w-[340px]` |
| **Account content** | `AccountSheetContent` | `AccountSheetContent` |
| **Menu content** | `MenuSection` + `MenuLink` + `ThemeRow` + `LanguageRow` | mismo |
| **Trigger Account** | Bottom nav `[👤 Account]` | Header `[👤 Edgar]` |
| **Trigger Menu** | Header `☰` | Header `☰ MENU` |

Idéntica jerarquía mental, mismo código de contenido.
