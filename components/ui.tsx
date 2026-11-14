import Link from "next/link";

export function initials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

export function Avatar({
  emoji,
  name,
  src,
  size = 40,
  ring = false,
}: {
  emoji?: string | null;
  name?: string | null;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        className={`inline-block shrink-0 rounded-full border border-hairline bg-elevated object-cover ${
          ring ? "ring-2 ring-white" : ""
        }`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full border border-hairline bg-elevated font-serif font-semibold uppercase text-text-secondary ${
        ring ? "ring-2 ring-white" : ""
      }`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      title={name ?? undefined}
    >
      {initials(name) || emoji || "·"}
    </span>
  );
}

export function SectionHead({
  title,
  hint,
  href,
  linkLabel,
}: {
  title: string;
  hint?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t border-strong/80 pt-2.5">
      <div className="min-w-0">
        <h2 className="font-serif text-[19px] leading-tight text-text-primary">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-text-tertiary">{hint}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11.5px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
        >
          {linkLabel ?? "Barchasi"}
        </Link>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn";
}) {
  return (
    <div className="card px-4 py-3">
      <div
        className={`font-serif text-[26px] leading-none ${
          tone === "warn" ? "text-amber-700" : "text-text-primary"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-text-tertiary">{label}</div>
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-full overflow-hidden rounded-none bg-elevated">
        <div className="h-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-text-tertiary">{pct}%</span>
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-strong bg-white/50 px-6 py-9 text-center">
      {icon && <div className="mb-1 text-lg opacity-70">{icon}</div>}
      <p className="font-serif text-[15px] text-text-primary">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-text-tertiary">{hint}</p>}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-strong bg-subtle text-text-primary",
  }[kind];
  return (
    <div className={`rounded-2xl border-l-2 px-3.5 py-2.5 text-[12.5px] font-medium ${styles}`}>{children}</div>
  );
}
