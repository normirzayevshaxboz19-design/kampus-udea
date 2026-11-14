"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { qrMatrix } from "@/lib/qr";
import { pulseCancelAction, pulseRsvpAction } from "@/app/actions";
import { dayNum, fmtTime, monthShort, parse, weekday } from "@/lib/format";
import { tgHaptic } from "@/components/TelegramMiniApp";

/* ---------- Matnlar ---------- */
const L: Record<string, [string, string, string]> = {
  title: ["Tadbirlar, joylar va chiptalar", "События, аудитории и пропуска", "Events, rooms and passes"],
  intro: [
    "Qidiruv, filtr va bir bosishda ro'yxatdan o'tish. Navbat avtomatik ishlaydi.",
    "Поиск, фильтры и запись в один клик. Лист ожидания работает сам.",
    "Search, filter and one-tap RSVP. The waitlist takes care of itself.",
  ],
  hello: ["Salom, {name}", "Привет, {name}", "Hi, {name}"],
  discover: ["Kashfiyot", "События", "Discover"],
  passes: ["Chiptalarim", "Мои пропуска", "My passes"],
  search: ["Tadbir, joy yoki tashkilotchi…", "Событие, аудитория или организатор…", "Event, room or host…"],
  allDates: ["Barcha sanalar", "Все даты", "All dates"],
  seats: ["{a} / {b} joy", "{a} / {b} мест", "{a} / {b} seats"],
  leftN: ["{n} joy qoldi", "Осталось {n} мест", "{n} seats left"],
  full: ["To'ldi", "Мест нет", "Full"],
  rsvp: ["Bir bosishda yozilish", "Записаться", "RSVP in one tap"],
  joinWait: ["Navbatga turish", "В лист ожидания", "Join waitlist"],
  ticketReady: ["Chipta tayyor", "Пропуск готов", "Ticket ready"],
  waitN: ["Navbatda #{n}", "В очереди #{n}", "Waitlisted #{n}"],
  pending: ["Tasdiq kutilmoqda", "Ожидает подтверждения", "Awaiting approval"],
  inEvent: ["Kirdi ✓", "Прошёл ✓", "Checked in ✓"],
  open: ["Batafsil", "Подробнее", "Details"],
  cancel: ["Bekor qilish", "Отменить", "Cancel"],
  serial: ["Chipta raqami", "Номер пропуска", "Pass serial"],
  none: ["Bu shartlarga mos tadbir yo'q.", "По этим условиям событий нет.", "No events match these filters."],
  noneYet: ["Hozircha tadbir yo'q.", "Пока событий нет.", "No events yet."],
  noneYetHint: [
    "Tashkilotchilar tadbir qo'shgach, ular shu yerda paydo bo'ladi.",
    "Когда организаторы добавят события, они появятся здесь.",
    "Events appear here as soon as organizers publish them.",
  ],
  notYet: ["Hali chipta yo'q.", "Пропусков пока нет.", "No passes yet."],
  notYetHint: [
    "Tadbirni tanlab, bir bosishingizda yoziling — chipta shu yerda paydo bo'ladi.",
    "Выберите событие и запишитесь в один клик — пропуск появится здесь.",
    "Pick an event and RSVP — your pass appears here.",
  ],
  showShare: ["Eshikda shu QR kodni ko'rsating.", "Покажите этот QR-код на входе.", "Show this QR code at the door."],
  certOpen: ["Sertifikat", "Сертификат", "Certificate"],
  print: ["Chop etish / PDF", "Печать / PDF", "Print / PDF"],
  certBody: ["ushbu tadbirda ishtirok etgani uchun", "за участие в мероприятии", "for participating in"],
  eventsN: ["{n} tadbir", "{n} событий", "{n} events"],
  promoted: ["Navbatdan tasdiqlandi", "Из листа ожидания", "Promoted from waitlist"],
};

function x(lang: Lang, key: keyof typeof L, vars?: Record<string, string | number>): string {
  const raw = L[key][lang === "ru" ? 1 : lang === "en" ? 2 : 0];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : raw;
}

export type PulseEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  confirmed: number;
  waitlist: number;
  org_name: string;
  org_color: string;
};

export type PulsePassView = {
  event_id: string;
  slug: string;
  title: string;
  emoji: string;
  location: string | null;
  starts_at: string;
  status: string;
  ticket_code: string;
  checked_in_at: string | null;
  promoted_at: string | null;
  wait_position: number;
  org_name: string;
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-800",
  attended: "bg-sky-100 text-sky-800",
  waitlist: "bg-amber-100 text-amber-800",
  pending: "bg-elevated text-text-secondary",
};

function Qr({ value, size = 128 }: { value: string; size?: number }) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  return (
    <div
      aria-label={`QR ${value}`}
      style={{
        width: size,
        height: size,
        display: "grid",
        gridTemplateColumns: `repeat(${matrix.length}, 1fr)`,
        background: "#ffffff",
        padding: 6,
        borderRadius: 6,
        border: "1px solid #d8d3c7",
      }}
    >
      {matrix.flatMap((row, r) =>
        row.map((on, c) => (
          <span key={`${r}-${c}`} style={{ background: on ? "#111315" : "#ffffff" }} />
        ))
      )}
    </div>
  );
}

export function Pulse({
  lang,
  name,
  today,
  events,
  passes,
  notice,
}: {
  lang: Lang;
  name: string;
  today: string;
  events: PulseEvent[];
  passes: PulsePassView[];
  notice?: { kind: "ok" | "err"; text: string } | null;
}) {
  const [tab, setTab] = useState<"discover" | "passes">("discover");
  const [query, setQuery] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const [openCert, setOpenCert] = useState<string | null>(null);

  const passByEvent = useMemo(() => {
    const map = new Map<string, PulsePassView>();
    for (const p of passes) map.set(p.event_id, p);
    return map;
  }, [passes]);

  const todayDate = parse(today);

  const ribbon = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() + i);
      const pad = (n: number) => String(n).padStart(2, "0");
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      days.push({ date: key, count: events.filter((e) => e.starts_at.startsWith(key)).length });
    }
    return days;
  }, [events, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (day !== null && !e.starts_at.startsWith(ribbon[day].date)) return false;
      if (!q) return true;
      return [e.title, e.description ?? "", e.location ?? "", e.org_name]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [events, query, day, ribbon]);

  return (
    <div className="pulse-shell mx-auto max-w-[920px]">
      <style>{`
        @media print{
          body *{visibility:hidden}
          .pulse-cert,.pulse-cert *{visibility:visible}
          .pulse-cert{position:fixed;inset:0;margin:auto;box-shadow:none;border:1px solid #111}
        }
        .pulse-cert{background:#fff !important;color:#111 !important}
        .pulse-cert *{color:#111315 !important;border-color:#d8d3c7 !important}
        .pulse-cert .pulse-sub{color:#525860 !important}
      `}</style>

      <header className="border-b border-strong pb-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">UDEA · Pulse</p>
        <h1 className="mt-2 font-serif text-[26px] leading-[1.1] text-text-primary md:text-[33px]">
          {x(lang, "title")}
        </h1>
        <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-text-tertiary">{x(lang, "intro")}</p>
        <p className="mt-2 font-mono text-[11px] text-text-tertiary">
          {x(lang, "hello", { name }).toUpperCase()} · {x(lang, "eventsN", { n: events.length }).toUpperCase()}
        </p>
      </header>

      {notice && (
        <div
          className={`mt-4 rounded-2xl border-l-2 px-3.5 py-2.5 text-[12.5px] font-medium ${
            notice.kind === "ok"
              ? "border-emerald-400 bg-emerald-50 text-emerald-800"
              : "border-rose-400 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="mt-4 inline-flex rounded-full border border-strong bg-card p-1">
        {(["discover", "passes"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              tgHaptic("tap");
              setTab(key);
            }}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold ${
              tab === key ? "bg-accent text-white" : "text-text-tertiary"
            }`}
          >
            {x(lang, key)}
            {key === "passes" && passes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10.5px]">{passes.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "discover" ? (
        <section className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={x(lang, "search")}
              className="input flex-1"
              type="search"
            />
          </div>

          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => {
                tgHaptic("tap");
                setDay(null);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold ${
                day === null
                  ? "border-accent bg-accent text-white"
                  : "border-strong bg-card text-text-tertiary"
              }`}
            >
              {x(lang, "allDates")}
            </button>
            {ribbon.map((d, i) => {
              const date = parse(d.date);
              const active = day === i;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    tgHaptic("select");
                    setDay(active ? null : i);
                  }}
                  disabled={d.count === 0}
                  className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 ${
                    active
                      ? "border-accent bg-accent text-white"
                      : d.count === 0
                        ? "border-hairline bg-card text-hairline"
                        : "border-strong bg-card text-text-primary"
                  }`}
                >
                  <span className="font-mono text-[9.5px] uppercase tracking-wide">
                    {weekday(d.date, lang).slice(0, 3)}
                  </span>
                  <span className="font-mono text-[14px] font-bold leading-none">{dayNum(d.date)}</span>
                  <span className="mt-0.5 font-mono text-[9px] opacity-70">{d.count || "·"}</span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-strong px-6 py-10 text-center">
              <p className="font-serif text-[15px] text-text-primary">
                {events.length === 0 ? x(lang, "noneYet") : x(lang, "none")}
              </p>
              {events.length === 0 && (
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-text-tertiary">{x(lang, "noneYetHint")}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((e) => {
                const pass = passByEvent.get(e.id);
                const full = e.capacity !== null && e.confirmed >= e.capacity;
                const left = e.capacity === null ? null : Math.max(0, e.capacity - e.confirmed);
                const pct = e.capacity ? Math.min(100, Math.round((e.confirmed / e.capacity) * 100)) : 0;
                return (
                  <article key={e.id} className="card flex flex-col p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                        {e.emoji} {e.org_name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        {fmtTime(e.starts_at)}
                        {e.ends_at ? `–${fmtTime(e.ends_at)}` : ""}
                      </span>
                    </div>

                    <Link href={`/events/${e.slug}`} className="mt-2 block">
                      <h2 className="font-serif text-[18px] leading-snug text-text-primary hover:text-academic">{e.title}</h2>
                    </Link>
                    {e.description && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-tertiary">{e.description}</p>
                    )}

                    <p className="mt-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-secondary">
                      {weekday(e.starts_at, lang).slice(0, 3)}, {dayNum(e.starts_at)} {monthShort(e.starts_at, lang).toUpperCase()}
                    </p>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-text-tertiary">
                      {e.location ?? "—"}
                    </p>

                    <div className="mt-3">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <span>{e.capacity === null ? "∞" : x(lang, "seats", { a: e.confirmed, b: e.capacity })}</span>
                        <span className={full ? "text-rose-600" : "text-text-tertiary"}>
                          {e.capacity === null ? "" : full ? x(lang, "full") : x(lang, "leftN", { n: left ?? 0 })}
                        </span>
                      </div>
                      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-elevated">
                        <div
                          className={`h-full ${full ? "bg-rose-500" : "bg-accent"}`}
                          style={{ width: `${e.capacity === null ? 12 : pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-3">
                      {pass && pass.status !== "cancelled" ? (
                        <button
                          type="button"
                          onClick={() => setTab("passes")}
                          className="flex-1 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800"
                        >
                          {pass.status === "waitlist"
                            ? x(lang, "waitN", { n: pass.wait_position })
                            : pass.status === "attended"
                              ? x(lang, "inEvent")
                              : pass.status === "pending"
                                ? x(lang, "pending")
                                : x(lang, "ticketReady")}
                        </button>
                      ) : (
                        <form action={pulseRsvpAction} className="flex-1">
                          <input type="hidden" name="event_id" value={e.id} />
                          <button
                            onClick={() => tgHaptic(full ? "tap" : "success")}
                            className={`w-full rounded-2xl px-3 py-2 text-[12px] font-semibold ${
                              full
                                ? "border border-amber-300 bg-amber-50 text-amber-800"
                                : "bg-accent text-white"
                            }`}
                          >
                            {full ? x(lang, "joinWait") : x(lang, "rsvp")}
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/events/${e.slug}`}
                        className="rounded-2xl border border-strong px-3 py-2 text-[12px] font-semibold text-text-secondary"
                      >
                        {x(lang, "open")}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          {passes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-strong px-6 py-10 text-center">
              <p className="font-serif text-[15px] text-text-primary">{x(lang, "notYet")}</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-text-tertiary">{x(lang, "notYetHint")}</p>
              <button type="button" onClick={() => setTab("discover")} className="btn-primary btn-sm mt-3">
                {x(lang, "discover")}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {passes.map((p) => (
                <article key={p.event_id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <Qr value={p.ticket_code} />
                    <div className="min-w-0 flex-1">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                          STATUS_STYLE[p.status] ?? "bg-elevated text-text-secondary"
                        }`}
                      >
                        {p.status === "waitlist"
                          ? x(lang, "waitN", { n: p.wait_position })
                          : p.status === "attended"
                            ? x(lang, "inEvent")
                            : p.status === "pending"
                              ? x(lang, "pending")
                              : x(lang, "ticketReady")}
                      </span>
                      <h2 className="mt-1.5 font-serif text-[17px] leading-snug text-text-primary">{p.title}</h2>
                      <p className="mt-0.5 text-[11.5px] text-text-tertiary">
                        {weekday(p.starts_at, lang).slice(0, 3)}, {dayNum(p.starts_at)} {monthShort(p.starts_at, lang)} ·{" "}
                        {fmtTime(p.starts_at)}
                      </p>
                      <p className="font-mono text-[10.5px] uppercase tracking-wide text-text-tertiary">
                        {p.location ?? p.org_name}
                      </p>
                      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-tertiary">
                        {x(lang, "serial")}: {p.ticket_code}
                      </p>
                      {p.promoted_at && p.status !== "waitlist" && (
                        <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-emerald-800">
                          ↑ {x(lang, "promoted")}
                        </span>
                      )}
                    </div>
                  </div>

                  {p.status === "confirmed" && (
                    <p className="mt-2 text-[11px] text-text-tertiary">{x(lang, "showShare")}</p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    {p.status === "attended" && (
                      <button
                        type="button"
                        onClick={() => {
                          tgHaptic("tap");
                          setOpenCert(openCert === p.event_id ? null : p.event_id);
                        }}
                        className="btn-ghost btn-sm"
                      >
                        {x(lang, "certOpen")}
                      </button>
                    )}
                    {p.status !== "attended" && (
                      <form action={pulseCancelAction}>
                        <input type="hidden" name="event_id" value={p.event_id} />
                        <button onClick={() => tgHaptic("tap")} className="btn-ghost btn-sm">
                          {x(lang, "cancel")}
                        </button>
                      </form>
                    )}
                    <Link href={`/events/${p.slug}`} className="ml-auto text-[11.5px] font-semibold text-text-tertiary">
                      {x(lang, "open")} →
                    </Link>
                  </div>

                  {openCert === p.event_id && (
                    <div className="pulse-cert mt-3 rounded-2xl border border-strong p-4">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em]">UDEA · {p.org_name}</p>
                      <p className="mt-2 font-serif text-[13px] uppercase tracking-[0.12em]">Sertifikat</p>
                      <p className="mt-1 font-serif text-[17px]">{name}</p>
                      <p className="pulse-sub text-[11px]">{x(lang, "certBody")}</p>
                      <p className="text-[12px] font-semibold">{p.title}</p>
                      <p className="pulse-sub mt-1 font-mono text-[9.5px] uppercase tracking-wide">
                        {dayNum(p.starts_at)} {monthShort(p.starts_at, lang)} · {p.ticket_code}
                      </p>
                      <button type="button" onClick={() => window.print()} className="btn-ghost btn-sm mt-2">
                        {x(lang, "print")}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
