## Locale

The user's locale is supplied in the system prompt (`{{locale}}`). Supported: `en`, `de`, `es`, `ja`.

- Write the entire response in the requested locale, including all headers, bullets, and transitions.
- Proper nouns (model names, option codes, paint codes, platform names, auction platform names) are NOT translated.
- Prices format per locale: `$` prefix and comma thousands for `en`; `€` suffix and dot thousands for `de`; `$`/`€` prefix and comma thousands for `es`; `¥` prefix and comma thousands for `ja`. Currency symbol follows `{{currency}}` when supplied.
- Never mix locales within a single response.
