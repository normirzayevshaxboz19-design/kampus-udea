import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { getProject, membershipOf, orgMembers, tasksOfProject } from "@/lib/data";
import { fmtDate, monthName, now, parse, relativeDay } from "@/lib/format";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/labels";
import { can } from "@/lib/perms";
import { createTaskAction, updateTaskStatusAction } from "@/app/actions";
import { Alert, Avatar, Empty, Progress } from "@/components/ui";
import { getT } from "@/lib/lang";
import { tr, tpl, type Lang } from "@/lib/i18n";

const VIEWS = [
  { key: "board", label: "Taxta" },
  { key: "timeline", label: "Jadval" },
  { key: "calendar", label: "Kalendar" },
];

const COLUMNS = ["todo", "doing", "review", "done"] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view! : "board";

  const user = await requireUser(`/admin/projects/${id}`);
  const { lang, t } = await getT();
  const active = await getActiveOrg(user.id);
  const project = getProject(id);
  if (!project) notFound();

  const membership = await membershipOf(user.id, project.org_id);
  if (!membership || membership.status !== "active") {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-text-primary">{t("Bu loyiha sizning tashkilotingizga tegishli emas.")}</p>
        <Link href="/admin/projects" className="btn-ghost btn-sm mt-3">
          {t("Loyihalar")}
        </Link>
      </div>
    );
  }

  const tasks = tasksOfProject(id);
  const members = orgMembers(project.org_id);
  const canAssign = can(membership.role_key, "task.assign");
  const base = `/admin/projects/${id}`;

  return (
    <div className="space-y-5">
      <Link href="/admin/projects" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-tertiary hover:text-text-primary">
        ← {t("Loyihalar")}
      </Link>

      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-academic">{project.org_name}</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-text-primary md:text-2xl">{project.title}</h1>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-tertiary">{project.description}</p>
          </div>
          <div className="w-full max-w-[200px] shrink-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-tertiary">
              <span>{t("Bajarilish")}</span>
              <span>
                {project.done}/{project.total}
              </span>
            </div>
            <div className="mt-1.5">
              <Progress done={project.done} total={project.total} />
            </div>
            <p className="mt-2 text-[11px] text-text-tertiary">
              {project.start_date ? fmtDate(project.start_date, lang) : "—"} →{" "}
              {project.end_date ? fmtDate(project.end_date, lang) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-2xl bg-elevated p-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`${base}?view=${v.key}`}
              className={`rounded-2xl px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                view === v.key ? "bg-card text-text-primary" : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              {t(v.label)}
            </Link>
          ))}
        </div>
        <span className="text-[11.5px] font-semibold text-text-tertiary">{tpl(lang, "{n} vazifa", { n: tasks.length })}</span>
      </div>

      {view === "board" && <Board tasks={tasks} base={base} lang={lang} />}
      {view === "timeline" && <Timeline tasks={tasks} base={base} lang={lang} />}
      {view === "calendar" && <Calendar tasks={tasks} anchor={project.start_date} base={base} lang={lang} />}

      {canAssign && (
        <details className="card p-5">
          <summary className="cursor-pointer text-[13.5px] font-bold text-text-primary">{t("+ Yangi vazifa qo'shish")}</summary>
          <form action={createTaskAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="org_id" value={project.org_id} />
            <div className="md:col-span-2">
              <label className="label">{t("Vazifa nomi")}</label>
              <input name="title" required placeholder={t("Reklama dizaynini tayyorlash")} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t("Tavsif")}</label>
              <textarea name="description" rows={2} className="input" placeholder={t("Nima qilish kerakligi...")} />
            </div>
            <div>
              <label className="label">{t("Mas'ul shaxs")}</label>
              <select name="assignee_id" className="input">
                <option value="">{t("— tanlanmagan —")}</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("Muhimlik")}</label>
              <select name="priority" className="input" defaultValue="normal">
                <option value="low">{t("Past")}</option>
                <option value="normal">{t("O'rta")}</option>
                <option value="high">{t("Yuqori")}</option>
                <option value="urgent">{t("Shoshilinch")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("Tugash muddati")}</label>
              <input type="date" name="due_date" className="input" />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full">{t("Vazifa qo'shish")}</button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}

function TaskMeta({ task, lang }: { task: ReturnType<typeof tasksOfProject>[number]; lang: Lang }) {
  const p = TASK_PRIORITY[task.priority];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`badge ${p.className}`}>{tr(lang, p.label)}</span>
      {task.due_date && (
        <span className="text-[11px] font-semibold text-text-tertiary">{relativeDay(task.due_date, lang)}</span>
      )}
    </div>
  );
}

function Board({ tasks, base, lang }: { tasks: ReturnType<typeof tasksOfProject>; base: string; lang: Lang }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const s = TASK_STATUS[col];
        const items = tasks.filter((t) => t.status === col);
        return (
          <div key={col} className="rounded-2xl bg-elevated/60 p-2.5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`size-2 rounded-full ${s.dot}`} />
              <h3 className="text-[12px] font-bold text-text-primary">{tr(lang, s.label)}</h3>
              <span className="ml-auto text-[11px] font-semibold text-text-tertiary">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.id} className="card p-3">
                  <p className="text-[12.5px] font-bold leading-snug text-text-primary">{t.title}</p>
                  <div className="mt-2">
                    <TaskMeta task={t} lang={lang} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-hairline pt-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {t.assignee_name ? (
                        <>
                          <Avatar emoji={t.assignee_emoji} name={t.assignee_name} size={20} />
                          <span className="truncate text-[10.5px] font-semibold text-text-tertiary">
                            {t.assignee_name.split(" ")[0]}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10.5px] text-text-tertiary">{tr(lang, "Mas'ul yo'q")}</span>
                      )}
                    </div>
                    <form action={updateTaskStatusAction} className="flex gap-1">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="next" value={base} />
                      <select
                        name="status"
                        defaultValue={t.status}
                        className="rounded-2xl border border-strong bg-card px-1.5 py-1 text-[10.5px] font-semibold text-text-secondary"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c} value={c}>
                            {tr(lang, TASK_STATUS[c].label)}
                          </option>
                        ))}
                      </select>
                      <button className="nav-active rounded-2xl px-2 py-1 text-[10.5px] font-bold">✓</button>
                    </form>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="rounded-2xl border border-dashed border-hairline px-2 py-4 text-center text-[11px] text-text-tertiary">
                  {tr(lang, "Bo'sh")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ tasks, base, lang }: { tasks: ReturnType<typeof tasksOfProject>; base: string; lang: Lang }) {
  const sorted = [...tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-subtle text-[10.5px] uppercase tracking-wide text-text-tertiary">
          <tr>
            <th className="px-4 py-2.5 font-bold">{tr(lang, "Muddat")}</th>
            <th className="px-4 py-2.5 font-bold">{tr(lang, "Vazifa")}</th>
            <th className="hidden px-4 py-2.5 font-bold sm:table-cell">{tr(lang, "Mas'ul")}</th>
            <th className="px-4 py-2.5 font-bold">{tr(lang, "Holat")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {sorted.map((t) => {
            const s = TASK_STATUS[t.status];
            return (
              <tr key={t.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-text-tertiary">
                  {t.due_date ? fmtDate(t.due_date, lang) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[12.5px] font-bold text-text-primary">{t.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11.5px] text-text-tertiary">{t.description}</div>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-[12px] text-text-secondary sm:table-cell">
                  {t.assignee_name ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <form action={updateTaskStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="task_id" value={t.id} />
                    <input type="hidden" name="next" value={`${base}?view=timeline`} />
                    <select
                      name="status"
                      defaultValue={t.status}
                      className={`badge border-0 px-2 py-1 text-[11px] font-bold ${s.className}`}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c} value={c}>
                          {tr(lang, TASK_STATUS[c].label)}
                        </option>
                      ))}
                    </select>
                    <button className="text-[11px] font-bold text-academic">✓</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <Empty title={tr(lang, "Vazifa yo'q")} hint={tr(lang, "Pastdagi shakl orqali birinchi vazifani qo'shing.")} />
      )}
    </div>
  );
}

function Calendar({
  tasks,
  anchor,
  base,
  lang,
}: {
  tasks: ReturnType<typeof tasksOfProject>;
  anchor: string | null;
  base: string;
  lang: Lang;
}) {
  const ref = parse(anchor ?? now());
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const byDay = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), t]);
  }
  const todayKey = now().slice(0, 10);
  const weekdays = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

  return (
    <div className="card overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[13px] font-bold text-text-primary">
          {monthName(`${year}-${pad2(month + 1)}-01`, lang)} {year}
        </h3>
        <Link href={base} className="text-[11.5px] font-semibold text-academic">
          {tr(lang, "Taxtaga qaytish")}
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
        {weekdays.map((d) => (
          <div key={d} className="py-1">
            {tr(lang, d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          const key = day ? `${year}-${pad2(month + 1)}-${pad2(day)}` : "";
          const items = day ? byDay.get(key) ?? [] : [];
          const isToday = key === todayKey;
          return (
            <div
              key={idx}
              className={`min-h-[74px] rounded-2xl border p-1 text-left ${
                day ? "border-hairline bg-card" : "border-transparent"
              } ${isToday ? "ring-2 ring-indigo-400" : ""}`}
            >
              {day && (
                <>
                  <div className={`px-0.5 text-[10.5px] font-bold ${isToday ? "text-academic" : "text-text-tertiary"}`}>
                    {day}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        title={t.title}
                        className={`truncate rounded-2xl px-1 py-0.5 text-[9.5px] font-semibold ${TASK_STATUS[t.status].className}`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {items.length > 2 && (
                      <div className="px-1 text-[9px] font-bold text-text-tertiary">+{items.length - 2}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
