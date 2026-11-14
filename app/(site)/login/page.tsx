import Link from "next/link";
import { loginAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/lang";
import { one } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; next?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getT();
  const users = one<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0;
  if (users === 0) redirect("/setup");

  return (
    <div className="mx-auto max-w-md py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Kampus · UDEA</p>
      <h1 className="mt-1.5 font-serif text-[28px] leading-none text-text-primary">{t("Tizimga kirish")}</h1>
      <p className="mt-2 text-[12.5px] text-text-tertiary">
        {t("Bitta hisob — talaba va tashkilotchi bo'limlari uchun.")}
      </p>

      <form action={loginAction} className="card mt-5 space-y-4 p-6">
        {sp.err && <Alert>{t(sp.err)}</Alert>}
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <div>
          <label className="label" htmlFor="email">
            {t("Email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={sp.email ?? ""}
            placeholder="ism@udea.uz"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t("Parol")}
          </label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <button className="btn-primary w-full">{t("Kirish")}</button>
      </form>

      <p className="mt-4 text-center text-[13px] text-text-tertiary">
        {t("Hisobingiz yo'qmi?")}{" "}
        <Link href="/register" className="font-semibold text-academic hover:opacity-75">
          {t("Ro'yxatdan o'tish")}
        </Link>
      </p>

    </div>
  );
}
