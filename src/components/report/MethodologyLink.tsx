import Link from "next/link"
import { BookOpen, ArrowRight } from "lucide-react"

interface MethodologyLinkProps {
  href?: string
}

export function MethodologyLink({ href = "/methodology" }: MethodologyLinkProps) {
  return (
    <section className="px-4 py-4">
      <Link
        href={href}
        className="group inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <BookOpen className="size-4" />
        <span>
          How we compute Fair Value, Modifiers, Market Intel, and Sources
        </span>
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  )
}
