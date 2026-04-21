import { createClient } from "@/lib/supabase/server"

const BUCKET = process.env.SUPABASE_STORAGE_EXPORTS_BUCKET ?? "exports"

export type ExportKind = "pdf" | "xlsx"

export function exportStoragePath(reportHash: string, kind: ExportKind): string {
  const ext = kind === "pdf" ? "pdf" : "xlsx"
  return `${reportHash}/report.${ext}`
}

/** Upload export bytes to Supabase Storage. Idempotent upsert. */
export async function uploadExport(
  reportHash: string,
  kind: ExportKind,
  bytes: Uint8Array | Buffer
): Promise<{ path: string }> {
  const supabase = await createClient()
  const path = exportStoragePath(reportHash, kind)
  const contentType =
    kind === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return { path }
}

/** Return a signed URL valid for N seconds (default 1 hour). */
export async function getSignedExportUrl(
  reportHash: string,
  kind: ExportKind,
  expiresInSeconds = 3600
): Promise<string | null> {
  const supabase = await createClient()
  const path = exportStoragePath(reportHash, kind)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}

/** Check whether an export already exists for this report hash (cache hit). */
export async function exportExists(
  reportHash: string,
  kind: ExportKind
): Promise<boolean> {
  const supabase = await createClient()
  const folder = reportHash
  const { data, error } = await supabase.storage.from(BUCKET).list(folder)
  if (error || !data) return false
  const filename = kind === "pdf" ? "report.pdf" : "report.xlsx"
  return data.some((item) => item.name === filename)
}
