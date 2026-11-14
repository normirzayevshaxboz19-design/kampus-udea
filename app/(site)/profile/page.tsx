import Link from "next/link";
import { getMemberships, requireUser } from "@/lib/auth";
import { myPendingClubs, myRegistrations } from "@/lib/data";
import { fmtDateTime, isPast } from "@/lib/format";
import { orgGradient } from "@/lib/labels";
import { roleAccent, roleLabel } from "@/lib/perms";
import { logoutAction, updateProfileAction } from "@/app/actions";
import { Alert, Avatar, Empty, SectionHead } from "@/components/ui";
import { AvatarUploader } from "@/components/AvatarUploader";
import { getT } from "@/lib/lang";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/profile");
  const { lang, t } = await getT();
  const memberships = await getMemberships(user.id);
  const events = myRegistrations(user.id);
  const pending = myPendingClubs(user.id);
  const interests = (user.interests ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-5">
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
      {sp.err && <Alert>{t(sp.err)}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <Avatar emoji={user.avatar_emoji} name={user.full_name} src={user.avatar_url} size={56} />
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-black tracking-tight text-text-primary">{user.full_name}</h1>
                <p className="truncate text-[12px] text-text-tertiary">{user.email}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-hairline bg-subtle/70 p-3">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary">{t("Profil rasmi")}</p>
              <AvatarUploader current={user.avatar_url} emoji={user.avatar_emoji} name={user.full_name} lang={lang} />
            </div>
            <dl className="mt-4 space-y-2 text-[12.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-text-tertiary">{t("Fakultet")}</dt>
                <dd className="font-semibold text-text-primary">{user.faculty ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-tertiary">{t("Talaba ID")}</dt>
                <dd className="font-semibold text-text-primary">{user.student_no ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-tertiary">{t("Tashkilotlar")}</dt>
                <dd className="font-semibold text-text-primary">{memberships.length}</dd>
              </div>
            </dl>
            {user.bio && <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">{user.bio}</p>}
            {interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {interests.map((i) => (
                  <span key={i} className="badge bg-elevated text-text-secondary">
                    {i}
                  </span>
                ))}
              </div>
            )}
            <form action={logoutAction} className="mt-4 md:hidden">
              <button className="btn-ghost btn-sm w-full">{t("Chiqish")}</button>
            </form>
          </div>

          {memberships.length > 0 && (
            <div className="card p-5">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-text-tertiary">{t("Rollarim")}</h2>
              <ul className="mt-2.5 space-y-2">
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${orgGradient(m.org_color)}`} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text-primary">{m.org_name}</span>
                    <span className={`badge ${roleAccent(m.role_key)}`}>{roleLabel(m.role_key, lang)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin" className="btn-soft btn-sm mt-3 w-full">
                {t("Boshqaruv paneli")}
              </Link>
            </div>
          )}

          <details className="card p-5">
            <summary className="cursor-pointer text-[13px] font-bold text-text-primary">{t("Profilni tahrirlash")}</summary>
            <form action={updateProfileAction} className="mt-4 space-y-3">
              <div>
                <label className="label">{t("Ism va familiya")}</label>
                <input name="full_name" defaultValue={user.full_name} required className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="label">{t("Fakultet")}</label>
                  <input name="faculty" defaultValue={user.faculty ?? ""} className="input" />
                </div>
                <div>
                  <label className="label">{t("Talaba ID")}</label>
                  <input name="student_no" defaultValue={user.student_no ?? ""} className="input" />
                </div>
              </div>
              <div>
                <label className="label">{t("Qiziqishlar (vergul bilan)")}</label>
                <input
                  name="interests"
                  defaultValue={user.interests ?? ""}
                  placeholder="Zakovat, moliya, dizayn"
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t("O'zingiz haqingizda")}</label>
                <textarea name="bio" defaultValue={user.bio ?? ""} rows={3} className="input" />
              </div>
              <button className="btn-primary w-full">{t("Saqlash")}</button>
            </form>
          </details>
        </aside>

        <div className="space-y-6">
          <section>
            <SectionHead
              title={t("Mening tadbirlarim")}
              hint={t("Ro'yxatdan o'tgan va qatnashgan tadbirlar")}
              href="/events"
              linkLabel={t("Barchasi")}
            />
            {events.length === 0 ? (
              <Empty
                title={t("Hali tadbirga yozilmagansiz")}
                hint={t("Tadbirlar bo'limidan qiziqarlisini tanlab, bir tugma bilan ro'yxatdan o'ting.")}
              />
            ) : (
              <ul className="card divide-y divide-hairline overflow-hidden">
                {events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.slug}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-subtle/70">
                      <span className={`mt-0.5 size-2 shrink-0 rounded-full ${orgGradient(e.org_color)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-text-primary">{e.title}</div>
                        <div className="text-[11.5px] text-text-tertiary">
                          {fmtDateTime(e.starts_at, lang)} · {e.org_name}
                        </div>
                      </div>
                      <span
                        className={`badge shrink-0 ${
                          isPast(e.starts_at)
                            ? "bg-elevated text-text-tertiary"
                            : e.reg_status === "waitlist"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isPast(e.starts_at)
                          ? t("O'tgan")
                          : e.reg_status === "waitlist"
                            ? t("Navbatda")
                            : e.ticket_code}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHead
              title={t("Klublarim")}
              hint={t("A'zo bo'lgan klublar")}
              href="/clubs"
              linkLabel={t("Barchasi")}
            />
            {memberships.filter((m) => m.org_kind === "club").length === 0 ? (
              <Empty
                title={t("Hali klubga qo'shilmagansiz")}
                hint={t("Klublar sahifasidan qiziqqan yo'nalishingizni tanlang.")}
              />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {memberships
                  .filter((m) => m.org_kind === "club")
                  .map((m) => (
                    <Link
                      key={m.id}
                      href={`/clubs/${m.org_slug}`}
                      className="card flex items-center gap-3 px-3.5 py-3 transition hover:border-hairline"
                    >
                      <span className={`size-2 shrink-0 rounded-full ${orgGradient(m.org_color)}`} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text-primary">{m.org_name}</span>
                      <span className={`badge ${roleAccent(m.role_key)}`}>{roleLabel(m.role_key, lang)}</span>
                    </Link>
                  ))}
              </div>
            )}
          </section>

          {pending.length > 0 && (
            <section>
              <SectionHead title={t("Ko'rib chiqilayotgan arizalar")} />
              <ul className="card divide-y divide-hairline overflow-hidden">
                {pending.map((p) => (
                  <li key={p.org_id} className="flex items-center gap-3 px-4 py-3">
                    <span className="size-2 shrink-0 rounded-full bg-elevated" />
                    <span className="flex-1 text-[13px] font-semibold text-text-primary">{p.name}</span>
                    <span className="badge bg-amber-50 text-amber-700">{t("Kutilmoqda")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
