import Link from "next/link";
import { getActiveOrg, getMemberships, isAdmin, requireUser } from "@/lib/auth";
import { allEvents, eventsOfOrg, pendingRegistrationCounts } from "@/lib/data";
import { dayNum, fmtEventRange, isPast, monthShort } from "@/lib/format";
import { EVENT_STATUS } from "@/lib/labels";
import { canActor } from "@/lib/perms";
import { saveEventAction } from "@/app/actions";
import { Alert, Empty } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/admin/events");
  const { lang, t, tpl } = await getT();
  const active = await getActiveOrg(user.id);
  const admin = isAdmin(user);
  const orgs = await getMemberships(user.id);

  const allowed = admin || canActor(active?.role_key, "event.manage", admin);
  const events = admin ? allEvents() : active ? eventsOfOrg(active.org_id, true) : [];
  const pending = pendingRegistrationCounts();
  const totalPending = events.reduce((sum, e) => sum + (pending[e.id] ?? 0), 0);

  return (
    <div className="space-y-6">
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{t("Boshqaruv")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">{t("Tadbirlar")}</h1>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {admin
              ? t("Barcha tashkilotlar tadbirlari")
              : tpl("{org} tadbirlari", { org: active?.org_name ?? t("Tashkilot") })}{" "}
            · {tpl("{n} ta", { n: events.length })}
          </p>
        </div>
        {totalPending > 0 && (
          <span className="badge bg-amber-100 text-amber-700">{tpl("{n} yangi ariza", { n: totalPending })}</span>
        )}
      </div>

      {!allowed ? (
        <Empty
          title={t("Ruxsat yo'q")}
          hint={t("Tadbirlarni faqat admin va klub koordinatorlari boshqaradi.")}
        />
      ) : (
        <>
          <details className="card p-5" open={events.length === 0}>
            <summary className="cursor-pointer font-serif text-[16px] text-text-primary">{t("Yangi tadbir qo'shish")}</summary>
            <form action={saveEventAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              {admin ? (
                <label className="sm:col-span-2">
                  <span className="label">{t("Tashkilot")}</span>
                  <select name="org_id" defaultValue={active?.org_id ?? orgs[0]?.org_id} className="input">
                    {orgs.map((o) => (
                      <option key={o.org_id} value={o.org_id}>
                        {o.org_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="org_id" value={active?.org_id ?? ""} />
              )}

              <label className="sm:col-span-2">
                <span className="label">{t("Tadbir nomi")}</span>
                <input name="title" required placeholder={t("Masalan: Karyera kuni 2026")} className="input" />
              </label>

              <label>
                <span className="label">{t("Emoji")}</span>
                <input name="emoji" defaultValue="🎯" maxLength={4} className="input" />
              </label>
              <label>
                <span className="label">{t("Joy")}</span>
                <input name="location" placeholder={t("Asosiy bino, 2-qavat")} className="input" />
              </label>

              <label>
                <span className="label">{t("Boshlanish")}</span>
                <input type="datetime-local" name="starts_at" required className="input" />
              </label>
              <label>
                <span className="label">{t("Tugash")}</span>
                <input type="datetime-local" name="ends_at" className="input" />
              </label>

              <label>
                <span className="label">{t("Ro'yxat muddati")}</span>
                <input type="datetime-local" name="reg_closes_at" className="input" />
              </label>
              <label>
                <span className="label">{t("Joylar soni")}</span>
                <input type="number" name="capacity" min={1} placeholder={t("Cheklanmagan")} className="input" />
              </label>

              <label>
                <span className="label">{t("Ko'rinish")}</span>
                <select name="visibility" className="input" defaultValue="public">
                  <option value="public">{t("Ommaviy — hamma ko'radi")}</option>
                  <option value="internal">{t("Ichki — faqat jamoa")}</option>
                </select>
              </label>
              <label>
                <span className="label">{t("Holat")}</span>
                <select name="status" className="input" defaultValue="published">
                  <option value="draft">{t("Qoralama")}</option>
                  <option value="published">{t("E'lon qilingan")}</option>
                  <option value="closed">{t("Ro'yxat yopilgan")}</option>
                  <option value="finished">{t("Tugallangan")}</option>
                  <option value="cancelled">{t("Bekor qilingan")}</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="label">{t("Tavsif")}</span>
                <textarea name="description" rows={3} className="input" placeholder={t("Tadbir haqida qisqa ma'lumot")} />
              </label>
              <label className="sm:col-span-2">
                <span className="label">{t("Ishtirokchilar uchun talablar")}</span>
                <textarea name="requirements" rows={2} className="input" placeholder={t("Masalan: talaba ID bilan kelish")} />
              </label>

              <div className="sm:col-span-2">
                <button className="btn-primary w-full sm:w-auto">{t("Tadbirni saqlash")}</button>
              </div>
            </form>
          </details>

          {events.length === 0 ? (
            <Empty title={t("Tadbir yo'q")} hint={t("Yuqoridagi forma orqali birinchi tadbirni qo'shing.")} />
          ) : (
            <ul className="space-y-3">
              {events.map((e) => {
                const st = EVENT_STATUS[e.status] ?? EVENT_STATUS.published;
                const newCount = pending[e.id] ?? 0;
                return (
                  <li key={e.id} className="card p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="w-10 shrink-0 border-r border-hairline pr-2 text-center">
                        <span className="block font-serif text-[18px] leading-none text-text-primary">
                          {dayNum(e.starts_at)}
                        </span>
                        <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                          {monthShort(e.starts_at, lang)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[14px] font-bold leading-snug text-text-primary">{e.title}</h2>
                          <span className={`badge ${st.className}`}>{t(st.label)}</span>
                          {e.visibility === "internal" && (
                            <span className="badge bg-elevated text-text-tertiary">{t("Ichki")}</span>
                          )}
                          {newCount > 0 && (
                            <span className="badge bg-amber-100 text-amber-700">
                              {tpl("{n} yangi ariza", { n: newCount })}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] text-text-tertiary">
                          {admin && <span className="font-semibold text-text-secondary">{e.org_name} · </span>}
                          {fmtEventRange(e.starts_at, e.ends_at, lang)} · {e.location ?? "—"}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-text-tertiary">
                          {tpl("{n} tasdiqlangan", { n: e.confirmed })}
                          {e.capacity !== null && ` / ${e.capacity}`} · {tpl("{n} navbatda", { n: e.waitlist })}
                          {isPast(e.starts_at) && ` · ${t("o'tgan")}`}
                        </p>
                      </div>
                      <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                        <Link href={`/admin/events/${e.id}`} className="btn-soft btn-sm">
                          {t("Ariza va ishtirokchilar")}
                        </Link>
                        <Link href={`/admin/events/${e.id}/edit`} className="btn-ghost btn-sm">
                          {t("Tahrirlash")}
                        </Link>
                        <Link href={`/events/${e.slug}`} className="btn-ghost btn-sm">
                          {t("Sahifa")}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
