"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          className="relative overflow-hidden rounded-3xl border border-primary/10 p-12 sm:p-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Background */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at top left, rgba(var(--glow-color), 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at bottom right, rgba(var(--glow-color), 0.06) 0%, transparent 50%),
                var(--popover)
              `,
            }}
          />

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(var(--glow-color), 0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(var(--glow-color), 0.5) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Content */}
          <div className="relative z-10 text-center">
            <motion.h2
              className="text-3xl font-light tracking-tight text-foreground sm:text-4xl lg:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Start Making{" "}
              <span className="font-semibold text-gradient">Smarter Bids</span>{" "}
              Today
            </motion.h2>

            <motion.p
              className="mx-auto mt-5 max-w-lg text-sm text-[rgba(232,226,222,0.45)] sm:text-base font-light"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Join thousands of collectors and investors who trust Monza Lab
              for their acquisition intelligence.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Link
                href="/auctions"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:bg-primary/80 hover:shadow-xl hover:shadow-primary/25"
              >
                Browse Listings
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-primary/4 px-8 py-3.5 text-[11px] font-medium tracking-[0.1em] uppercase text-foreground/70 transition-all hover:border-primary/25 hover:bg-primary/8 hover:text-foreground"
              >
                Explore the Platform
              </Link>
            </motion.div>

            <motion.p
              className="mt-8 text-[10px] tracking-[0.15em] uppercase text-[rgba(232,226,222,0.25)]"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              Free to browse. No account required.
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
