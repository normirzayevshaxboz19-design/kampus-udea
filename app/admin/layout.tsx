import Link from "next/link";
import { getActiveOrg, getMemberships, isAdmin, requireUser } from "@/lib/auth";
import { setActiveOrgAction } from "@/app/actions";
import { AdminSidebar, AdminTabs } from "@/components/nav";
import { Avatar } from "@/components/ui";
import { Preferences } from "@/components/Controls";
import { can, roleLabel } from "@/lib/perms";
import { orgGradient } from "@/lib/labels";
import { getLang, getTheme } from "@/lib/lang";
import { tr } from "@/lib/i18n";

const NAV = [
  { href: "/admin", label: "Boshqaruv", icon: "" },
  { href: "/admin/events", label: "Tadbirlar", icon: "" },
  { href: "/admin/scan", label: "Skaner", icon: "" },
  { href: "/admin/projects", label: "Loyihalar", icon: "" },
  { href: "/admin/tasks", label: "Vazifalar", icon: "" },
  { href: "/admin/team", label: "Jamoa", icon: "" },
  { href: "/admin/plan", label: "Umumiy reja", icon: "" },
  { href: "/admin/club", label: "Klub profili", icon: "" },
];

const ADMIN_ONLY = [{ href: "/admin/users", label: "Foydalanuvchilar", icon: "" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  const memberships = await getMemberships(user.id);
  const active = await getActiveOrg(user.id);
  const [lang, theme] = await Promise.all([getLang(), getTheme()]);
  const t = (text: string) => tr(lang, text);

  if (!active) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-serif text-[22px] text-text-primary">{t("Tashkilotchilar bo'limi")}</h1>
        <p className="mt-1.5 text-[13px] text-text-tertiary">
          {t("Bu bo'lim faqat jamoa a'zolari uchun. Klub sahifasidan a'zolik uchun ariza yuborishingiz mumkin.")}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/clubs" className="btn-primary btn-sm">
            {t("Klublar")}
          </Link>
          <Link href="/" className="btn-ghost btn-sm">
            {t("Bosh sahifa")}
          </Link>
        </div>
        <div className="mt-5 flex justify-center">
          <Preferences lang={lang} theme={theme} />
        </div>
      </div>
    );
  }

  const nav = NAV.filter((item) => {
    if (item.href === "/admin/events") return isAdmin(user) || can(active.role_key, "event.manage");
    if (item.href === "/admin/scan") return isAdmin(user) || can(active.role_key, "reg.view");
    if (item.href === "/admin/club") return isAdmin(user) || can(active.role_key, "team.manage");
    return true;
  });
  if (isAdmin(user)) nav.push(...ADMIN_ONLY);
  const translatedNav = nav.map((item) => ({ ...item, label: t(item.label) }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-strong bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-[21px] font-bold leading-none tracking-[-0.02em] text-text-primary">Kampus</span>
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-text-tertiary sm:block">
              {t("Tashkilotchilar")}
            </span>
          </Link>

          <div className="ml-1 flex min-w-0 items-center gap-2 border-l border-strong pl-3">
            <span className={`size-2 shrink-0 rounded-full ${orgGradient(active.org_color)}`} />
            <form action={setActiveOrgAction} className="min-w-0">
              <select
                name="org_id"
                defaultValue={active.org_id}
                className="max-w-[150px] cursor-pointer truncate border-0 bg-transparent text-[12.5px] font-semibold text-text-primary outline-none sm:max-w-none"
              >
                {memberships.map((m) => (
                  <option key={m.org_id} value={m.org_id}>
                    {m.org_name} · {roleLabel(m.role_key, lang)}
                  </option>
                ))}
              </select>
              <button type="submit" className="ml-1 text-[11px] font-bold text-academic">
                ↻
              </button>
            </form>
          </div>

          {isAdmin(user) && <span className="badge bg-indigo-100 text-academic">Admin</span>}

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-[11.5px] font-semibold text-text-tertiary underline decoration-slate-300 underline-offset-4 hover:text-text-primary sm:inline"
            >
              {t("Saytga qaytish")}
            </Link>
            <Link href="/profile" className="flex items-center gap-2 hover:opacity-80">
              <Avatar emoji={user.avatar_emoji} name={user.full_name} src={user.avatar_url} size={28} />
              <span className="hidden text-[12.5px] font-semibold text-text-primary sm:block">
                {user.full_name.split(" ")[0]}
              </span>
            </Link>
            <Preferences lang={lang} theme={theme} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-7 px-4 pb-24 pt-6 md:pb-12">
        <AdminSidebar items={translatedNav} lang={lang} />
        <div className="min-w-0 flex-1">
          <AdminTabs items={translatedNav} />
          {children}
        </div>
      </div>
    </div>
  );
}
