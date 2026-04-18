# SEO Indexing Playbook — MonzaHaus

**One-time setup that Edgar (or whoever owns domain verification) must complete after deploy.** Everything below needs access to `monzalab.com` DNS or Google/Bing account ownership — Claude cannot do these interactively.

---

## 1. Google Search Console (5 min)

**URL:** https://search.google.com/search-console

1. Sign in with the Google account that owns `monzalab.com`.
2. Click **Add property** → choose **Domain** property (not URL-prefix — domain covers all subdomains + http/https).
3. Verification: Google gives a TXT record. Add to DNS:
   - Provider: wherever `monzalab.com` DNS is hosted (Vercel, Cloudflare, Namecheap, etc.)
   - Type: `TXT`
   - Name: `@` (root)
   - Value: the string Google provides (looks like `google-site-verification=abc123...`)
   - Wait 5–15 minutes for DNS propagation, click **Verify**.
4. **Submit the sitemap:** Sitemaps → Add a new sitemap → enter `sitemap.xml` → Submit.
5. **Set preferred canonical:** Settings → Preferred domain (if applicable).
6. **Coverage check:** Pages → see which URLs are being crawled/indexed over the next 24–72 hours.

Google Search Console is the **primary** indexing channel. Bing and others cooperate via IndexNow, but Google must be done separately via Search Console.

---

## 2. Bing Webmaster Tools (5 min)

**URL:** https://www.bing.com/webmasters

1. Sign in and click **Add a site** → enter `https://monzalab.com`.
2. Verification options: BingSiteAuth.xml file (preferred) or DNS TXT record.
3. **Submit sitemap:** `https://monzalab.com/sitemap.xml`.
4. Optional: import from Google Search Console (Bing has a one-click importer).

Bing powers DuckDuckGo and Ecosia, so this indirectly covers them too.

---

## 3. IndexNow (already configured — just run)

IndexNow is the open protocol for pushing URL updates to Bing, Yandex, Seznam, Naver, and any cooperating indexer. Configuration is already in place:

- **Key:** `142ba841b9e60590d23f26af5a9b53cb`
- **Key file:** `public/142ba841b9e60590d23f26af5a9b53cb.txt` (served at `https://monzalab.com/142ba841b9e60590d23f26af5a9b53cb.txt`)
- **Script:** `scripts/indexnow-submit.ts`
- **Run:** `npm run seo:indexnow`

The script reads the current sitemap and POSTs every URL to `api.indexnow.org`. Safe to re-run — IndexNow deduplicates.

**Run after each major deploy** that adds new pages. Recommended cadence: weekly.

To override host or key per environment:

```bash
INDEXNOW_KEY=... INDEXNOW_HOST=monzalab.com npm run seo:indexnow
```

---

## 4. Apple Search (Safari + Siri Search Suggestions)

Apple uses Applebot which crawls sites autonomously. It respects `robots.txt` — our current `robots.txt` allows `Applebot` explicitly. No submission required; Apple crawls on its own cadence.

---

## 5. LLM-specific notes

There is no public "submit sitemap" API for ChatGPT, Claude, Gemini, Perplexity. These models build their knowledge from web crawls at training time + real-time search at inference time.

**What already works for us:**

- `/llms.txt` published at `https://monzalab.com/llms.txt` — read by ChatGPT and Claude browsing sessions, and increasingly by Perplexity.
- Structured data (Dataset, Article, FAQPage, HowTo) — Perplexity and Google AI Overviews use this to surface the site in answers.
- Explicit AI bot allowances in `robots.txt` — GPTBot, ChatGPT-User, Claude-Web, ClaudeBot, PerplexityBot, Google-Extended, etc.

**What accelerates LLM coverage:**

- External inbound links from sites the LLM-crawlers already index (Wikipedia, Reddit r/porsche, forums).
- PR / guest posts on Hagerty, Road & Track, Petrolicious, Classic Driver.
- Being cited in an answer on an existing high-authority site.

There is no shortcut. Content quality + inbound links + time.

---

## 6. Re-validation checklist (run monthly)

Monthly ops to keep SEO signals fresh:

- [ ] Run `npm run seo:indexnow` to push latest URLs to Bing/Yandex/etc.
- [ ] Review Google Search Console Coverage report — confirm no mass de-indexing events.
- [ ] Review Search Console Performance — track queries that are ranking (adjust content if drift).
- [ ] Check Bing Webmaster Tools for crawl errors.
- [ ] Verify `https://monzalab.com/sitemap.xml` returns 200 and includes the current URL set.
- [ ] Verify `https://monzalab.com/llms.txt` returns 200 and mentions recent additions.
- [ ] Verify `https://monzalab.com/robots.txt` is unchanged from expected allow-list.

---

## 7. Current SEO surface area (reference)

As of 2026-04-18, the indexable surface covers:

- **MonzaHaus Index** — 5 pages × 4 locales (20) + 4 CSV endpoints + dynamic OG images.
- **Model buyer's guides** — 6 × 4 locales (24).
- **Generation comparisons** — 5 × 4 (20).
- **Variant deep-dives** — 9 × 4 (36).
- **Import guides** — 4 × 4 (16).
- **Buy hub** — 1 × 4 (4).
- **VIN decoder tool** — 1 × 4 (4).
- **Knowledge articles** — 4+ × 4 (16+).
- **Existing car + make pages** — 14 existing.

**Total:** ~160+ indexable SEO-first URLs, growing.

Schema types live: Article, Dataset, DataDownload, CollectionPage, Organization, WebSite, SoftwareApplication, BreadcrumbList, FAQPage, Question, Answer, HowTo, HowToStep, Vehicle (Car, Brand, Offer), ImageObject, ContactPoint.
