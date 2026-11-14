import Link from "next/link";
import { getActiveOrg, isAdmin, requireUser } from "@/lib/auth";
import { canActor } from "@/lib/perms";
import { Scanner } from "@/components/Scanner";
import { getT } from "@/lib/lang";
import { fmtDateLong, now } from "@/lib/format";

export const metadata = { title: "Skaner — UDEA" };

export default async function ScanPage() {
  const user = await requireUser("/admin/scan");
  const active = await getActiveOrg(user.id);
  const { lang, t } = await getT();

  if (!active || !canActor(active.role_key, "reg.view", user.is_admin)) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-[20px] text-text-primary">{t("Skaner")}</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">{t("Bu bo'lim tadbirlarni boshqaradigan koordinatorlar uchun.")}</p>
        <Link href="/admin" className="btn-ghost btn-sm mt-3">
          {t("Boshqaruvga qaytish")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{t("Kirish nazorati")}</p>
        <h1 className="mt-1 font-serif text-[24px] leading-tight text-text-primary">{t("Chiptani skanerlash")}</h1>
        <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-text-tertiary">
          {t(
            "Tadbir eshigida talabaning QR chiptasini skanerlang — tizim chiptani «kirdi» deb belgilaydi va takroriy o'tishni to'xtatadi."
          )}{" "}
          <span className="font-semibold text-text-primary">{active.org_name}</span>
        </p>
      </header>

      <Scanner lang={lang} today={fmtDateLong(now(), lang)} />
    </div>
  );
}
