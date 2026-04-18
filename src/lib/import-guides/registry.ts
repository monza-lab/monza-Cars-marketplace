import type { ImportGuide } from "./types";
import { usImportGuide } from "./us";
import { japanImportGuide } from "./japan";
import { germanyImportGuide } from "./germany";
import { ukImportGuide } from "./uk";

export const IMPORT_GUIDES: ImportGuide[] = [
  usImportGuide,
  japanImportGuide,
  germanyImportGuide,
  ukImportGuide,
];

export function getImportGuide(slug: string): ImportGuide | null {
  return IMPORT_GUIDES.find((g) => g.slug === slug) ?? null;
}

export function listImportGuideSlugs(): string[] {
  return IMPORT_GUIDES.map((g) => g.slug);
}
