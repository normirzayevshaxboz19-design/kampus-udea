import { cookies } from "next/headers";
import { isLang, tr, tpl, type Lang } from "./i18n";

export const LANG_COOKIE = "lang";
export const THEME_COOKIE = "theme";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return isLang(value) ? value : "uz";
}

export async function getTheme(): Promise<"light" | "dark"> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}

export async function getT() {
  const lang = await getLang();
  return {
    lang,
    t: (text: string) => tr(lang, text),
    tpl: (text: string, vars: Record<string, string | number>) => tpl(lang, text, vars),
  };
}
