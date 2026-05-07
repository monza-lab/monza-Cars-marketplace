/**
 * Pre-process raw description_text from scraped listings before sending
 * to the Gemini signal extractor. Strips navigation chrome, HTML tags,
 * footer boilerplate, and collapses whitespace.
 *
 * Goal: the output should contain ONLY vehicle-relevant text (description,
 * specs, seller notes). This dramatically improves Gemini extraction
 * accuracy and reduces token waste.
 */

// Patterns that indicate Classic.com / marketplace navigation boilerplate.
// Match start-of-line anchored blocks that precede the actual vehicle description.
const CLASSIC_COM_NAV_PATTERNS = [
  /^Find\n[\s\S]*?(?=About this|VIN:|\d{4}\s+Porsche)/m,
  /Search Listings\n[\d,]+\nBrowse Auctions\n[\d,]+\nBrowse Dealers[\s\S]*?(?=About this|\d{4}\s+Porsche)/m,
]

// Footer patterns from various sources
const FOOTER_PATTERNS = [
  /All rights reserved[\s\S]*$/m,
  /Vehicle information is provided by the seller[\s\S]*$/m,
  /CLASSIC\.COM is not affiliated[\s\S]*$/m,
  /Become a CLASSIC Insider[\s\S]*$/m,
  /Error Report:[\s\S]*?SUBMIT/m,
  /Your name \*\nYour email[\s\S]*?SEND MESSAGE/m,
  /Have a question\? Ask Rusty[\s\S]*?Powered by CLASSIC\.com/m,
  /Get our newsletter[\s\S]*$/m,
  /Terms and Conditions[\s\S]*$/m,
]

// Generic marketplace chrome keywords — lines containing ONLY these are nav
const NAV_ONLY_LINES = new Set([
  "search", "person", "close", "share", "bookmark_border save",
  "bookmark_border", "contact seller", "see full description",
  "see specs", "loading seller information...", "show all",
  "send message", "or", "overview", "description", "media",
  "outlined_flag report this listing",
])

// Specs section pattern (structured data we already have — strip to avoid
// Gemini re-extracting what we get from DB columns)
const SPECS_BLOCK = /Specs\n(?:Details about this vehicle[\s\S]*?)(?=About this|Media|Loading|$)/m

const HTML_TAG = /<\/?[a-z][^>]*>/gi

export function cleanDescription(raw: string): string {
  if (!raw) return ""

  let text = raw

  // 1. Strip HTML tags
  text = text.replace(HTML_TAG, " ")

  // 2. Strip Classic.com navigation blocks
  for (const pattern of CLASSIC_COM_NAV_PATTERNS) {
    text = text.replace(pattern, "")
  }

  // 3. Strip structured specs block (we have this from DB columns)
  text = text.replace(SPECS_BLOCK, "")

  // 4. Strip footer boilerplate
  for (const pattern of FOOTER_PATTERNS) {
    text = text.replace(pattern, "")
  }

  // 5. Remove nav-only lines
  text = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().toLowerCase()
      if (!trimmed) return true // keep blank lines (for now)
      if (NAV_ONLY_LINES.has(trimmed)) return false
      // Remove lines that are just icons/emojis (unicode control chars)
      if (/^[\s\u{e000}-\u{f8ff}\u{fe00}-\u{fe0f}]+$/u.test(trimmed)) return false
      // Remove lines that are just "View All (N)" or "zoom_in" etc
      if (/^(?:view all|zoom_in|filter|phone)(?:\s*\(\d+\))?$/i.test(trimmed)) return false
      return true
    })
    .join("\n")

  // 6. Collapse excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim()

  // 7. Deduplicate — Classic.com repeats the "About this..." block
  const aboutMatch = text.match(/About this \d{4} Porsche [^\n]+/g)
  if (aboutMatch && aboutMatch.length > 1) {
    // Keep only the first occurrence
    let found = false
    text = text
      .split("\n")
      .filter((line) => {
        if (line.startsWith("About this") && !found) {
          found = true
          return true
        }
        if (line.startsWith("About this") && found) {
          return false
        }
        return true
      })
      .join("\n")
  }

  return text.trim()
}
