import { deleteMessageAction, postMessageAction } from "@/app/actions";
import { ChatRefresh } from "@/components/ChatRefresh";
import { Alert, Avatar } from "@/components/ui";
import { fmtStamp } from "@/lib/format";
import { roleAccent, roleLabel } from "@/lib/perms";
import { ETIQUETTE_NOTE } from "@/lib/moderation";
import { getLang } from "@/lib/lang";
import { tr, tpl } from "@/lib/i18n";
import type { MessageRow } from "@/lib/data";

export async function Chat({
  scopeType,
  scopeId,
  path,
  title = "Chat",
  messages,
  meId,
  canModerate = false,
  error,
}: {
  scopeType: "event" | "org";
  scopeId: string;
  path: string;
  title?: string;
  messages: MessageRow[];
  meId: string;
  canModerate?: boolean;
  error?: string;
}) {
  const lang = await getLang();
  const t = (text: string) => tr(lang, text);

  return (
    <section id="chat" className="card scroll-mt-20 p-5 md:p-6">
      <ChatRefresh />
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-[18px] leading-tight text-text-primary">{t(title)}</h2>
        <span className="badge bg-elevated text-text-tertiary">{tpl(lang, "{n} xabar", { n: messages.length })}</span>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-tertiary">{t(ETIQUETTE_NOTE)}</p>
      {error && (
        <div className="mt-3">
          <Alert>{t(error)}</Alert>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-hairline bg-subtle/60 px-4 py-6 text-center text-[12.5px] text-text-tertiary">
          {t("Hali xabar yo'q — birinchi bo'lib savol yoki fikringizni yozing.")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {messages.map((m) => {
            const mine = m.user_id === meId;
            return (
              <li key={m.id} className="flex gap-2.5">
                <Avatar src={m.avatar_url} emoji={m.avatar_emoji} name={m.full_name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12.5px] font-bold text-text-primary">{m.full_name}</span>
                    {m.role_key && (
                      <span className={`badge ${roleAccent(m.role_key)}`}>{roleLabel(m.role_key, lang)}</span>
                    )}
                    {mine && <span className="badge bg-elevated text-text-secondary">{t("siz")}</span>}
                    <span className="text-[10.5px] text-text-tertiary">{fmtStamp(m.created_at, lang)}</span>
                    {(mine || canModerate) && (
                      <form action={deleteMessageAction} className="ml-auto">
                        <input type="hidden" name="message_id" value={m.id} />
                        <input type="hidden" name="next" value={path} />
                        <button className="text-[10.5px] font-semibold text-hairline transition hover:text-rose-600">
                          {t("o'chirish")}
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line break-words text-[13px] leading-relaxed text-text-primary">
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form action={postMessageAction} className="mt-4 flex items-end gap-2">
        <input type="hidden" name="scope_type" value={scopeType} />
        <input type="hidden" name="scope_id" value={scopeId} />
        <input type="hidden" name="next" value={path} />
        <textarea
          name="body"
          rows={2}
          required
          maxLength={600}
          placeholder={t("Savol yoki fikringizni yozing…")}
          className="input min-h-[46px] flex-1 resize-y"
        />
        <button className="btn-primary shrink-0">{t("Yuborish")}</button>
      </form>
      <p className="mt-1.5 text-[10.5px] text-text-tertiary">
        {t("Chatga yozish uchun hisobingiz bo'lishi kifoya. Xabaringizni keyin o'zingiz o'chira olasiz.")}
      </p>
    </section>
  );
}
