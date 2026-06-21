import { randomUUID } from "crypto"

export function generateReferenceNumber(platform: string, type: "C" | "E"): string {
  const prefix = platform === "et" ? "ET" : "AB"
  const year = new Date().getFullYear()
  // Use middle section of two UUIDs for maximum randomness
  const uuid1 = randomUUID().replace(/-/g, "")
  const suffix = uuid1.slice(8, 16).toUpperCase()
  return prefix + "-" + type + "-" + year + "-" + suffix
}

export function generateProfileToken(): string {
  // Two concatenated UUIDs — cryptographically secure, collision-proof
  return randomUUID() + randomUUID()
}
