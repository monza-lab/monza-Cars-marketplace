import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");

const hasDeprecatedUrl = /\burl\s*=\s*env\(/.test(schema);
const hasDeprecatedDirectUrl = /\bdirectUrl\s*=\s*env\(/.test(schema);

if (hasDeprecatedUrl || hasDeprecatedDirectUrl) {
  console.error(
    "[verify_prisma_schema] prisma/schema.prisma contains deprecated Prisma 7 datasource fields (`url` or `directUrl`). Move DB URL config to prisma.config.ts.",
  );
  process.exit(1);
}

console.log("[verify_prisma_schema] prisma/schema.prisma is Prisma 7 compatible.");
