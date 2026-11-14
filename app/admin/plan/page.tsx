import { getActiveOrg, requireUser } from "@/lib/auth";
import { planOfWeek } from "@/lib/data";
import { weekStart } from "@/lib/format";
import { can } from "@/lib/perms";
import { addPlanItemAction, togglePlanItemAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/lang";

const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/admin/plan");
  const { t, tpl } = await getT();
  const active = await getActiveOrg(user.id);
  if (!active) return null;

  const week = weekStart();
  const items = planOfWeek(active.org_id, week);
  const editable = can(active.role_key, "plan.edit");

  return (
    <div className="space-y-5">
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">{t("Umumiy reja")}</h1>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {t("Jamoaning haftalik rejasi. Barcha a'zolar ko'radi, tahrirlash huquqi faqat rahbarlarda.")}
          </p>
        </div>
        <span className="badge bg-elevated px-3 py-1.5 text-text-secondary">{tpl("Hafta: {week}", { week })}</span>
      </div>

      {!editable && (
        <div className="rounded-2xl border border-hairline bg-card/70 px-4 py-3 text-[12.5px] text-text-tertiary">
          {t("Siz rejani faqat ko'rishingiz mumkin. O'zgartirish uchun rahbarga murojaat qiling.")}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DAYS.map((day) => {
          const dayItems = items.filter((i) => i.day === day);
          if (dayItems.length === 0 && !editable) return null;
          return (
            <div key={day} className="card p-4">
              <h2 className="text-[13px] font-bold text-text-primary">{t(day)}</h2>
              <ul className="mt-2 space-y-1.5">
                {dayItems.map((i) => (
                  <li key={i.id}>
                    <form action={togglePlanItemAction} className="flex items-start gap-2">
                      <input type="hidden" name="org_id" value={active.org_id} />
                      <input type="hidden" name="item_id" value={i.id} />
                      <button
                        type="submit"
                        disabled={!editable}
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-2xl border text-[9px] font-bold ${
                          i.done
                            ? "border-emerald-500 bg-emerald-500 text-text-inverted"
                            : "border-strong bg-card text-transparent"
                        } ${editable ? "" : "cursor-default opacity-70"}`}
                        aria-label={t("Bajarildi")}
                      >
                        ✓
                      </button>
                      <span
                        className={`text-[12.5px] leading-snug ${i.done ? "text-text-tertiary line-through" : "text-text-primary"}`}
                      >
                        {i.title}
                      </span>
                    </form>
                  </li>
                ))}
                {dayItems.length === 0 && <li className="text-[11.5px] text-text-tertiary">{t("Reja bandi yo'q")}</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {editable && (
        <form action={addPlanItemAction} className="card grid gap-3 p-5 md:grid-cols-[160px_1fr_auto]">
          <input type="hidden" name="org_id" value={active.org_id} />
          <input type="hidden" name="week_start" value={week} />
          <div>
            <label className="label">{t("Kun")}</label>
            <select name="day" className="input" defaultValue="Dushanba">
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {t(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("Reja bandi")}</label>
            <input name="title" required placeholder={t("Loyihalar holatini ko'rib chiqish")} className="input" />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full">{t("Qo'shish")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
