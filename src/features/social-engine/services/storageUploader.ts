import { createClient } from "@supabase/supabase-js";

const BUCKET = "social-carousels";

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function uploadSlidePng(draftId: string, slideIdx: number, png: Buffer): Promise<string> {
  const supa = makeClient();
  const path = `${draftId}/slide-${slideIdx}.png`;
  const { error } = await supa.storage.from(BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
