"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Copy, CheckCheck, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CriticalQuestionsProps {
  questions: string[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useCopyToClipboard(resetMs = 2000) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copy = useCallback(
    async (text: string, index: number) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), resetMs);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), resetMs);
      }
    },
    [resetMs]
  );

  return { copiedIndex, copy };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CriticalQuestions({
  questions,
  className,
}: CriticalQuestionsProps) {
  const { copiedIndex, copy } = useCopyToClipboard();
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = async () => {
    const allText = questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(allText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = allText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Copy All button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleCopyAll}
          className={cn(
            "text-zinc-500 hover:text-zinc-300 gap-1.5",
            allCopied && "text-positive hover:text-positive"
          )}
        >
          {allCopied ? (
            <>
              <CheckCheck className="size-3" />
              Copied!
            </>
          ) : (
            <>
              <ClipboardList className="size-3" />
              Copy All
            </>
          )}
        </Button>
      </div>

      {/* Question list */}
      <div className="space-y-2">
        {questions.map((question, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={cn(
              "group flex items-start gap-3 rounded-md p-3",
              "bg-zinc-900/60 border border-zinc-800/60",
              "hover:bg-zinc-800/50 hover:border-zinc-700/60 transition-colors"
            )}
          >
            {/* Number badge */}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-destructive text-xs font-semibold mt-0.5">
              {i + 1}
            </span>

            {/* Icon + Text */}
            <div className="flex-1 flex items-start gap-2 min-w-0">
              <HelpCircle className="size-4 mt-0.5 shrink-0 text-destructive/70" />
              <p className="text-sm text-zinc-300 leading-relaxed">{question}</p>
            </div>

            {/* Copy individual */}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => copy(question, i)}
              className={cn(
                "opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                "text-zinc-500 hover:text-zinc-300",
                copiedIndex === i && "opacity-100 text-positive hover:text-positive"
              )}
              title="Copy question"
            >
              {copiedIndex === i ? (
                <CheckCheck className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
