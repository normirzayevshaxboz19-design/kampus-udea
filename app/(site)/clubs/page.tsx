import Link from "next/link";
import { clubs, myClubs, myPendingClubs } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import { orgGradient } from "@/lib/labels";
import { Empty } from "@/components/ui";
import { getT } from "@/lib/lang";

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function ClubsPage() {
  const user = await requireUser("/clubs");
  const { t, tpl } = await getT();
  const list = clubs();
  const joined = new Set(myClubs(user.id).map((c) => c.id));
  const pending = myPendingClubs(user.id);

  return (
    <div className="space-y-6">
      <div className="border-b border-strong pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
          {tpl("Ro'yxat · {n} faol klub", { n: list.length })}
        </p>
        <h1 className="mt-1.5 font-serif text-[30px] leading-none text-text-primary">{t("Klublar")}</h1>
        <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-text-secondary">
          {t(
            "Klub sahifasida a'zolik uchun ariza qoldirasiz, koordinator tasdiqlaydi. Tasdiqlangach klub chati va tadbirlari ochiladi.",
          )}
        </p>
      </div>

      {pending.length > 0 && (
        <p className="border-l-2 border-amber-300 bg-amber-50/60 px-3.5 py-2.5 text-[12px] text-amber-900">
          <span className="font-semibold">{t("Ko'rib chiqilmoqda:")}</span>{" "}
          {pending.map((p) => p.name).join(", ")} — {t("koordinator javobini kuting.")}
        </p>
      )}

      {list.length === 0 ? (
        <Empty title={t("Hozircha klub yo'q")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const isMember = joined.has(c.id);
            const isPending = pending.some((p) => p.org_id === c.id);
            return (
              <Link
                key={c.id}
                href={`/clubs/${c.slug}`}
                className="card group flex flex-col transition-colors hover:border-strong"
              >
                <div className={`flex items-baseline justify-between px-4 py-3 ${orgGradient(c.color)}`}>
                  <span className="font-serif text-[21px] leading-none tracking-[0.02em] text-white/95">
                    {monogram(c.name)}
                  </span>
                  {isMember && (
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/80">
                      {t("A'zo")}
                    </span>
                  )}
                  {!isMember && isPending && (
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/80">
                      {t("Ariza")}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col px-4 py-3.5">
                  <h2 className="font-serif text-[17px] leading-snug text-text-primary group-hover:opacity-75">
                    {c.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-tertiary">{c.tagline}</p>
                  <div className="mt-auto flex items-baseline gap-4 pt-3 font-mono text-[10.5px] text-text-tertiary">
                    <span>{tpl("{n} a'zo", { n: c.members })}</span>
                    <span>{tpl("{n} tadbir", { n: c.upcoming })}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
