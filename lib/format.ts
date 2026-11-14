import { tpl, tr, type Lang } from "./i18n";

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const WEEKDAYS_RU = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parse(iso: string): Date {
  return new Date(iso.length <= 10 ? `${iso}T00:00` : iso);
}

export function fmtDate(iso: string, lang: Lang = "uz"): string {
  const d = parse(iso);
  const m = d.getMonth();
  if (lang === "ru") return `${d.getDate()} ${SHORT_RU[m]}`;
  if (lang === "en") return `${d.getDate()} ${SHORT_EN[m]}`;
  return `${d.getDate()}-${MONTHS[m]}`;
}

/** Kun raqami — jurnaldagi sana ustuni uchun. */
export function dayNum(iso: string): string {
  return String(parse(iso).getDate()).padStart(2, "0");
}

/** Oy nomi, qisqa shaklda. */
export function monthShort(iso: string, lang: Lang = "uz"): string {
  const m = parse(iso).getMonth();
  if (lang === "ru") return SHORT_RU[m];
  if (lang === "en") return SHORT_EN[m];
  return MONTHS[m].slice(0, 3);
}

export function monthName(iso: string, lang: Lang = "uz"): string {
  const m = parse(iso).getMonth();
  if (lang === "ru") return MONTHS_RU[m];
  if (lang === "en") return MONTHS_EN[m];
  return MONTHS[m];
}

export function fmtDateLong(iso: string, lang: Lang = "uz"): string {
  const d = parse(iso);
  const m = d.getMonth();
  if (lang === "ru") return `${d.getDate()} ${MONTHS_RU[m]} ${d.getFullYear()}`;
  if (lang === "en") return `${d.getDate()} ${MONTHS_EN[m]} ${d.getFullYear()}`;
  return `${d.getDate()}-${MONTHS[m]}, ${d.getFullYear()}`;
}

export const fmtDateLongUz = (iso: string) => fmtDateLong(iso, "uz");

export function fmtTime(iso: string): string {
  const d = parse(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string, lang: Lang = "uz"): string {
  return `${fmtDate(iso, lang)}, ${fmtTime(iso)}`;
}

export function fmtEventRange(start: string, end?: string | null, lang: Lang = "uz"): string {
  if (!end) return `${fmtDate(start, lang)}, ${fmtTime(start)}`;
  const s = parse(start);
  const e = parse(end);
  if (s.toDateString() === e.toDateString()) {
    return `${fmtDate(start, lang)}, ${fmtTime(start)}–${fmtTime(end)}`;
  }
  return `${fmtDateTime(start, lang)} – ${fmtDateTime(end, lang)}`;
}

export function weekday(iso: string, lang: Lang = "uz"): string {
  const i = parse(iso).getDay();
  if (lang === "ru") return WEEKDAYS_RU[i];
  if (lang === "en") return WEEKDAYS_EN[i];
  return WEEKDAYS[i];
}

export function daysUntil(iso: string): number {
  const now = new Date();
  const d = parse(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export function relativeDay(iso: string, lang: Lang = "uz"): string {
  const diff = daysUntil(iso);
  if (diff === 0) return tr(lang, "Bugun");
  if (diff === 1) return tr(lang, "Ertaga");
  if (diff === -1) return tr(lang, "Kecha");
  if (diff > 1 && diff <= 14) return tpl(lang, "{n} kundan keyin", { n: diff });
  if (diff < -1 && diff >= -14) return tpl(lang, "{n} kun oldin", { n: Math.abs(diff) });
  return fmtDate(iso, lang);
}

/** SQLite `datetime('now')` (UTC) qiymatini qisqa mahalliy vaqtga aylantiradi. */
export function fmtStamp(value: string, lang: Lang = "uz"): string {
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `${tr(lang, "bugun")} ${time}`;
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return `${tr(lang, "kecha")} ${time}`;
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${time}`;
}

export function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isPast(iso: string): boolean {
  return new Date(iso.length <= 10 ? `${iso}T23:59` : iso) < new Date();
}

export function weekStart(date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
