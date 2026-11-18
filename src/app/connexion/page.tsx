import { signIn, signUp } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { getI18n } from "@/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; verifier?: string; next?: string }>;
}) {
  const { t } = await getI18n();
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.appName}</h1>
        <LanguageSwitch />
      </div>
      <p className="text-muted">{t.auth.subtitle}</p>
      {params.erreur && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{t.auth.error}</p>}
      {params.verifier && <p className="rounded-lg bg-accent/10 p-3 text-sm">{t.auth.checkEmail}</p>}
      <form className="card flex flex-col gap-4">
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required dir="ltr" />
        </div>
        <button formAction={signIn} className="btn">{t.auth.signIn}</button>
        <button formAction={signUp} className="btn-ghost">{t.auth.signUp}</button>
      </form>
    </main>
  );
}
