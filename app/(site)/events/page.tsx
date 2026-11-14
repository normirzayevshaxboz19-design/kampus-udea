import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { allPublicEvents } from "@/lib/data";
import { isPast } from "@/lib/format";
import { EventCard } from "@/components/EventCard";
import { Empty } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser("/events");
  const { lang, t, tpl } = await getT();
  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const all = allPublicEvents();
  const events = all
    .filter((e) => (tab === "past" ? isPast(e.ends_at ?? e.starts_at) : e.status === "published" && !isPast(e.starts_at)))
    .sort((a, b) => (tab === "past" ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-strong pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
            {tpl("Jadval · {n} tadbir", { n: all.length })}
          </p>
          <h1 className="mt-1.5 font-serif text-[30px] leading-none text-text-primary">{t("Tadbirlar")}</h1>
          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-text-secondary">
            {t(
              "Universitet tadbirlari, forumlar va klublar uchrashuvlari. Har bir tadbirga ariza yuboriladi va tashkilotchi tasdiqlaydi.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-5">
          {[
            { key: "upcoming", label: "Yaqinlashayotgan", href: "/events" },
            { key: "past", label: "O'tgan", href: "/events?tab=past" },
          ].map((tabItem) => (
            <Link
              key={tabItem.key}
              href={tabItem.href}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                tab === tabItem.key
                  ? "bg-accent text-white"
                  : "bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(tabItem.label)}
            </Link>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <Empty
          title={t(tab === "past" ? "O'tgan tadbirlar yo'q" : "Hozircha tadbir e'lon qilinmagan")}
          hint={t("Tashkilotchilar yangi tadbir qo'shganda shu ro'yxatda paydo bo'ladi.")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
