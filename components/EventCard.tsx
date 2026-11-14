import Link from "next/link";
import { dayNum, fmtTime, monthShort, relativeDay } from "@/lib/format";
import { tr, tpl, type Lang } from "@/lib/i18n";
import { orgGradient } from "@/lib/labels";
import type { EventRow } from "@/lib/data";

export function EventCard({ event, lang = "uz" }: { event: EventRow; lang?: Lang }) {
  const remaining = event.capacity === null ? null : event.capacity - event.confirmed;
  const rel = relativeDay(event.starts_at, lang);
  const soon = rel === tr(lang, "Bugun") || rel === tr(lang, "Ertaga");

  return (
    <Link
      href={`/events/${event.slug}`}
      className="card group block overflow-hidden transition-shadow hover:shadow-[var(--shadow-hover)]"
    >
      <div className="relative h-[96px] bg-surface">
        <div aria-hidden="true" className={`absolute inset-0 opacity-30 mix-blend-multiply ${orgGradient(event.org_color)}`} />
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[38px]">
          {event.emoji}
        </span>
        <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-[10.5px] font-bold text-text-primary shadow-sm backdrop-blur">
          {dayNum(event.starts_at)} {monthShort(event.starts_at, lang)}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-[10.5px] font-semibold text-text-secondary shadow-sm backdrop-blur">
          {fmtTime(event.starts_at)}
        </span>
        {soon && (
          <span className="absolute bottom-3 left-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
            {rel}
          </span>
        )}
      </div>

      <div className="p-3.5">
        <div className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
          {event.org_name}
        </div>
        <h3 className="mt-1 font-serif text-[16.5px] leading-snug text-text-primary group-hover:opacity-75">
          {event.title}
        </h3>
        {event.description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-secondary">{event.description}</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
          {event.location && (
            <span className="inline-flex max-w-[180px] items-center gap-1 truncate">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
                <circle cx="12" cy="11" r="2.2" />
              </svg>
              <span className="truncate">{event.location}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="9" cy="9" r="3.2" />
              <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
            </svg>
            {event.confirmed}
          </span>
          {remaining === null ? null : remaining <= 0 ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">{tr(lang, "Navbat")}</span>
          ) : remaining <= 5 ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">
              {tpl(lang, "{n} joy qoldi", { n: remaining })}
            </span>
          ) : (
            <span>{tpl(lang, "{n} joy", { n: remaining })}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
