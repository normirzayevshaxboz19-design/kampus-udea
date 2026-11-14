import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { announcementsFor, clubs, myRegistrations, upcomingEvents } from "@/lib/data";
import { fmtDateLong, isPast, relativeDay } from "@/lib/format";
import { EventCard } from "@/components/EventCard";
import { Empty, SectionHead } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function HomePage() {
  const user = await requireUser("/");
  const { lang, t, tpl } = await getT();
  const events = upcomingEvents(6);
  const clubList = clubs();
  const news = announcementsFor(4);
  const mine = myRegistrations(user.id).filter((e) => !isPast(e.starts_at));
  const firstName = user.full_name.split(" ")[0];
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <div className="space-y-10">
      <section className="border-b border-strong pb-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
              {t("UDEA · talabalar platformasi")} · {fmtDateLong(todayIso, lang)}
            </p>
            <h1 className="mt-2.5 font-serif text-[30px] leading-[1.12] text-text-primary md:text-[38px]">
              {tpl("Salom, {name}.", { name: firstName })}
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-text-secondary">
              {t(
                "Kampustagi tadbirlar, klublar va jamoa ishlari bir joyda. Tadbirga ariza bering, klubga qo'shiling — qolganini tashkilotchilar boshqaradi.",
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href="/events" className="btn-primary btn-sm">
                {t("Tadbirlar jadvali")}
              </Link>
              <Link href="/clubs" className="btn-ghost btn-sm">
                {t("Klublar ro'yxati")}
              </Link>
            </div>
          </div>

          <dl className="flex gap-7 border-t border-strong pt-3 text-[12px] text-text-secondary sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
            <div>
              <dt className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">{t("Yaqin tadbir")}</dt>
              <dd className="mt-1 font-serif text-[26px] leading-none text-text-primary">{events.length}</dd>
            </div>
            <div>
              <dt className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">{t("Klub")}</dt>
              <dd className="mt-1 font-serif text-[26px] leading-none text-text-primary">{clubList.length}</dd>
            </div>
            <div>
              <dt className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">{t("Mening")}</dt>
              <dd className="mt-1 font-serif text-[26px] leading-none text-text-primary">{mine.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {mine.length > 0 && (
        <section>
          <SectionHead title={t("Mening tadbirlarim")} hint={t("Tasdiqlangan arizalar va chiptalar")} />
          <ul className="divide-y divide-hairline border-b border-hairline">
            {mine.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.slug}`}
                  className="flex items-baseline gap-x-4 py-3 hover:bg-card/60"
                >
                  <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-wide text-text-tertiary sm:w-28">
                    {relativeDay(e.starts_at, lang)}
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-text-primary">{e.title}</span>
                  <span className="hidden shrink-0 font-mono text-[11px] text-text-tertiary sm:block">
                    {e.ticket_code}
                  </span>
                  <span
                    className={`shrink-0 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                      e.reg_status === "pending"
                        ? "text-amber-700"
                        : e.reg_status === "waitlist"
                          ? "text-amber-700"
                          : "text-emerald-700"
                    }`}
                  >
                    {e.reg_status === "pending"
                      ? t("Kutilmoqda")
                      : e.reg_status === "waitlist"
                        ? t("Navbatda")
                        : t("Tasdiqlangan")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_290px]">
        <div className="space-y-9">
          <section>
            <SectionHead
              title={t("Yaqinlashib kelayotgan tadbirlar")}
              hint={t("Ro'yxatdan o'tish ochiq bo'lgan tadbirlar")}
              href="/events"
              linkLabel={t("Barcha tadbirlar")}
            />
            {events.length === 0 ? (
              <Empty
                title={t("Hozircha tadbir yo'q")}
                hint={t("Yangi tadbirlar e'lon qilinganda shu yerda paydo bo'ladi.")}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {events.slice(0, 4).map((e) => (
                  <EventCard key={e.id} event={e} lang={lang} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHead
              title={t("Klublar")}
              hint={t("Qiziqishingizga mos klubni tanlang")}
              href="/clubs"
              linkLabel={t("Barcha klublar")}
            />
            <ul className="border-t border-hairline">
              {clubList.slice(0, 5).map((c) => (
                <li key={c.id} className="border-b border-hairline">
                  <Link href={`/clubs/${c.slug}`} className="flex flex-wrap items-baseline gap-x-4 py-3 hover:bg-card/60">
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-text-primary">{c.name}</span>
                    <span className="hidden max-w-[240px] truncate text-[12px] text-text-tertiary sm:block">{c.tagline}</span>
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] text-text-tertiary">
                      {tpl("{n} a'zo", { n: c.members })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <SectionHead title={t("E'lonlar")} hint={t("Tashkilotdan yangiliklar")} />
            <ul className="space-y-4">
              {news.map((n) => (
                <li key={n.id} className="border-b border-hairline pb-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                    <span className="truncate">{n.org_name ?? t("Tashkilot")}</span>
                    <span className="shrink-0">{relativeDay(n.created_at, lang)}</span>
                  </div>
                  <h3 className="mt-1 font-serif text-[15px] leading-snug text-text-primary">{n.title}</h3>
                  <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-text-tertiary">{n.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHead title={t("Bog'lanish")} hint={t("Tashkilot sahifalari")} />
            <ul className="space-y-1.5 text-[12.5px]">
              <li>
                <a
                  href="https://t.me/udea_students"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-baseline justify-between border-b border-hairline py-1.5 text-text-secondary hover:text-text-primary"
                >
                  {t("Telegram kanal")} <span className="text-text-tertiary">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/udea_students"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-baseline justify-between border-b border-hairline py-1.5 text-text-secondary hover:text-text-primary"
                >
                  Instagram <span className="text-text-tertiary">↗</span>
                </a>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
