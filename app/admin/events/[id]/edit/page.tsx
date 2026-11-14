import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { getEventById, membershipOf } from "@/lib/data";
import { fmtEventRange } from "@/lib/format";
import { EVENT_STATUS } from "@/lib/labels";
import { canActor } from "@/lib/perms";
import { saveEventAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/admin/events/${id}/edit`);
  const { lang, t } = await getT();
  const event = getEventById(id);
  if (!event) notFound();

  const membership = await membershipOf(user.id, event.org_id);
  const allowed = canActor(membership?.role_key, "event.manage", isAdmin(user));
  if (!allowed) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-text-primary">{t("Bu tadbirni tahrirlash uchun ruxsatingiz yo'q.")}</p>
        <Link href="/admin/events" className="btn-ghost btn-sm mt-3">
          {t("Tadbirlar")}
        </Link>
      </div>
    );
  }

  const st = EVENT_STATUS[event.status] ?? EVENT_STATUS.published;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-tertiary hover:text-text-primary"
      >
        ← {t("Tadbirlar")}
      </Link>

      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-academic">{event.org_name}</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-text-primary">{t("Tadbirni tahrirlash")}</h1>
            <p className="mt-1 text-[12.5px] text-text-tertiary">
              {fmtEventRange(event.starts_at, event.ends_at, lang)} ·{" "}
              <span className={`badge ${st.className}`}>{t(st.label)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/events/${event.id}`} className="btn-soft btn-sm">
              {t("Ishtirokchilar")}
            </Link>
            <Link href={`/events/${event.slug}`} className="btn-ghost btn-sm">
              {t("Ochiq sahifa")}
            </Link>
          </div>
        </div>
      </div>

      <form action={saveEventAction} className="card grid gap-3 p-5 sm:grid-cols-2">
        <input type="hidden" name="event_id" value={event.id} />

        <label className="sm:col-span-2">
          <span className="label">{t("Tadbir nomi")}</span>
          <input name="title" defaultValue={event.title} required className="input" />
        </label>

        <label>
          <span className="label">{t("Emoji")}</span>
          <input name="emoji" defaultValue={event.emoji} maxLength={4} className="input" />
        </label>
        <label>
          <span className="label">{t("Joy")}</span>
          <input name="location" defaultValue={event.location ?? ""} className="input" />
        </label>

        <label>
          <span className="label">{t("Boshlanish")}</span>
          <input type="datetime-local" name="starts_at" defaultValue={event.starts_at.slice(0, 16)} required className="input" />
        </label>
        <label>
          <span className="label">{t("Tugash")}</span>
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={event.ends_at ? event.ends_at.slice(0, 16) : ""}
            className="input"
          />
        </label>

        <label>
          <span className="label">{t("Ro'yxat ochilishi")}</span>
          <input
            type="datetime-local"
            name="reg_opens_at"
            defaultValue={event.reg_opens_at ? event.reg_opens_at.slice(0, 16) : ""}
            className="input"
          />
        </label>
        <label>
          <span className="label">{t("Ro'yxat muddati")}</span>
          <input
            type="datetime-local"
            name="reg_closes_at"
            defaultValue={event.reg_closes_at ? event.reg_closes_at.slice(0, 16) : ""}
            className="input"
          />
        </label>

        <label>
          <span className="label">{t("Joylar soni")}</span>
          <input
            type="number"
            name="capacity"
            min={1}
            defaultValue={event.capacity ?? ""}
            placeholder={t("Cheklanmagan")}
            className="input"
          />
        </label>
        <label>
          <span className="label">{t("Ko'rinish")}</span>
          <select name="visibility" defaultValue={event.visibility} className="input">
            <option value="public">{t("Ommaviy")}</option>
            <option value="internal">{t("Ichki")}</option>
          </select>
        </label>

        <label>
          <span className="label">{t("Holat")}</span>
          <select name="status" defaultValue={event.status} className="input">
            <option value="draft">{t("Qoralama")}</option>
            <option value="published">{t("E'lon qilingan")}</option>
            <option value="closed">{t("Ro'yxat yopilgan")}</option>
            <option value="finished">{t("Tugallangan")}</option>
            <option value="cancelled">{t("Bekor qilingan")}</option>
          </select>
        </label>
        <label>
          <span className="label">{t("Havola (slug)")}</span>
          <input name="slug" defaultValue={event.slug} className="input" />
        </label>

        <label className="sm:col-span-2">
          <span className="label">{t("Tavsif")}</span>
          <textarea name="description" defaultValue={event.description ?? ""} rows={4} className="input" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">{t("Ishtirokchilar uchun talablar")}</span>
          <textarea name="requirements" defaultValue={event.requirements ?? ""} rows={2} className="input" />
        </label>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className="btn-primary">{t("O'zgarishlarni saqlash")}</button>
          <Link href="/admin/events" className="btn-ghost">
            {t("Bekor qilish")}
          </Link>
        </div>
      </form>
    </div>
  );
}
