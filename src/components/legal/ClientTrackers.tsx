"use client"

import Script from "next/script"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { useConsent } from "./ConsentProvider"

// Single mount point for every non-essential tracker:
// - Loads NOTHING while consent is "pending"
// - On "accepted": Vercel Analytics + Speed Insights + Meta Pixel
// - On "rejected": still nothing (and stays that way until the user
//   resets consent via /legal/cookies preferences)
//
// Adding Google Analytics later: add it here, gated by the same `accepted`
// branch, and add its row to COOKIES in /legal/cookies/page.tsx.

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export function ClientTrackers() {
  const { consent } = useConsent()

  if (consent !== "accepted") {
    return null
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
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
