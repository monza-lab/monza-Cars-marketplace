import { z } from "zod";

const MODEL_PATTERN = /^[A-Za-z0-9 .\-/]+$/;

export const FerrariHistoryInputSchema = z.object({
  make: z.literal("ferrari"),
  model: z.string().trim().min(1).max(80).regex(MODEL_PATTERN),
  months: z.literal(12).default(12),
  limit: z.number().int().min(50).max(200).default(120),
});

export const FerrariSoldListingRowSchema = z.object({
  id: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  status: z.string(),
  final_price: z.number().nullable(),
  hammer_price: z.union([z.number(), z.string(), z.null()]),
  end_time: z.string().nullable(),
  sale_date: z.string().nullable(),
  original_currency: z.string().nullable(),
  source: z.string().nullable(),
  year: z.number().nullable(),
  mileage: z.number().nullable(),
  location: z.string().nullable(),
  source_url: z.string().nullable(),
});

export const FerrariSoldListingSchema = z.object({
  id: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  sold_price: z.number().positive(),
  sold_at: z.string().datetime({ offset: true }),
  currency: z.string().trim().min(1),
  source_platform: z.string().nullable(),
  year: z.number().nullable(),
  mileage: z.number().nullable(),
  location: z.string().nullable(),
  listing_url: z.string().nullable(),
});

export const PriceHistoryEntrySchema = z.object({
  id: z.string().min(1),
  bid: z.number().positive(),
  timestamp: z.string().datetime({ offset: true }),
});

export const ComparableSaleSchema = z.object({
  title: z.string().min(1),
  soldPrice: z.number().positive(),
  soldDate: z.string().min(1),
  platform: z.string().min(1),
  mileage: z.number().nullable().optional(),
  url: z.string().nullable().optional(),
});

export type FerrariHistoryInput = z.infer<typeof FerrariHistoryInputSchema>;
export type FerrariSoldListingRow = z.infer<typeof FerrariSoldListingRowSchema>;
export type FerrariSoldListing = z.infer<typeof FerrariSoldListingSchema>;
export type FerrariPriceHistoryEntry = z.infer<typeof PriceHistoryEntrySchema>;
export type FerrariComparableSale = z.infer<typeof ComparableSaleSchema>;
