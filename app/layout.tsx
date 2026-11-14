import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";
import { getLang, getTheme } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: tr(lang, "Kampus — talabalar platformasi"),
    description: tr(
      lang,
      "Universitet tadbirlari, klublar, loyihalar va jamoa boshqaruvi — bitta joyda. UDEA talabalari uchun.",
    ),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, theme] = await Promise.all([getLang(), getTheme()]);

  return (
    <html
      lang={lang}
      data-theme={theme}
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-canvas text-text-primary antialiased">{children}</body>
    </html>
  );
}
