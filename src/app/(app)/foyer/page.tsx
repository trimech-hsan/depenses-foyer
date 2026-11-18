import { headers } from "next/headers";
import { addAccount, createInvitation, saveExchangeRate } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { format, getI18n } from "@/i18n";
import { todayIso } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import { CURRENCIES, type Account } from "@/lib/types";

export default async function HouseholdPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { t } = await getI18n();
  const { supabase, household, members } = await requireHousehold();
  const { invitation } = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const others = CURRENCIES.filter((c) => c !== household.reference_currency);

  const [{ data: accounts }, { data: rates }] = await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", household.id).eq("archived", false).order("created_at"),
    supabase.from("exchange_rates").select("*").eq("household_id", household.id).order("valid_from", { ascending: false }).limit(5),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.household.title}</h2>

      <section className="card flex flex-col gap-3">
        <h3 className="font-semibold">{t.household.members}</h3>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.user_id} className="rounded-full bg-accent/10 px-3 py-1 text-sm">{m.display_name}</li>
          ))}
        </ul>
        {invitation ? (
          <div className="text-sm">
            <p className="mb-1 text-muted">{t.household.inviteHint}</p>
            <code className="block break-all rounded-lg bg-background p-2" dir="ltr">{`${origin}/rejoindre/${invitation}`}</code>
          </div>
        ) : (
          members.length < 2 && (
            <form action={createInvitation}>
              <SubmitButton>{t.household.invite}</SubmitButton>
            </form>
          )
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="font-semibold">{t.household.accounts}</h3>
        <ul className="divide-y divide-border">
          {((accounts ?? []) as Account[]).map((a) => (
            <li key={a.id} className="flex justify-between py-2 text-sm">
              <span>{a.name}</span>
              <span className="text-muted">{t.household.kinds[a.kind]} · {a.currency}</span>
            </li>
          ))}
        </ul>
        <form action={addAccount} className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input className="input" name="name" placeholder={t.household.accountName} aria-label={t.household.accountName} required maxLength={60} />
          <select className="input" name="kind" aria-label={t.categories.kind}>
            {(["bank", "cash", "card", "savings"] as const).map((k) => <option key={k} value={k}>{t.household.kinds[k]}</option>)}
          </select>
          <select className="input" name="currency" aria-label={t.tx.currency} defaultValue={household.reference_currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="col-span-3"><SubmitButton>{t.household.addAccount}</SubmitButton></div>
        </form>
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="font-semibold">{t.household.rates}</h3>
        {others.map((c) => (
          <form key={c} action={saveExchangeRate} className="grid grid-cols-2 gap-2">
            <p className="col-span-2 text-sm text-muted">{format(t.household.ratesHint, { currency: c, reference: household.reference_currency })}</p>
            <input type="hidden" name="currency" value={c} />
            <input className="input tabular-nums" name="rate" inputMode="decimal" placeholder="3,400" aria-label={t.household.rate} required dir="ltr" />
            <input className="input" name="valid_from" type="date" defaultValue={todayIso()} aria-label={t.household.validFrom} required />
            <div className="col-span-2"><SubmitButton>{t.household.saveRate}</SubmitButton></div>
          </form>
        ))}
        {(rates ?? []).length > 0 && (
          <ul className="text-sm text-muted" dir="ltr">
            {(rates ?? []).map((r) => (
              <li key={`${r.currency}-${r.valid_from}`}>1 {r.currency} = {r.rate} {household.reference_currency} · {r.valid_from}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
