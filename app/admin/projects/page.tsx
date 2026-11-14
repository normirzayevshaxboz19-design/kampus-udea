import Link from "next/link";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { projectsOfOrg, tasksOfProject } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { can } from "@/lib/perms";
import { Progress } from "@/components/ui";
import { getT } from "@/lib/lang";

export default async function ProjectsPage() {
  const user = await requireUser("/admin/projects");
  const { lang, t, tpl } = await getT();
  const active = await getActiveOrg(user.id);
  if (!active) return null;
  const projects = projectsOfOrg(active.org_id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-text-primary">{t("Loyihalar")}</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">
          {t(
            "Har bir loyiha — reja, muddat va vazifalar to'plami. Ichkariga kirib jadval, kalendar va taxta ko'rinishlarini almashtirishingiz mumkin.",
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => {
          const tasks = tasksOfProject(p.id);
          const next = tasks.find((task) => task.status !== "done");
          return (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}`}
              className="card group p-5 transition hover:border-hairline"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-bold leading-snug text-text-primary group-hover:text-academic">
                  {p.title}
                </h2>
                <span
                  className={`badge shrink-0 ${
                    p.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-elevated text-text-tertiary"
                  }`}
                >
                  {t(p.status === "active" ? "Faol" : p.status === "done" ? "Yakunlangan" : "Qoralama")}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-text-tertiary">{p.description}</p>

              <div className="mt-4">
                <Progress done={p.done} total={p.total} />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11.5px] text-text-tertiary">
                <span>
                  {p.end_date
                    ? tpl("Muddat: {date} gacha", { date: fmtDate(p.end_date, lang) })
                    : t("Muddat yo'q")}
                </span>
                <span className="font-semibold">{tpl("{done}/{total} vazifa", { done: p.done, total: p.total })}</span>
              </div>

              {next && (
                <div className="mt-3 rounded-2xl bg-subtle px-3 py-2 text-[11.5px] text-text-secondary">
                  <span className="font-bold text-text-tertiary">{t("Keyingi:")} </span>
                  {next.title}
                  {next.assignee_name ? ` · ${next.assignee_name}` : ""}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {can(active.role_key, "project.create") && (
        <p className="text-[12px] text-text-tertiary">
          {t("Yangi loyiha ochish uchun jamoa rahbariga murojaat qiling — loyiha yaratish huquqi faqat rahbarlarda.")}
        </p>
      )}
    </div>
  );
}
