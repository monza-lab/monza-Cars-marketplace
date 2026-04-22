import { NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/pricing/priceHistory";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const data = await getPriceHistory(id, requestId);
  return NextResponse.json({ success: true, data });
}
