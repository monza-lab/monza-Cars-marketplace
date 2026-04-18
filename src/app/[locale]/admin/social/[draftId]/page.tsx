import { requireAdmin } from "@/features/social-engine/auth";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { DraftEditor } from "./DraftEditor";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({ params }: { params: Promise<{ draftId: string; locale: string }> }) {
  await requireAdmin();
  const { draftId, locale } = await params;
  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) notFound();

  return (
    <div style={{
      minHeight: "100vh", background: "#0E0A0C", color: "#E8E2DE", padding: "48px 64px",
      fontFamily: "Karla, sans-serif",
    }}>
      <Link href={`/${locale}/admin/social`} style={{ color: "#9A8E88", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", textDecoration: "none" }}>
        ← Back to drafts
      </Link>
      <h1 style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 40, margin: "16px 0 32px" }}>
        Draft {draftId.slice(0, 8)}
      </h1>
      <DraftEditor draft={draft} />
    </div>
  );
}
