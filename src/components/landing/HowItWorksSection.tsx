"use client"

import { motion } from "framer-motion"
import { Eye, Scale, Target } from "lucide-react"
import { useTranslations } from "next-intl"

const steps = [
  {
    number: "01",
    icon: Eye,
    titleKey: "steps.track.title",
    descriptionKey: "steps.track.description",
  },
  {
    number: "02",
    icon: Scale,
    titleKey: "steps.analyzes.title",
    descriptionKey: "steps.analyzes.description",
  },
  {
    number: "03",
    icon: Target,
    titleKey: "steps.bidSmart.title",
    descriptionKey: "steps.bidSmart.description",
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
} as const

export function HowItWorksSection() {
  const t = useTranslations("howItWorks")

  return (
    <section className="relative py-24 sm:py-32 monza-section-glow">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="mb-4 inline-block text-[11px] font-medium tracking-[0.2em] uppercase text-[#F8B4D9]">
            {t("kicker")}
          </span>
          <h2 className="text-3xl font-light tracking-tight text-[#FFFCF7] sm:text-4xl">
            {t("title1")}{" "}
            <span className="font-semibold text-gradient">{t("title2")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[rgba(255,252,247,0.45)] font-light">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Steps grid */}
        <motion.div
          className="grid gap-6 sm:grid-cols-3 sm:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {steps.map((step) => (
            <motion.div
              key={step.number}
              className="group relative overflow-hidden rounded-2xl border border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.7)] p-8 transition-all duration-300 hover:border-[rgba(248,180,217,0.2)] hover:shadow-2xl hover:shadow-[rgba(248,180,217,0.03)]"
              variants={cardVariants}
              whileHover={{ y: -4 }}
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[rgba(248,180,217,0.08)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

              {/* Step number */}
              <span className="mb-6 inline-block font-mono text-[11px] font-medium tracking-[0.1em] text-[rgba(255,252,247,0.2)]">
                {step.number}
              </span>

              {/* Icon */}
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(248,180,217,0.08)] text-[#F8B4D9] transition-all duration-300 group-hover:bg-[rgba(248,180,217,0.12)]">
                <step.icon className="h-5 w-5" />
              </div>

              {/* Content */}
              <h3 className="mb-3 text-lg font-semibold text-[#FFFCF7]">
                {t(step.titleKey)}
              </h3>
              <p className="text-sm leading-relaxed text-[rgba(255,252,247,0.4)] font-light">
                {t(step.descriptionKey)}
              </p>

              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r from-[#F8B4D9] to-transparent transition-all duration-500 group-hover:w-full" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
