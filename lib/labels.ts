export const EVENT_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Qoralama", className: "bg-slate-100 text-slate-600" },
  published: { label: "E'lon qilingan", className: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Ro'yxat yopilgan", className: "bg-amber-100 text-amber-700" },
  finished: { label: "Tugallangan", className: "bg-slate-100 text-slate-500" },
  cancelled: { label: "Bekor qilingan", className: "bg-rose-100 text-rose-700" },
};

export const TASK_STATUS: Record<string, { label: string; className: string; dot: string }> = {
  todo: { label: "Kutilmoqda", className: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  doing: { label: "Jarayonda", className: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  review: { label: "Tekshiruvda", className: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  done: { label: "Bajarildi", className: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

export const TASK_PRIORITY: Record<string, { label: string; className: string }> = {
  low: { label: "Past", className: "bg-slate-100 text-slate-500" },
  normal: { label: "O'rta", className: "bg-slate-100 text-slate-600" },
  high: { label: "Yuqori", className: "bg-amber-100 text-amber-700" },
  urgent: { label: "Shoshilinch", className: "bg-rose-100 text-rose-700" },
};

export const REG_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Ko'rib chiqilmoqda", className: "bg-amber-50 text-amber-700" },
  rejected: { label: "Rad etilgan", className: "bg-rose-50 text-rose-600" },
  confirmed: { label: "Tasdiqlangan", className: "bg-emerald-100 text-emerald-700" },
  waitlist: { label: "Navbatda", className: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Bekor qilgan", className: "bg-slate-100 text-slate-500" },
  attended: { label: "Qatnashgan", className: "bg-indigo-100 text-indigo-700" },
  no_show: { label: "Kelmagan", className: "bg-rose-100 text-rose-700" },
};

/* Tashkilot ranglari — gradient emas, bitta bo'g'iq tus. */
export const ORG_COLORS: Record<string, string> = {
  indigo: "bg-[#3f4a56]",
  emerald: "bg-[#3d5645]",
  sky: "bg-[#3c515f]",
  amber: "bg-[#6f5431]",
  violet: "bg-[#524750]",
  rose: "bg-[#634042]",
  teal: "bg-[#33534c]",
};

export function orgGradient(color?: string | null): string {
  return ORG_COLORS[color ?? "indigo"] ?? ORG_COLORS.indigo;
}
