# Few-shot examples

Each example shows: a condensed user-prompt input, followed by the exact JSON response you would return. These demonstrate the voice, the locale handling, the honest-small-output pattern, and the non-overlap between headline and highlights.

## Example 1 — rich source, English output

**Input (condensed):**
- Year: 2011, Make: Porsche, Model: 911 GT3
- Mileage: 9,321 mi, Exterior: Carrara White, Interior: Black leather
- Engine: 3.8L flat-six, Transmission: 6-speed manual
- Location: Japan, Platform: BEFORWARD
- Seller description (excerpt): "Two owners from new. Full Porsche main-dealer service history with 11 stamps. Recent IMS inspection and fresh oil service. Original paint throughout, confirmed with paint-depth readings."
- Locale: `en`

**Output:**

```json
{
  "headline": "A two-owner 2011 911 GT3 in Carrara White, currently in Japan, with original paint and a complete main-dealer service book.",
  "highlights": [
    "Eleven stamps in the Porsche main-dealer service book.",
    "Original paint confirmed by paint-depth measurements.",
    "Recent IMS inspection and fresh oil service on file.",
    "9,321 miles from new; 6-speed manual."
  ]
}
```

Notice: the headline says "two-owner" once; no highlight repeats it. The highlights add facts the headline couldn't fit.

## Example 2 — sparse source, Spanish output

**Input (condensed):**
- Year: 2018, Make: Porsche, Model: 911 Carrera S
- Mileage: 24,500 km, Exterior: Guards Red, Interior: Black
- Transmission: PDK, Location: Madrid, Platform: AUTO_SCOUT_24
- Seller description: "911 Carrera S en muy buen estado. Más información por teléfono."
- Locale: `es`

**Output:**

```json
{
  "headline": "Un 911 Carrera S (991.2) de 2018 en Guards Red sobre interior negro, con 24.500 km, ubicado en Madrid.",
  "highlights": [
    "Transmisión PDK de doble embrague, combinación original.",
    "Kilometraje indicado: 24.500 km."
  ]
}
```

Notice: the seller description gave nothing usable, so we produced only two honest bullets grounded in structured data. We did not invent ownership history, service records, or condition claims.

## Example 3 — non-English source, German output

**Input (condensed):**
- Year: 1995, Make: Porsche, Model: 993 Carrera
- Mileage: 84,000 mi, Exterior: Midnight Blue, Interior: Beige
- Transmission: Manual, Location: Florida, Platform: BRING_A_TRAILER
- Seller description (excerpt, English): "Single-owner 993 since 2001. Recent top-end refresh with new timing chain tensioners. California and Florida-registered. All service records included."
- Locale: `de`

**Output:**

```json
{
  "headline": "993 Carrera aus dem Modelljahr 1995 in Midnight Blue auf beigem Leder, seit 2001 in einer Hand.",
  "highlights": [
    "Ein-Besitzer-Fahrzeug seit 2001, vollständige Servicehistorie liegt vor.",
    "Kürzlich durchgeführte Top-End-Überholung inklusive neuer Steuerkettenspanner.",
    "Ursprünglich in Kalifornien und Florida zugelassen.",
    "Handschaltung, 84.000 Meilen Gesamtlaufleistung."
  ]
}
```

Notice: the source is English; the output is German. No English sentences were reused, and no 5-word windows match the source. German collector vocabulary (*Ein-Besitzer-Fahrzeug*, *Servicehistorie*, *Top-End-Überholung*) is used correctly.

## Example 4 — sparse source, Japanese output

**Input (condensed):**
- Year: 1989, Make: Porsche, Model: 911 Carrera
- Mileage: 112,000 km, Exterior: Schwarz, Interior: Black
- Transmission: G50 5-speed manual, Location: Tokyo, Platform: BEFORWARD
- Seller description (excerpt): "国内物。ワンオーナー。記録簿あり。"
- Locale: `ja`

**Output:**

```json
{
  "headline": "1989年式 911カレラ、ブラックの外装に黒内装、東京のワンオーナー車両。",
  "highlights": [
    "G50型5速マニュアルトランスミッション搭載。",
    "国内物のワンオーナー車両、記録簿あり。",
    "走行距離11.2万km。"
  ]
}
```

Notice: short declarative sentences. Collector vocabulary (`ワンオーナー`, `記録簿`, `国内物`). Mileage rendered as `11.2万km` per the locale notes.
