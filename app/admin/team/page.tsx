import { getActiveOrg, requireUser } from "@/lib/auth";
import { orgMembers, pendingRequests } from "@/lib/data";
import { can, ROLES, ROLE_ORDER, roleAccent, roleLabel } from "@/lib/perms";
import { decideJoinAction, setRoleAction } from "@/app/actions";
import { Alert, Avatar, Empty } from "@/components/ui";
import { getT } from "@/lib/lang";

const PERMISSION_LABELS: Record<string, string> = {
  "project.create": "loyiha yaratish",
  "project.edit": "loyihani tahrirlash",
  "task.assign": "vazifa biriktirish",
  "task.own": "o'z vazifasi",
  "event.manage": "tadbir boshqarish",
  "reg.view": "ishtirokchilarni ko'rish",
  "reg.export": "ro'yxatni yuklab olish",
  "plan.edit": "umumiy rejani tahrirlash",
  "team.manage": "a'zolarni boshqarish",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/admin/team");
  const { lang, t, tpl } = await getT();
  const active = await getActiveOrg(user.id);
  if (!active) return null;

  const members = orgMembers(active.org_id);
  const requests = pendingRequests(active.org_id);
  const manage = can(active.role_key, "team.manage");

  return (
    <div className="space-y-6">
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div>
        <h1 className="text-2xl font-black tracking-tight text-text-primary">{t("Jamoa")}</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">
          {tpl("{n} a'zo · har bir rol uchun vakolatlar quyida ko'rsatilgan.", { n: members.length })}
        </p>
      </div>

      {manage && (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-text-primary">{t("Klubga qo'shilish arizalari")}</h2>
            <span className="badge bg-amber-50 text-amber-700">{tpl("{n} yangi", { n: requests.length })}</span>
          </div>
          {requests.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-text-tertiary">{t("Yangi ariza yo'q.")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-hairline">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar emoji={r.avatar_emoji} name={r.full_name} src={r.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-text-primary">{r.full_name}</div>
                    <div className="text-[11.5px] text-text-tertiary">{r.faculty ?? "—"}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <form action={decideJoinAction}>
                      <input type="hidden" name="membership_id" value={r.id} />
                      <input type="hidden" name="org_id" value={active.org_id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="btn-primary btn-sm">{t("Tasdiqlash")}</button>
                    </form>
                    <form action={decideJoinAction}>
                      <input type="hidden" name="membership_id" value={r.id} />
                      <input type="hidden" name="org_id" value={active.org_id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button className="btn-ghost btn-sm">{t("Rad etish")}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[14px] font-bold text-text-primary">{t("A'zolar")}</h2>
        <div className="card overflow-hidden">
          <ul className="divide-y divide-hairline">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar emoji={m.avatar_emoji} name={m.full_name} src={m.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-text-primary">{m.full_name}</div>
                  <div className="text-[11.5px] text-text-tertiary">{m.faculty ?? "—"}</div>
                </div>
                {manage ? (
                  <form action={setRoleAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="membership_id" value={m.id} />
                    <input type="hidden" name="org_id" value={active.org_id} />
                    <select
                      name="role_key"
                      defaultValue={m.role_key}
                      className="rounded-2xl border border-strong bg-card px-2 py-1.5 text-[11.5px] font-semibold text-text-primary"
                    >
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r, lang)}
                        </option>
                      ))}
                    </select>
                    <button className="text-[11px] font-bold text-academic">{t("Saqlash")}</button>
                  </form>
                ) : (
                  <span className={`badge ${roleAccent(m.role_key)}`}>{roleLabel(m.role_key, lang)}</span>
                )}
              </li>
            ))}
          </ul>
          {members.length === 0 && <Empty title={t("A'zolar yo'q")} />}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[14px] font-bold text-text-primary">{t("Rollar va vakolatlar")}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="rounded-2xl border border-hairline/80 p-3">
              <span className={`badge ${roleAccent(r)}`}>{roleLabel(r, lang)}</span>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-tertiary">
                {ROLES[r].perms.map((p) => t(PERMISSION_LABELS[p] ?? p)).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
