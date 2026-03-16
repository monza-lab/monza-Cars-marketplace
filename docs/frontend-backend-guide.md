# Guía Frontend → Backend — Monza Cars Marketplace

Documento para el desarrollador backend. Explica de dónde viene cada dato que muestra la UI, qué lee el frontend de la base de datos, qué está hardcodeado temporalmente, y qué necesita datos reales.

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE (DB)                            │
│  Tabla: listings                                                │
│  Campos que lee el frontend:                                    │
│  id, year, make, model, trim, source, source_url, status,      │
│  country, hammer_price, current_bid, bid_count, end_time,       │
│  images, engine, transmission, mileage, mileage_unit,           │
│  color_exterior, color_interior, platform, final_price,         │
│  location, vin, description_text, body_style, seller_notes      │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
   ┌───────────────────────┐          ┌────────────────────────┐
   │ /api/mock-auctions    │          │ page.tsx (MakePage)     │
   │ (API Route)           │          │ Server Component        │
   │ Alimenta: Dashboard   │          │ Alimenta: /cars/porsche │
   └───────────┬───────────┘          └────────────┬───────────┘
               │                                   │
               ▼                                   ▼
   ┌───────────────────────┐          ┌────────────────────────┐
   │ DashboardClient.tsx   │          │ MakePageClient.tsx      │
   │ (Landing page /)      │          │ (/cars/porsche)         │
   └───────────────────────┘          └────────────────────────┘
```

---

## 2. Tabla `listings` — Qué Necesita el Frontend

### Campos OBLIGATORIOS (sin estos no se muestra el carro)

| Campo | Tipo | Ejemplo | Notas |
|-------|------|---------|-------|
| `id` | string | `"abc-123"` | Identificador único |
| `year` | number | `2023` | Año del vehículo |
| `make` | string | `"Porsche"` | **Case-insensitive** — se busca con `ilike` |
| `model` | string | `"911 GT3 RS"` | Se usa para clasificar en serie/familia |
| `status` | string | `"active"` | **CRÍTICO**: solo se muestran los que tienen `status = "active"` |
| `source` | string | `"BaT"` | Plataforma de origen (ver sección 5) |

### Campos de PRECIO (al menos uno debe tener valor > 0)

| Campo | Tipo | Prioridad | Notas |
|-------|------|-----------|-------|
| `current_bid` | number | 1ra | Bid actual en subastas activas |
| `hammer_price` | string/number | 2da | Precio de venta final |
| `final_price` | number | 3ra | Precio final alternativo |

**Lógica del frontend** (archivo `supabaseLiveListings.ts`, línea ~380):
```
precio = current_bid > 0 ? current_bid
       : hammer_price > 0 ? hammer_price
       : final_price > 0 ? final_price
       : 0
```

Si los 3 son 0 o null, el carro aparece con precio "$0" y sin barras de valuación.

### Campos OPCIONALES (mejoran la UI pero no son obligatorios)

| Campo | Tipo | Dónde se muestra |
|-------|------|-----------------|
| `trim` | string | Título del carro, variant chips |
| `images` | string[] | Fotos en cards y detalle. Si es `null`, busca en `photos_media` |
| `engine` | string | Ficha técnica |
| `transmission` | string | Ficha técnica + filtro de transmisión |
| `mileage` | number | Ficha técnica |
| `mileage_unit` | string | `"mi"` o `"km"` |
| `country` | string | Determina la **región** del carro (ver sección 4) |
| `platform` | string | Badge de plataforma en la card |
| `bid_count` | number | Contador de bids en la card |
| `end_time` | string (ISO) | Countdown timer en la card |
| `location` | string | Texto de ubicación |
| `color_exterior` | string | Filtro de color |
| `color_interior` | string | Ficha técnica |
| `body_style` | string | Ayuda a clasificar body type (Targa, Cabrio, etc.) |
| `source_url` | string | Link "View on [platform]" |
| `vin` | string | Ficha técnica |
| `description_text` | string | Descripción en detalle |

---

## 3. Familias y Series — brandConfig.ts (HARDCODEADO)

**Archivo**: `src/lib/brandConfig.ts`

Este archivo contiene la taxonomía completa de Porsche. El frontend clasifica cada carro en una **serie** basándose en el campo `model` de la DB.

### Cómo funciona la clasificación

```typescript
// El frontend hace esto con cada carro:
const seriesId = extractSeries(car.model, car.year, "Porsche")
// Ejemplo: extractSeries("911 GT3 RS", 2023, "Porsche") → "992"
```

**Paso 1**: Busca keywords en el `model` string:
- `model` contiene "992" → serie `992`
- `model` contiene "cayenne" → serie `cayenne`
- `model` contiene "gt4 rs" → serie `718-cayman`

**Paso 2**: Si no encuentra keyword, usa el `year` como fallback:
- `model` = "911 Carrera" + `year` = 2021 → serie `992` (porque 2019-2026 = rango del 992)

### Las 27 series definidas

| Serie ID | Label | Familia | Años | Keywords en `model` |
|----------|-------|---------|------|---------------------|
| `992` | 992 | 911 Family | 2019-2026 | "992" |
| `991` | 991 | 911 Family | 2012-2019 | "991" |
| `997` | 997 | 911 Family | 2005-2012 | "997" |
| `996` | 996 | 911 Family | 1998-2005 | "996" |
| `993` | 993 | 911 Family | 1994-1998 | "993" |
| `964` | 964 | 911 Family | 1989-1994 | "964" |
| `930` | 930 Turbo | 911 Family | 1975-1989 | "930" |
| `g-model` | 911 SC/Carrera (G) | 911 Family | 1974-1989 | "911 sc", "carrera 3.2" |
| `f-model` | 911 (F-Model) | 911 Family | 1963-1973 | "911s", "911t", "911e" |
| `912` | 912 | 911 Family | 1965-1969 | "912" |
| `918` | 918 Spyder | GT & Hypercars | 2013-2015 | "918" |
| `carrera-gt` | Carrera GT | GT & Hypercars | 2004-2007 | "carrera gt" |
| `959` | 959 | GT & Hypercars | 1986-1993 | "959" |
| `718-cayman` | 718 Cayman | Mid-Engine | 2016-2026 | "718 cayman" |
| `718-boxster` | 718 Boxster | Mid-Engine | 2016-2026 | "718 boxster" |
| `cayman` | Cayman (981/987) | Mid-Engine | 2005-2016 | "cayman" |
| `boxster` | Boxster (986/987/981) | Mid-Engine | 1996-2016 | "boxster" |
| `914` | 914 | Mid-Engine | 1969-1976 | "914" |
| `944` | 944 | Transaxle Classics | 1982-1991 | "944" |
| `928` | 928 | Transaxle Classics | 1978-1995 | "928" |
| `968` | 968 | Transaxle Classics | 1992-1995 | "968" |
| `924` | 924 | Transaxle Classics | 1976-1988 | "924" |
| `356` | 356 | Heritage | 1948-1965 | "356" |
| `cayenne` | Cayenne | SUV & Sedan | 2003-2026 | "cayenne" |
| `macan` | Macan | SUV & Sedan | 2014-2026 | "macan" |
| `panamera` | Panamera | SUV & Sedan | 2009-2026 | "panamera" |
| `taycan` | Taycan | SUV & Sedan | 2020-2026 | "taycan" |

### 6 Grupos de Familias (landing page)

| Grupo | Series que incluye |
|-------|--------------------|
| 911 Family | 992, 991, 997, 996, 993, 964, 930, g-model, f-model, 912 |
| GT & Hypercars | 918, carrera-gt, 959 |
| Mid-Engine | 718-cayman, 718-boxster, cayman, boxster, 914 |
| Transaxle Classics | 944, 928, 968, 924 |
| Heritage | 356 |
| SUV & Sedan | cayenne, macan, panamera, taycan |

### Para el backend: qué implica esto

- **No necesitas** meter la familia/serie en la DB — el frontend la calcula del `model` + `year`
- **Sí necesitas** que el campo `model` tenga el nombre del modelo de forma legible (ej: "911 GT3 RS", "Cayenne Turbo", "718 Cayman GT4")
- Si el `model` dice solo "Porsche" sin especificar, el carro queda sin clasificar
- Si el `model` dice "911 Carrera" sin generación, se usa el `year` para asignarla

---

## 4. Regiones — Cómo se Asigna la Región a Cada Carro

### Por campo `country` de la DB

```typescript
// supabaseLiveListings.ts línea 291-298
function mapRegion(country: string | null): Region {
  if (!country) return "US"                                    // null → US
  const c = country.toUpperCase()
  if (c === "USA" || c === "US" || c === "UNITED STATES") return "US"
  if (c === "UK" || c === "UNITED KINGDOM") return "UK"
  if (c === "JAPAN") return "JP"
  return "EU"                                                  // todo lo demás → EU
}
```

**IMPORTANTE**: Si mandas `country = "United States"` (con "United" en vez de "US"), cae en "EU" porque no matchea. Valores seguros:

| Region | Valores aceptados en `country` |
|--------|-------------------------------|
| US | `"US"`, `"USA"`, `"UNITED STATES"` |
| UK | `"UK"`, `"UNITED KINGDOM"` |
| JP | `"JAPAN"` |
| EU | Todo lo demás: `"Germany"`, `"France"`, `"Italy"`, `null`, etc. |

### Conteos por región (header badges)

El frontend también cuenta carros por **plataforma** para los badges de región:

| Plataforma (`source`) | Región asignada |
|----------------------|-----------------|
| BaT, CarsAndBids | US |
| AutoScout24, CollectingCars | EU |
| AutoTrader | UK |
| BeForward | JP |

---

## 5. Plataformas/Sources — Aliases Aceptados

El frontend reconoce estas variaciones del campo `source`:

| Canónico | Aliases aceptados |
|----------|-------------------|
| `BaT` | "BaT", "BAT", "bat", "BringATrailer", "BRING_A_TRAILER", "bringatrailer" |
| `AutoScout24` | "AutoScout24", "AUTOSCOUT24", "autoscout24", "AUTO_SCOUT_24", "AutoScout" |
| `AutoTrader` | "AutoTrader", "AUTOTRADER", "auto_trader", "AUTO_TRADER" |
| `BeForward` | "BeForward", "BEFORWARD", "be_forward", "BE_FORWARD" |
| `CarsAndBids` | "CarsAndBids", "CARS_AND_BIDS", "carsandbids" |
| `CollectingCars` | "CollectingCars", "COLLECTING_CARS", "collectingcars" |

Si mandas un `source` que no está en esta lista, el carro se intenta cargar pero puede fallar el conteo.

---

## 6. Flujo de Datos: Landing Page (Dashboard)

```
Browser → GET /api/mock-auctions?limit=400
       → API Route llama: fetchLiveListingsAsCollectorCars() + fetchLiveListingAggregateCounts()
       → Supabase: SELECT de listings WHERE make ilike 'Porsche' AND status = 'active'
       → Respuesta JSON con: auctions[] + aggregates { liveNow, regionTotals }
       → DashboardClient.tsx recibe auctions[] y renderiza
```

**DashboardClient muestra:**
- Family cards (911 Family, Cayenne, etc.) — clasificadas con `brandConfig.ts`
- Live Bids sidebar — los carros con `currentBid > 0`
- Conteos por región — de `aggregates.regionTotals`

---

## 7. Flujo de Datos: Make Page (/cars/porsche)

```
Browser → /en/cars/porsche
       → page.tsx (Server Component) llama:
           1. fetchLiveListingsAsCollectorCars({ make: "Porsche", status: "active" })
           2. fetchSoldListingsForMake("Porsche")
           3. fetchLiveListingAggregateCounts({ make: "Porsche" })
       → Pasa cars[], liveRegionTotals, dbSoldHistory a MakePageClient
       → MakePageClient clasifica por serie/familia y renderiza
```

**MakePageClient muestra:**
- Column A: Lista de series con conteos (claculado del array de cars)
- Column B: Cards de carros filtrados
- Column C: Valuación, market depth, ownership cost

---

## 8. Lo Que Está HARDCODEADO (Temporal) — Reemplazar con Datos Reales

### 8.1 Regional Market Premiums ⚠️

**Archivo**: `src/lib/regionPricing.ts`

```typescript
export const REGIONAL_MARKET_PREMIUM: Record<string, number> = {
  US: 1.0,    // base
  EU: 1.08,   // +8%
  UK: 1.15,   // +15%
  JP: 0.85,   // -15%
}
```

**Qué hace**: Multiplica el precio USD de cada carro por estos factores para simular diferencia de precios entre mercados. Ejemplo: un carro de $100K se muestra como $100K en US, $108K equivalente en EU, $115K en UK, $85K en JP.

**Por qué existe**: El frontend recibía UN solo precio en USD y las barras de "Valuation by Market" salían todas iguales. Se agregó este multiplicador para que visualmente se vean diferentes.

**Cómo reemplazarlo**: Si la DB tiene precios reales por región (ej: `price_usd`, `price_eur`, `price_gbp`, `price_jpy`), el frontend puede leer esos campos directamente y eliminar los multiplicadores.

### 8.2 Fair Value Range (±20%)

**Archivo**: `src/lib/regionPricing.ts`, líneas 46-47

```typescript
const low = usdPrice * 0.8   // -20%
const high = usdPrice * 1.2  // +20%
```

**Qué hace**: Para cada carro, genera un rango de "fair value" de ±20% del precio actual.

**Cómo reemplazarlo**: Si tienes valuaciones reales (comparables, historial de ventas), manda `fair_value_low` y `fair_value_high` por carro.

### 8.3 Currency Exchange Rates

**Archivo**: `src/lib/regionPricing.ts`, líneas 12-25

```typescript
export const TO_USD_RATE = { "$": 1, "€": 1.08, "£": 1.27, "¥": 0.0067 }
export const FROM_USD_RATE = { "$": 1, "€": 1/1.08, "£": 1/1.27, "¥": 1/0.0067 }
```

**Qué hace**: Convierte precios entre monedas con tasas fijas.

**Cómo reemplazarlo**: Mandar tasas de cambio actualizadas desde el backend, o almacenar precios nativos en cada moneda.

### 8.4 5-Year Appreciation Rates

**Archivo**: `src/components/dashboard/DashboardClient.tsx` (dentro del useMemo `regionalVal`)

```typescript
const regionAppreciation = { US: 0.22, UK: 0.28, EU: 0.18, JP: 0.12 }
```

**Qué hace**: Muestra "+22% 5Y", "+28% 5Y", etc. al lado de cada barra de región. Son valores inventados.

**Cómo reemplazarlo**: Calcular apreciación real con datos históricos de ventas por región.

### 8.5 Investment Grade

**Archivo**: `src/lib/supabaseLiveListings.ts`, función `computeGrade()`

```typescript
// Fórmula basada en: make (premium/mid), age (vintage/classic), price tier
// Genera: AAA, AA, A, B+, B, C
```

**Qué hace**: Asigna un "Investment Grade" a cada carro basado en reglas simples (marca premium + antigüedad + precio alto = mejor grado).

**Cómo reemplazarlo**: Si tienes un scoring más sofisticado, manda `investment_grade` como campo en la tabla `listings`.

### 8.6 Ownership Costs

**Archivo**: `src/lib/brandConfig.ts`

```typescript
ownershipCosts: { insurance: 8500, storage: 6000, maintenance: 8000 }
```

**Son valores fijos para toda la marca Porsche.** Si hay datos reales por modelo/año, se pueden parametrizar.

### 8.7 Market Depth

**Archivo**: `src/lib/brandConfig.ts`

```typescript
marketDepth: { auctionsPerYear: 340, avgDaysToSell: 12, sellThroughRate: 89, demandScore: 9 }
```

**Valores fijos** para Porsche en general. Si tienes datos reales de sell-through rate, demand score, etc., se pueden conectar.

---

## 9. Lo Que Está ESTABLE y No Va a Cambiar

Estas partes de la UI ya están finalizadas. Puedes alimentarlas con datos:

| Componente | Qué muestra | De dónde viene el dato |
|-----------|-------------|----------------------|
| **Family cards** (landing) | 911 Family, Cayenne, etc. con conteo de carros | `brandConfig.ts` (clasificación) + `listings` (carros) |
| **Car cards** (feed) | Foto, título, precio, bids, timer, platform badge | Campos de `listings`: images, title/model, current_bid, bid_count, end_time, platform |
| **Series nav** (sidebar) | Lista de 992, 991, 997... con conteos | `brandConfig.ts` (definiciones) + `listings` (conteo por model match) |
| **Filtros** | Precio, año, mileage, transmisión, body type, color, status | Campos de `listings`: current_bid, year, mileage, transmission, body_style, color_exterior, status |
| **Region selector** (header) | US / EU / UK / JP con conteos | `country` de `listings` + conteo por `source` |
| **Search bar** | Autocomplete de series/variantes | `brandConfig.ts` (no necesita DB) |
| **Variant chips** | GT3, Turbo, Carrera, GTS pills | `brandConfig.ts` variants + `model`/`trim` de `listings` |

---

## 10. Checklist para el Backend

### Para que aparezcan carros correctamente:

- [ ] Cada carro tiene `status = "active"` (exactamente así, en minúsculas)
- [ ] `make = "Porsche"` (case-insensitive, el frontend usa `ilike`)
- [ ] `model` tiene el nombre legible del modelo (ej: "911 GT3 RS", NO "P992-GT3RS")
- [ ] Al menos uno de `current_bid`, `hammer_price`, `final_price` > 0
- [ ] `source` es uno de los aliases reconocidos (ver sección 5)
- [ ] `country` usa valores estándar: "US", "USA", "UK", "JAPAN", o nombre europeo

### Para que los conteos de región sean correctos:

- [ ] Carros de BaT → `source = "BaT"` (contado como US)
- [ ] Carros de AutoScout24 → `source = "AutoScout24"` (contado como EU)
- [ ] Carros de AutoTrader → `source = "AutoTrader"` (contado como UK)
- [ ] Carros de BeForward → `source = "BeForward"` (contado como JP)

### Para imágenes:

- [ ] `images` es un array de URLs: `["https://...", "https://..."]`
- [ ] Si `images` es null, el frontend busca en la relación `photos_media(photo_url)`
- [ ] Si ambos están vacíos, se muestra un placeholder gris

---

## 11. Próximo Paso: Branch `First-Mobile`

1. **Backend** hace merge de `UI-UX-5.0` → `main`
2. **Backend** verifica que los datos de `listings` cumplen el checklist (sección 10)
3. **Frontend** crea `First-Mobile` desde `main` ya actualizado
4. Se trabaja la versión mobile sobre esa base

---

*Última actualización: 27 Feb 2026 — Branch UI-UX-5.0*
