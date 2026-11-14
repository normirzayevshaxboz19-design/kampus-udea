import { headers } from "next/headers";

/**
 * Ichki yo'nalishni tekshiradi — open redirect (//evil.com, /\evil.com) oldini oladi.
 * Faqat sayt ichidagi "/..." yo'llar qabul qilinadi.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\") || raw.includes("://") || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}

/** Tashqi havola: faqat http(s) qoldiriladi (javascript:/data: kabi sxemalar bloklanadi). */
export function safeExternalUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^(javascript|data|vbscript|file|blob):/i.test(raw)) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** So'rov yuborgan mijoz IP manzili (proxy sarlavhalaridan). */
export async function clientIp(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || store.get("x-real-ip") || "local";
}

/** Oyna (fixed-window) asosidagi sodda cheklov. true — ruxsat berildi. */
export { allowRate, resetRate } from "./rate-limit";
