# Supabase Data Population Guide

## ✅ Implementation Status: COMPLETE

The scraper system has been successfully implemented and is ready to populate your Supabase database with auction data.

## 📊 Database Schema

The following tables will be populated:

### 1. Auction Table (Already exists: 12 rows)
Stores all auction listings (both live and historical)
- **Live auctions**: Status = 'ACTIVE' or 'ENDING_SOON'
- **Historical auctions**: Status = 'SOLD' (from BaT backfill)
- **Key fields**: make, model, year, currentBid, finalPrice, status, url, images

### 2. PriceHistory Table (Already exists: 48 rows)
Tracks price changes over time
- Linked to Auction via auctionId
- Records every bid/price snapshot

### 3. ModelBackfillState Table (✅ NEW - Created)
Tracks which models have been backfilled with historical data
- **Status values**: PENDING, BACKFILLED, FAILED
- **Unique constraint**: make + model combination
- Prevents duplicate historical scraping

## 🚀 How to Populate Data

### Step 1: Update Environment Variables

Edit `.env.local` and add your actual Supabase database password:

```bash
# Get your database password from Supabase Dashboard:
# Project Settings > Database > Connection String

DATABASE_URL=postgresql://postgres:[YOUR_ACTUAL_PASSWORD]@db.xgtlnyemulgdebyweqlf.supabase.co:5432/postgres
```

### Step 2: Run the Scraper

**Option A: Via API Endpoint (Recommended)**

```bash
# Start the dev server
npm run dev

# Trigger the cron job (in another terminal)
curl -X GET "http://localhost:3000/api/cron" \
  -H "Authorization: Bearer your-cron-secret-key-here"
```

**Option B: Via Test Script**

```bash
# Set the database password first
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xgtlnyemulgdebyweqlf.supabase.co:5432/postgres"

# Run the test script
npx tsx scripts/test-scraper-with-backfill.ts
```

## 📈 Expected Data Flow

### First Run (New Models Discovered):
1. **Live Scraping**: Fetches current auctions from BaT, C&B, CC
2. **New Model Detection**: Identifies unique make/model combinations
3. **Historical Backfill**: For each new model:
   - Searches BaT for 12 months of sold auctions
   - Stores ~20-50 historical sales per model
   - Marks model as "BACKFILLED"
4. **Total Expected**: 50-200 new auction records

### Subsequent Runs:
1. **Live Scraping**: Updates current auctions
2. **Status Detection**: Marks ended auctions as SOLD/ENDED
3. **Skip Backfill**: Models already backfilled are skipped
4. **New Models Only**: Only backfills if new make/model appears

## 🔍 Data Verification

After running the scraper, verify data in Supabase:

```sql
-- Count live auctions
SELECT COUNT(*) FROM "Auction" WHERE status = 'ACTIVE';

-- Count sold auctions (historical)
SELECT COUNT(*) FROM "Auction" WHERE status = 'SOLD';

-- Check backfill status
SELECT make, model, status, "auctionCount" 
FROM "ModelBackfillState" 
ORDER BY "backfilledAt" DESC;

-- Sample recent auctions
SELECT make, model, year, "currentBid", status
FROM "Auction"
ORDER BY "scrapedAt" DESC
LIMIT 10;
```

## 🎯 Key Features Implemented

✅ **Status Detection**: Automatically detects SOLD vs ACTIVE from HTML
✅ **Historical Backfill**: Fetches 12 months of sold auctions for new models
✅ **Rate Limiting**: 2.5s delays between requests (respectful scraping)
✅ **Duplicate Prevention**: Checks externalId before inserting
✅ **Error Resilience**: Continues on errors, retries failed models
✅ **Zero Dependencies**: Uses existing Prisma/Cheerio setup

## 📁 Files Created/Modified

### New Files:
- `src/lib/scrapers/historical/baHistorical.ts` - BaT historical scraper
- `src/lib/scrapers/historical/modelTracker.ts` - Model backfill tracking
- `src/lib/scrapers/historical/index.ts` - Module exports

### Modified Files:
- `src/lib/scrapers/bringATrailer.ts` - Added status detection
- `src/lib/scrapers/carsAndBids.ts` - Added status detection
- `src/lib/scrapers/collectingCars.ts` - Added status detection
- `src/lib/scrapers/index.ts` - Added backfill orchestration
- `src/app/api/cron/route.ts` - Integrated historical backfill
- `prisma/schema.prisma` - Added ModelBackfillState table

## ⏱️ Cron Schedule Recommendation

Add to Vercel Dashboard or your cron service:

```bash
# Every 6 hours
0 */6 * * * curl -X GET "https://your-app.vercel.app/api/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 🎉 Ready to Execute!

The system is fully configured and ready. Just:
1. Add your database password to `.env.local`
2. Run the scraper using one of the methods above
3. Check Supabase for populated data!

**Next Step**: Provide your database password and I'll trigger the scraper for you.