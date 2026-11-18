import { cookies } from "next/headers";
import { ar } from "./ar";
import { fr, type Dictionary } from "./fr";

export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "locale";

const dictionaries: Record<Locale, Dictionary> = { fr, ar };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "fr";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale), dir: dirOf(locale) };
}

/** Remplace les {clés} d'un message. */
export function format(message: string, values: Record<string, string>): string {
  return message.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}
