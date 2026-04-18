import { airCooled911IndexConfig } from "./airCooled911";
import { waterCooled911IndexConfig } from "./waterCooled911";
import { porscheTurboIndexConfig } from "./porscheTurbo";
import { porscheGtIndexConfig } from "./porscheGt";

export interface IndexRegistryEntry {
  slug: string;
  name: string;
  description: string;
  tagline: string;
  status: "live" | "upcoming";
}

export const INDEX_REGISTRY: IndexRegistryEntry[] = [
  {
    slug: airCooled911IndexConfig.slug,
    name: "Air-Cooled 911 Index",
    description: airCooled911IndexConfig.description,
    tagline: "993, 964, G-Body, 930, early 911 — the pre-1998 era.",
    status: "live",
  },
  {
    slug: waterCooled911IndexConfig.slug,
    name: "Water-Cooled 911 Index",
    description: waterCooled911IndexConfig.description,
    tagline: "996, 997, 991, 992 — the modern 911 family.",
    status: "live",
  },
  {
    slug: porscheTurboIndexConfig.slug,
    name: "Porsche Turbo Index",
    description: porscheTurboIndexConfig.description,
    tagline: "Fifty years of 911 Turbo — 930 through 992.",
    status: "live",
  },
  {
    slug: porscheGtIndexConfig.slug,
    name: "Porsche GT Index",
    description: porscheGtIndexConfig.description,
    tagline: "GT2, GT3, GT3 RS, GT4 and air-cooled RS — track-bred lineage.",
    status: "live",
  },
  {
    slug: "ferrari-modern-classics",
    name: "Ferrari Modern Classics Index",
    description:
      "348, 355, 360, 430, 458 — the analog-to-digital Ferrari transition.",
    tagline: "Modern Ferrari classics — coming soon.",
    status: "upcoming",
  },
];
