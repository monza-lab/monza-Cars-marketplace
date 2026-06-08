import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public", "rarity-methodology.html"), "utf8");

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
