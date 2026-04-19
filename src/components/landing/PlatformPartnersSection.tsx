"use client"

import { motion } from "framer-motion"

const platforms = [
  {
    name: "Bring a Trailer",
    abbreviation: "BaT",
    description: "The premier online auction platform for enthusiast vehicles",
    color: "text-primary",
    bgColor: "bg-primary/6",
    borderColor: "border-primary/10",
    hoverBorder: "hover:border-primary/25",
  },
  {
    name: "Cars & Bids",
    abbreviation: "C&B",
    description: "Modern and cool cars from the 1980s to today",
    color: "text-[#c084fc]",
    bgColor: "bg-[rgba(192,132,252,0.06)]",
    borderColor: "border-[rgba(192,132,252,0.1)]",
    hoverBorder: "hover:border-[rgba(192,132,252,0.25)]",
  },
  {
    name: "Collecting Cars",
    abbreviation: "CC",
    description: "The global online auction house for collector cars",
    color: "text-[#67e8f9]",
    bgColor: "bg-[rgba(103,232,249,0.06)]",
    borderColor: "border-[rgba(103,232,249,0.1)]",
    hoverBorder: "hover:border-[rgba(103,232,249,0.25)]",
  },
]

export function PlatformPartnersSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Section header */}
        <motion.div
          className="mb-14 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="mb-4 inline-block text-[11px] font-medium tracking-[0.2em] uppercase text-primary">
            Platform Partners
          </span>
          <h2 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            The Best Listings, <span className="font-semibold text-primary">One Platform</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground font-light">
            Aggregating the best auctions from the world&apos;s premier platforms.
          </p>
        </motion.div>

        {/* Platform cards */}
        <div className="grid gap-5 sm:grid-cols-3">
          {platforms.map((platform, index) => (
            <motion.div
              key={platform.name}
              className={`group relative flex flex-col items-center gap-4 rounded-2xl border ${platform.borderColor} ${platform.hoverBorder} bg-card p-8 text-center transition-all duration-300 hover:shadow-2xl hover:shadow-primary/3`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -3 }}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${platform.bgColor} transition-transform duration-300 group-hover:scale-105`}
              >
                <span className={`text-xl font-bold ${platform.color}`}>
                  {platform.abbreviation}
                </span>
              </div>

              <h3 className="text-base font-semibold text-foreground">
                {platform.name}
              </h3>

              <p className="text-sm text-muted-foreground font-light">
                {platform.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Connecting line */}
        <motion.div
          className="mx-auto mt-12 flex max-w-xs items-center gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/10" />
          <span className="shrink-0 text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground/60">
            Unified in Monza Lab
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/10" />
        </motion.div>
      </div>
    </section>
  )
}
