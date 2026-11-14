import Link from "next/link";
import { getCurrentUser, getMemberships } from "@/lib/auth";
import { HeaderNav, BottomNav } from "@/components/nav";
import { Avatar } from "@/components/ui";
import { Preferences } from "@/components/Controls";
import { logoutAction } from "@/app/actions";
import { getLang, getTheme } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const memberships = user ? await getMemberships(user.id) : [];
  const [lang, theme] = await Promise.all([getLang(), getTheme()]);

  return (
    <div className="min-h-screen" lang="uz">
      <div id="root" className="min-h-screen relative">
          <header
            className="site-header sticky top-0 z-40 bg-canvas/80 backdrop-blur"
          >
            <div className="mx-auto flex h-[62px] max-w-[1380px] items-center gap-2 px-4 md:px-6">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="font-serif text-[22px] font-bold leading-none tracking-[-0.02em] text-text-primary">
                  Kampus
                </span>
                <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                  UDEA
                </span>
              </Link>

              <HeaderNav authed={Boolean(user)} lang={lang} />

              <div className="ml-auto flex items-center gap-3">
                {user ? (
                  <>
                {memberships.length > 0 && (
                  <Link
                    href="/admin"
                    className="hidden text-[12px] font-semibold text-text-secondary underline decoration-slate-300 underline-offset-4 hover:text-text-primary sm:inline"
                  >
                    {tr(lang, "Boshqaruv")}
                  </Link>
                )}
                <Link href="/profile" className="flex items-center gap-2 hover:opacity-80">
                  <Avatar
                    emoji={user.avatar_emoji}
                    name={user.full_name}
                    src={user.avatar_url}
                    size={28}
                  />
                  <span className="hidden text-[12px] font-semibold text-text-primary sm:block">
                    {user.full_name.split(" ")[0]}
                  </span>
                </Link>
                <form action={logoutAction} className="hidden md:block">
                  <button className="text-[11.5px] font-semibold text-text-secondary hover:text-rose-600">
                    {tr(lang, "Chiqish")}
                  </button>
                </form>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-[12px] font-semibold text-text-secondary hover:text-text-primary"
                    >
                      {tr(lang, "Kirish")}
                    </Link>
                    <Link
                      href="/register"
                      className="btn-primary btn-sm"
                    >
                      {tr(lang, "Ro'yxatdan o'tish")}
                    </Link>
                  </>
                )}
                <span aria-hidden="true" className="h-4 w-px bg-elevated" />
                <Preferences lang={lang} theme={theme} />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1380px] px-4 pb-24 pt-6 md:px-6 md:pb-8 md:pt-8">
            {children}
          </main>
          <BottomNav isAuthed={Boolean(user)} hasAdmin={memberships.length > 0} lang={lang} />
      </div>
    </div>
  );
}