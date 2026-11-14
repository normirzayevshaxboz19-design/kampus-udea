import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { eventsOfOrg, getClub, membershipOf, messagesFor, orgMembers } from "@/lib/data";
import { canActor } from "@/lib/perms";
import { Chat } from "@/components/Chat";
import { dayNum, fmtDateTime, isPast, monthShort } from "@/lib/format";
import { orgGradient } from "@/lib/labels";
import { roleAccent, roleLabel } from "@/lib/perms";
import { joinClubAction } from "@/app/actions";
import { Alert, Avatar } from "@/components/ui";
import { getT } from "@/lib/lang";
import { safeExternalUrl } from "@/lib/security";

export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; err?: string; chat_err?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const club = getClub(slug);
  if (!club) notFound();

  const user = await requireUser(`/clubs/${slug}`);
  const { lang, t, tpl } = await getT();
  const membership = membershipOf(user.id, club.id);
  const messages = messagesFor("org", club.id);
  const members = orgMembers(club.id);
  const upcoming = eventsOfOrg(club.id).filter((e) => !isPast(e.starts_at));
  const past = eventsOfOrg(club.id)
    .filter((e) => isPast(e.starts_at))
    .reverse()
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <Link href="/clubs" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-tertiary hover:text-text-primary">
        ← {t("Klublar")}
      </Link>

      <div className="overflow-hidden rounded-2xl border border-hairline/80 bg-card">
        <div className={`flex h-16 items-end justify-between px-5 md:px-8 ${orgGradient(club.color)}`}>
          <span className="pb-3 font-serif text-[22px] uppercase tracking-[0.14em] text-white/85">
            {club.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
          <span className="pb-3.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
            {tpl("{n} a'zo", { n: club.members })} · {tpl("{n} tadbir", { n: club.upcoming })}
          </span>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-6 pt-5 md:flex-row md:items-start md:justify-between md:px-8">
          <div>
            <h1 className="font-serif text-[27px] leading-tight text-text-primary md:text-[32px]">{club.name}</h1>
            <p className="mt-1 text-[13px] font-medium text-academic">{club.tagline}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2">
            {sp.ok && <Alert kind="success">{t(sp.ok)}</Alert>}
            {sp.err && <Alert>{t(sp.err)}</Alert>}
            {membership?.status === "active" ? (
              <span className="badge justify-center bg-emerald-100 px-4 py-2.5 text-[12px] text-emerald-700">
                {t("Siz klub a'zosisiz")}
              </span>
            ) : membership?.status === "pending" ? (
              <span className="badge justify-center bg-amber-100 px-4 py-2.5 text-[12px] text-amber-700">
                {t("Ariza ko'rib chiqilmoqda")}
              </span>
            ) : (
              <form action={joinClubAction}>
                <input type="hidden" name="slug" value={club.slug} />
                <input type="hidden" name="org_id" value={club.id} />
                <button className="btn-primary w-full">{t("Klubga qo'shilish")}</button>
              </form>
            )}
            {safeExternalUrl(club.telegram) && (
              <a href={safeExternalUrl(club.telegram)!} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                {t("Telegram kanal")} ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="card p-5 md:p-6">
            <h2 className="text-[15px] font-bold text-text-primary">{t("Klub haqida")}</h2>
            <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-text-secondary">{club.description}</p>
          </section>

          <section className="card p-5 md:p-6">
            <h2 className="text-[15px] font-bold text-text-primary">{t("Rejalashtirilgan tadbirlar")}</h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-[13px] text-text-tertiary">{t("Hozircha rejalashtirilgan tadbir yo'q.")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-hairline">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.slug}`} className="flex items-center gap-3 py-3 transition hover:bg-subtle/70">
                      <span className="w-11 shrink-0 border-r border-hairline pr-3 text-center">
                        <span className="block font-serif text-[19px] leading-none text-text-primary">
                          {dayNum(e.starts_at)}
                        </span>
                        <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                          {monthShort(e.starts_at, lang)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-text-primary">{e.title}</div>
                        <div className="text-[11.5px] text-text-tertiary">
                          {fmtDateTime(e.starts_at, lang)} · {e.location}
                        </div>
                      </div>
                      <span className="badge bg-subtle text-academic">
                        {tpl("{n} yozilgan", { n: e.confirmed })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {past.length > 0 && (
              <>
                <h3 className="mt-5 text-[12px] font-bold uppercase tracking-wide text-text-tertiary">
                  {t("O'tgan tadbirlar")}
                </h3>
                <ul className="mt-1 text-[12.5px] text-text-tertiary">
                  {past.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-1.5">
                      <span>{e.title}</span>
                      <span>{fmtDateTime(e.starts_at, lang)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <Chat
            scopeType="org"
            scopeId={club.id}
            path={`/clubs/${club.slug}`}
            title="Klub chati"
            messages={messages}
            meId={user.id}
            canModerate={canActor(membership?.role_key, "team.manage", isAdmin(user))}
            error={sp.chat_err}
          />
        </div>

        <aside className="space-y-3">
          <div className="card p-5">
            <h2 className="text-[12px] font-bold uppercase tracking-wide text-text-tertiary">{t("A'zolar")}</h2>
            <ul className="mt-3 space-y-2.5">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5">
                  <Avatar emoji={m.avatar_emoji} name={m.full_name} src={m.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-text-primary">{m.full_name}</div>
                    <div className="text-[11px] text-text-tertiary">{m.faculty ?? "—"}</div>
                  </div>
                  <span className={`badge ${roleAccent(m.role_key)}`}>{roleLabel(m.role_key, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
