"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { LangMenu } from "@/components/Controls";

type Haptic = {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
};

type TgWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; last_name?: string; username?: string };
  };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  viewportStableHeight?: number;
  ready: () => void;
  expand: () => void;
  close?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
  disableVerticalSwipes?: () => void;
  HapticFeedback?: Haptic;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

/** Joriy muhit Telegram Mini App ichidami? */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  const app = window.Telegram?.WebApp;
  return Boolean(app && (app.initData || app.initDataUnsafe?.user));
}

/**
 * Telegram ichidagi tugmalar uchun taktil javob.
 * Brauzerda hech narsa qilmaydi — chaqirish xavfsiz.
 */
export function tgHaptic(kind: "tap" | "select" | "success" | "error" = "tap") {
  if (typeof window === "undefined") return;
  const h = window.Telegram?.WebApp?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === "select") h.selectionChanged();
    else if (kind === "success") h.notificationOccurred("success");
    else if (kind === "error") h.notificationOccurred("error");
    else h.impactOccurred("light");
  } catch {
    /* Telegram eski versiyalari jim o'tkaziladi */
  }
}

const LABELS: Record<Lang, { mode: string; close: string; back: string }> = {
  uz: { mode: "Mini App rejimi", close: "Yopish", back: "Orqaga" },
  ru: { mode: "Режим Mini App", close: "Закрыть", back: "Назад" },
  en: { mode: "Mini App mode", close: "Close", back: "Back" },
};

/**
 * Pulse sahifasini Telegram Mini App sifatida ishlatish uchun qatlam.
 *
 * Telegram WebApp topilsa:
 *  - `data-tma="1"` o'rnatiladi (sayt sarlavhasi va pastki nav CSS orqali yashiriladi);
 *  - Mini App kengaytiriladi, sarlavha/fon ranglari Telegram mavzusiga moslanadi;
 *  - Telegram "Back" tugmasi sahifa ichida ishlaydi;
 *  - sahifa ustida ixcham Mini App paneli ko'rsatiladi.
 * Brauzerda komponent hech narsa render qilmaydi.
 */
export function TelegramMiniApp({ lang, userName }: { lang: Lang; userName: string }) {
  const [app, setApp] = useState<TgWebApp | null>(null);
  const labels = LABELS[lang] ?? LABELS.uz;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !(tg.initData || tg.initDataUnsafe?.user)) return;

    setApp(tg);
    document.documentElement.setAttribute("data-tma", "1");

    try {
      tg.ready();
      tg.expand();
      tg.disableVerticalSwipes?.();
    } catch {
      /* eski Telegram — muhim emas */
    }

    // Telegram mavzusini sayt mavzusiga ko'chirish
    const applyTheme = () => {
      const scheme = tg.colorScheme === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", scheme);
      document.documentElement.style.setProperty(
        "--tg-viewport-height",
        `${tg.viewportStableHeight ?? window.innerHeight}px`
      );
      const canvas = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg-canvas")
        .trim();
      if (canvas) {
        tg.setHeaderColor?.(canvas);
        tg.setBackgroundColor?.(canvas);
      }
    };
    applyTheme();
    try {
      tg.onEvent?.("themeChanged", applyTheme);
    } catch {
      /* eski mijoz */
    }

    const onBack = () => {
      tgHaptic("tap");
      if (window.history.length > 1) window.history.back();
      else window.scrollTo({ top: 0, behavior: "smooth" });
    };
    try {
      tg.BackButton?.show();
      tg.BackButton?.onClick(onBack);
    } catch {
      /* BackButton ba'zi mijozlarda yo'q */
    }

    return () => {
      document.documentElement.removeAttribute("data-tma");
      try {
        tg.offEvent?.("themeChanged", applyTheme);
        tg.BackButton?.offClick(onBack);
        tg.BackButton?.hide();
      } catch {
        /* jim */
      }
    };
  }, []);

  if (!app) return null;

  const firstName = app.initDataUnsafe?.user?.first_name ?? userName.split(" ")[0] ?? "";

  return (
    <div className="tma-chrome">
      <span className="tma-chip" aria-hidden="true">
        TG
      </span>
      <span className="tma-title">
        UDEA · Pulse
        <span className="tma-sep">/</span>
        <span className="tma-mode">{labels.mode}</span>
      </span>
      {firstName && <span className="tma-user">{firstName}</span>}
      <LangMenu lang={lang} />
      <button
        type="button"
        className="tma-close"
        onClick={() => {
          tgHaptic("tap");
          if (app.close) app.close();
          else window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        {labels.close}
      </button>
    </div>
  );
}
