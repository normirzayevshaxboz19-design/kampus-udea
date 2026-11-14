"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { decodeQrImage } from "@/lib/qr-decode";

const L: Record<string, [string, string, string]> = {
  start: ["Kamerani yoqish", "Включить камеру", "Start camera"],
  stop: ["Kamerani to'xtatish", "Остановить камеру", "Stop camera"],
  hint: [
    "Chiptadagi QR kodni kamera oldiga tuting. Kod avtomatik tekshiriladi.",
    "Поднесите QR-код с пропуска к камере. Код проверится автоматически.",
    "Hold the QR code on the pass in front of the camera. It verifies automatically.",
  ],
  manual: ["Qo'lda kod kiritish", "Ввести код вручную", "Enter code manually"],
  placeholder: ["Masalan ZA-4821", "Например ZA-4821", "e.g. ZA-4821"],
  check: ["Tekshirish", "Проверить", "Check"],
  denied: [
    "Kamera ochilmadi. Brauzer ruxsatini tekshiring yoki kodni qo'lda kiriting.",
    "Камера не открылась. Проверьте разрешение браузера или введите код вручную.",
    "Camera did not open. Check the browser permission or enter the code manually.",
  ],
  unsupported: [
    "Bu brauzer QR kodni o'qiy olmaydi — kodni qo'lda kiriting.",
    "Этот браузер не умеет читать QR — введите код вручную.",
    "This browser cannot read QR codes — enter the code manually.",
  ],
  ok: ["Kirdi ✓", "Прошёл ✓", "Checked in ✓"],
  dup: ["Allaqachon ishlatilgan", "Уже использован", "Already used"],
  bad: ["Chipta topilmadi", "Пропуск не найден", "Pass not found"],
  scanning: ["Kod qidirilmoqda…", "Сканирование…", "Scanning…"],
  attendee: ["Ishtirokchi", "Участник", "Attendee"],
  code: ["Kod", "Код", "Code"],
  event: ["Tadbir", "Событие", "Event"],
  time: ["Vaqt", "Время", "Time"],
  recent: ["Oxirgi tekshiruvlar", "Последние проверки", "Recent checks"],
  clear: ["Tozalash", "Очистить", "Clear"],
};

function x(lang: Lang, key: keyof typeof L): string {
  return L[key][lang === "ru" ? 1 : lang === "en" ? 2 : 0];
}

type Result = {
  ok: boolean;
  error?: string;
  attendee?: string;
  faculty?: string | null;
  event?: string;
  code?: string;
  at?: string;
  status?: "ok" | "dup" | "bad";
};

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };

export function Scanner({ lang, today }: { lang: Lang; today: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Result[]>([]);

  async function verify(code: string) {
    const clean = code.trim().toUpperCase();
    if (!clean || busy) return;
    lastRef.current = { code: clean, at: Date.now() };
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
      setLog((prev) => [data, ...prev].slice(0, 6));
      if (navigator.vibrate) navigator.vibrate(data.ok ? 60 : [40, 60, 40]);
    } catch {
      setResult({ ok: false, error: "Server bilan aloqa yo'q", status: "bad" });
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setMessage("");
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector;
    if (!Detector) {
      setMessage(x(lang, "unsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!streamRef.current) return;
        const video = videoRef.current;
        if (video && video.readyState === 4) {
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue?.trim();
            if (raw) {
              const now = Date.now();
              if (raw !== lastRef.current.code || now - lastRef.current.at > 4000) await verify(raw);
            }
          } catch {
            /* kadr o'qilmadi — davom etamiz */
          }
        }
        if (streamRef.current) setTimeout(loop, 350);
      };
      loop();
    } catch {
      setMessage(x(lang, "denied"));
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRunning(false);
  }

  useEffect(() => () => stop(), []);

  const tone =
    result?.status === "ok"
      ? "border-emerald-300 bg-emerald-50"
      : result?.status === "dup"
        ? "border-amber-300 bg-amber-50"
        : "border-rose-300 bg-rose-50";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card overflow-hidden p-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-ink">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="text-[34px]">📷</span>
              <p className="max-w-[240px] text-[12px] leading-relaxed text-white/70">{x(lang, "hint")}</p>
            </div>
          )}
          {running && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-[62%] rounded-[10px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={running ? stop : start}
            className={running ? "btn-ghost btn-sm flex-1" : "btn-primary btn-sm flex-1"}
          >
            {running ? x(lang, "stop") : x(lang, "start")}
          </button>
          {running && <span className="text-[11.5px] text-text-tertiary">{busy ? x(lang, "scanning") : ""}</span>}
        </div>
        {message && <p className="mt-2 text-[11.5px] leading-relaxed text-amber-700">{message}</p>}

        <form
          className="mt-3 flex items-center gap-2 border-t border-hairline pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const input = new FormData(e.currentTarget).get("code");
            verify(String(input ?? ""));
            e.currentTarget.reset();
          }}
        >
          <input name="code" placeholder={x(lang, "placeholder")} className="input flex-1 font-mono uppercase" />
          <button className="btn-ghost btn-sm">{x(lang, "check")}</button>
        </form>
        <p className="mt-2 text-[11px] text-text-tertiary">{x(lang, "manual")}</p>
      </section>

      <section className="space-y-3">
        {result ? (
          <div className={`rounded-xl border p-4 ${tone}`}>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">
              {result.status === "ok" ? x(lang, "ok") : result.status === "dup" ? x(lang, "dup") : x(lang, "bad")}
            </p>
            {result.ok || result.attendee ? (
              <>
                <p className="mt-1.5 font-serif text-[20px] leading-tight text-text-primary">{result.attendee}</p>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  {result.event}
                  {result.faculty ? ` · ${result.faculty}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-text-tertiary">
                  <span>{x(lang, "code")}: {result.code}</span>
                  {result.at && <span>{x(lang, "time")}: {result.at}</span>}
                </div>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-text-primary">{result.error ?? x(lang, "bad")}</p>
            )}
            {result.code && !result.ok && result.attendee && (
              <p className="mt-2 text-[11.5px] text-text-tertiary">
                {x(lang, "code")}: <span className="font-mono">{result.code}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="card p-4">
            <p className="text-[12.5px] leading-relaxed text-text-tertiary">{x(lang, "hint")}</p>
            <p className="mt-2 font-mono text-[11px] text-text-tertiary">{today}</p>
          </div>
        )}

        {log.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-text-tertiary">{x(lang, "recent")}</p>
              <button type="button" onClick={() => { setLog([]); setResult(null); }} className="text-[11px] font-semibold text-text-tertiary hover:text-text-primary">
                {x(lang, "clear")}
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {log.map((row, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-text-primary">{row.attendee ?? row.error}</span>
                  <span
                    className={`shrink-0 font-mono text-[10.5px] font-bold uppercase ${
                      row.ok ? "text-emerald-700" : row.status === "dup" ? "text-amber-700" : "text-rose-700"
                    }`}
                  >
                    {row.ok ? "OK" : row.status === "dup" ? "USED" : "FAIL"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
