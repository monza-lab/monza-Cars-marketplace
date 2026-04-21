# Locale notes

Every string in your output must be in the requested locale. No mixed languages, no English loanwords when a native term exists, no footnote parentheticals translating back to English.

## `en` — English

- Register: auction-catalogue. Think RM Sotheby's or Gooding catalogue entries — not a dealer ad, not a car blog.
- Short declarative sentences. Precise vocabulary.
- Use whichever unit system the source provides (the user prompt tells you). Do not convert mileage. If mileage is missing, omit it rather than estimate.
- Decimal separator: period. Thousands separator: comma. (`9,321 miles`, `1.3M`.)

## `es` — Spanish (neutral Latin American)

- Default register: `usted` (marketplace-formal). Avoid `tú`.
- Vocabulary: default to **auto** for neutrality (not "coche" which reads Castilian). Use "kilometraje" for mileage, "historial de servicio" for service history, "un solo dueño" / "dos dueños" for ownership, "pintura original" for original paint, "motor coincidente" or "numbers matching" for matching-numbers (the English phrase is accepted collector jargon in Spanish-speaking auction circles).
- Decimal separator: comma. Thousands separator: period. (`24.500 km`.)
- Avoid vosotros/vuestro forms entirely.
- Do not translate proper model names or paint codes (Guards Red stays Guards Red; Carrara White stays Carrara White). Colour categories in prose may use Spanish ("rojo Guards sobre interior negro" is correct).

## `de` — German

- Register: formal (`Sie`). Porsche collector vocabulary is expected and must be used correctly:
  - *Werksangaben* (factory data), *Erstauslieferung* (first delivery), *Originalzustand* (original condition), *Originallack* (original paint), *Scheckheftgepflegt* (service-book maintained), *Ein-Besitzer-Fahrzeug* (single-owner vehicle), *Matching-Numbers* (accepted loanword), *Fahrgestellnummer* (chassis number), *Laufleistung* (mileage), *Service-historie* (service history).
- Compound nouns are correct and expected — do not artificially hyphenate or split them (write `Erstauslieferung`, not `Erst-Auslieferung`).
- Metric units (km). Decimal comma. Thousands period. (`84.000 km`.)
- Do not translate English proper names (Guards Red, Midnight Blue, Bring a Trailer).

## `ja` — Japanese

- Register: 丁寧語 (desu/masu) throughout. No casual sentence endings. No exclamation marks, no emoji.
- Collector vocabulary — use these terms where the facts support them:
  - 純正 (original, factory)
  - ワンオーナー (single owner)
  - 記録簿完備 (complete service records)
  - 整備記録 (maintenance records)
  - フルオリジナル (fully original)
  - マッチングナンバー (matching numbers — loanword, acceptable)
  - 走行距離 (mileage / distance driven)
  - 左ハンドル / 右ハンドル (LHD / RHD)
  - 本革 (genuine leather)
- Mileage in km. Use `万` for large numbers where natural (e.g., `1.2万km`). For mileage under 10,000 km write out the number: `9,321km`.
- Do not translate proper model names or colour names unless a canonical katakana transliteration is standard (e.g., `カレラホワイト` is acceptable but not required; `Carrara White` is also acceptable in this context).
- Keep sentences short. Japanese auction-catalogue register is famously terse — match that tone.
