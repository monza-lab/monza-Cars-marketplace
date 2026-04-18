# Social Engine — Operating Modes

## Current mode: v0.5 (local semi-auto batch)

Generates 10 carousels + captions per day to a local folder. Edgar uploads manually to Meta Business Suite.

### Prerequisites
1. `producto/supabase/migrations/20260418_create_social_post_drafts.sql` **applied to Supabase** (the migration creates `social_post_drafts`; v0.5 doesn't write to it but other tools may).
2. Env vars in `producto/.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (for Claude caption generation)
   - Optional: `GOOGLE_GENERATIVE_AI_API_KEY` (not used in v0.5 unless vision is re-enabled)

### Daily run

```bash
cd producto
npx tsx scripts/generate-daily-batch.ts
# or with custom count
npx tsx scripts/generate-daily-batch.ts 15
```

Output lands in `producto/posts/YYYY-MM-DD/`. Open `INDEX.md` for a summary + upload checklist.

### Per-post folder contents
- `slide-1.png` … `slide-5.png` — 1080×1350 PNGs, ready for Instagram 4:5 / Facebook
- `caption.txt` — copy into the Meta post
- `listing-info.md` — metadata reference (VIN, price, source URL)

### Upload workflow
1. Open `posts/YYYY-MM-DD/INDEX.md`
2. For each post folder:
   - Copy `caption.txt`
   - In Meta Business Suite → Create post → Carousel
   - Upload the 5 slides in order
   - Paste caption
   - Select Facebook Page + Instagram → Publish (or Schedule)

### Regenerating a single post
Delete the folder inside `posts/YYYY-MM-DD/` and re-run the script — it skips folders that already exist.

---

## Future mode: v1 (fully automated IG + FB publisher)

# Social Engine — One-Time Setup Guide

Complete these steps before enabling the Vercel Cron entry for `/api/cron/social-engine`.

## 1. Supabase Storage bucket

Supabase dashboard → Storage → New bucket:
- Name: `social-carousels`
- Public: **Yes** (read)
- File size limit: 10 MB

Bucket policies (add via SQL editor):

```sql
-- Allow service role writes, public reads
create policy "Service role writes" on storage.objects
  for all using (bucket_id = 'social-carousels' and auth.role() = 'service_role');
create policy "Public read" on storage.objects
  for select using (bucket_id = 'social-carousels');
```

## 2. Meta Business Setup

### Required accounts
- Meta Business Manager account
- A Facebook Page under that Business Manager
- An Instagram **Business** account (not Personal, not Creator). Convert via Instagram app → Settings → Account type → Switch to Professional → Business.
- Instagram account linked to the Page: Facebook Page → Settings → Linked accounts → Instagram → Connect.

### Create Meta App
1. Go to https://developers.facebook.com/apps → Create App
2. App type: **Business**
3. Add these products to the app:
   - **Facebook Login for Business**
   - **Instagram Graph API**
4. In App Review → Permissions and Features, request (or use in dev mode):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`

### Obtain Page Access Token
1. Tools → Graph API Explorer
2. Select your app and user token with the above permissions
3. GET `/me/accounts` → find your Page and copy its `access_token`
4. Convert to long-lived (60 days):
   ```
   curl "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}"
   ```
5. That long-lived token is what goes in `META_PAGE_ACCESS_TOKEN`.

### Get IG Business ID
```
curl "https://graph.facebook.com/v19.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}"
```
Returns `{ "instagram_business_account": { "id": "17841..." } }` — copy that ID into `META_IG_BUSINESS_ID`.

## 3. Environment variables

Add to Vercel (Settings → Environment Variables) and to `.env.local`:

```
META_PAGE_ACCESS_TOKEN=<long-lived token from step 2>
META_PAGE_ID=<numeric Page ID>
META_IG_BUSINESS_ID=<numeric IG Business Account ID>
META_GRAPH_API_VERSION=v19.0
ADMIN_DASHBOARD_TOKEN=<openssl rand -hex 32>
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
CRON_SECRET=<openssl rand -hex 32>  # optional; Vercel can auto-provide
```

Existing vars expected to already be present:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`)

## 4. Token refresh — manual for v1

Meta long-lived Page tokens last **~60 days**. Vercel logs will not auto-alert. Put a calendar reminder to refresh every 50 days. To refresh, re-run the long-lived exchange from step 2.

## 5. First run

1. Deploy to production.
2. Trigger the worker manually once to seed a draft:
   ```
   curl "https://yourdomain.com/api/cron/social-engine" -H "authorization: Bearer $CRON_SECRET"
   ```
3. Visit `https://yourdomain.com/admin/social/login`, enter your admin token.
4. Open a draft, click Generate, then Publish. Verify the post appears on IG + FB.

## 6. Troubleshooting

- **"Invalid image URL"** from Meta → the slide URL must be **publicly reachable over HTTPS**. Supabase Storage public bucket is fine; private bucket is not.
- **IG publish "duplicate media"** → Meta deduplicates within a short window. Regenerate slides to get new URLs, then republish.
- **Vision score always low** → check that the first 3 `images[]` entries are real photo URLs. AS24 listings can have placeholder `/assets/` entries at index 1.
