import { redirect } from "next/navigation";
import { createHousehold } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { SubmitButton } from "@/components/submit-button";
import { getI18n } from "@/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function WelcomePage() {
  const { t } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { count } = await supabase
    .from("household_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (count) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.welcome.title}</h1>
        <LanguageSwitch />
      </div>
      <form action={createHousehold} className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.welcome.createTitle}</h2>
        <div>
          <label className="label" htmlFor="name">{t.welcome.householdName}</label>
          <input className="input" id="name" name="name" required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="display_name">{t.welcome.yourName}</label>
          <input className="input" id="display_name" name="display_name" required maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="reference_currency">{t.welcome.referenceCurrency}</label>
          <select className="input" id="reference_currency" name="reference_currency" defaultValue="TND">
            <option value="TND">TND</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <SubmitButton>{t.welcome.create}</SubmitButton>
      </form>
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold">{t.welcome.joinTitle}</h2>
        <p className="text-sm text-muted">{t.welcome.joinHint}</p>
      </div>
    </main>
  );
}
