import { getPorscheTurboIndex } from "@/lib/index/porscheTurbo";
import { toCsv } from "@/lib/index/factory";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const payload = await getPorscheTurboIndex();
  const csv = toCsv(payload);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="monzahaus-porsche-turbo-index.csv"',
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
