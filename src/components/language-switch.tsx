import { setLocale } from "@/app/actions";
import { getI18n } from "@/i18n";

export async function LanguageSwitch() {
  const { locale, t } = await getI18n();
  const other = locale === "fr" ? "ar" : "fr";
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={other} />
      <button type="submit" className="btn-ghost" aria-label={t.language.label}>
        {t.language[other]}
      </button>
    </form>
  );
}
