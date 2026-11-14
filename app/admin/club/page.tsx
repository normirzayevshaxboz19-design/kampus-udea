import Link from "next/link";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { canActor } from "@/lib/perms";
import { saveClubAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/lang";

export const metadata = { title: "Klub sozlamalari — UDEA" };

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  emoji: string;
  telegram: string | null;
  instagram: string | null;
  kind: string;
  is_active: number;
};

export default async function ClubSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/admin/club");
  const active = await getActiveOrg(user.id);
  const { t } = await getT();

  if (!active || !canActor(active.role_key, "team.manage", user.is_admin)) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-[20px] text-text-primary">{t("Klub sozlamalari")}</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">
          {t("Klubni faqat koordinator yoki prezident tahrirlay oladi.")}
        </p>
        <Link href="/admin" className="btn-ghost btn-sm mt-3">
          {t("Boshqaruvga qaytish")}
        </Link>
      </div>
    );
  }

  const org = one<OrgRow>(
    "SELECT id, name, slug, tagline, description, emoji, telegram, instagram, kind, is_active FROM orgs WHERE id = ?",
    active.org_id
  );
  if (!org) return <Alert>{t("Tashkilot topilmadi")}</Alert>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{t("Klub profili")}</p>
          <h1 className="mt-1 font-serif text-[24px] leading-tight text-text-primary">{org.emoji} {org.name}</h1>
          <p className="mt-1 text-[12.5px] text-text-tertiary">
            {t("Bu ma'lumotlar saytdagi klub sahifasida ko'rinadi.")}{" "}
            <Link href={`/clubs/${org.slug}`} className="font-semibold text-academic hover:opacity-75">
              {t("Sahifani ko'rish ↗")}
            </Link>
          </p>
        </div>
        <Link href="/admin/events" className="btn-primary btn-sm">
          {t("Tadbir qo'shish")}
        </Link>
      </header>

      {sp.err && <Alert>{t(sp.err)}</Alert>}
      {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}

      <form action={saveClubAction} className="card space-y-4 p-5">
        <input type="hidden" name="org_id" value={org.id} />
        <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
          <div>
            <label className="label" htmlFor="emoji">{t("Belgi")}</label>
            <input id="emoji" name="emoji" defaultValue={org.emoji} maxLength={4} className="input text-center" />
          </div>
          <div>
            <label className="label" htmlFor="name">{t("Nomi")}</label>
            <input id="name" name="name" defaultValue={org.name} required className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tagline">{t("Qisqa shior")}</label>
          <input id="tagline" name="tagline" defaultValue={org.tagline ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="description">{t("Tavsif")}</label>
          <textarea id="description" name="description" defaultValue={org.description ?? ""} rows={5} className="input" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="telegram">Telegram</label>
            <input id="telegram" name="telegram" defaultValue={org.telegram ?? ""} placeholder="https://t.me/…" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="instagram">Instagram</label>
            <input id="instagram" name="instagram" defaultValue={org.instagram ?? ""} placeholder="https://instagram.com/…" className="input" />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-hairline pt-3">
          <button className="btn-primary btn-sm">{t("Saqlash")}</button>
          <span className="text-[11.5px] text-text-tertiary">
            {org.is_active ? t("Klub saytda faol") : t("Klub saytda yopiq — bosh admin faollashtiradi")}
          </span>
        </div>
      </form>
    </div>
  );
}
