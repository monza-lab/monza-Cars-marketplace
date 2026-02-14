// ---------------------------------------------------------------------------
// Historical Scrapers Index
// ---------------------------------------------------------------------------
// Re-exports for the historical scraping module.
// ---------------------------------------------------------------------------

export {
  fetchHistoricalAuctions,
  storeHistoricalAuctions,
  scrapeHistoricalForModel,
  parseHistoricalAuction,
  type HistoricalAuctionRecord,
  type HistoricalScrapeResult,
} from './baHistorical';

export {
  getBackfillState,
  needsBackfill,
  markPending,
  getPendingModels,
  markBackfilled,
  markFailed,
  identifyAndMarkNewModels,
  getBackfillStats,
  type ModelIdentifier,
  type BackfillState,
} from './modelTracker';
