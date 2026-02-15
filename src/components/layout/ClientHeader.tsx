"use client";

import dynamic from "next/dynamic";

// Radix UI generates different auto-IDs on server vs client, causing hydration
// mismatches on DropdownMenu/Sheet trigger elements. Skipping SSR for the Header
// avoids this entirely — the Header is purely interactive so there's no SEO impact.
const Header = dynamic(
  () => import("./Header").then((m) => m.Header),
  { ssr: false }
);

export function ClientHeader() {
  return <Header />;
}
