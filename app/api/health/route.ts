import { NextResponse } from "next/server";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Hosting provayderlarining health-check'i uchun. */
export async function GET() {
  try {
    const row = one<{ ok: number }>("SELECT 1 AS ok");
    return NextResponse.json(
      { ok: row?.ok === 1, uptime: Math.round(process.uptime()) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
