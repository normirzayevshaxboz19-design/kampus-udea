import Link from "next/link";
import { isAdmin, requireUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import {
  assignRoleAction,
  createOrgAction,
  removeMembershipAction,
  setSiteAdminAction,
  toggleOrgAction,
} from "@/app/actions";
import { ROLE_ORDER, roleLabel } from "@/lib/perms";
import { Alert, Avatar, Empty } from "@/components/ui";
import { getT } from "@/lib/lang";

export const metadata = { title: "Foydalanuvchilar — UDEA" };

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  avatar_emoji: string;
  avatar_url: string | null;
  faculty: string | null;
  is_admin: number;
  created_at: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  org_id: string;
  role_key: string;
  status: string;
  org_name: string;
  org_emoji: string;
};

type OrgRow = {
  id: string;
  name: string;
  emoji: string;
  kind: string;
  is_active: number;
  members: number;
  coordinators: string | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireUser("/admin/users");
  const { t } = await getT();

  if (!isAdmin(me)) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-[20px] text-text-primary">{t("Foydalanuvchilar")}</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">
          {t("Bu bo'lim faqat saytning bosh admini uchun ochiq.")}
        </p>
        <Link href="/admin" className="btn-ghost btn-sm mt-3">
          {t("Boshqaruvga qaytish")}
        </Link>
      </div>
    );
  }

  const users = all<UserRow>(
    "SELECT id, full_name, email, avatar_emoji, avatar_url, faculty, is_admin, created_at FROM users ORDER BY is_admin DESC, created_at"
  );
  const memberships = all<MembershipRow>(
    `SELECT m.id, m.user_id, m.org_id, m.role_key, m.status, o.name AS org_name, o.emoji AS org_emoji
     FROM memberships m JOIN orgs o ON o.id = m.org_id
     WHERE m.status = 'active'
     ORDER BY CASE m.role_key WHEN 'president' THEN 0 WHEN 'vice_president' THEN 1 WHEN 'project_lead' THEN 2 WHEN 'coordinator' THEN 3 ELSE 4 END`
  );
  const orgs = all<OrgRow>(
    `SELECT o.id, o.name, o.emoji, o.kind, o.is_active,
            (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'active') AS members,
            (SELECT group_concat(u.full_name, ', ') FROM memberships m2 JOIN users u ON u.id = m2.user_id
             WHERE m2.org_id = o.id AND m2.status = 'active' AND m2.role_key IN ('coordinator','president','vice_president')) AS coordinators
     FROM orgs o ORDER BY o.kind, o.name`
  );
  const eventCount = one<{ c: number }>("SELECT COUNT(*) AS c FROM events")?.c ?? 0;
  const admins = users.filter((u) => u.is_admin).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{t("Bosh admin paneli")}</p>
        <h1 className="mt-1 font-serif text-[24px] leading-tight text-text-primary">{t("Foydalanuvchilar va klublar")}</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-text-tertiary">
          {t(
            "Bu yerda hammasi sizning nazoratingizda: foydalanuvchilarni bosh admin qilish, klub yaratish va koordinator tayinlash."
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
          <span>{users.length} {t("foydalanuvchi")}</span>
          <span>{orgs.length} {t("tashkilot")}</span>
          <span>{eventCount} {t("tadbir")}</span>
          <span>{admins} {t("admin")}</span>
        </div>
      </header>

      {sp.err && <Alert>{t(sp.err)}</Alert>}
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-[18px] text-text-primary">{t("Yangi klub yoki jamoa")}</h2>
          <span className="text-[11.5px] text-text-tertiary">{t("Koordinator darhol tayinlanadi")}</span>
        </div>
        <form action={createOrgAction} className="mt-3 grid gap-2.5 sm:grid-cols-[80px_1fr_130px_1fr_auto]">
          <input name="emoji" placeholder="🎯" maxLength={4} className="input text-center" aria-label="emoji" />
          <input name="name" required placeholder={t("Klub nomi")} className="input" />
          <select name="kind" className="input" defaultValue="club">
            <option value="club">{t("Klub")}</option>
            <option value="team">{t("Jamoa")}</option>
          </select>
          <select name="coordinator_id" className="input" defaultValue="">
            <option value="">{t("Koordinator (keyinroq)")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} · {u.email}
              </option>
            ))}
          </select>
          <button className="btn-primary btn-sm">{t("Qo'shish")}</button>
        </form>
      </section>

      <section className="space-y-2.5">
        <h2 className="font-serif text-[18px] text-text-primary">{t("Klublar va jamoalar")}</h2>
        {orgs.length === 0 && <Empty title={t("Hali klub yo'q")} hint={t("Yuqoridagi shakl orqali birinchi klubni qo'shing.")} />}
        <div className="grid gap-2">
          {orgs.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <span className="text-[20px]">{o.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-text-primary">
                  {o.name}{" "}
                  <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">{o.kind}</span>
                </p>
                <p className="truncate text-[11.5px] text-text-tertiary">
                  {o.members} {t("a'zo")} · {o.coordinators ? o.coordinators : t("koordinator yo'q")}
                </p>
              </div>
              <span className={`badge ${o.is_active ? "bg-emerald-100 text-emerald-700" : "bg-elevated text-text-tertiary"}`}>
                {o.is_active ? t("Faol") : t("Yopiq")}
              </span>
              <form action={toggleOrgAction}>
                <input type="hidden" name="org_id" value={o.id} />
                <input type="hidden" name="active" value={o.is_active ? "0" : "1"} />
                <button className="btn-ghost btn-sm">{o.is_active ? t("Yopish") : t("Faollashtirish")}</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="font-serif text-[18px] text-text-primary">{t("Foydalanuvchilar")}</h2>
        <div className="grid gap-2">
          {users.map((u) => {
            const mine = memberships.filter((m) => m.user_id === u.id);
            return (
              <div key={u.id} className="card p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar emoji={u.avatar_emoji} name={u.full_name} src={u.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-text-primary">
                      {u.full_name}
                      {u.is_admin ? <span className="badge ml-2 bg-indigo-100 text-academic">{t("Bosh admin")}</span> : null}
                    </p>
                    <p className="truncate font-mono text-[11px] text-text-tertiary">{u.email}</p>
                  </div>
                  <form action={setSiteAdminAction}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="make" value={u.is_admin ? "0" : "1"} />
                    <button className="btn-ghost btn-sm">
                      {u.is_admin ? t("Adminlikni olish") : t("Bosh admin qilish")}
                    </button>
                  </form>
                </div>

                {mine.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {mine.map((m) => (
                      <li key={m.id} className="flex items-center gap-1 rounded-full bg-elevated py-0.5 pl-2 pr-1 text-[11px] text-text-primary">
                        <span>{m.org_emoji} {m.org_name}</span>
                        <span className="font-semibold text-text-tertiary">· {roleLabel(m.role_key)}</span>
                        <form action={removeMembershipAction}>
                          <input type="hidden" name="membership_id" value={m.id} />
                          <button className="px-1 text-text-tertiary hover:text-rose-600" aria-label="remove">
                            ×
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                {orgs.length > 0 && (
                  <form action={assignRoleAction} className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-hairline pt-2.5">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select name="org_id" className="input max-w-[220px] py-1.5 text-[12px]" defaultValue={mine[0]?.org_id ?? orgs[0].id}>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.emoji} {o.name}
                        </option>
                      ))}
                    </select>
                    <select name="role" className="input max-w-[170px] py-1.5 text-[12px]" defaultValue="coordinator">
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <button className="btn-ghost btn-sm">{t("Rolni belgilash")}</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
