import path from "path"
import { Font } from "@react-pdf/renderer"

// Monza Haus brand fonts. Registered once on module import.
// - Cormorant: serif, used for display/hero/titles (brand spec §5).
// - Karla: sans, used for body/UI/labels.
// Variable fonts downloaded from Google Fonts `main` branch; served from
// `public/fonts/monzahaus/` so the same path resolves in dev and on Vercel.

const FONT_DIR = path.join(process.cwd(), "public", "fonts", "monzahaus")

let registered = false

export function ensureBrandFontsRegistered(): void {
  if (registered) return

  try {
    Font.register({
      family: "Cormorant",
      fonts: [
        { src: path.join(FONT_DIR, "Cormorant.ttf"), fontWeight: 300 },
        { src: path.join(FONT_DIR, "Cormorant.ttf"), fontWeight: 400 },
        { src: path.join(FONT_DIR, "Cormorant.ttf"), fontWeight: 500 },
        { src: path.join(FONT_DIR, "Cormorant.ttf"), fontWeight: 600 },
      ],
    })

    Font.register({
      family: "Karla",
      fonts: [
        { src: path.join(FONT_DIR, "Karla.ttf"), fontWeight: 300 },
        { src: path.join(FONT_DIR, "Karla.ttf"), fontWeight: 400 },
        { src: path.join(FONT_DIR, "Karla.ttf"), fontWeight: 500 },
        { src: path.join(FONT_DIR, "Karla.ttf"), fontWeight: 600 },
        { src: path.join(FONT_DIR, "Karla.ttf"), fontWeight: 700 },
        { src: path.join(FONT_DIR, "Karla-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
        { src: path.join(FONT_DIR, "Karla-Italic.ttf"), fontWeight: 500, fontStyle: "italic" },
      ],
    })

    // Disable hyphenation — editorial typography, not technical wrap.
    Font.registerHyphenationCallback((w) => [w])

    registered = true
  } catch (err) {
    // If registration fails (e.g. font files missing), fall back silently to
    // react-pdf's built-in Helvetica. The report still renders; branding
    // degrades gracefully.
    // eslint-disable-next-line no-console
    console.warn("[pdf/fonts] brand font registration failed, using Helvetica fallback:", err)
  }
}
