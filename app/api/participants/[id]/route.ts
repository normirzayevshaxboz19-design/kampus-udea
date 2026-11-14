import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { membershipOf, participants } from "@/lib/data";
import { one } from "@/lib/db";
import { canActor } from "@/lib/perms";
import { REG_STATUS } from "@/lib/labels";

function cell(value: string | null | undefined): string {
  const text = (value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Avval tizimga kiring", { status: 401 });

  const event = one<{ org_id: string; title: string }>("SELECT org_id, title FROM events WHERE id = ?", id);
  if (!event) return new NextResponse("Tadbir topilmadi", { status: 404 });

  const membership = await membershipOf(user.id, event.org_id);
  if (!canActor(membership?.role_key, "reg.export", isAdmin(user))) {
    return new NextResponse("Bu ro'yxatni yuklab olishga ruxsatingiz yo'q", { status: 403 });
  }

  const rows = participants(id);
  const header = ["Ism familiya", "Fakultet", "Email", "Holat", "Chipta", "Ro'yxat sanasi", "Davomat"];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((r) =>
      [
        r.full_name,
        r.faculty,
        r.email,
        REG_STATUS[r.status]?.label ?? r.status,
        r.ticket_code,
        r.created_at,
        r.checked_in_at ?? "",
      ]
        .map(cell)
        .join(",")
    ),
  ];

  const fileName = `ishtirokchilar-${event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)}.csv`;
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
