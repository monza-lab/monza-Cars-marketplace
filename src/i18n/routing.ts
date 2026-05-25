import { defineRouting } from 'next-intl/routing';

// English-only mode. Other locales ('es', 'de', 'ja') are intentionally
// hidden from end users. To re-enable: add them back to `locales`, remove
// the redirect in `src/middleware.ts`, and uncomment `<LanguageRow />` in
// `src/components/layout/Header.tsx`. Message files in `messages/` are
// preserved on disk and ready to use.
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: false, // never auto-redirect based on Accept-Language
});

export type Locale = (typeof routing.locales)[number];
