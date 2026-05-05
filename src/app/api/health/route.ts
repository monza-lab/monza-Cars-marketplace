import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey ?? anonKey;

  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: url ? `SET (${url.substring(0, 30)}...)` : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? "SET" : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? "SET" : "MISSING",
    usingKey: serviceKey ? "service_role" : anonKey ? "anon" : "NONE",
  };

  if (!url || !key) {
    return NextResponse.json({ ok: false, envStatus, error: "Missing env vars" });
  }

  try {
    const supabase = createClient(url, key);
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("make", "Porsche")
      .eq("status", "active")
      .limit(1);

    if (error) {
      return NextResponse.json({
        ok: false,
        envStatus,
        dbError: error.message,
        dbCode: error.code,
      });
    }

    return NextResponse.json({
      ok: true,
      envStatus,
      activeListingsCount: count,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      envStatus,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
