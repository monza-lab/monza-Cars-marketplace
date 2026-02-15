import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "bringatrailer.com" },
      { protocol: "https", hostname: "**.bringatrailer.com" },
      { protocol: "https", hostname: "carsandbids.com" },
      { protocol: "https", hostname: "**.carsandbids.com" },
      { protocol: "https", hostname: "collectingcars.com" },
      { protocol: "https", hostname: "**.collectingcars.com" },
      { protocol: "https", hostname: "cdn.bringatrailer.com" },
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
};

export default withNextIntl(nextConfig);
