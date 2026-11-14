"use client";

import { useRef, useState } from "react";
import { updateAvatarAction } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { tr, type Lang } from "@/lib/i18n";

const MAX_FILE = 8 * 1024 * 1024;
const SIZE = 320;

function toSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Rasmni ochib bo'lmadi"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Brauzer rasmni qayta ishlay olmadi"));
        const scale = Math.max(SIZE / img.width, SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUploader({
  current,
  emoji,
  name,
  lang = "uz",
}: {
  current: string | null;
  emoji: string;
  name?: string;
  lang?: Lang;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = (text: string) => tr(lang, text);

  async function onPick(file: File | undefined) {
    setError(null);
    setPreview(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("Faqat rasm fayli (JPG, PNG, WEBP) yuklash mumkin"));
      return;
    }
    if (file.size > MAX_FILE) {
      setError(t("Rasm hajmi 8 MB dan oshmasin"));
      return;
    }
    try {
      setPreview(await toSquareDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t("Rasm yuklanmadi"));
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar src={preview ?? current} emoji={emoji} name={name} size={64} />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <button type="button" className="btn-soft btn-sm" onClick={() => inputRef.current?.click()}>
            {t(current ? "Rasmni almashtirish" : "Rasm yuklash")}
          </button>
          {current && !preview && (
            <form action={updateAvatarAction}>
              <input type="hidden" name="remove" value="1" />
              <button className="text-[11.5px] font-semibold text-text-tertiary transition hover:text-rose-600">
                {t("Rasmni o'chirish")}
              </button>
            </form>
          )}
          <span className="text-[10.5px] leading-tight text-text-tertiary">
            {t("JPG/PNG · kvadratga kesiladi")}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-2 rounded-2xl bg-rose-50 px-2.5 py-1.5 text-[11.5px] font-medium text-rose-700">{error}</p>}

      {preview && (
        <form action={updateAvatarAction} className="mt-2.5 flex gap-2">
          <input type="hidden" name="avatar_data" value={preview} />
          <button className="btn-primary btn-sm flex-1">{t("Saqlash")}</button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setPreview(null);
              setError(null);
            }}
          >
            {t("Bekor qilish")}
          </button>
        </form>
      )}
    </div>
  );
}
