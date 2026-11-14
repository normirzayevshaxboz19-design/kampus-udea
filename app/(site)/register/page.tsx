import Link from "next/link";
import { registerAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/lang";
import { one } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getT();
  const users = one<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0;
  if (users === 0) redirect("/setup");

  return (
    <div className="mx-auto max-w-md py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Kampus · UDEA</p>
      <h1 className="mt-1.5 font-serif text-[28px] leading-none text-text-primary">{t("Hisob yaratish")}</h1>
      <p className="mt-2 text-[12.5px] text-text-tertiary">{t("30 soniyada — email va parol yetarli.")}</p>

      <form action={registerAction} className="card mt-5 space-y-4 p-6">
        {sp.err && <Alert>{t(sp.err)}</Alert>}
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <div>
          <label className="label" htmlFor="full_name">
            {t("Ism va familiya")}
          </label>
          <input id="full_name" name="full_name" required placeholder="Malika Rasulova" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            {t("Email")}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="ism@udea.uz" className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="faculty">
              {t("Fakultet")}
            </label>
            <input id="faculty" name="faculty" placeholder="Iqtisodiyot" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="student_no">
              {t("Talaba ID")}
            </label>
            <input id="student_no" name="student_no" placeholder="B-24-01" className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t("Parol")}
          </label>
          <input id="password" name="password" type="password" required minLength={6} className="input" />
          <p className="mt-1 text-[11.5px] text-text-tertiary">{t("Kamida 6 belgi.")}</p>
        </div>
        <button className="btn-primary w-full">{t("Ro'yxatdan o'tish")}</button>
      </form>

      <p className="mt-4 text-center text-[13px] text-text-tertiary">
        {t("Hisobingiz bormi?")}{" "}
        <Link href="/login" className="font-semibold text-academic hover:opacity-75">
          {t("Kirish")}
        </Link>
      </p>
    </div>
  );
}
