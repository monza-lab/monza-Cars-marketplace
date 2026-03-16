import { z } from "zod";

export const CanonicalSourceSchema = z.enum(["BaT", "CarsAndBids", "AutoScout24", "ClassicCars"]);
export const CanonicalStatusSchema = z.enum(["active", "sold", "unsold", "delisted", "draft"]);

export const CanonicalListingSchema = z.object({
  source: CanonicalSourceSchema,
  source_id: z.string().min(1),
  source_url: z.string().url(),
  make: z.literal("Porsche"),
  model: z.string().min(1),
  year: z.number().int().gte(1948).lte(new Date().getUTCFullYear() + 1),
  title: z.string().min(1),
  status: CanonicalStatusSchema,
  sale_date: z.string().nullable(),
  vin: z.string().min(5).nullable().optional(),
  hammer_price: z.number().nonnegative().nullable().optional(),
  current_bid: z.number().nonnegative().nullable().optional(),
  bid_count: z.number().int().nonnegative().nullable().optional(),
  final_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(3).max(3).nullable().optional(),
  mileage: z.number().int().nonnegative().nullable().optional(),
  mileage_unit: z.enum(["km", "miles"]).default("km"),
  country: z.string().min(1).default("Unknown"),
  region: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  auction_house: z.string().min(1),
  description_text: z.string().nullable().optional(),
  images: z.array(z.string().url()).default([]),
  raw_payload: z.record(z.string(), z.unknown()),
});

export type CanonicalListing = z.infer<typeof CanonicalListingSchema>;

export type NormalizeReject = {
  source: z.infer<typeof CanonicalSourceSchema>;
  reason: string;
  details?: Record<string, unknown>;
  raw: Record<string, unknown>;
};
