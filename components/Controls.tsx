"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGS, tr, type Lang } from "@/lib/i18n";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}

export function LangMenu({ lang, tone = "light" }: { lang: Lang; tone?: "light" | "dark" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const current = LANGS.find((l) => l.key === lang) ?? LANGS[0];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tr(lang, "Til")}
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-2xl px-1.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
          tone === "dark" ? "text-text-tertiary hover:text-text-primary" : "text-text-tertiary hover:text-text-primary"
        }`}
      >
        {current.short}
        <svg width="7" height="5" viewBox="0 0 7 5" aria-hidden="true" className="opacity-60">
          <path d="M0 0h7L3.5 5z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-50 mt-1 min-w-[132px] border border-strong bg-card py-1 shadow-sm">
          {LANGS.map((l) => (
            <li key={l.key}>
              <button
                type="button"
                onClick={() => {
                  setCookie("lang", l.key);
                  setOpen(false);
                  router.refresh();
                }}
                className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[12.5px] ${
                  l.key === lang ? "font-semibold text-text-primary" : "text-text-secondary hover:bg-elevated"
                }`}
              >
                <span>{l.label}</span>
                <span className="font-mono text-[10px] uppercase text-text-tertiary">{l.short}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ThemeToggle({ lang, theme }: { lang: Lang; theme: "light" | "dark" }) {
  const [dark, setDark] = useState(theme === "dark");

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggle = () => {
    const next = document.documentElement.getAttribute("data-theme") !== "dark";
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    setCookie("theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={tr(lang, dark ? "Yorug' rejim" : "Qorong'i rejim")}
      title={tr(lang, dark ? "Yorug' rejim" : "Qorong'i rejim")}
      className="flex h-6 w-6 items-center justify-center rounded-2xl bg-subtle text-text-secondary hover:text-text-primary"
    >
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.2">
            <path d="M8 .8v1.9M8 13.3v1.9M.8 8h1.9M13.3 8h1.9M2.9 2.9l1.3 1.3M11.8 11.8l1.3 1.3M13.1 2.9l-1.3 1.3M4.2 11.8l-1.3 1.3" />
          </g>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M13.6 10.2A6.1 6.1 0 0 1 5.8 2.4a6.2 6.2 0 1 0 7.8 7.8z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}

export function Preferences({
  lang,
  theme,
}: {
  lang: Lang;
  theme: "light" | "dark";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <LangMenu lang={lang} />
      <span aria-hidden="true" className="text-hairline">
        /
      </span>
      <ThemeToggle lang={lang} theme={theme} />
    </div>
  );
}
