"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { MessageCircle } from "lucide-react"
import { MonzaHausHelmet } from "@/components/brand/MonzaHausHelmet"
import { useChatContext } from "@/lib/advisor/ChatContextProvider"

/**
 * Floating Advisor button — bottom-right on every page.
 *
 * Replaces the desktop header pill (which ate space in the top nav).
 * The button is on-brand: Heritage Lavender surface, MonzaHaus helmet
 * glyph as the primary mark, with a small MessageCircle indicator so
 * users read it as "chat" not just "logo".
 *
 * Hidden contexts:
 *  - When the user is already on /advisor (no need to open chat from chat).
 *  - When the page is a print/PDF view (URL contains ?print or ?pdf).
 *  - When the URL contains ?mock= (PDF preview routes — we don't want
 *    the FAB in screenshots / printable previews).
 */
export function AdvisorFab() {
  const pathname = usePathname() ?? ""
  const t = useTranslations()
  const { open } = useChatContext()

  // Hide on /advisor itself
  if (pathname.startsWith("/advisor")) return null
  // Hide on /en/advisor etc. (locale-prefixed)
  if (/^\/[a-z]{2}\/advisor/.test(pathname)) return null

  // Suppress on print-style report previews (Mock URLs used by preview script).
  if (typeof window !== "undefined") {
    const sp = new URLSearchParams(window.location.search)
    if (sp.has("print") || sp.has("pdf") || sp.has("mock")) return null
  }

  return (
    <button
      type="button"
      onClick={open}
      data-onboarding="advisor"
      aria-label={t("nav.advisorAria")}
      className="
        fixed right-4 md:right-6
        bottom-[calc(env(safe-area-inset-bottom,0)+5rem)] md:bottom-6
        z-50
        flex items-center gap-2.5
        rounded-full
        bg-primary text-primary-foreground
        shadow-[0_12px_32px_rgba(94,63,102,0.32)]
        hover:shadow-[0_18px_44px_rgba(94,63,102,0.45)]
        hover:-translate-y-0.5
        transition-all duration-200 ease-out
        px-4 md:px-5 py-2.5 md:py-3
        focus:outline-none
        focus-visible:ring-2 focus-visible:ring-primary
        focus-visible:ring-offset-2 focus-visible:ring-offset-background
        group
        print:hidden
      "
    >
      {/* Helmet — on-brand identity, sized to match the chat glyph */}
      <span
        className="
          relative inline-flex items-center justify-center
          size-7 rounded-full
          bg-background/15
        "
      >
        <span className="size-5 inline-block">
          <MonzaHausHelmet tone="cream-on-lavender" className="block w-full h-full" />
        </span>
        {/* Chat indicator — small dot at top-right so users read this as 'chat',
            not just a static logo. Matches messaging-app convention. */}
        <span
          aria-hidden="true"
          className="
            absolute -top-0.5 -right-0.5
            inline-flex items-center justify-center
            size-3.5 rounded-full
            bg-background text-primary
            ring-2 ring-primary
          "
        >
          <MessageCircle className="size-2" strokeWidth={2.5} />
        </span>
      </span>

      <span className="text-[12px] font-semibold tracking-wide whitespace-nowrap">
        {t("nav.advisor")}
      </span>
    </button>
  )
}
