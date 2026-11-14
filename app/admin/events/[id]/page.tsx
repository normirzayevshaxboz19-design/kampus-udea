import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import {
  TEAM_MAX_MEMBERS,
  eventTeams,
  feedbackFor,
  feedbackStats,
  getEventById,
  membershipOf,
  participants,
} from "@/lib/data";
import { fmtDateTime, fmtEventRange, fmtStamp, isPast } from "@/lib/format";
import { REG_STATUS } from "@/lib/labels";
import { canActor } from "@/lib/perms";
import { attendanceAction, decideRegistrationAction, promoteWaitlistAction } from "@/app/actions";
import { Alert, Avatar, Empty, Stat } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function EventParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/admin/events/${id}`);
  const { lang, t, tpl } = await getT();
  const event = getEventById(id);
  if (!event) notFound();

  const membership = await membershipOf(user.id, event.org_id);
  const manage = canActor(membership?.role_key, "reg.view", isAdmin(user));
  if (!manage) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-text-primary">
          {t("Bu tadbir ishtirokchilarini ko'rishga ruxsatingiz yo'q.")}
        </p>
        <Link href="/admin" className="btn-ghost btn-sm mt-3">
          {t("Boshqaruv")}
        </Link>
      </div>
    );
  }

  const canExport = canActor(membership?.role_key, "reg.export", isAdmin(user));
  const list = participants(id);
  const pendingList = list.filter((r) => r.status === "pending");
  const waitlistList = list.filter((r) => r.status === "waitlist");
  const teamsList = eventTeams(id);
  const attended = list.filter((r) => r.status === "attended").length;
  const confirmed = list.filter((r) => r.status === "confirmed").length;
  const feedback = feedbackFor(id);
  const rating = feedbackStats(id);
  const next = `/admin/events/${id}`;

  return (
    <div className="space-y-5">
      <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-tertiary hover:text-text-primary">
        ← {t("Tadbirlar")}
      </Link>

      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-academic">{event.org_name}</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-text-primary">{event.title}</h1>
            <p className="mt-1 text-[12.5px] text-text-tertiary">
              {fmtEventRange(event.starts_at, event.ends_at, lang)} · {event.location}
            </p>
            <p className="mt-0.5 text-[12px] text-text-tertiary">
              {t("Ro'yxat muddati:")} {event.reg_closes_at ? fmtDateTime(event.reg_closes_at, lang) : t("cheklanmagan")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/events/${event.id}/edit`} className="btn-soft btn-sm">
              {t("Tahrirlash")}
            </Link>
            <Link href={`/events/${event.slug}`} className="btn-ghost btn-sm">
              {t("Ochiq sahifa")}
            </Link>
            {canExport && (
              <a href={`/api/participants/${event.id}`} className="btn-primary btn-sm" download>
                ↓ {t("CSV yuklash")}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={t("Yangi ariza")} value={pendingList.length} tone={pendingList.length > 0 ? "warn" : "default"} />
        <Stat label={t("Tasdiqlangan")} value={confirmed} />
        <Stat label={t("Navbatda")} value={waitlistList.length} tone={waitlistList.length > 0 ? "warn" : "default"} />
        <Stat label={t("Qatnashgan")} value={attended} />
        <Stat label={t("Joylar soni")} value={event.capacity ?? "∞"} />
      </div>

      {pendingList.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-text-primary">{t("Tasdiqlash kutayotgan arizalar")}</h2>
            <span className="badge bg-amber-100 text-amber-700">{tpl("{n} yangi", { n: pendingList.length })}</span>
          </div>
          <ul className="mt-3 divide-y divide-hairline">
            {pendingList.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar emoji={r.avatar_emoji} name={r.full_name} src={r.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-text-primary">{r.full_name}</div>
                  <div className="text-[11.5px] text-text-tertiary">
                    {r.faculty ?? "—"} · {r.email}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {fmtStamp(r.created_at, lang)} · {r.ticket_code}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <form action={decideRegistrationAction}>
                    <input type="hidden" name="registration_id" value={r.id} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="next" value={next} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn-primary btn-sm">{t("Tasdiqlash")}</button>
                  </form>
                  <form action={decideRegistrationAction}>
                    <input type="hidden" name="registration_id" value={r.id} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="next" value={next} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="btn-ghost btn-sm">{t("Rad etish")}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-bold text-text-primary">{t("Navbatdagilar")}</h2>
            <p className="mt-0.5 text-[11.5px] text-text-tertiary">
              {t("Bo'sh joylar navbatdagilarga avtomatik beriladi. Qo'lda ham tasdiqlashingiz mumkin.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-amber-100 text-amber-700">{tpl("{n} navbatda", { n: waitlistList.length })}</span>
            <form action={promoteWaitlistAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="next" value={next} />
              <button className="btn-primary btn-sm" disabled={waitlistList.length === 0}>
                ↑ {t("Navbatdan tasdiqlash")}
              </button>
            </form>
          </div>
        </div>
        {waitlistList.length > 0 && (
          <ol className="mt-3 divide-y divide-hairline">
            {waitlistList.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 font-mono text-[12px] font-bold text-text-tertiary">#{i + 1}</span>
                <Avatar emoji={r.avatar_emoji} name={r.full_name} src={r.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold text-text-primary">{r.full_name}</div>
                  <div className="text-[11px] text-text-tertiary">
                    {r.faculty ?? "—"} · {fmtStamp(r.created_at, lang)}
                  </div>
                </div>
                <form action={decideRegistrationAction}>
                  <input type="hidden" name="registration_id" value={r.id} />
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="next" value={next} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn-soft btn-sm">{t("Tasdiqlash")}</button>
                </form>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead className="bg-subtle text-[10.5px] uppercase tracking-wide text-text-tertiary">
            <tr>
              <th className="px-4 py-2.5 font-bold">{t("Ishtirokchi")}</th>
              <th className="px-4 py-2.5 font-bold">{t("Chipta")}</th>
              <th className="px-4 py-2.5 font-bold">{t("Holat")}</th>
              <th className="px-4 py-2.5 font-bold">{t("Davomat")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {list.map((r) => {
              const st = REG_STATUS[r.status] ?? REG_STATUS.confirmed;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar emoji={r.avatar_emoji} name={r.full_name} src={r.avatar_url} size={32} />
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-bold text-text-primary">{r.full_name}</div>
                        <div className="text-[11px] text-text-tertiary">
                          {r.faculty ?? "—"} · {r.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] text-text-tertiary">{r.ticket_code}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`badge ${st.className}`}>{t(st.label)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.status === "pending" ? (
                      <span className="text-[11px] text-amber-600">{t("Tasdiqlash kutmoqda")}</span>
                    ) : r.status === "waitlist" ? (
                      <span className="text-[11px] text-text-tertiary">{t("Navbatda")}</span>
                    ) : r.status === "rejected" ? (
                      <span className="text-[11px] text-rose-500">{t("Ariza rad etilgan")}</span>
                    ) : (
                      <form action={attendanceAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="registration_id" value={r.id} />
                        <input type="hidden" name="event_id" value={event.id} />
                        <select
                          name="status"
                          defaultValue={r.status === "no_show" ? "no_show" : r.status === "attended" ? "attended" : "confirmed"}
                          className="rounded-2xl border border-strong bg-card px-2 py-1.5 text-[11px] font-semibold text-text-primary"
                        >
                          <option value="confirmed">{t("Kutilmoqda")}</option>
                          <option value="attended">{t("Qatnashdi")}</option>
                          <option value="no_show">{t("Kelmadi")}</option>
                        </select>
                        <button className="text-[11px] font-bold text-academic">✓</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-tertiary">
            {t("Hozircha hech kim ro'yxatdan o'tmagan.")}
          </p>
        )}
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-bold text-text-primary">{t("Jamoalar")}</h2>
          <span className="text-[12px] font-semibold text-text-tertiary">
            {tpl("{n} jamoa · har birida {m} kishi", { n: teamsList.length, m: TEAM_MAX_MEMBERS })}
          </span>
        </div>
        {teamsList.length === 0 ? (
          <p className="mt-1.5 text-[11.5px] text-text-tertiary">{t("Ishtirokchilar hali jamoa tuzmagan.")}</p>
        ) : (
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {teamsList.map((tm) => (
              <li key={tm.id} className="rounded-2xl border border-hairline px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-text-primary">{tm.name}</p>
                    {tm.idea && <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-tertiary">{tm.idea}</p>}
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      {tpl("{n} kishi", { n: tm.members.length })} · {tm.creator_name}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 font-mono text-[10px] font-bold text-text-secondary">
                    {tm.members.length}/{TEAM_MAX_MEMBERS}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tm.members.map((m) => (
                    <span
                      key={m.user_id}
                      className="inline-flex items-center gap-1 rounded-full bg-subtle py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-text-primary"
                    >
                      <Avatar emoji={m.avatar_emoji} name={m.full_name} src={m.avatar_url} size={18} />
                      {m.full_name.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-bold text-text-primary">{t("Tadbir haqidagi fikrlar")}</h2>
          <span className="text-[12px] font-semibold text-text-tertiary">
            {rating.count > 0
              ? tpl("O'rtacha {avg} / 5 · {n} fikr", { avg: rating.avg, n: rating.count })
              : t("Hali fikr yo'q")}
          </span>
        </div>
        {!isPast(event.ends_at ?? event.starts_at) && (
          <p className="mt-1.5 text-[11.5px] text-text-tertiary">
            {t("Fikrlar tadbir yakunlangandan keyin ishtirokchilarga ochiladi.")}
          </p>
        )}
        {feedback.length === 0 ? (
          <div className="mt-3">
            <Empty title={t("Fikr qoldirilmagan")} hint={t("Ishtirokchilar tadbirdan keyin baho va izoh yozishi mumkin.")} />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {feedback.map((f) => (
              <li key={f.id} className="flex gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0">
                <Avatar emoji={f.avatar_emoji} name={f.full_name} src={f.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] font-bold text-text-primary">{f.full_name}</span>
                    <span className="text-[12px] text-amber-500">
                      {"★".repeat(f.rating)}
                      <span className="text-elevated">{"★".repeat(5 - f.rating)}</span>
                    </span>
                    <span className="text-[11px] text-text-tertiary">{fmtStamp(f.created_at, lang)}</span>
                  </div>
                  {f.comment && (
                    <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-relaxed text-text-secondary">{f.comment}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11.5px] text-text-tertiary">
        {t(
          "Eslatma: ro'yxatdan o'tgan talabalar ma'lumoti shaxsiy — uni faqat tadbirni tashkil qilayotgan jamoa ko'rishi mumkin.",
        )}
      </p>
    </div>
  );
}
