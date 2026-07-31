"use client"

import Script from "next/script"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useConsent } from "./ConsentProvider"
import { captureAttributionFromBrowser } from "@/lib/marketing/attribution"
import { readStoredAttribution } from "@/lib/marketing/attribution"
import { track } from "@/lib/analytics/events"

// Single mount point for every non-essential tracker:
// - Loads NOTHING while consent is "pending"
// - On "accepted": Vercel Analytics + Speed Insights + Meta Pixel + GA4
// - On "rejected": still nothing (and stays that way until the user
//   resets consent via /legal/cookies preferences)
//
// GA4 was added 2026-07-30, following the note this file used to carry. Its
// row was already declared in COOKIES in /legal/cookies/page.tsx, so the
// policy now matches what actually runs.

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function ClientTrackers() {
  const { consent } = useConsent()
  const pathname = usePathname()
  const lastTrackedPathRef = useRef<string | null>(null)
  const funnelVisitTrackedRef = useRef(false)

  useEffect(() => {
    captureAttributionFromBrowser()
  }, [pathname])

  useEffect(() => {
    const isBrowseEntry = /^\/browse\/?$/.test(pathname) || /^\/[^/]+\/browse\/?$/.test(pathname)
    if (consent !== "accepted" || !isBrowseEntry || funnelVisitTrackedRef.current) return
    funnelVisitTrackedRef.current = true
    const attribution = readStoredAttribution()
    let anonymousSessionId = window.localStorage.getItem("monzahaus_funnel_session")
    if (!anonymousSessionId) {
      anonymousSessionId = crypto.randomUUID()
      window.localStorage.setItem("monzahaus_funnel_session", anonymousSessionId)
    }
    void track({
      event: "visit_landed",
      payload: { source: attribution?.utm_source || "direct", anonymousSessionId },
    })
  }, [consent, pathname])

  // Route-change page views. Both snippets fire their own view on first load,
  // so the first pathname is recorded and skipped — otherwise every session
  // would open with a duplicate.
  useEffect(() => {
    if (consent !== "accepted") return
    if (typeof window === "undefined") return
    if (!lastTrackedPathRef.current) {
      lastTrackedPathRef.current = pathname
      return
    }
    if (lastTrackedPathRef.current === pathname) return
    lastTrackedPathRef.current = pathname

    window.fbq?.("track", "PageView")
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [consent, pathname])

  if (consent !== "accepted") {
    return null
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}
      {META_PIXEL_ID && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  )
}
