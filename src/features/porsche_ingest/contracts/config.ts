import { z } from "zod";

export const SourceArgSchema = z.enum(["bat", "carsandbids", "autoscout24", "classiccars", "all"]);
export const ModeArgSchema = z.enum(["sample", "incremental", "backfill"]);

export const CliConfigSchema = z.object({
  source: SourceArgSchema.default("bat"),
  mode: ModeArgSchema.default("incremental"),
  limit: z.number().int().positive().max(5000).default(100),
  dryRun: z.boolean().default(false),
  failFast: z.boolean().default(false),
  soldOnly: z.boolean().default(false),
  soldWithinMonths: z.number().int().positive().max(120).optional(),
  activeOnly: z.boolean().default(false),
  since: z.string().optional(),
  from: z.string().optional(),
  resume: z.string().optional(),
});

export const EnvSchema = z.object({
  APIFY_TOKEN: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  APIFY_BAT_ACTOR_ID: z.string().min(1),
  APIFY_CARSANDBIDS_ACTOR_ID: z.string().min(1),
  APIFY_AUTOSCOUT24_ACTOR_ID: z.string().min(1),
  APIFY_CLASSICCARS_ACTOR_ID: z.string().min(1),
});

export type CliConfig = z.infer<typeof CliConfigSchema>;
export type SourceArg = z.infer<typeof SourceArgSchema>;
export type ModeArg = z.infer<typeof ModeArgSchema>;
