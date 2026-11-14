import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { membershipOf, ticketByCode, checkInTicket } from "@/lib/data";
import { canActor } from "@/lib/perms";
import { fmtDateTime } from "@/lib/format";
import { allowRate } from "@/lib/security";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Tizimga kiring", status: "bad" }, { status: 401 });
  if (!allowRate(`checkin:${user.id}`, 120, 60)) {
    return NextResponse.json({ ok: false, error: "Juda ko'p so'rov — bir daqiqadan so'ng qayta urinib ko'ring", status: "bad" }, { status: 429 });
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: string };
    code = String(body.code ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Kod yuborilmadi", status: "bad" }, { status: 400 });
  }

  const ticket = ticketByCode(code);
  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: "Bunday kodli chipta topilmadi", status: "bad", code: code.trim().toUpperCase() },
      { status: 404 }
    );
  }

  if (!isAdmin(user)) {
    const membership = await membershipOf(user.id, ticket.org_id);
    if (!canActor(membership?.role_key, "reg.view", 0)) {
      return NextResponse.json(
        { ok: false, error: "Bu tadbir chiptasini tekshirishga ruxsatingiz yo'q", status: "bad" },
        { status: 403 }
      );
    }
  }

  const base = {
    attendee: ticket.full_name,
    faculty: ticket.faculty,
    event: ticket.event_title,
    code: ticket.ticket_code,
    at: ticket.checked_in_at ? fmtDateTime(ticket.checked_in_at) : undefined,
  };

  if (ticket.checked_in_at) {
    return NextResponse.json({ ...base, ok: false, status: "dup", error: "Bu chipta allaqachon ishlatilgan" });
  }

  const res = checkInTicket(ticket.registration_id);
  if (!res.ok) {
    return NextResponse.json({ ...base, ok: false, status: "bad", error: res.error });
  }

  return NextResponse.json({
    ...base,
    ok: true,
    status: "ok",
    at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  });
}
