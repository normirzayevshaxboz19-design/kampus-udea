import { requireUser } from "@/lib/auth";
import { allPublicEvents, pulsePasses } from "@/lib/data";
import { getT } from "@/lib/lang";
import { isPast, now } from "@/lib/format";
import { Pulse, type PulseEvent, type PulsePassView } from "@/components/Pulse";
import { TelegramMiniApp } from "@/components/TelegramMiniApp";

export const metadata = { title: "Pulse — Kampus" };

export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/pulse");
  const { lang } = await getT();
  const sp = await searchParams;

  const okText = typeof sp.ok === "string" ? sp.ok : null;
  const errText = typeof sp.err === "string" ? sp.err : null;
  const notice = errText
    ? ({ kind: "err", text: errText } as const)
    : okText
      ? ({ kind: "ok", text: okText } as const)
      : null;

  const events: PulseEvent[] = allPublicEvents()
    .filter((e) => e.status === "published" && !isPast(e.ends_at ?? e.starts_at))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description,
      emoji: e.emoji,
      location: e.location,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      capacity: e.capacity,
      confirmed: e.confirmed,
      waitlist: e.waitlist,
      org_name: e.org_name,
      org_color: e.org_color,
    }));

  const passes: PulsePassView[] = pulsePasses(user.id).map((p) => ({
    event_id: p.event_id,
    slug: p.slug,
    title: p.title,
    emoji: p.emoji,
    location: p.location,
    starts_at: p.starts_at,
    status: p.status,
    ticket_code: p.ticket_code,
    checked_in_at: p.checked_in_at,
    promoted_at: p.promoted_at,
    wait_position: p.wait_position,
    org_name: p.org_name,
  }));

  return (
    <div>
      <TelegramMiniApp lang={lang} userName={user.full_name} />
      <Pulse
        lang={lang}
        name={user.full_name.split(" ")[0]}
        today={now().slice(0, 10)}
        events={events}
        passes={passes}
        notice={notice}
      />
    </div>
  );
}
