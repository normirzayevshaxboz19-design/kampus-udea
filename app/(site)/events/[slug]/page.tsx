import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import {
  TEAM_MAX_MEMBERS,
  eventTeams,
  feedbackFor,
  feedbackStats,
  getEvent,
  membershipOf,
  messagesFor,
  myFeedback,
  myTeamForEvent,
  orgMembers,
  registrationFor,
} from "@/lib/data";
import { canActor } from "@/lib/perms";
import { Chat } from "@/components/Chat";
import { fmtDateLong, fmtEventRange, fmtDateTime, isPast, now } from "@/lib/format";
import { EVENT_STATUS, orgGradient } from "@/lib/labels";
import { roleAccent, roleLabel } from "@/lib/perms";
import {
  cancelEventAction,
  createTeamAction,
  joinTeamAction,
  leaveTeamAction,
  registerEventAction,
  submitFeedbackAction,
} from "@/app/actions";
import { Alert, Avatar } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; err?: string; chat_err?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = getEvent(slug);
  if (!event) notFound();

  const user = await requireUser(`/events/${slug}`);
  const { lang, t, tpl } = await getT();
  const reg = registrationFor(event.id, user.id);
  const team = orgMembers(event.org_id).slice(0, 5);
  const membership = membershipOf(user.id, event.org_id);
  if (event.visibility === "internal" && !membership && !isAdmin(user)) notFound();
  const messages = messagesFor("event", event.id);
  const status = EVENT_STATUS[event.status] ?? EVENT_STATUS.published;
  const remaining = event.capacity === null ? null : Math.max(0, event.capacity - event.confirmed);
  const ended = isPast(event.ends_at ?? event.starts_at);
  const feedback = ended ? feedbackFor(event.id) : [];
  const rating = feedbackStats(event.id);
  const mine = myFeedback(event.id, user.id);
  const canReview = Boolean(reg && ["attended", "confirmed"].includes(reg.status));
  const stamp = now();
  const regOpen =
    event.status === "published" &&
    !isPast(event.starts_at) &&
    (!event.reg_opens_at || stamp >= event.reg_opens_at) &&
    (!event.reg_closes_at || stamp <= event.reg_closes_at);
  const active = reg && !["cancelled", "rejected"].includes(reg.status);
  const teamsList = eventTeams(event.id);
  const myTeam = myTeamForEvent(event.id, user.id);
  const teamEligible = Boolean(reg && ["confirmed", "attended"].includes(reg.status));

  return (
    <div className="space-y-5">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-tertiary hover:text-text-primary">
        ← {t("Tadbirlar")}
      </Link>

      <div className="overflow-hidden rounded-2xl border border-hairline/80 bg-card">
        <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 md:px-8 ${orgGradient(event.org_color)}`}>
          <span className="max-w-full truncate font-serif text-[16px] uppercase tracking-[0.12em] text-white/90">
            {event.org_name}
          </span>
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-white/65">
            {fmtDateLong(event.starts_at, lang)}
          </span>
        </div>

        <div className="px-5 pb-6 pt-5 md:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`badge ${status.className}`}>{t(status.label)}</span>
            <Link
              href={`/clubs/${event.org_slug}`}
              className="text-[11px] font-semibold text-text-tertiary underline decoration-slate-300 underline-offset-4 hover:text-text-primary"
            >
              {t("Klub sahifasi ↗")}
            </Link>
          </div>
          <h1 className="mt-2.5 font-serif text-[27px] leading-[1.12] text-text-primary md:text-[33px]">
            {event.title}
          </h1>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-5 md:p-6">
            <h2 className="text-[15px] font-bold text-text-primary">{t("Tadbir haqida")}</h2>
            <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-text-secondary">{event.description}</p>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-subtle px-3.5 py-3">
                <dt className="text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary">{t("Sana va vaqt")}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-text-primary">
                  {fmtEventRange(event.starts_at, event.ends_at, lang)}
                </dd>
              </div>
              <div className="rounded-2xl bg-subtle px-3.5 py-3">
                <dt className="text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary">{t("Joy")}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-text-primary">{event.location ?? "—"}</dd>
              </div>
              <div className="rounded-2xl bg-subtle px-3.5 py-3">
                <dt className="text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary">{t("Ro'yxat muddati")}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-text-primary">
                  {event.reg_closes_at
                    ? tpl("{date} gacha", { date: fmtDateTime(event.reg_closes_at, lang) })
                    : t("Cheklanmagan")}
                </dd>
              </div>
              <div className="rounded-2xl bg-subtle px-3.5 py-3">
                <dt className="text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary">{t("Joylar soni")}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-text-primary">
                  {event.capacity === null ? t("Cheklanmagan") : `${event.confirmed} / ${event.capacity}`}
                </dd>
              </div>
            </dl>

            {event.requirements && (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-amber-700">
                  {t("Ishtirokchilar uchun talablar")}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80">{event.requirements}</p>
              </div>
            )}
          </section>

          <section className="card p-5 md:p-6">
            <h2 className="text-[15px] font-bold text-text-primary">{t("Tashkilotchi jamoa")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-full bg-subtle py-1 pl-1 pr-3">
                  <Avatar emoji={m.avatar_emoji} name={m.full_name} src={m.avatar_url} size={28} />
                  <span className="text-[12.5px] font-semibold text-text-primary">{m.full_name}</span>
                  <span className={`badge ${roleAccent(m.role_key)}`}>{roleLabel(m.role_key, lang)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-text-tertiary">
              {t("Savollar bo'lsa, quyidagi chatda yozishingiz yoki klub sahifasidagi ijtimoiy tarmoqlar orqali bog'lanishingiz mumkin.")}
            </p>
          </section>

          {!ended && (
            <section id="teams" className="card p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-text-primary">{t("Jamoalar")}</h2>
                <span className="text-[11.5px] font-semibold text-text-tertiary">
                  {tpl("{n} jamoa · har birida {m} kishi", { n: teamsList.length, m: TEAM_MAX_MEMBERS })}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-tertiary">
                {t(
                  "Jamoa tuzish tasdiqlangan ishtirokchilar uchun. Tasdiqlanganingizdan so'ng jamoa yaratishingiz yoki mavjudiga qo'shilishingiz mumkin.",
                )}
              </p>

              {teamEligible && !myTeam && (
                <details className="mt-3 rounded-2xl border border-hairline bg-subtle/60 px-3.5 py-2.5">
                  <summary className="cursor-pointer text-[12.5px] font-bold text-text-primary">
                    + {t("Yangi jamoa tuzish")}
                  </summary>
                  <form action={createTeamAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="slug" value={event.slug} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <label className="block">
                      <span className="label">{t("Jamoa nomi")}</span>
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={40}
                        className="input"
                        placeholder={t("Masalan: Orbit")}
                      />
                    </label>
                    <label className="block">
                      <span className="label">{t("G'oya (ixtiyoriy)")}</span>
                      <input name="idea" maxLength={200} className="input" placeholder={t("Nima ustida ishlaysiz?")} />
                    </label>
                    <button className="btn-primary btn-sm self-end">{t("Yaratish")}</button>
                  </form>
                </details>
              )}

              {myTeam && (
                <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-emerald-800">
                  {tpl("Siz «{name}» jamoasidasiz", { name: myTeam.name })}
                </p>
              )}

              {teamsList.length === 0 ? (
                <p className="mt-3 text-[12.5px] leading-relaxed text-text-tertiary">
                  {t("Hali jamoa yo'q — birinchi bo'lib tuzing.")}
                </p>
              ) : (
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {teamsList.map((tm) => {
                    const mine = myTeam?.team_id === tm.id;
                    const fullTeam = tm.members.length >= TEAM_MAX_MEMBERS;
                    return (
                      <li
                        key={tm.id}
                        className={
                          mine
                            ? "rounded-2xl border border-emerald-300 bg-emerald-50/50 px-3.5 py-3"
                            : "rounded-2xl border border-hairline bg-card px-3.5 py-3"
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-serif text-[15px] text-text-primary">{tm.name}</p>
                            {tm.idea && (
                              <p className="mt-0.5 text-[12px] leading-relaxed text-text-tertiary">{tm.idea}</p>
                            )}
                          </div>
                          <span
                            className={
                              fullTeam
                                ? "shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800"
                                : "shrink-0 rounded-full bg-elevated px-2 py-0.5 font-mono text-[10px] font-bold text-text-secondary"
                            }
                          >
                            {tm.members.length}/{TEAM_MAX_MEMBERS}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tm.members.map((m) => (
                            <span
                              key={m.user_id}
                              className="inline-flex items-center gap-1 rounded-full bg-white/80 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-text-primary"
                            >
                              <Avatar emoji={m.avatar_emoji} name={m.full_name} src={m.avatar_url} size={18} />
                              {m.full_name.split(" ")[0]}
                            </span>
                          ))}
                        </div>

                        {teamEligible && (
                          <form action={mine ? leaveTeamAction : joinTeamAction} className="mt-2.5">
                            <input type="hidden" name="slug" value={event.slug} />
                            <input type="hidden" name="event_id" value={event.id} />
                            <input type="hidden" name="team_id" value={tm.id} />
                            <button
                              className={mine ? "btn-ghost btn-sm" : "btn-soft btn-sm"}
                              disabled={!mine && (fullTeam || Boolean(myTeam))}
                            >
                              {mine
                                ? t("Jamoadan chiqish")
                                : fullTeam
                                  ? t("To'lgan")
                                  : t("Qo'shilish")}
                            </button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {ended && (
            <section className="card p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-text-primary">{t("Tadbir bahosi")}</h2>
                {rating.count > 0 && (
                  <span className="text-[12.5px] font-semibold text-text-secondary">
                    <span className="text-amber-500">★</span> {rating.avg} / 5 · {tpl("{n} fikr", { n: rating.count })}
                  </span>
                )}
              </div>

              {canReview ? (
                <>
                  {mine && (
                    <div className="mt-3 rounded-2xl bg-subtle px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">{t("Sizning bahoyingiz")}</p>
                      <p className="mt-0.5 text-[15px] text-amber-500">
                        {"★".repeat(mine.rating)}
                        <span className="text-elevated">{"★".repeat(5 - mine.rating)}</span>
                      </p>
                      {mine.comment && (
                        <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-text-secondary">{mine.comment}</p>
                      )}
                    </div>
                  )}
                  <details className="mt-3" open={!mine}>
                    <summary className="cursor-pointer text-[12.5px] font-bold text-academic">
                      {t(mine ? "Bahoni o'zgartirish" : "Fikringizni yozib qoldiring")}
                    </summary>
                    <form action={submitFeedbackAction} className="mt-3 space-y-3">
                      <input type="hidden" name="slug" value={event.slug} />
                      <input type="hidden" name="event_id" value={event.id} />
                      <label className="block">
                        <span className="label">{t("Tadbirdan mamnuniyatingiz")}</span>
                        <select name="rating" defaultValue={String(mine?.rating ?? 5)} className="input">
                          <option value="5">{t("5 — Ajoyib")}</option>
                          <option value="4">{t("4 — Yaxshi")}</option>
                          <option value="3">{t("3 — O'rtacha")}</option>
                          <option value="2">{t("2 — Yomon")}</option>
                          <option value="1">{t("1 — Juda yomon")}</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="label">{t("Fikr va takliflar (ixtiyoriy)")}</span>
                        <textarea
                          name="comment"
                          rows={3}
                          maxLength={600}
                          defaultValue={mine?.comment ?? ""}
                          placeholder={t("Nima yoqdi, nimani yaxshilash mumkin?")}
                          className="input"
                        />
                      </label>
                      <button className="btn-primary btn-sm">
                        {t(mine ? "Bahoni yangilash" : "Fikrni yuborish")}
                      </button>
                    </form>
                  </details>
                </>
              ) : (
                <p className="mt-2 text-[12.5px] leading-relaxed text-text-tertiary">
                  {t(
                    "Fikr qoldirish tadbirda qatnashgan ishtirokchilar uchun ochiq. Ro'yxatdan o'tgan va tasdiqlangan bo'lsangiz, bu yerda baho va izoh yozishingiz mumkin.",
                  )}
                </p>
              )}

              {feedback.length > 0 && (
                <div className="mt-4 border-t border-hairline pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">{t("Ishtirokchilar fikri")}</p>
                  <ul className="mt-2 space-y-2.5">
                    {feedback.slice(0, 5).map((f) => (
                      <li key={f.id} className="flex gap-2.5">
                        <Avatar emoji={f.avatar_emoji} name={f.full_name} src={f.avatar_url} size={28} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-bold text-text-primary">{f.full_name}</span>
                            <span className="text-[11.5px] text-amber-500">{"★".repeat(f.rating)}</span>
                          </div>
                          {f.comment && (
                            <p className="text-[12.5px] leading-relaxed text-text-secondary">{f.comment}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <Chat
            scopeType="event"
            scopeId={event.id}
            path={`/events/${event.slug}`}
            title="Tadbir chati"
            messages={messages}
            meId={user.id}
            canModerate={canActor(membership?.role_key, "team.manage", isAdmin(user))}
            error={sp.chat_err}
          />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
            {sp.err && (
              <div className="mb-3">
                <Alert>{t(sp.err)}</Alert>
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">{t("Ishtirokchilar")}</span>
              <span className="text-[13px] font-bold text-text-primary">
                {event.confirmed}
                {event.capacity !== null && <span className="text-text-tertiary"> / {event.capacity}</span>}
              </span>
            </div>
            {event.capacity !== null && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${Math.min(100, Math.round((event.confirmed / event.capacity) * 100))}%` }}
                />
              </div>
            )}
            <p className="mt-2 text-[11.5px] text-text-tertiary">
              {remaining === null
                ? t("Joylar soni cheklanmagan")
                : remaining > 0
                  ? tpl("{n} joy bo'sh", { n: remaining })
                  : tpl("{n} kishi navbatda", { n: event.waitlist })}
            </p>

            <div className="mt-4 space-y-2">
              {active && reg ? (
                <>
                  <div
                    className={`rounded-2xl border px-3.5 py-3 ${
                      reg.status === "waitlist" || reg.status === "pending"
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
                      {reg.status === "pending"
                        ? t("Ariza ko'rib chiqilmoqda")
                        : reg.status === "waitlist"
                          ? t("Navbatdasiz")
                          : t("Siz ro'yxatdan o'tgansiz")}
                    </p>
                    <p className="mt-0.5 text-[13px] font-bold text-text-primary">
                      {reg.status === "pending"
                        ? t("Tashkilotchi tasdiqlashini kuting")
                        : tpl("Chipta: {code}", { code: reg.ticket_code })}
                    </p>
                    {reg.status === "confirmed" && reg.promoted_at && (
                      <p className="mt-1 text-[11.5px] font-semibold text-emerald-700">
                        {t("Navbatdan tasdiqlandi — o'rningiz band")}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11.5px] text-text-tertiary">
                      {reg.status === "pending"
                        ? t("Ariza tasdiqlangach chipta kodi faollashadi.")
                        : reg.status === "waitlist"
                          ? t("Joy bo'shashi bilan navbatdagilar tasdiqlanadi.")
                          : t("Tadbir kuni chipta kodini ko'rsatishingiz mumkin.")}
                    </p>
                  </div>
                  <form action={cancelEventAction}>
                    <input type="hidden" name="slug" value={event.slug} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <button className="btn-ghost w-full">{t("Ro'yxatdan o'tishni bekor qilish")}</button>
                  </form>
                </>
              ) : regOpen ? (
                <form action={registerEventAction}>
                  <input type="hidden" name="slug" value={event.slug} />
                  <input type="hidden" name="event_id" value={event.id} />
                  <button className="btn-primary w-full">
                    {t(reg?.status === "rejected" ? "Qayta ariza yuborish" : "Ishtirok uchun ariza yuborish")}
                  </button>
                </form>
              ) : (
                <button disabled className="btn-ghost w-full">
                  {isPast(event.starts_at)
                    ? t("Tadbir yakunlangan")
                    : event.status !== "published"
                      ? t("Ro'yxatdan o'tish yopilgan")
                      : t("Ro'yxatdan o'tish muddati tugagan")}
                </button>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-tertiary">{t("Tashkilot")}</h3>
            <p className="mt-2 font-serif text-[16px] text-text-primary">{event.org_name}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-tertiary">
              {t("Savollar bo'lsa chatda yozing — tashkilotchi jamoa javob beradi.")}
            </p>
            <Link
              href={`/clubs/${event.org_slug}`}
              className="mt-2 inline-block text-[11.5px] font-semibold text-text-secondary underline decoration-slate-300 underline-offset-4 hover:text-text-primary"
            >
              {t("Klub sahifasi ↗")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
