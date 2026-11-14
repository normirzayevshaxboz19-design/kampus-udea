import { redirect } from "next/navigation";
import { setupAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { one } from "@/lib/db";
import { getT } from "@/lib/lang";

export const metadata = { title: "Sozlash — UDEA" };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; token?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getT();
  const users = one<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0;
  if (users > 0) redirect("/login");

  // Serverda SETUP_TOKEN o'rnatilgan bo'lsa, bosh adminni faqat kalit egasi yaratadi.
  const expected = process.env.SETUP_TOKEN ?? "";
  const token = sp.token ?? "";
  if (expected && token !== expected) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Kampus · UDEA</p>
        <h1 className="mt-1.5 font-serif text-[30px] leading-tight text-text-primary">{t("Birinchi sozlash")}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-tertiary">
          {t("Bu serverda sozlash kaliti o'rnatilgan. Davom etish uchun kalitni kiriting.")}
        </p>
        <form method="get" className="card mt-5 space-y-4 p-6">
          <div>
            <label className="label" htmlFor="token">
              {t("Sozlash kaliti")}
            </label>
            <input id="token" name="token" type="password" required className="input" autoComplete="off" />
          </div>
          <button className="btn-primary w-full">{t("Davom etish")}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Kampus · UDEA</p>
      <h1 className="mt-1.5 font-serif text-[30px] leading-tight text-text-primary">
        {t("Birinchi sozlash")}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-text-tertiary">
        {t(
          "Hozircha bazada hech kim yo'q. Birinchi hisob saytning bosh admini bo'ladi — u barcha klublar, tadbirlar va foydalanuvchilarni boshqaradi."
        )}
      </p>

      <form action={setupAction} className="card mt-5 space-y-4 p-6">
        {sp.err && <Alert>{t(sp.err)}</Alert>}
        {expected ? <input type="hidden" name="token" value={token} /> : null}
        <div>
          <label className="label" htmlFor="full_name">
            {t("Ism va familiya")}
          </label>
          <input id="full_name" name="full_name" required placeholder="Dilshod Karimov" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            {t("Email")}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="admin@udea.uz" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t("Parol")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
          <p className="mt-1 text-[11.5px] text-text-tertiary">{t("Kamida 8 belgi. Parolni xavfsiz joyda saqlang.")}</p>
        </div>
        <button className="btn-primary w-full">{t("Bosh admin sifatida kirish")}</button>
      </form>

      <p className="mt-4 text-[11.5px] leading-relaxed text-text-tertiary">
        {t(
          "Bu sahifa faqat baza bo'sh bo'lganda ochiladi. Hisob yaratilgach, keyingi kirishlar /login orqali bo'ladi."
        )}
      </p>
    </div>
  );
}
