// ---------------------------------------------------------------------------
// Model Tracker for Historical Backfill
// ---------------------------------------------------------------------------
// Tracks which make/model combinations need historical backfill.
// Provides state management for the historical scraping pipeline.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelIdentifier {
  make: string;
  model: string;
}

export interface BackfillState {
  status: 'pending' | 'backfilled' | 'failed';
  backfilledAt: Date | null;
  auctionCount: number;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// State Management Functions
// ---------------------------------------------------------------------------

/**
 * Check if a make/model combination has been backfilled.
 */
export async function getBackfillState(
  make: string,
  model: string,
): Promise<BackfillState | null> {
  const state = await prisma.modelBackfillState.findUnique({
    where: { make_model: { make, model } },
  });

  if (!state) return null;

  return {
    status: state.status.toLowerCase() as BackfillState['status'],
    backfilledAt: state.backfilledAt,
    auctionCount: state.auctionCount,
    errorMessage: state.errorMessage,
  };
}

/**
 * Check if a make/model needs historical backfill.
 * Returns true if never backfilled or previously failed.
 */
export async function needsBackfill(make: string, model: string): Promise<boolean> {
  const state = await getBackfillState(make, model);
  return !state || state.status === 'pending' || state.status === 'failed';
}

/**
 * Mark a model as pending backfill.
 * Called when a new model is seen during live scraping.
 */
export async function markPending(make: string, model: string): Promise<void> {
  await prisma.modelBackfillState.upsert({
    where: { make_model: { make, model } },
    update: { status: 'PENDING', updatedAt: new Date() },
    create: {
      make,
      model,
      status: 'PENDING',
    },
  });
}

/**
 * Get all models pending backfill.
 */
export async function getPendingModels(): Promise<ModelIdentifier[]> {
  const states = await prisma.modelBackfillState.findMany({
    where: { status: 'PENDING' },
    select: { make: true, model: true },
  });
  return states;
}

/**
 * Mark a model as successfully backfilled.
 */
export async function markBackfilled(
  make: string,
  model: string,
  auctionCount: number,
): Promise<void> {
  await prisma.modelBackfillState.update({
    where: { make_model: { make, model } },
    data: {
      status: 'BACKFILLED',
      backfilledAt: new Date(),
      auctionCount,
      errorMessage: null,
    },
  });
}

/**
 * Mark a model as failed.
 */
export async function markFailed(
  make: string,
  model: string,
  errorMessage: string,
): Promise<void> {
  await prisma.modelBackfillState.update({
    where: { make_model: { make, model } },
    data: {
      status: 'FAILED',
      errorMessage,
    },
  });
}

/**
 * Identify new models from a list of auctions and mark them pending.
 * Returns only the newly marked models (those that actually needed backfill).
 */
export async function identifyAndMarkNewModels(
  auctions: Array<{ make: string; model: string }>,
): Promise<ModelIdentifier[]> {
  // Deduplicate to unique make/model combinations
  const uniqueModels = new Map<string, ModelIdentifier>();

  for (const auction of auctions) {
    const key = `${auction.make}|${auction.model}`;
    if (!uniqueModels.has(key)) {
      uniqueModels.set(key, { make: auction.make, model: auction.model });
    }
  }

  const newModels: ModelIdentifier[] = [];

  for (const model of uniqueModels.values()) {
    const needs = await needsBackfill(model.make, model.model);
    if (needs) {
      await markPending(model.make, model.model);
      newModels.push(model);
    }
  }

  console.log(`[ModelTracker] Identified ${newModels.length} new models needing backfill`);
  return newModels;
}

/**
 * Get statistics about backfill state.
 */
export async function getBackfillStats(): Promise<{
  pending: number;
  backfilled: number;
  failed: number;
  total: number;
}> {
  const [pending, backfilled, failed] = await Promise.all([
    prisma.modelBackfillState.count({ where: { status: 'PENDING' } }),
    prisma.modelBackfillState.count({ where: { status: 'BACKFILLED' } }),
    prisma.modelBackfillState.count({ where: { status: 'FAILED' } }),
  ]);

  return {
    pending,
    backfilled,
    failed,
    total: pending + backfilled + failed,
  };
}
