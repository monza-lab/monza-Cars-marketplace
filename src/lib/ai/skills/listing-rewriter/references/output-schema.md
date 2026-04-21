# Output schema (human mirror)

The runtime will enforce the shape via Gemini's `responseSchema`. This file restates the contract in plain language for human editors of the prompt.

## Shape

```json
{
  "headline": "string, one sentence, 12–28 words, in the target locale",
  "highlights": ["2 to 5 short factual bullets, each ≤180 chars, in the target locale"]
}
```

## Rules (repeated from tone-guide and SKILL.md for convenience)

- **Both fields required.** `headline` is a non-empty string; `highlights` is an array with 2–5 string elements.
- **Locale.** Every string — `headline` and every `highlight` — in the locale specified by the user prompt.
- **No invention.** Claims must be supported by structured facts or the seller description.
- **No verbatim source.** No 5-word window of your output may match any 5-word window of the seller description.
- **No hype.** See the tone-guide banned-phrase list.
- **No overlap.** A claim in the headline must not be repeated verbatim in the highlights.
- **Honesty over padding.** If you only have 2 honest bullets, produce 2. Do not pad to 5.
- **JSON only.** Return the object and nothing else — no preamble, no code fence, no commentary.
