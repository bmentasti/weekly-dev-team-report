// i18n — helpers server-side. Resuelve el locale desde la cookie y, si no hay,
// autodetecta desde Accept-Language del navegador.
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { DICTIONARIES, translate } from "./dictionaries";

export function getLocale(): Locale {
  const cookieLang = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLang)) return cookieLang;
  const accept = headers().get("accept-language")?.toLowerCase() ?? "";
  if (accept.startsWith("en") || accept.includes(",en")) return "en";
  return DEFAULT_LOCALE;
}

/** Devuelve el locale + función t() para usar en Server Components. */
export function getT(): { locale: Locale; t: (key: string) => string } {
  const locale = getLocale();
  const dict = DICTIONARIES[locale];
  return { locale, t: (key: string) => translate(dict, key) };
}
