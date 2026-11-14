import Link from "next/link";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { myTasks, orgTasks } from "@/lib/data";
import { relativeDay } from "@/lib/format";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/labels";
import { can } from "@/lib/perms";
import { updateTaskStatusAction } from "@/app/actions";
import { Empty } from "@/components/ui";
import { getT } from "@/lib/lang";

const COLUMNS = ["todo", "doing", "review", "done"] as const;

export default async function TasksPage() {
  const user = await requireUser("/admin/tasks");
  const { lang, t, tpl } = await getT();
  const active = await getActiveOrg(user.id);
  if (!active) return null;

  const mine = myTasks(user.id, active.org_id);
  const all = can(active.role_key, "task.assign") ? orgTasks(active.org_id) : [];
  const open = mine.filter((task) => task.status !== "done");
  const closed = mine.filter((task) => task.status === "done");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-text-primary">{t("Vazifalar")}</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">
          {t("Sizga biriktirilgan ishlar. Holatni yangilaganingizda rahbar panelda darhol ko'radi.")}
        </p>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-text-primary">{t("Ochiq vazifalar")}</h2>
          <span className="text-[11.5px] font-semibold text-text-tertiary">{tpl("{n} ta", { n: open.length })}</span>
        </div>
        {open.length === 0 ? (
          <Empty
            title={t("Ochiq vazifa yo'q")}
            hint={t("Yangi vazifa biriktirilganda shu yerda paydo bo'ladi.")}
          />
        ) : (
          <ul className="space-y-2">
            {open.map((task) => (
              <li key={task.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold leading-snug text-text-primary">{task.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-text-tertiary">{task.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${TASK_STATUS[task.status].className}`}>
                        {t(TASK_STATUS[task.status].label)}
                      </span>
                      <span className={`badge ${TASK_PRIORITY[task.priority].className}`}>
                        {t(TASK_PRIORITY[task.priority].label)}
                      </span>
                      {task.due_date && (
                        <span className="text-[11px] font-semibold text-text-tertiary">
                          {t("muddat:")} {relativeDay(task.due_date, lang)}
                        </span>
                      )}
                      <Link
                        href={`/admin/projects/${task.project_id}`}
                        className="text-[11px] font-semibold text-academic hover:opacity-75"
                      >
                        {task.project_title}
                      </Link>
                    </div>
                  </div>
                  <form action={updateTaskStatusAction} className="flex shrink-0 items-center gap-1.5">
                    <input type="hidden" name="task_id" value={task.id} />
                    <input type="hidden" name="next" value="/admin/tasks" />
                    <select
                      name="status"
                      defaultValue={task.status}
                      className="rounded-2xl border border-strong bg-card px-2 py-1.5 text-[11.5px] font-semibold text-text-primary"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c} value={c}>
                          {t(TASK_STATUS[c].label)}
                        </option>
                      ))}
                    </select>
                    <button className="btn-soft btn-sm">{t("Saqlash")}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="mb-2 text-[14px] font-bold text-text-primary">{t("Bajarilgan")}</h2>
          <ul className="card divide-y divide-hairline overflow-hidden">
            {closed.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-emerald-500">✓</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-tertiary line-through">{task.title}</span>
                <form action={updateTaskStatusAction}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <input type="hidden" name="status" value="todo" />
                  <input type="hidden" name="next" value="/admin/tasks" />
                  <button className="text-[11px] font-bold text-academic">{t("Qayta ochish")}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {all.length > 0 && (
        <section>
          <h2 className="mb-2 text-[14px] font-bold text-text-primary">{t("Jamoa vazifalari")}</h2>
          <p className="mb-2 text-[12px] text-text-tertiary">
            {t("Rahbar sifatida barcha vazifalar holatini kuzatishingiz mumkin.")}
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-subtle text-[10.5px] uppercase tracking-wide text-text-tertiary">
                <tr>
                  <th className="px-4 py-2.5 font-bold">{t("Vazifa")}</th>
                  <th className="px-4 py-2.5 font-bold">{t("Mas'ul")}</th>
                  <th className="px-4 py-2.5 font-bold">{t("Muddat")}</th>
                  <th className="px-4 py-2.5 font-bold">{t("Holat")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {all.map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-2.5 text-[12.5px] font-semibold text-text-primary">{task.title}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-text-tertiary">
                      {task.assignee_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-text-tertiary">
                      {task.due_date ? relativeDay(task.due_date, lang) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`badge ${TASK_STATUS[task.status].className}`}>
                        {t(TASK_STATUS[task.status].label)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
