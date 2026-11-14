import Link from "next/link";
import { getActiveOrg, isAdmin, requireUser } from "@/lib/auth";
import {
  allEvents,
  eventsOfOrg,
  myTasks,
  orgStats,
  pendingRequests,
  projectsOfOrg,
} from "@/lib/data";
import { dayNum, fmtDateTime, monthShort, now, relativeDay } from "@/lib/format";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/labels";
import { can, roleAccent, roleLabel } from "@/lib/perms";
import { quickTaskAction } from "@/app/actions";
import { Alert, Avatar, Empty, Progress, SectionHead, Stat } from "@/components/ui";
import { getT } from "@/lib/lang";

const NEXT_STATUS: Record<string, { label: string; next: string }> = {
  todo: { label: "Boshlash", next: "doing" },
  doing: { label: "Tekshiruvga", next: "review" },
  review: { label: "Bajarildi", next: "done" },
  done: { label: "Qayta ochish", next: "todo" },
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/admin");
  const { lang, t, tpl } = await getT();
  const active = await getActiveOrg(user.id);
  if (!active) return null;

  const stats = orgStats(active.org_id);
  const tasks = myTasks(user.id, active.org_id).filter((task) => task.status !== "done");
  const projects = projectsOfOrg(active.org_id);
  const admin = isAdmin(user);
  const upcoming = (admin ? allEvents().slice().reverse() : eventsOfOrg(active.org_id, true))
    .filter((e) => e.starts_at >= now())
    .slice(0, 4);
  const requests = can(active.role_key, "team.manage") ? pendingRequests(active.org_id) : [];

  return (
    <div className="space-y-6">
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{t("Tashkilotchilar paneli")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-text-primary">
            {active.org_name}
            <span className={`badge ${roleAccent(active.role_key)}`}>{roleLabel(active.role_key, lang)}</span>
          </h1>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {tpl("Salom, {name} — bugungi ishlaringiz va loyihalar holati.", { name: user.full_name.split(" ")[0] })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/events" className="btn-primary btn-sm">
            {t("Tadbirlar")}
          </Link>
          <Link href="/admin/projects" className="btn-ghost btn-sm">
            {t("Loyihalar")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Faol loyiha")} value={stats.projects} />
        <Stat label={t("Mening vazifalarim")} value={tasks.length} tone={tasks.length > 0 ? "warn" : "default"} />
        <Stat label={t("Yaqin tadbir")} value={stats.events} />
        <Stat label={t("Kutayotgan ariza")} value={stats.pending} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <SectionHead
            title={t("Mening vazifalarim")}
            hint={t("Sizga biriktirilgan ochiq vazifalar")}
            href="/admin/tasks"
            linkLabel={t("Barchasi")}
          />
          {tasks.length === 0 ? (
            <Empty title={t("Ochiq vazifa yo'q")} hint={t("Barcha biriktirilgan ishlar bajarilgan.")} />
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 6).map((task) => {
                const s = TASK_STATUS[task.status];
                const p = TASK_PRIORITY[task.priority];
                const action = NEXT_STATUS[task.status];
                return (
                  <li key={task.id} className="rounded-2xl border border-hairline/80 px-3.5 py-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold leading-snug text-text-primary">{task.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className={`badge ${s.className}`}>{t(s.label)}</span>
                          <span className={`badge ${p.className}`}>{t(p.label)}</span>
                          {task.due_date && (
                            <span className="font-semibold text-text-tertiary">{relativeDay(task.due_date, lang)}</span>
                          )}
                        </div>
                      </div>
                      <form action={quickTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="status" value={action.next} />
                        <button className="btn-soft btn-sm whitespace-nowrap">{t(action.label)}</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <SectionHead
            title={t("Loyihalar")}
            hint={t("Faol loyihalar va bajarilish darajasi")}
            href="/admin/projects"
            linkLabel={t("Barchasi")}
          />
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/projects/${p.id}`} className="block rounded-2xl px-1 py-1 transition hover:bg-subtle">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-text-primary">{p.title}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-text-tertiary">
                      {p.done}/{p.total}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Progress done={p.done} total={p.total} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <SectionHead
            title={t("Yaqin tadbirlar")}
            hint={t(admin ? "Barcha tashkilotlar tadbirlari" : "Jamoa tadbirlari va ichki yig'ilishlar")}
            href="/admin/events"
          />
          <ul className="divide-y divide-hairline">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className="w-9 shrink-0 border-r border-hairline pr-2 text-center">
                  <span className="block font-serif text-[16px] leading-none text-text-primary">
                    {dayNum(e.starts_at)}
                  </span>
                  <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                    {monthShort(e.starts_at, lang)}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-text-primary">{e.title}</div>
                  <div className="text-[11.5px] text-text-tertiary">
                    {fmtDateTime(e.starts_at, lang)} ·{" "}
                    {e.visibility === "internal" ? t("Ichki") : tpl("{n} ishtirokchi", { n: e.confirmed })}
                  </div>
                </div>
                {e.visibility === "internal" ? (
                  <span className="badge bg-elevated text-text-tertiary">{t("Ichki")}</span>
                ) : (
                  <Link href={`/admin/events/${e.id}`} className="btn-ghost btn-sm shrink-0">
                    {t("Ishtirokchilar")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <SectionHead title={t("Yangi arizalar")} hint={t("Klubga qo'shilish so'rovlari")} href="/admin/team" />
          {requests.length === 0 ? (
            <p className="text-[12.5px] text-text-tertiary">{t("Hozircha yangi ariza yo'q.")}</p>
          ) : (
            <ul className="space-y-2">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 border-b border-hairline px-0.5 py-2 last:border-0">
                  <Avatar emoji={r.avatar_emoji} name={r.full_name} src={r.avatar_url} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-text-primary">{r.full_name}</div>
                    <div className="text-[11px] text-text-tertiary">{r.faculty ?? "—"}</div>
                  </div>
                  <Link href="/admin/team" className="text-[11.5px] font-bold text-academic">
                    {t("Ko'rish")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
