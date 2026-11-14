import { one, run } from "./db";

/** Oyna (fixed-window) asosidagi sodda cheklov. true — ruxsat berildi. */
export function allowRate(key: string, limit: number, windowSeconds: number): boolean {
  const row = one<{ count: number; window_start: string }>(
    "SELECT count, window_start FROM rate_limits WHERE key = ?",
    key
  );
  if (!row) {
    run("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, datetime('now'))", key);
    return true;
  }
  const expired = one<{ old: number }>(
    "SELECT (window_start < datetime('now', ?)) AS old FROM rate_limits WHERE key = ?",
    `-${windowSeconds} seconds`,
    key
  )?.old;
  if (expired) {
    run("UPDATE rate_limits SET count = 1, window_start = datetime('now') WHERE key = ?", key);
    return true;
  }
  if (row.count >= limit) return false;
  run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
  return true;
}

/** Muvaffaqiyatli urinishdan keyin hisoblagichni tozalash (masalan, login). */
export function resetRate(key: string): void {
  run("DELETE FROM rate_limits WHERE key = ?", key);
}
