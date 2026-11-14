import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

const TICKET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Taxmin qilib bo'lmaydigan chipta kodi (kriptografik tasodifiy, ~30 bit). */
export function ticketCode(prefix: string): string {
  let body = "";
  for (let i = 0; i < 6; i += 1) body += TICKET_ALPHABET[randomInt(TICKET_ALPHABET.length)];
  return `${prefix}-${body}`;
}
