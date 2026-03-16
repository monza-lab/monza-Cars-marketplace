import { createClient } from "@supabase/supabase-js";

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing supabase credentials");
    return;
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("listings")
    .select("images, photos_media(photo_url)")
    .eq("id", "6f8f9563-997c-4b37-b58c-b084c868ec91")
    .single();

  if (error) {
    console.error("Error fetching listing:", error);
    return;
  }

  console.log("Data:");
  console.log(JSON.stringify(data, null, 2));
}

run();