"use client";

import { useState, useTransition } from "react";
import { triggerGenerate, triggerPublish, discardDraft } from "./actions";
import type { SocialPostDraft } from "@/features/social-engine/types";

export function DraftEditor({ draft }: { draft: SocialPostDraft }) {
  const [caption, setCaption] = useState(draft.caption_final ?? draft.caption_draft ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const slides = draft.generated_slide_urls ?? [];

  const run = (fn: () => Promise<void>) => startTransition(async () => {
    setMessage(null);
    try { await fn(); setMessage("OK"); }
    catch (e) { setMessage("Error: " + (e as Error).message); }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {slides.length === 0 ? (
        <div style={{
          padding: 32, background: "#161113", border: "1px dashed #2A2226", borderRadius: 10,
          textAlign: "center", color: "#9A8E88",
        }}>
          <div style={{ marginBottom: 16 }}>Slides not generated yet.</div>
          <button
            disabled={isPending}
            onClick={() => run(() => triggerGenerate(draft.id))}
            style={{ padding: "12px 24px", background: "#7A2E4A", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            {isPending ? "Generating..." : "Generate carousel"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
          {slides.map((url, i) => (
            <div key={i} style={{ flex: "0 0 auto" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9A8E88", textAlign: "center", marginBottom: 6 }}>
                Slide {i + 1}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Slide ${i + 1}`}
                style={{ width: 432, height: 540, objectFit: "cover", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#9A8E88", marginBottom: 12 }}>
          Caption
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={6}
          style={{
            width: "100%", padding: 16, background: "#161113", border: "1px solid #2A2226",
            color: "#E8E2DE", borderRadius: 6, fontFamily: "Karla, sans-serif", fontSize: 14, lineHeight: 1.6,
          }}
        />
        {draft.hashtags && draft.hashtags.length > 0 && (
          <div style={{ marginTop: 8, fontFamily: "Geist Mono, monospace", fontSize: 12, color: "#9A8E88" }}>
            {draft.hashtags.map((h) => `#${h}`).join(" · ")}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          disabled={isPending || slides.length === 0 || !caption.trim()}
          onClick={() => run(() => triggerPublish(draft.id, caption))}
          style={{ padding: "12px 24px", background: "#34D399", color: "#0E0A0C", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
        >
          {isPending ? "Publishing..." : "Publish to IG + FB"}
        </button>
        <button
          disabled={isPending || slides.length === 0}
          onClick={() => run(() => triggerGenerate(draft.id))}
          style={{ padding: "12px 24px", background: "transparent", color: "#E8E2DE", border: "1px solid #2A2226", borderRadius: 6, cursor: "pointer" }}
        >
          Regenerate
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm("Discard this draft?")) return;
            run(() => discardDraft(draft.id, "manual"));
          }}
          style={{ padding: "12px 24px", background: "transparent", color: "#FB923C", border: "1px solid #FB923C", borderRadius: 6, cursor: "pointer" }}
        >
          Discard
        </button>
      </div>

      {message && (
        <div style={{ padding: 12, background: "#161113", border: "1px solid #2A2226", borderRadius: 6, fontSize: 12, color: "#9A8E88" }}>
          {message}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#9A8E88", marginTop: 16 }}>
        <div>Quality: {draft.quality_score} · Vision: {draft.vision_score}</div>
        <div style={{ marginTop: 4 }}>{draft.vision_notes}</div>
        {draft.error_log && draft.error_log.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", color: "#FB923C" }}>Errors</summary>
            <pre style={{ fontSize: 10, whiteSpace: "pre-wrap", color: "#FB923C" }}>{JSON.stringify(draft.error_log, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
