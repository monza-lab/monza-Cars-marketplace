"use server";

import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

async function assertAdmin() {
  const store = await cookies();
  if (store.get("admin_token")?.value !== process.env.ADMIN_DASHBOARD_TOKEN) {
    throw new Error("unauthorized");
  }
}

export async function triggerGenerate(draftId: string) {
  await assertAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const r = await fetch(`${baseUrl}/api/social/generate/${draftId}`, {
    method: "POST",
    headers: { "x-admin-token": process.env.ADMIN_DASHBOARD_TOKEN! },
  });
  if (!r.ok) {
    throw new Error(`generate failed: ${await r.text()}`);
  }
  revalidatePath(`/admin/social/${draftId}`);
}

export async function triggerPublish(draftId: string, captionFinal: string) {
  await assertAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const r = await fetch(`${baseUrl}/api/social/publish/${draftId}`, {
    method: "POST",
    headers: {
      "x-admin-token": process.env.ADMIN_DASHBOARD_TOKEN!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ caption_final: captionFinal }),
  });
  if (!r.ok) {
    throw new Error(`publish failed: ${await r.text()}`);
  }
  revalidatePath(`/admin/social/${draftId}`);
  revalidatePath(`/admin/social`);
}

export async function discardDraft(draftId: string, reason: string) {
  await assertAdmin();
  const repo = new DraftRepository();
  await repo.discard(draftId, reason || "manually discarded");
  revalidatePath(`/admin/social`);
}
