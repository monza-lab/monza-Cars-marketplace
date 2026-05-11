# Decision · Header desktop cleanup, Editorial Salon edition

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Síntoma

El header desktop tenía **11 elementos** apretados en una sola row de ~1280px:

```
[MONZAHAUS] [Monza|Classic] [search…] [ALL US UK EU JP] [$ USD ▾]
[🔧 0 Pistons] [💬 Advisor] [👤 Edgar] [🌐 EN] [🌗] [☰ MENU]
```

Edgar lo describió: *"el menú de arriba quedó súper pesado… ni siquiera el search bar se alcanza a ver la letra bien"*. El search era `flex-1 max-w-xl` pero los pills de Region + Currency le robaban la mitad del ancho disponible.

## Causa raíz

Cada feature se fue agregando sin auditar duplicación ni contexto:
- **Theme toggle** y **LanguageSwitcher** ya vivían dentro del Menu sheet (sección Preferences) — tenerlos también en el header era duplicación pura.
- **Currency dropdown** es preferencia personal, no acción de header — no aporta sobre 90% de las páginas.
- **Region pills** sólo filtran cuando hay listings que filtrar (`/cars/{make}` y `/browse`). En home, advisor, report, tools, etc. eran ruido.
- **Monza/Classic toggle** sólo tiene sentido en home, donde la dual-feed view es la UX. En `/advisor` o `/cars/{id}/report` no aportaba.

## Decisión: Editorial Salon — route-aware header

Header se adapta a la ruta. Cada control vive sólo donde aplica.

### Esenciales (siempre presentes)

| Elemento | Por qué siempre |
|---|---|
| **MONZAHAUS wordmark** | Identidad — link a home |
| **Search** | Entry point primario al producto |
| **🔧 Pistons** (auth) | Moneda — debe estar visible cuando el user tiene balance |
| **💬 Advisor** | Funnel principal a Pistons (commit `ddb3728`) |
| **👤 Account** (auth) / **Sign in** (anon) | TÚ side del split TÚ vs APP |
| **☰ MENU** | APP side — navegación + preferencias |

### Route-aware (sólo donde aplican)

| Elemento | Visible en | Oculto en |
|---|---|---|
| **Monza \| Classic** ViewToggle | `/` y `/{locale}` (home) | resto |
| **ALL US UK EU JP** Region pills | `/cars/{make}` y `/browse` | resto |

### Movidos al Menu › Preferences

- **Theme** (ThemeRow — ya existía)
- **Language** (LanguageRow — ya existía)
- **Currency** (CurrencyRow — nuevo, mismo patrón)

Tres preferencias en un solo lugar coherente. El user que quiera cambiar tema, idioma o moneda lo encuentra en el mismo sheet.

## Resultado por ruta

```
/  (home) — 7 elementos
[MONZAHAUS] [Monza|Classic] [search……………………………………] 
[🔧 Pistons] [💬 Advisor] [👤 Edgar] [☰ MENU]

/cars/porsche — 7 elementos
[MONZAHAUS] [search…………………] [ALL US UK EU JP] 
[🔧 Pistons] [💬 Advisor] [👤 Edgar] [☰ MENU]

/advisor, /pricing, /cars/{id}, /cars/{id}/report — 6 elementos
[MONZAHAUS] [search………………………………………………………] 
[🔧 Pistons] [💬 Advisor] [👤 Edgar] [☰ MENU]
```

Search bar siempre respira. El user nunca pierde acceso a nada — todo lo "quitado" sigue accesible, sólo en su lugar correcto.

## Implementación

`src/components/layout/Header.tsx`:

```tsx
const isHomePage = /^\/(?:[a-z]{2})?\/?$/.test(pathname);
const isCarsListPage = /^\/(?:[a-z]{2}\/)?cars\/[^/]+\/?$/.test(pathname);
const showViewToggle = isHomePage;
const showRegionPills = isCarsListPage || isBrowsePage;
```

Luego:
- `{showViewToggle && <ViewToggle />}`
- `{showRegionPills && (<div>...REGIONS.map...</div>)}`
- Removidos del header: `<LanguageSwitcher />`, theme toggle button, `<CurrencyDropdown />`
- Agregado `function CurrencyRow()` que envuelve `<CurrencyDropdown />` con label, mismo patrón que `LanguageRow` / `ThemeRow`
- Agregado `<CurrencyRow />` dentro del `<MenuSection label="Preferences">`

Imports limpiados: `LanguageSwitcher`, `Sun`, `Moon`, `useTheme()` (la var local) — solo lo que ya no se usa.

## Por qué NO Apple-minimalist (la opción C)

La opción "máxima poda" mergeaba Pistons dentro del Account button (`👤 Edgar · 24 ⚡`). Lo descarté porque:

1. **Pistons es la moneda del producto.** Ocultar el balance dentro del Account button reduce su visibilidad — y el balance es precisamente la señal que dispara la conversión a top-up / Monthly. El skill `monzahaus-monetization` enfatiza que el balance siempre debe estar a la mano.
2. **El click-to-wallet directo es valor.** Click en `🔧 0 Pistons` abre `PistonsWalletModal` con todo el contexto (balance, today usage, recent debits, upgrade CTA). Si lo metemos en Account, se vuelve un sub-camino de un sub-camino.
3. **El header después del cleanup ya respira.** No había razón de empujar más cuando el problema (search ahogado) ya estaba resuelto.

## Lo que NO se tocó

- AccountSheetContent: sigue siendo la TÚ side, intocada.
- Mobile bottom nav: ya estaba limpio (Home · Advisor · Search · Account).
- Free user CTA banner (sobre el header): keep — se justifica porque comunica balance crítico.
