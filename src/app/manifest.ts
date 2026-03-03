import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Monza Lab — Investment-Grade Automotive Assets",
    short_name: "Monza Lab",
    description:
      "The intelligent terminal for collector vehicle acquisition and analysis. AI-powered insights for smarter acquisitions.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b10",
    theme_color: "#0b0b10",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
