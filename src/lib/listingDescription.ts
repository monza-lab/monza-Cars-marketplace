/**
 * Some scrapers store a listing's "description" as the whole competitor page:
 * their navigation, their "Contact Seller" button, their subscription pricing
 * table and their own disclaimers. Rendered inside a MonzaHaus listing that
 * puts a competitor's upgrade offer — and copy we would never write, such as
 * "AI can make mistakes" — in front of the reader, and feeds the same text to
 * page metadata, JSON-LD, rarity scoring and the report engine.
 *
 * Every read path goes through `sanitizeListingDescription`: it salvages the
 * seller's own block when the dump is labelled, and otherwise drops the field
 * so the UI can hide the section instead of publishing page furniture.
 */

/** One of these alone identifies scraped page furniture. */
const STRONG_CHROME_MARKERS: readonly RegExp[] = [
  /\bbecome a classic insider\b/i,
  /\bbrowse auctions\b/i,
  /\bbrowse dealers\b/i,
  /\bsearch listings\b/i,
  /\bupgrade now\b/i,
  /\bAI can make mistakes\b/i,
  /\bAI-generated insights\b/i,
  /\bclassic\.com\b/i,
  /\bsearch person close\b/i,
  /\$\s?\d[\d,.]*\s*\/\s*month\b/i,
  /\bper month\b.*\bupgrade\b/i,
];

/**
 * Phrases that also occur in genuine seller copy ("contact seller for more
 * information"), so two or more must appear before the text is treated as a
 * page dump.
 */
const WEAK_CHROME_MARKERS: readonly RegExp[] = [
  /\bcontact seller\b/i,
  /\ball rights reserved\b/i,
  /\bsee an error\b/i,
  /\bloading seller\b/i,
  /\bsign in\b/i,
  /\bcreate an account\b/i,
  /\bnewsletter\b/i,
  /\bfollow us\b/i,
  /\bcookie (?:policy|preferences)\b/i,
  /\bterms of (?:use|service)\b/i,
  /\bprivacy policy\b/i,
];

const SELLER_DESCRIPTION_HEADING =
  /(?:^|\n)[ \t]*(?:seller'?s?\s+description|description\s+from\s+(?:the\s+)?seller|vehicle\s+description|seller'?s?\s+notes)[ \t]*:?[ \t]*\n/i;

const SELLER_DESCRIPTION_TERMINATOR =
  /\n[ \t]*(?:specs?|specifications|market\s+data|similar\s+(?:cars|listings|vehicles)|sales?\s+history|vehicle\s+history|price\s+history|comparables?|see\s+an\s+error|loading\s+seller|contact\s+seller|become\s+a\s+classic\s+insider|recently\s+sold|browse\s+(?:auctions|dealers)|all\s+rights\s+reserved|©)\b/i;

const MIN_SALVAGEABLE_LENGTH = 80;

export function hasScrapedChrome(text: string | null | undefined): boolean {
  const value = String(text ?? "");
  if (!value.trim()) return false;
  if (STRONG_CHROME_MARKERS.some((pattern) => pattern.test(value))) return true;
  return WEAK_CHROME_MARKERS.filter((pattern) => pattern.test(value)).length >= 2;
}

/**
 * Pull the seller's own block out of a page dump. Returns null when the dump is
 * unlabelled or the salvaged block still carries page furniture.
 */
export function extractSellerDescription(text: string | null | undefined): string | null {
  const value = String(text ?? "");
  if (!value.trim()) return null;

  const heading = SELLER_DESCRIPTION_HEADING.exec(value);
  if (!heading) return null;

  const body = value.slice(heading.index + heading[0].length);
  const terminator = SELLER_DESCRIPTION_TERMINATOR.exec(body);
  const block = (terminator ? body.slice(0, terminator.index) : body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (block.length < MIN_SALVAGEABLE_LENGTH) return null;
  return hasScrapedChrome(block) ? null : block;
}

/**
 * The single entry point for turning a stored description into something
 * publishable. Returns null when nothing of the seller's own words survives.
 */
export function sanitizeListingDescription(text: string | null | undefined): string | null {
  const value = String(text ?? "").trim();
  if (!value) return null;
  if (!hasScrapedChrome(value)) return value;
  return extractSellerDescription(value);
}
