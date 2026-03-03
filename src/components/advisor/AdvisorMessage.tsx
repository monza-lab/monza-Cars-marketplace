"use client"

import { motion } from "framer-motion"
import { Bot, User, FileText, ChevronRight, ExternalLink } from "lucide-react"
import { Link } from "@/i18n/navigation"
import type { AdvisorMessage as AdvisorMessageType, QuickAction, ReportCtaData } from "./advisorTypes"

// ═══ RICH CONTENT PARSER ═══

function RichContent({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="text-[13px] leading-relaxed space-y-0.5">
      {lines.map((line, i) => {
        // Parse **bold** segments
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <span key={j} className="font-semibold text-[#FFFCF7]">{part.slice(2, -2)}</span>
          }
          return <span key={j}>{part}</span>
        })

        // Numbered list: "1. ", "2. " etc
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1 py-0.5">
              <span className="text-[#F8B4D9] shrink-0 font-mono text-[11px] mt-0.5">{line.match(/^\d+/)?.[0]}.</span>
              <span>{rendered.slice(1)}</span>
            </div>
          )
        }

        // Bullet: "- "
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-1 py-0.5">
              <span className="text-[#F8B4D9] shrink-0 mt-1">
                <span className="block size-1 rounded-full bg-[#F8B4D9]" />
              </span>
              <span>{parts.slice(1).map((part, j) => {
                const inner = part.replace(/^-\s*/, "")
                if (inner.startsWith("**") && inner.endsWith("**")) {
                  return <span key={j} className="font-semibold text-[#FFFCF7]">{inner.slice(2, -2)}</span>
                }
                // Handle mixed: "**Bold:** rest"
                const boldParts = inner.split(/(\*\*[^*]+\*\*)/g)
                return boldParts.map((bp, k) => {
                  if (bp.startsWith("**") && bp.endsWith("**")) {
                    return <span key={`${j}-${k}`} className="font-semibold text-[#FFFCF7]">{bp.slice(2, -2)}</span>
                  }
                  return <span key={`${j}-${k}`}>{bp}</span>
                })
              })}</span>
            </div>
          )
        }

        // Empty line = spacer
        if (line.trim() === "") return <div key={i} className="h-1.5" />

        return <div key={i}>{rendered}</div>
      })}
    </div>
  )
}

// ═══ REPORT CTA CARD ═══

function ReportCtaCard({ cta, onGenerate }: { cta: ReportCtaData; onGenerate?: (carId: string) => void }) {
  if (cta.alreadyAnalyzed) {
    return (
      <Link
        href={`/cars/${cta.make.toLowerCase().replace(/\s+/g, "-")}/${cta.carId}/report`}
        className="mt-3 flex items-center gap-3 rounded-xl border border-[rgba(248,180,217,0.2)] bg-[rgba(248,180,217,0.06)] p-3 hover:bg-[rgba(248,180,217,0.1)] transition-colors group"
      >
        <div className="size-9 rounded-lg bg-[rgba(248,180,217,0.15)] flex items-center justify-center shrink-0">
          <FileText className="size-4 text-[#F8B4D9]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#FFFCF7]">View Report</p>
          <p className="text-[10px] text-[#6B7280] truncate">{cta.carTitle}</p>
        </div>
        <ExternalLink className="size-4 text-[#F8B4D9] shrink-0" />
      </Link>
    )
  }

  if (cta.hasTokens) {
    return (
      <button
        onClick={() => onGenerate?.(cta.carId)}
        className="mt-3 w-full flex items-center gap-3 rounded-xl border border-[rgba(248,180,217,0.25)] bg-[rgba(248,180,217,0.08)] p-3 hover:bg-[rgba(248,180,217,0.15)] transition-colors group text-left"
      >
        <div className="size-9 rounded-lg bg-[rgba(248,180,217,0.15)] flex items-center justify-center shrink-0">
          <FileText className="size-4 text-[#F8B4D9]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#FFFCF7]">Generate Report</p>
          <p className="text-[10px] text-[#6B7280]">1,000 tokens ({cta.analysesRemaining} remaining)</p>
        </div>
        <ChevronRight className="size-4 text-[#F8B4D9] group-hover:translate-x-0.5 transition-transform shrink-0" />
      </button>
    )
  }

  return (
    <Link
      href="/pricing"
      className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-colors group"
    >
      <div className="size-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <FileText className="size-4 text-[#6B7280]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#FFFCF7]">Upgrade to Generate Reports</p>
        <p className="text-[10px] text-[#6B7280]">Full investment analysis with comparables</p>
      </div>
      <ChevronRight className="size-4 text-[#6B7280] group-hover:translate-x-0.5 transition-transform shrink-0" />
    </Link>
  )
}

// ═══ QUICK ACTION CHIPS ═══

function QuickActionChips({ actions, onAction }: { actions: QuickAction[]; onAction: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => onAction(action.prompt)}
          className="text-[11px] px-3 py-1.5 rounded-full border border-[rgba(248,180,217,0.2)] bg-[rgba(248,180,217,0.06)] text-[#F8B4D9] hover:bg-[rgba(248,180,217,0.15)] transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

// ═══ MESSAGE COMPONENT ═══

interface Props {
  message: AdvisorMessageType
  onQuickAction?: (prompt: string) => void
  onGenerateReport?: (carId: string) => void
}

export function MessageBubble({ message, onQuickAction, onGenerateReport }: Props) {
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div className={`size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser
          ? "bg-[rgba(248,180,217,0.15)] border border-[rgba(248,180,217,0.2)]"
          : "bg-[rgba(248,180,217,0.1)] border border-white/5"
      }`}>
        {isUser
          ? <User className="size-3.5 text-[#F8B4D9]" />
          : <Bot className="size-3.5 text-[#F8B4D9]" />
        }
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        <div className={`rounded-2xl px-4 py-3 max-w-[90%] ${
          isUser
            ? "bg-[rgba(248,180,217,0.15)] border border-[rgba(248,180,217,0.2)] text-[#FFFCF7]"
            : "bg-white/[0.04] border border-white/5 text-[#D1D5DB]"
        }`}>
          {isUser
            ? <p className="text-[13px] leading-relaxed">{message.content}</p>
            : <RichContent text={message.content} />
          }
        </div>

        {/* Report CTA */}
        {!isUser && message.reportCta && (
          <div className="max-w-[90%] mt-0">
            <ReportCtaCard cta={message.reportCta} onGenerate={onGenerateReport} />
          </div>
        )}

        {/* Quick Actions */}
        {!isUser && message.quickActions && message.quickActions.length > 0 && onQuickAction && (
          <div className="max-w-[90%]">
            <QuickActionChips actions={message.quickActions} onAction={onQuickAction} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ═══ TYPING INDICATOR ═══

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="size-7 rounded-full bg-[rgba(248,180,217,0.1)] border border-white/5 flex items-center justify-center shrink-0">
        <Bot className="size-3.5 text-[#F8B4D9]" />
      </div>
      <div className="rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/5">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="size-1.5 rounded-full bg-[#F8B4D9]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
