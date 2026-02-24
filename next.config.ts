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
      // Other platforms
      { protocol: "https", hostname: "image-cdn.beforward.jp" },
      { protocol: "https", hostname: "m.atcdn.co.uk" },
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "**/node_modules/typescript/**",
      "**/node_modules/prisma/**",
      "**/node_modules/@types/**",
      "**/node_modules/@playwright/**",
      "**/node_modules/playwright/**"
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
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
