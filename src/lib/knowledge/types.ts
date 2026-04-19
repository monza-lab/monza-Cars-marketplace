export interface KnowledgeArticle {
  /** URL slug, e.g. "ims-bearing" */
  slug: string;
  /** Display title */
  title: string;
  /** SEO meta title (can differ from H1) */
  seoTitle: string;
  /** One-line summary shown on hub + meta description seed */
  summary: string;
  /** Category, for grouping on the hub page */
  category: "reliability" | "authentication" | "engine" | "ownership" | "market";
  /** 3-5 paragraph intro */
  intro: string[];
  /** Long-form body sections */
  sections: { heading: string; body: string[] }[];
  /** Optional step-by-step (enables HowTo schema) */
  howTo?: {
    name: string;
    description: string;
    steps: { name: string; text: string; url?: string }[];
  };
  /** 6-10 FAQs */
  faqs: { question: string; answer: string }[];
  /** One-paragraph takeaway */
  verdict: string;
  /** Keywords */
  keywords: string[];
}
