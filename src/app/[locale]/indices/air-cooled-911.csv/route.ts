import { getAirCooled911Index, toCsv } from "@/lib/index/airCooled911";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const payload = await getAirCooled911Index();
  const csv = toCsv(payload);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="monzahaus-air-cooled-911-index.csv"',
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
