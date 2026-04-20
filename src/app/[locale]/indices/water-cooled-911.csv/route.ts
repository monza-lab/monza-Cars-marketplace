import { getWaterCooled911Index } from "@/lib/index/waterCooled911";
import { toCsv } from "@/lib/index/factory";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const payload = await getWaterCooled911Index();
  const csv = toCsv(payload);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="monzahaus-water-cooled-911-index.csv"',
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
