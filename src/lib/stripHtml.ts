/**
 * Strips HTML tags and decodes common HTML entities from scraped text.
 * Converts `<br>`, `<br/>`, and `brbr` patterns to newlines,
 * strips remaining tags, and decodes entities like `&#x27;`, `&amp;`, etc.
 */
export function stripHtml(raw: string | null | undefined): string {
  if (!raw) return ""

  let text = raw
    // Normalize br variants to newline
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/brbr/gi, "\n")
    // Strip all remaining HTML tags
    .replace(/<[^>]*>/g, "")
    // Decode common HTML entities
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    // Collapse multiple newlines into max 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim leading/trailing whitespace per line
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim()

  return text
}
