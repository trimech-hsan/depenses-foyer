import { addTransaction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getI18n } from "@/i18n";
import { todayIso } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import { categoryName } from "@/lib/money";
import { CURRENCIES, type Account, type Category } from "@/lib/types";

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { t, locale } = await getI18n();
  const { supabase, household, members, user } = await requireHousehold();
  const { erreur } = await searchParams;
  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase.from("categories").select("*").eq("household_id", household.id).eq("archived", false).order("name_fr"),
    supabase.from("accounts").select("*").eq("household_id", household.id).eq("archived", false).order("created_at"),
  ]);
  const cats = (categories ?? []) as Category[];

  return (
    <form action={addTransaction} className="card mx-auto flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.tx.newTitle}</h2>

      <fieldset className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center justify-center rounded-lg border border-border py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
            <input type="radio" name="kind" value={k} defaultChecked={k === "expense"} className="sr-only" />
            {k === "expense" ? t.tx.expense : t.tx.incomeKind}
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label className="label" htmlFor="amount">{t.tx.amount}</label>
          <input className="input text-xl tabular-nums" id="amount" name="amount" inputMode="decimal" autoFocus required dir="ltr" placeholder="0,000" />
        </div>
        <div>
          <label className="label" htmlFor="currency">{t.tx.currency}</label>
          <select className="input" id="currency" name="currency" defaultValue={household.reference_currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {erreur && <p className="text-sm text-danger">{t.common.required}</p>}

      <div>
        <label className="label" htmlFor="category_id">{t.tx.category}</label>
        <select className="input" id="category_id" name="category_id">
          <optgroup label={t.tx.expense}>
            {cats.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{categoryName(c, locale)}</option>)}
          </optgroup>
          <optgroup label={t.tx.incomeKind}>
            {cats.filter((c) => c.kind === "income").map((c) => <option key={c.id} value={c.id}>{categoryName(c, locale)}</option>)}
          </optgroup>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="occurred_on">{t.tx.date}</label>
          <input className="input" id="occurred_on" name="occurred_on" type="date" defaultValue={todayIso()} required />
        </div>
        <div>
          <label className="label" htmlFor="paid_by">{t.tx.paidBy}</label>
          <select className="input" id="paid_by" name="paid_by" defaultValue={user.id}>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="account_id">{t.tx.account}</label>
        <select className="input" id="account_id" name="account_id">
          <option value="">{t.tx.none}</option>
          {((accounts ?? []) as Account[]).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="note">{t.tx.note}</label>
        <input className="input" id="note" name="note" maxLength={500} />
      </div>

      <div>
        <label className="label" htmlFor="visibility">{t.tx.visibility}</label>
        <select className="input" id="visibility" name="visibility" defaultValue="shared">
          <option value="shared">{t.tx.shared}</option>
          <option value="personal">{t.tx.personal}</option>
        </select>
      </div>

      <SubmitButton>{t.tx.save}</SubmitButton>
    </form>
  );
}
