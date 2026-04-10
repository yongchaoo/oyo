import crypto from "crypto";

/** Generate a short 8-char ID */
export function genId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Get today's date in YYYY-MM-DD format (local timezone) */
export function today(): string {
  return new Date().toLocaleDateString("sv"); // sv locale gives YYYY-MM-DD
}

