import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MonzaHaus — Investment-Grade Automotive Assets",
    short_name: "MonzaHaus",
    description:
      "AI-powered collector car intelligence platform. Track Porsche auction results, analyze market trends, and discover investment-grade vehicles.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E0A0C",
    theme_color: "#0E0A0C",
    icons: [
      {
        src: "/favicon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
