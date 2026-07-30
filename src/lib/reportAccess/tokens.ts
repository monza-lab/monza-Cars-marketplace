import { createHash, createHmac, randomBytes } from "node:crypto"

export function createAccessToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function hashIdentifier(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex")
}
