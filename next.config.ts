import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "bringatrailer.com" },
      { protocol: "https", hostname: "**.bringatrailer.com" },
      { protocol: "https", hostname: "cdn.bringatrailer.com" },
      { protocol: "https", hostname: "wp.com" },
      { protocol: "https", hostname: "**.wp.com" },
      { protocol: "https", hostname: "carsandbids.com" },
      { protocol: "https", hostname: "**.carsandbids.com" },
      { protocol: "https", hostname: "collectingcars.com" },
      { protocol: "https", hostname: "**.collectingcars.com" },
      { protocol: "https", hostname: "media.carsandbids.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "**.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // RM Sotheby's CDN for auction images
      { protocol: "https", hostname: "cdn.rmsothebys.com" },
      { protocol: "https", hostname: "**.rmsothebys.com" },
      // AutoScout24 CDN for listing images
      { protocol: "https", hostname: "autoscout24.net" },
      { protocol: "https", hostname: "**.autoscout24.net" },
      { protocol: "https", hostname: "autoscout24.com" },
      { protocol: "https", hostname: "**.autoscout24.com" },
      { protocol: "https", hostname: "**.autoscout24.de" },
      { protocol: "https", hostname: "**.autoscout24.ch" },
      { protocol: "https", hostname: "**.autoscout24.it" },
      { protocol: "https", hostname: "**.autoscout24.fr" },
      { protocol: "https", hostname: "**.autoscout24.nl" },
      { protocol: "https", hostname: "**.autoscout24.es" },
      { protocol: "https", hostname: "**.autoscout24.at" },
      { protocol: "https", hostname: "**.autoscout24.be" },
      // Classic.com CDN for listing images
      { protocol: "https", hostname: "images.classic.com" },
      { protocol: "https", hostname: "**.classic.com" },
      // Elferspot CDN for listing images
      { protocol: "https", hostname: "cdn.elferspot.com" },
      { protocol: "https", hostname: "**.elferspot.com" },
      // Other platforms
      { protocol: "https", hostname: "image-cdn.beforward.jp" },
      { protocol: "https", hostname: "m.atcdn.co.uk" },
    ],
  },
  outputFileTracingIncludes: {
    "/api/cron/classic": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/cron/autoscout24": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/advisor/message": ["./src/lib/ai/skills/**/*"],
    "/api/listings/[id]/rewrite": ["./src/lib/ai/skills/**/*"],
  },
  serverExternalPackages: [
    "rebrowser-playwright",
    "rebrowser-playwright-core",
  ],
  outputFileTracingExcludes: {
    "*": [
      "**/node_modules/typescript/**",
      "**/node_modules/@types/**",
      "**/node_modules/@playwright/**",
      "**/node_modules/rebrowser-playwright/**",
      "**/node_modules/rebrowser-playwright-core/**",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: bringatrailer.com *.bringatrailer.com wp.com *.wp.com carsandbids.com *.carsandbids.com collectingcars.com *.collectingcars.com images.unsplash.com source.unsplash.com upload.wikimedia.org *.wikimedia.org picsum.photos fastly.picsum.photos cdn.rmsothebys.com *.rmsothebys.com autoscout24.net *.autoscout24.net autoscout24.com *.autoscout24.com *.autoscout24.de *.autoscout24.ch *.autoscout24.it *.autoscout24.fr *.autoscout24.nl *.autoscout24.es *.autoscout24.at *.autoscout24.be images.classic.com *.classic.com cdn.elferspot.com *.elferspot.com image-cdn.beforward.jp m.atcdn.co.uk",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/:locale(en|es|de|ja)/api/:path*',
        destination: '/api/:path*',
      },
      {
        source: '/:locale(en|es|de|ja)/trpc/:path*',
        destination: '/trpc/:path*',
      },
    ]
  },
};

export default withNextIntl(nextConfig);
